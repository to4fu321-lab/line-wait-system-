'use client'

// ============================================================================
//  お直し受付モーダル（再構築版）
//  フロー: お客様 → 服種 > 項目 > オプション → 価格/見積もり → 受付写真 → 保存
//  価格 = 基本料金(項目) + Σオプション加算。特殊ケースはマニュアル表示。
//  マスタにない特殊対応は「個別見積もり(manual)」で金額自由入力・未定受付も可。
// ============================================================================

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Loader2, ChevronLeft, ChevronRight, User, Check, X, Search, Camera, AlertTriangle, Plus, Printer, Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RepairType } from '@/types/crm'
import {
  PRICE_UNIT_LABELS, PRICING_MODE_LABELS, REPAIR_PHOTOS_BUCKET, toFieldDefs,
  type RepairGarmentType, type RepairItem, type RepairOption,
  type PricingMode, type SelectedOptionSnapshot, type RepairManual, type FieldDef,
} from '@/types/repair'
import { calcLinePrice, needsQuote, toOptionSnapshot, addBusinessDays } from '@/lib/repairPricing'
import { RepairIcon } from '@/lib/garmentIcons'
import { useRepairProfile } from '@/lib/useRepairProfile'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { isSessionExpiredError } from '@/lib/staffSessionClient'
import type { CustResult } from './types'

// 材料候補（商品マスタから引く。ガット・グリップ等）
interface MaterialProduct {
  id:                string
  name:              string
  group_name:        string | null
  color_code:        string | null
  maker:             string | null
  base_price_tax_in: number | null
  stock:             number | null
  category:          string | null
}
import { CustomerLinkSheet } from './CustomerLinkSheet'
import { RecentCustomers, type RecentCust } from '../../_components/RecentCustomers'
import { OcrCaptureButton, type OcrResult } from '../../_components/OcrCaptureButton'
import { RepairPrintModal, type PrintableRepair } from './RepairPrintSlip'
import { fmtReqNo } from './utils'
import { getLiffId } from '@/lib/line-config'

// item.code → 既存 repair_type 列へのマッピング（互換表示用）
const REPAIR_TYPE_CODES: RepairType[] = ['hem', 'sleeve', 'waist', 'embroidery', 'button', 'tear', 'badge', 'size_exchange', 'other']
// measurements.key → 既存の代表カラム
const LEGACY_MEAS: Record<string, 'hem_length_mm' | 'sleeve_adjust_mm' | 'waist_adjust_mm'> = {
  hem_length_mm: 'hem_length_mm', sleeve_adjust_mm: 'sleeve_adjust_mm', waist_adjust_mm: 'waist_adjust_mm',
}

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

export function NewRepairModal({ storeId, storeName = '', onClose, onSave, onToast }: {
  storeId: string; storeName?: string; onClose: () => void; onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
  showOcr?: boolean
}) {
  type Step = 'customer' | 'build' | 'done'
  const [step, setStep] = useState<Step>('customer')
  const [buildStep, setBuildStep] = useState(0) // build内サブステップ index
  const [linkSheetOpen, setLinkSheetOpen] = useState(false) // 顧客インライン紐付け
  const { hasFeature } = useStoreFeatures(storeId)
  // 業種プロファイル（「服種/項目/採寸」などの語彙を店舗設定で差し替える）
  const { labels } = useRepairProfile(storeId)
  const smsEnabled = hasFeature('sms_notify')

  // ── 顧客 ──────────────────────────────────────────────────
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<CustResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCust, setSelectedCust] = useState<CustResult | null>(null)
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string; school_name: string | null } | null>(null)
  // 顧客の新規登録（シンプルモード同様: いつでも・電話番号/LINEでOK）
  const [phoneMode, setPhoneMode] = useState(false)
  const [showReg, setShowReg] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTel, setNewTel] = useState('')
  const [registering, setRegistering] = useState(false)

  const handlePhoneRegister = async () => {
    const tel = newTel.trim()
    const digits = tel.replace(/[-\s]/g, '')
    if (!newName.trim()) { onToast('err', 'お名前を入力してください'); return }
    if (!/^\d{10,11}$/.test(digits)) { onToast('err', '電話番号は10〜11桁で入力してください'); return }
    setRegistering(true)
    // 既存を電話番号で検索 → 無ければ作成（create-or-link）
    const sel = 'id, name, tel, school_name, children:children(id, name, school_name)'
    const { data: rows } = await (supabase as any).from('customers')
      .select(sel).eq('store_id', storeId).eq('tel', tel).is('deleted_at', null).limit(1)
    let cust: CustResult | undefined = rows?.[0]
    if (!cust) {
      const { data: c, error } = await (supabase as any).from('customers')
        .insert({ store_id: storeId, name: newName.trim(), tel }).select(sel).single()
      if (error) {
        setRegistering(false)
        if (isSessionExpiredError(error)) {
          onToast('err', 'ログインの有効期限が切れました。3秒後に管理画面トップへ移動します。PINを再入力してください。')
          setTimeout(() => { window.location.href = `/${storeId}/admin` }, 3000)
          return
        }
        onToast('err', error.message ?? '登録に失敗しました'); return
      }
      cust = c as CustResult
    }
    setSelectedCust(cust!); setSelectedChild(null)
    setPhoneMode(false); setNewName(''); setNewTel(''); setRegistering(false)
  }

  useEffect(() => {
    if (custSearch.trim().length < 1) { setCustResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const q = custSearch.trim(); const qTel = q.replace(/[-\s]/g, '')
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId)
        .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q}%,tel.ilike.%${qTel}%,school_name.ilike.%${q}%`)
        .is('deleted_at', null).limit(8)
      setCustResults(data ?? []); setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch, storeId])

  // ── マスタ ──────────────────────────────────────────────────
  const [garments, setGarments] = useState<RepairGarmentType[]>([])
  const [items, setItems] = useState<RepairItem[]>([])
  const [options, setOptions] = useState<RepairOption[]>([])
  const [garmentId, setGarmentId] = useState<string | null>(null)
  const [item, setItem] = useState<RepairItem | null>(null)
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  // OCRでマスタの項目に完全一致した直後は、garmentId変更に伴う item リセットを1回だけ抑止する
  const suppressItemResetRef = useRef(false)

  useEffect(() => {
    ;(supabase as any).from('repair_vendors')
      .select('id, name').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: { data: { id: string; name: string }[] | null }) => setVendors(data ?? []))
  }, [storeId])

  useEffect(() => {
    ;(supabase as any).from('repair_garment_types')
      .select('*').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: { data: RepairGarmentType[] | null }) => {
        setGarments(data ?? []); setGarmentId(data?.[0]?.id ?? null)
      })
  }, [storeId])

  useEffect(() => {
    if (!garmentId) { setItems([]); return }
    ;(supabase as any).from('repair_items')
      .select('*').eq('garment_type_id', garmentId).eq('active', true).order('sort_order')
      .then(({ data }: { data: RepairItem[] | null }) => setItems(data ?? []))
    if (suppressItemResetRef.current) suppressItemResetRef.current = false
    else setItem(null)
  }, [garmentId])

  // ── 項目選択 ────────────────────────────────────────────────
  const [optSel, setOptSel] = useState<Record<string, boolean>>({})
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [qty, setQty] = useState(1)
  const [pricingMode, setPricingMode] = useState<PricingMode>('master')
  const [overridePrice, setOverridePrice] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [manualItemName, setManualItemName] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [manualConfirmed, setManualConfirmed] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState('')
  const [memo, setMemo] = useState('')
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [saving, setSaving] = useState(false)

  // ── 1人が複数点持ち込んだ場合、続けて登録できるようにする ──────────
  const [savedItems, setSavedItems] = useState<string[]>([])
  // 受付完了後の印刷・連絡（このセッションで登録した全点分）
  const [printQueue, setPrintQueue] = useState<PrintableRepair[]>([])
  const [showPrint,  setShowPrint]  = useState(false)
  const [notifying,  setNotifying]  = useState(false)

  // 過去実績写真（項目選択時に取得）
  const [refPhotos,  setRefPhotos]  = useState<{ url: string; completed_date: string | null }[]>([])
  const [refLoading, setRefLoading] = useState(false)
  const [refOpen,    setRefOpen]    = useState(false)

  // 直近登録の顧客をワンタップ選択
  const pickRecent = (c: RecentCust, child: { id: string; name: string; school_name: string | null } | null) => {
    setSelectedCust({ id: c.id, name: c.name, tel: c.tel, school_name: c.school_name ?? null, children: c.children })
    setSelectedChild(child)
    setShowReg(false); setPhoneMode(false)
  }

  // OCR読み取り結果を受付フォームへ反映
  // 「納期・メモ」欄は服種・項目を選んだ後のステップにしか表示されないため、
  // ここで反映した内容をトーストに明記して「反映されていない」誤解を防ぐ。
  // 何も読み取れなかった場合も、誤って成功扱いにしない。
  const handleOcr = async (r: OcrResult) => {
    const applied: string[] = []
    if (r.desiredDate) { setDeadline(r.desiredDate); applied.push(`納期:${r.desiredDate}`) }
    if (r.items.length > 0) {
      setMemo(prev => [prev, r.items.join(' / ')].filter(Boolean).join(' / '))
      applied.push(`内容:${r.items.join('/')}`)
    }

    // お直し項目の自動選択：マスタの項目名と完全一致した場合のみ（誤選択による誤課金を避けるため）
    // 一致しなければ金額はOCR読み取り値を手入力欄にセットするだけに留める
    let itemMatched = false
    if (!item) {
      for (const text of r.items) {
        const needle = text.trim()
        if (!needle) continue
        const { data: matched } = await (supabase as any).from('repair_items')
          .select('*').eq('store_id', storeId).eq('active', true).eq('name', needle).limit(1)
        const mi = matched?.[0] as RepairItem | undefined
        if (mi) {
          suppressItemResetRef.current = true
          setGarmentId(mi.garment_type_id)
          setItem(mi)
          setPricingMode('master')
          applied.push(`項目:${mi.name}（マスタ一致）`)
          itemMatched = true
          break
        }
      }
    }
    if (!itemMatched && r.price != null) {
      setPricingMode('manual')
      setOverridePrice(String(r.price))
      applied.push(`金額:¥${r.price.toLocaleString()}`)
    }

    // 顧客：電話番号でDB検索 → ヒットすれば紐付け（ハイフン有無の表記差を吸収）
    if (r.tel) {
      const telDigits = r.tel.replace(/[^0-9]/g, '')
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId).is('deleted_at', null)
        .or(`tel.eq.${r.tel},tel.eq.${telDigits}`).limit(1)
      if (data?.[0]) {
        setSelectedCust(data[0]); setSelectedChild(null)
        onToast('ok', `📷 ${data[0].name}様を読み取りました（${applied.join('・') || '登録済み情報を確認'}）`)
        return
      }
    }
    // 未登録 → 名前・電話を入力欄に流し込み、電話番号登録を開く
    if (r.name && !/\d/.test(r.name)) { setNewName(r.name); applied.push(`氏名:${r.name}`) }
    if (r.tel) { setNewTel(r.tel); applied.push(`電話:${r.tel}`) }
    if (r.name || r.tel) { setShowReg(true); setPhoneMode(true); setStep('customer') }

    if (applied.length === 0) {
      onToast('err', '📷 内容を読み取れませんでした。手入力してください')
      return
    }
    onToast('ok', `📷 読み取りました（${applied.join('・')}）。「納期・メモ」ステップ等でご確認ください`)
  }

  async function fetchRefPhotos(it: RepairItem) {
    setRefPhotos([]); setRefOpen(false); setRefLoading(true)
    let { data: repairs } = await (supabase as any)
      .from('repair_histories')
      .select('id, completed_date')
      .eq('store_id', storeId)
      .eq('item_id', it.id)
      .in('status', ['completed', 'delivered'])
      .order('completed_date', { ascending: false })
      .limit(20)
    // item_id未設定のデータへフォールバック（item_code で検索）
    if (!repairs?.length && it.code && it.code !== 'other') {
      const { data: fb } = await (supabase as any)
        .from('repair_histories')
        .select('id, completed_date')
        .eq('store_id', storeId)
        .eq('item_code', it.code)
        .in('status', ['completed', 'delivered'])
        .order('completed_date', { ascending: false })
        .limit(20)
      repairs = fb
    }
    if (!repairs?.length) { setRefLoading(false); return }
    const ids = (repairs as any[]).map(r => r.id as string)
    const dateMap = new Map<string, string | null>((repairs as any[]).map(r => [r.id, r.completed_date]))
    const { data: ps } = await (supabase as any)
      .from('repair_photos')
      .select('url, repair_id')
      .in('repair_id', ids)
      .eq('phase', 'after')
      .order('created_at', { ascending: false })
      .limit(15)
    setRefPhotos((ps ?? []).map((p: any) => ({ url: p.url, completed_date: dateMap.get(p.repair_id) ?? null })))
    setRefLoading(false)
  }

  const selectItem = useCallback(async (it: RepairItem) => {
    setItem(it)
    setPricingMode(it.requires_quote ? 'manual' : 'master')
    setOverridePrice(''); setManualReason(''); setManualConfirmed(false)
    setManualItemName(it.code === 'other' ? '' : it.name); setManualContent('')
    setQty(1)
    // マスタが既定値を持つ入力は先に埋めておく（ポンド数24など。現場は変更だけで済む）
    const defs: Record<string, string> = {}
    for (const f of toFieldDefs(it.fields, it.measurements)) {
      if (f.default !== undefined && f.default !== null && f.default !== false) {
        defs[f.key] = String(f.default)
      }
    }
    setInputs(defs)
    const { data } = await (supabase as any).from('repair_options')
      .select('*').eq('item_id', it.id).eq('active', true).order('sort_order')
    const opts = (data ?? []) as RepairOption[]
    setOptions(opts)
    // 初期選択
    const init: Record<string, boolean> = {}
    opts.forEach(o => { if (o.default_selected) init[o.id] = true })
    setOptSel(init)
    // 過去実績写真を非同期取得
    fetchRefPhotos(it)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  // single グループは1つだけ選択に矯正
  const toggleOption = (o: RepairOption) => {
    setOptSel(prev => {
      const next = { ...prev }
      if (o.group_label && o.group_select === 'single') {
        options.filter(x => x.group_label === o.group_label && x.group_select === 'single')
          .forEach(x => { next[x.id] = false })
        next[o.id] = true
      } else {
        next[o.id] = !next[o.id]
      }
      return next
    })
  }

  const selectedOptions = useMemo(() => options.filter(o => optSel[o.id]), [options, optSel])
  const snapshots: SelectedOptionSnapshot[] = useMemo(() => selectedOptions.map(toOptionSnapshot), [selectedOptions])

  // qty は「同じ内容の点数」= 作成する行数。価格は常に1点あたりで計算する
  const calculated = useMemo(() => {
    if (!item) return 0
    return calcLinePrice({ item, options: snapshots, inputs, qty: 1 })
  }, [item, snapshots, inputs])

  const mustQuote = useMemo(() => item ? needsQuote(item, selectedOptions) : false, [item, selectedOptions])

  // 表示中に出すべきマニュアル（項目＋選択オプション）
  const manuals: RepairManual[] = useMemo(() => {
    const list: RepairManual[] = []
    if (item?.manual) list.push(item.manual)
    selectedOptions.forEach(o => { if (o.manual) list.push(o.manual) })
    return list
  }, [item, selectedOptions])
  const hasDanger = manuals.some(m => m.severity === 'danger')

  // 最終価格
  const finalPrice: number | null = useMemo(() => {
    if (pricingMode === 'master') return calculated
    const n = Number(overridePrice)
    return overridePrice.trim() === '' || Number.isNaN(n) ? null : n
  }, [pricingMode, calculated, overridePrice])

  const pubUrl = (path: string) => supabase.storage.from(REPAIR_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl

  function buildContent(): string {
    if (pricingMode === 'manual' && item?.code === 'other') return manualContent || manualItemName || '特殊対応'
    if (!item) return manualContent
    const parts: string[] = [item.name]
    const optNames = selectedOptions.map(o => o.name)
    if (optNames.length) parts.push(`（${optNames.join('・')}）`)
    // 入力の要約（bool は ON のときだけラベルを出す）
    const meas = toFieldDefs(item.fields, item.measurements)
      .filter(f => inputs[f.key] !== undefined && inputs[f.key] !== '')
      .map(f => (f.type ?? 'text') === 'bool' ? f.label : `${f.label}${inputs[f.key]}${f.unit ?? ''}`)
    if (meas.length) parts.push(meas.join(' '))
    return parts.join(' ').trim()
  }

  // 服種・項目選択に戻り、次の1点を続けて登録できるようにビルド状態をリセット
  // （顧客紐付けはそのまま維持。加工業者/納期/メモは項目ごとに異なりうるため初期化）
  function resetForNextItem() {
    setGarmentId(garments[0]?.id ?? null)
    setItem(null)
    setOptSel({}); setInputs({}); setQty(1)
    setPricingMode('master'); setOverridePrice(''); setManualReason('')
    setManualItemName(''); setManualContent(''); setManualConfirmed(false)
    setDeadline(''); setVendorId(null); setVendorName('')
    setMemo(''); setPhotos([])
    setBuildStep(0)
  }

  async function handleSave(closeAfter: boolean) {
    if (!item) return
    if (!selectedCust) { onToast('err', 'お客様を紐付けてください（上部の「顧客」から登録できます）'); setStep('customer'); return }
    if (hasDanger && !manualConfirmed) { onToast('err', '特殊ケースの確認にチェックしてください'); return }
    if (pricingMode === 'manual' && item.code === 'other' && !manualItemName.trim()) { onToast('err', '内容（品名）を入力してください'); return }
    if (pricingMode !== 'master' && finalPrice == null && !mustQuote) { /* 価格未入力でも見積もり対象なら可 */ }
    setSaving(true)

    const repairTypeCode = (REPAIR_TYPE_CODES as string[]).includes(item.code) ? item.code : 'other'
    const quote_status = finalPrice == null ? 'pending' : 'fixed'
    const itemName = pricingMode === 'manual' && item.code === 'other'
      ? (manualItemName.trim() || '特殊対応')
      : item.name
    const garmentName = garments.find(g => g.id === item.garment_type_id)?.name ?? ''
    const content = buildContent()

    // qty は「同じ内容の点数」= 何行(＝何点の物理的な服)作るか。価格は1点あたり(finalPrice)を各行に設定する
    const payload: Record<string, unknown> = {
      store_id: storeId, customer_id: selectedCust.id, child_id: selectedChild?.id ?? null,
      item_name: itemName, content,
      request_type: finalPrice == null ? 'repair_consult' : 'repair',
      repair_type: repairTypeCode,
      status: 'received', received_date: new Date().toISOString().slice(0, 10),
      desired_completion_date: deadline || defaultDeadline(),
      price: finalPrice, final_price: finalPrice,
      prepaid: false, notified: false, work_started: false,
      internal_memo: memo || null,
      vendor_id: vendorId || null,
      vendor_name: vendorName || null,
      // ▼ 新マスタ連携
      garment_type_id: item.garment_type_id, item_id: item.id, item_code: item.code,
      garment_name: garmentName,
      base_price: item.base_price, calculated_price: calculated,
      pricing_mode: pricingMode, quote_status,
      manual_reason: pricingMode === 'master' ? null : (manualReason || null),
      selected_options: snapshots, inputs,
    }
    // 既存カラムへ採寸の代表値を反映（カード/編集画面の互換）
    for (const f of toFieldDefs(item.fields, item.measurements)) {
      const col = LEGACY_MEAS[f.key]
      if (col && inputs[f.key] != null && inputs[f.key] !== '') payload[col] = Number(inputs[f.key])
    }
    if (inputs.text) payload.embroidery_text = inputs.text

    const insertedRows: { id: string; request_no: number | null }[] = []
    for (let n = 0; n < qty; n++) {
      const { data: inserted, error } = await (supabase as any)
        .from('repair_histories').insert(payload).select('id, request_no').single()
      if (error || !inserted) {
        if (n === 0) {
          setSaving(false)
          if (isSessionExpiredError(error)) {
            onToast('err', 'ログインの有効期限が切れました。3秒後に管理画面トップへ移動します。PINを再入力してください。')
            setTimeout(() => { window.location.href = `/${storeId}/admin` }, 3000)
            return
          }
          onToast('err', `保存失敗: ${error?.message ?? ''}`); return
        }
        console.error('[NewRepairModal] 数量分割保存の途中でエラー:', error)
        break
      }
      insertedRows.push(inserted)
    }

    // 受付写真アップロード（1回だけstorageへ上げて、作成した全行に同じ写真を紐付ける）
    if (photos.length) {
      const uploaded: { path: string; url: string }[] = []
      for (let i = 0; i < photos.length; i++) {
        const f = photos[i].file
        const ext = f.name.split('.').pop() || 'jpg'
        const path = `repairs/${storeId}/${insertedRows[0].id}/intake_${Date.now()}_${i}.${ext}`
        const up = await supabase.storage.from(REPAIR_PHOTOS_BUCKET).upload(path, f, { upsert: true })
        if (!up.error) uploaded.push({ path, url: pubUrl(path) })
      }
      if (uploaded.length) {
        const photoRows = insertedRows.flatMap(r => uploaded.map(u => ({
          store_id: storeId, repair_id: r.id, phase: 'intake', path: u.path, url: u.url,
        })))
        await (supabase as any).from('repair_photos').insert(photoRows)
      }
    }

    setSaving(false)
    const label = qty > 1 ? `${garmentName} ${itemName} ×${insertedRows.length}` : `${garmentName} ${itemName}`.trim()
    const printables: PrintableRepair[] = insertedRows.map(r => ({
      reqNo: fmtReqNo('repair', r.request_no ?? null, r.id),
      garmentName, itemName, content,
      schoolName: selectedChild?.school_name ?? selectedCust!.school_name ?? null,
      childName: selectedChild?.name ?? null,
      customerName: selectedCust!.name,
      receivedDate: payload.received_date as string,
      desiredDate: (payload.desired_completion_date as string | null) ?? null,
      vendorName: vendorName || null,
      memo: memo || null,
      hemLengthMm: (payload.hem_length_mm as number | undefined) ?? null,
      sleeveAdjustMm: (payload.sleeve_adjust_mm as number | undefined) ?? null,
      waistAdjustMm: (payload.waist_adjust_mm as number | undefined) ?? null,
      embroideryText: (payload.embroidery_text as string | undefined) ?? null,
      embroideryColor: null,
      embroideryPos: null,
    }))
    setPrintQueue(prev => [...prev, ...printables])
    onSave() // 都度リストを更新（保存済み分をすぐ反映）

    if (closeAfter) {
      const total = savedItems.length + insertedRows.length
      onToast('ok', total > 1 ? `✂️ ${total}${labels.unit_count}の${labels.domain}を受付しました` : (finalPrice == null ? '✂️ 見積もり待ちで受付しました' : `✂️ ${labels.domain}を受付しました`))
      setStep('done')
    } else {
      setSavedItems(prev => [...prev, label])
      onToast('ok', `✂️ ${label} を登録しました。続けて次の項目を選択してください`)
      resetForNextItem()
    }
  }

  // 受付内容をLINE/SMSでお客様へ連絡（このセッションで登録した全点をまとめて1通で送る）
  async function handleNotifyReceived() {
    if (!selectedCust || printQueue.length === 0) return
    setNotifying(true)
    const { data: cust } = await (supabase as any).from('customers')
      .select('line_user_id, tel').eq('id', selectedCust.id).single()
    const lineUserId = cust?.line_user_id ?? null
    const tel        = cust?.tel ?? null
    if (!lineUserId && !(tel && smsEnabled)) {
      setNotifying(false)
      onToast('err', lineUserId === null && tel && !smsEnabled
        ? 'SMS通知はアドオン未契約のため送信できません（LINE未連携のお客様です）'
        : '連絡先（LINE連携・電話番号）が見つかりません')
      return
    }
    const itemNames = printQueue.map(p => `${p.garmentName} ${p.itemName}`.trim()).join('、')
    const reqNos = printQueue.map(p => p.reqNo).join('、')
    try {
      const res = await fetch('/api/notify-repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repairId: 'multi', kind: 'received',
          lineUserId, tel, customerName: selectedCust.name,
          itemName: itemNames, storeName, reqNo: reqNos,
          desiredDate: printQueue[0]?.desiredDate ?? undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) { onToast('err', `連絡に失敗しました: ${(json as any).error ?? '不明なエラー'}`); return }
      onToast('ok', json.channel === 'line' ? '📱 LINEで受付内容を連絡しました' : json.channel === 'sms' ? '📱 SMSで受付内容を連絡しました' : '連絡先が未設定のため送信できませんでした')
    } catch (e) {
      onToast('err', `連絡エラー: ${String(e)}`)
    } finally {
      setNotifying(false)
    }
  }

  function defaultDeadline(): string | null {
    if (item?.lead_time_days == null) return null
    return addBusinessDays(new Date(), item.lead_time_days).toISOString().slice(0, 10)
  }

  // ── 入力フィールド（FieldDef 駆動）──────────────────────────
  //  制服の採寸(mm)は従来どおり±5mmボタン。ラケットのポンド数のように
  //  min/max/step を持つ数値は範囲内で±する。type はマスタ側が決める。
  const renderField = (f: FieldDef) => {
    const type     = f.type ?? 'text'
    const val      = inputs[f.key] ?? ''
    const required = !!f.required
    const head = (
      <label className="text-xs font-bold text-gray-600 block mb-1">
        {f.label}{required && <span className="text-red-500">*</span>}
      </label>
    )
    const hint = f.hint
      ? <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>
      : null

    if (type === 'number') {
      const isMm  = f.unit === 'mm'
      const step  = f.step ?? (isMm ? 5 : 1)
      const n     = val === '' ? (typeof f.default === 'number' ? f.default : 0) : Number(val) || 0
      // min/max があればその範囲に丸める（適正ポンド数を外れた受付を防ぐ）
      const clamp = (v: number) =>
        Math.min(f.max ?? Number.POSITIVE_INFINITY, Math.max(f.min ?? Number.NEGATIVE_INFINITY, v))
      const set = (v: number) => setInputs({ ...inputs, [f.key]: String(clamp(v)) })
      return (
        <div key={f.key}>
          {head}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
            <button type="button" onClick={() => set(n - step)} className="w-10 h-10 rounded-lg bg-white border font-black text-lg">−</button>
            <div className="flex-1 text-center font-black text-2xl text-gray-800">
              {isMm && n > 0 ? '+' : ''}{n}{f.unit && <span className="text-sm ml-0.5">{f.unit}</span>}
            </div>
            <button type="button" onClick={() => set(n + step)} className="w-10 h-10 rounded-lg bg-white border font-black text-lg">＋</button>
          </div>
          {hint}
        </div>
      )
    }

    if (type === 'bool') {
      // inputs は Record<string,string>。bool は 'true' 文字列で保持する
      const on = val === 'true' || val === '1'
      return (
        <div key={f.key}>
          <button
            type="button"
            onClick={() => setInputs({ ...inputs, [f.key]: on ? '' : 'true' })}
            className={`w-full flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
              on ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
            }`}
          >
            <span className="text-sm font-bold text-gray-800">
              {f.label}{required && <span className="text-red-500">*</span>}
            </span>
            <span className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition ${on ? 'bg-indigo-500' : 'bg-gray-300'}`}>
              <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
            </span>
          </button>
          {hint}
        </div>
      )
    }

    if (type === 'select') {
      const choices = f.choices ?? []
      return (
        <div key={f.key}>
          {head}
          <div className="grid grid-cols-2 gap-2">
            {choices.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setInputs({ ...inputs, [f.key]: c.value })}
                className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
                  val === c.value ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'
                }`}
              >{c.label}</button>
            ))}
          </div>
          {hint}
        </div>
      )
    }

    if (type === 'material') {
      const cat    = f.material_category ?? ''
      const groups = materialGroups(cat)
      // 銘柄の選択状態は inputs に持たせる（`_g` サフィックス）
      const gKey   = `${f.key}_g`
      const picked = String(inputs[gKey] ?? '')
      const colors = groups.find(([g]) => g === picked)?.[1] ?? []

      if (groups.length === 0) {
        // 商品マスタ未登録。受付を止めないよう自由入力に落とす。
        return (
          <div key={f.key}>
            {head}
            <input className={INPUT} value={String(val)}
              onChange={e => setInputs({ ...inputs, [f.key]: e.target.value })}
              placeholder="商品マスタ未登録のため手入力" />
            <p className="text-[11px] text-amber-600 mt-1">
              商品マスタに「{cat}」の商品がありません。マスタに登録するとタップで選べます。
            </p>
          </div>
        )
      }

      return (
        <div key={f.key}>
          {head}
          {/* ① 銘柄 */}
          <div className="grid grid-cols-2 gap-2">
            {groups.map(([g, rows]) => (
              <button key={g} type="button"
                onClick={() => {
                  // 色が1つしかない銘柄はその場で確定させる（タップ数を減らす）
                  const next = { ...inputs, [gKey]: g }
                  if (rows.length === 1) {
                    next[f.key] = rows[0].name
                    next[`${f.key}_id`] = rows[0].id
                  } else {
                    next[f.key] = ''
                    delete next[`${f.key}_id`]
                  }
                  setInputs(next)
                }}
                className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold text-left transition ${
                  picked === g ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'
                }`}>
                <span className="block truncate">{g}</span>
                {rows[0]?.maker && <span className="block text-[10px] font-normal text-gray-400 truncate">{rows[0].maker}</span>}
              </button>
            ))}
          </div>

          {/* ② 色（銘柄を選んで2つ以上あるときだけ） */}
          {picked && colors.length > 1 && (
            <div className="mt-2">
              <p className="text-[11px] font-black text-gray-400 mb-1.5">色を選ぶ</p>
              <div className="grid grid-cols-3 gap-2">
                {colors.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setInputs({ ...inputs, [f.key]: c.name, [`${f.key}_id`]: c.id })}
                    className={`rounded-xl border-2 px-2 py-2 text-xs font-bold transition ${
                      inputs[`${f.key}_id`] === c.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'
                    }`}>
                    <span className="block truncate">{c.color_code || c.name}</span>
                    {c.stock != null && (
                      <span className={`block text-[10px] font-normal ${c.stock > 0 ? 'text-gray-400' : 'text-red-500'}`}>
                        残{c.stock}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {val && <p className="text-xs font-bold text-indigo-700 mt-2">選択中: {String(val)}</p>}
          {hint}
        </div>
      )
    }

    return (
      <div key={f.key}>
        {head}
        <input
          className={INPUT}
          value={String(val)}
          onChange={e => setInputs({ ...inputs, [f.key]: e.target.value })}
          placeholder={f.unit || ''}
        />
        {hint}
      </div>
    )
  }

  // マスタが定義した入力（fields 優先・無ければ旧 measurements）
  const itemFields = useMemo(
    () => toFieldDefs(item?.fields, item?.measurements),
    [item],
  )

  // ── 材料（糸・グリップ等）の候補を商品マスタから取る ──────────
  //  ガットは「銘柄×色」でSKUが分かれるので、group_name でまとめて
  //  〈銘柄を選ぶ → 色を選ぶ〉の2段タップにする。
  const [materials, setMaterials] = useState<MaterialProduct[]>([])
  const materialCats = useMemo(
    () => Array.from(new Set(
      itemFields.filter(f => f.type === 'material').map(f => f.material_category ?? ''),
    )).filter(Boolean),
    [itemFields],
  )

  useEffect(() => {
    if (materialCats.length === 0) { setMaterials([]); return }
    let cancelled = false
    ;(async () => {
      const { data } = await (supabase as any).from('products')
        .select('id, name, group_name, color_code, maker, base_price_tax_in, stock, category')
        .eq('store_id', storeId).in('category', materialCats).eq('active', true)
        .order('group_name').order('sort_order')
      if (!cancelled) setMaterials((data ?? []) as MaterialProduct[])
    })()
    return () => { cancelled = true }
  }, [materialCats, storeId])

  // 銘柄（group_name。未設定の商品は自分の名前を銘柄として単独で並べる）
  const materialGroups = useCallback((category: string) => {
    const rows = materials.filter(m => m.category === category)
    const map = new Map<string, MaterialProduct[]>()
    for (const r of rows) {
      const k = r.group_name?.trim() || r.name
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return Array.from(map.entries())
  }, [materials])

  // 必須未入力があれば次へ進ませない
  const missingRequired = useMemo(
    () => itemFields.some(f => f.required && (inputs[f.key] === undefined || inputs[f.key] === '')),
    [itemFields, inputs],
  )

  // 選択オプションをグループ表示
  const groupedOptions = useMemo(() => {
    const map = new Map<string, RepairOption[]>()
    options.forEach(o => {
      const k = o.group_label ?? `__single_${o.id}`
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(o)
    })
    return Array.from(map.entries())
  }, [options])

  // ── build サブステップ（該当が無い段は自動スキップ）─────────────
  const buildStepDefs = useMemo(() => {
    const defs: { key: string; label: string }[] = [
      { key: 'garment', label: labels.garment },
      { key: 'item',    label: labels.item },
    ]
    if (item && (itemFields.length > 0 || manuals.length > 0)) defs.push({ key: 'measure', label: labels.measurement })
    if (item && groupedOptions.length > 0) defs.push({ key: 'options', label: labels.option })
    if (item) {
      defs.push({ key: 'price',   label: '価格' })
      defs.push({ key: 'photo',   label: '写真' })
      defs.push({ key: 'memo',    label: '納期・メモ' })
      defs.push({ key: 'confirm', label: '確認' })
    }
    return defs
  }, [item, manuals, groupedOptions, itemFields, labels])

  const curBuildIdx = Math.min(buildStep, buildStepDefs.length - 1)
  const curBuildKey = buildStepDefs[curBuildIdx]?.key ?? 'garment'
  const isLastBuild = curBuildKey === 'confirm'

  const canNextBuild = (() => {
    if (curBuildKey === 'garment') return !!garmentId
    if (curBuildKey === 'item')    return !!item
    if (curBuildKey === 'measure') return !(hasDanger && !manualConfirmed) && !missingRequired
    return true
  })()

  const goBackBuild = () => { if (curBuildIdx <= 0) setStep('customer'); else setBuildStep(curBuildIdx - 1) }
  const goNextBuild = () => { if (canNextBuild && curBuildIdx < buildStepDefs.length - 1) setBuildStep(curBuildIdx + 1) }

  // Step info for progress bar and header
  const currentStepNum = step === 'customer' ? 0 : curBuildIdx + 1
  const totalSteps = 1 + buildStepDefs.length
  const stepLabel = step === 'customer' ? '顧客' : (buildStepDefs[curBuildIdx]?.label ?? '')

  // ── 受付完了 → 印刷・連絡 ──────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 text-center"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <Check size={32} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-black text-gray-800">受付が完了しました</p>
            <p className="text-sm text-gray-500 mt-1">{printQueue.length}点登録：{printQueue.map(p => `${p.garmentName} ${p.itemName}`.trim()).join('、')}</p>
          </div>
          <div className="space-y-2 pt-2">
            <button onClick={() => setShowPrint(true)}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-base font-black flex items-center justify-center gap-2 active:scale-[0.98]">
              <Printer size={18} />受付内容を印刷する
            </button>
            <button onClick={handleNotifyReceived} disabled={notifying}
              className="w-full py-4 rounded-2xl border-2 border-indigo-300 text-indigo-600 text-base font-black flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
              {notifying ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}LINE・SMSで連絡する
            </button>
            <button onClick={onClose}
              className="w-full py-3.5 rounded-2xl text-gray-500 text-sm font-bold active:scale-[0.98]">
              閉じる
            </button>
          </div>
        </div>
        {showPrint && <RepairPrintModal items={printQueue} storeName={storeName} domainLabel={labels.domain} onClose={() => setShowPrint(false)} />}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[95dvh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {step === 'build' && (
              <button onClick={goBackBuild}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors active:scale-95">
                <ChevronLeft size={22} className="text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-black text-gray-800">✂️ {labels.domain}受付</h2>
              <p className="text-sm text-gray-400">
                {stepLabel}　{currentStepNum + 1} / {totalSteps}
                {savedItems.length > 0 && <span className="ml-1.5 text-indigo-500 font-bold">・登録済み{savedItems.length}点</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'build' && (
              <button onClick={() => setLinkSheetOpen(true)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border max-w-[36%] truncate ${
                  selectedCust ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-amber-50 border-amber-300 text-amber-700'
                }`}>
                {selectedCust ? `👤 ${selectedChild?.name ?? selectedCust.name}` : '＋顧客を紐付け'}
              </button>
            )}
            <OcrCaptureButton onResult={handleOcr} onError={m => onToast('err', m)} />
            <button onClick={onClose} className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              <X size={22} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="h-2 bg-gray-100 shrink-0">
          <div className="h-full bg-amber-500 transition-all duration-300 rounded-full"
            style={{ width: `${((currentStepNum + 1) / totalSteps) * 100}%` }} />
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 py-6">

          {/* ── 顧客選択 ── */}
          {step === 'customer' && (
            <div>
              <p className="text-xl font-black text-gray-800 mb-1">どなたの{labels.domain}ですか？</p>
              <p className="text-sm text-gray-500 mb-5">お名前・電話番号・学校で検索できます</p>

              {selectedCust ? (
                <div className="space-y-3">
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl px-4 py-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <User size={22} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-lg text-gray-900">{selectedCust.name}</p>
                      {selectedCust.tel && <p className="text-xs text-gray-500 mt-0.5">{selectedCust.tel}</p>}
                    </div>
                    <button onClick={() => { setSelectedCust(null); setSelectedChild(null) }} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={18} /></button>
                  </div>
                  {selectedCust.children && selectedCust.children.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-2">お子様（任意）</label>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedChild(null)} className={`px-3 py-2 rounded-xl text-sm font-bold border-2 ${!selectedChild ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>選択しない</button>
                        {selectedCust.children.map(ch => (
                          <button key={ch.id} onClick={() => setSelectedChild(ch)} className={`px-3 py-2 rounded-xl text-sm font-bold border-2 ${selectedChild?.id === ch.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>{ch.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input autoFocus
                      className="w-full border-2 border-gray-200 rounded-2xl pl-11 pr-4 py-4 text-lg focus:border-indigo-400 focus:outline-none"
                      placeholder="お名前・電話・学校で検索"
                      value={custSearch} onChange={e => setCustSearch(e.target.value)} />
                    {searching && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-300" />}
                  </div>
                  <RecentCustomers storeId={storeId} visible={custSearch.trim() === '' && !showReg} withChildren onPick={pickRecent} />
                  <div className="space-y-2">
                    {custResults.map(c => (
                      (c.children && c.children.length > 0) ? (
                        c.children.map(ch => (
                          <button key={ch.id} onClick={() => { setSelectedCust(c); setSelectedChild(ch) }}
                            className="w-full text-left bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 hover:border-indigo-300 active:scale-[0.98] transition-all">
                            {ch.school_name && <p className="text-[11px] font-black text-amber-600 leading-none mb-0.5">{ch.school_name}</p>}
                            <p className="font-bold text-gray-900">{ch.name}</p>
                            <p className="text-xs text-gray-400">保護者: {c.name}{c.tel ? ` / ${c.tel}` : ''}</p>
                          </button>
                        ))
                      ) : (
                        <button key={c.id} onClick={() => { setSelectedCust(c); setSelectedChild(null) }}
                          className="w-full text-left bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 hover:border-indigo-300 active:scale-[0.98] transition-all">
                          <p className="font-bold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-400">{[c.tel, c.school_name].filter(Boolean).join(' / ')}</p>
                        </button>
                      )
                    ))}
                    {custSearch && !searching && custResults.length === 0 && (
                      <p className="text-center text-sm text-gray-400 py-4">該当なし。新規登録できます。</p>
                    )}
                  </div>

                  {/* 新規顧客を登録 */}
                  {!showReg ? (
                    <button onClick={() => { setShowReg(true); if (!newName && custSearch && !/\d/.test(custSearch)) setNewName(custSearch.trim()) }}
                      className="w-full py-4 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 font-bold flex items-center justify-center gap-2">
                      ➕ 新規顧客を登録する
                    </button>
                  ) : (
                    <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                      {phoneMode ? (
                        <div className="space-y-2">
                          <p className="text-sm font-black text-indigo-800">電話番号で登録・紐付け</p>
                          <input className={INPUT} placeholder="お名前" value={newName} onChange={e => setNewName(e.target.value)} />
                          <input className={INPUT} type="tel" inputMode="numeric" placeholder="電話番号（携帯可）" value={newTel} onChange={e => setNewTel(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={() => { setPhoneMode(false); setNewTel('') }} className="flex-1 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-bold">戻る</button>
                            <button onClick={handlePhoneRegister} disabled={registering} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
                              {registering ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}登録して選択
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPhoneMode(true)} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2">
                          📞 電話番号で登録する
                        </button>
                      )}
                      <div className="border-t border-indigo-200 pt-3 text-center space-y-2">
                        <p className="text-xs font-black text-indigo-800">またはLINEで登録（QRを読み取ってもらう）</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`https://liff.line.me/${getLiffId('uniform')}/${storeId}`)}`}
                          alt="受付QR" width={180} height={180}
                          className="mx-auto rounded-xl bg-white p-1 shadow-sm"
                        />
                        <p className="text-[10px] text-indigo-500 leading-relaxed">LINE登録後、上の検索欄でお名前を検索してください</p>
                      </div>
                      <button onClick={() => { setShowReg(false); setPhoneMode(false); setNewTel('') }}
                        className="w-full py-2 text-sm font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-white">閉じる</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── お直し内容（build steps） ── */}
          {step === 'build' && (
            <div>
              {savedItems.length > 0 && (
                <div className="mb-4 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2.5">
                  <p className="text-xs font-black text-indigo-700">✅ 登録済み {savedItems.length}点</p>
                  <p className="text-[11px] text-indigo-500 mt-0.5">{savedItems.join('、')}</p>
                </div>
              )}
              {/* 服種 */}
              {curBuildKey === 'garment' && (
                <div>
                  <p className="text-xl font-black text-gray-800 mb-1">{labels.garment}を選んでください</p>
                  <p className="text-sm text-gray-500 mb-5">お預かりするものの種類です</p>
                  <div className="grid grid-cols-2 gap-3">
                    {garments.map(g => (
                      <button key={g.id} onClick={() => setGarmentId(g.id)}
                        className={`flex flex-col items-center justify-center gap-2 py-7 rounded-2xl border-2 active:scale-95 transition-all ${
                          garmentId === g.id ? 'bg-amber-50 border-amber-400' : 'bg-white border-gray-200'
                        }`}>
                        <span className="text-3xl leading-none"><RepairIcon icon={g.icon} /></span>
                        <span className="text-base font-black text-gray-800">{g.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 項目 */}
              {curBuildKey === 'item' && (
                <div>
                  <p className="text-xl font-black text-gray-800 mb-1">{labels.item}を選んでください</p>
                  <p className="text-sm text-gray-500 mb-5">項目をタップして選んでください</p>
                  <div className="grid grid-cols-2 gap-3">
                    {items.map(it => (
                      <button key={it.id} onClick={() => selectItem(it)}
                        className={`text-left p-4 rounded-2xl border-2 active:scale-95 transition-all ${
                          item?.id === it.id ? 'bg-amber-50 border-amber-400' : 'bg-white border-gray-200'
                        }`}>
                        <p className="font-bold text-gray-900 flex items-center gap-1.5"><RepairIcon icon={it.icon} /> {it.name}</p>
                        <p className="text-amber-600 font-black mt-1">{it.requires_quote ? '見積もり' : `¥${it.base_price.toLocaleString()}`}</p>
                      </button>
                    ))}
                    {items.length === 0 && <p className="col-span-2 text-center text-sm text-gray-400 py-6">この{labels.garment}の{labels.item}がありません</p>}
                  </div>
                  <RefPhotoStrip photos={refPhotos} loading={refLoading} open={refOpen} onToggle={() => setRefOpen(v => !v)} />
                </div>
              )}

              {item && (
                <>
                  {/* 採寸・特殊ケース */}
                  {curBuildKey === 'measure' && (
                    <div>
                      <p className="text-xl font-black text-gray-800 mb-1">{labels.measurement}・注意事項</p>
                      <p className="text-sm text-gray-500 mb-5">内容を確認して入力してください</p>
                      <div className="space-y-4">
                        {manuals.map((m, i) => (
                          <div key={i} className={`rounded-2xl p-4 border-2 ${m.severity === 'danger' ? 'bg-red-50 border-red-300' : m.severity === 'warn' ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-200'}`}>
                            <p className="font-black flex items-center gap-2 text-gray-800 mb-2">
                              <AlertTriangle size={16} className={m.severity === 'danger' ? 'text-red-500' : 'text-amber-500'} />{m.title}
                            </p>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{m.body}</p>
                            {m.images.length > 0 && (
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {m.images.map((img, j) => <img key={j} src={pubUrl(img.path)} alt="" className="w-20 h-20 object-cover rounded-xl border" />)}
                              </div>
                            )}
                          </div>
                        ))}
                        {hasDanger && (
                          <label className="flex items-center gap-3 text-base font-bold text-red-600 bg-red-50 rounded-2xl px-4 py-3">
                            <input type="checkbox" checked={manualConfirmed} onChange={e => setManualConfirmed(e.target.checked)} className="w-5 h-5" />内容を確認しました
                          </label>
                        )}
                        {itemFields.length > 0 && (
                          <div>
                            <p className="text-sm font-black text-gray-500 mb-3">{labels.measurement}・入力</p>
                            <div className="space-y-3">{itemFields.map(renderField)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* オプション */}
                  {curBuildKey === 'options' && (
                    <div>
                      <p className="text-xl font-black text-gray-800 mb-1">オプションは？</p>
                      <p className="text-sm text-gray-500 mb-5">追加オプションを選んでください（任意）</p>
                      <div className="space-y-4">
                        {groupedOptions.map(([gl, opts]) => (
                          <div key={gl}>
                            {!gl.startsWith('__single_') && (
                              <p className="text-sm font-bold text-gray-500 mb-2">{gl}{opts[0].group_select === 'single' ? '（択一）' : ''}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {opts.map(o => (
                                <button key={o.id} onClick={() => toggleOption(o)}
                                  className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                    optSel[o.id] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-700'
                                  }`}>
                                  {o.name}{o.price_delta !== 0 && <span className="ml-1 opacity-80">{o.price_delta > 0 ? '+' : ''}{o.price_delta}</span>}{o.requires_quote && '※'}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 価格 */}
                  {curBuildKey === 'price' && (
                    <div>
                      <p className="text-xl font-black text-gray-800 mb-1">金額の確認</p>
                      <p className="text-sm text-gray-500 mb-5">変更が必要な場合は価格モードを切り替えてください</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                          <div>
                            <p className="text-sm font-black text-indigo-800">数量（同じ内容の点数）</p>
                            <p className="text-[11px] text-indigo-400">同じ加工が複数点ある場合、まとめて登録・印刷できます</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                              className="w-9 h-9 rounded-xl bg-white border-2 border-indigo-300 text-indigo-600 font-black text-lg flex items-center justify-center active:scale-90">－</button>
                            <span className="text-2xl font-black text-indigo-800 w-8 text-center tabular-nums">{qty}</span>
                            <button type="button" onClick={() => setQty(q => Math.min(20, q + 1))}
                              className="w-9 h-9 rounded-xl bg-white border-2 border-indigo-300 text-indigo-600 font-black text-lg flex items-center justify-center active:scale-90">＋</button>
                          </div>
                        </div>
                        {pricingMode === 'manual' && item.code === 'other' && (
                          <div className="space-y-2 bg-rose-50 border-2 border-rose-200 rounded-2xl p-4">
                            <p className="text-sm font-black text-rose-600">個別見積もり（マスタにない特殊対応）</p>
                            <input className={INPUT} placeholder="品名（例: 学ラン 襟交換）" value={manualItemName} onChange={e => setManualItemName(e.target.value)} />
                            <textarea className={INPUT} rows={2} placeholder="内容・メモ" value={manualContent} onChange={e => setManualContent(e.target.value)} />
                          </div>
                        )}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-500">基本 ¥{item.base_price.toLocaleString()}（{PRICE_UNIT_LABELS[item.price_unit]}）{qty > 1 ? '／1点' : ''}</span>
                            <span className="text-3xl font-black text-amber-600">
                              {pricingMode === 'master' ? `¥${calculated.toLocaleString()}` : (finalPrice != null ? `¥${finalPrice.toLocaleString()}` : '見積もり待ち')}
                            </span>
                          </div>
                          {qty > 1 && (pricingMode === 'master' ? calculated : finalPrice) != null && (
                            <p className="text-right text-xs text-gray-400">× {qty}点　＝　合計 ¥{(((pricingMode === 'master' ? calculated : finalPrice) ?? 0) * qty).toLocaleString()}</p>
                          )}
                          <div className="flex gap-2">
                            {(['master', 'adjusted', 'manual'] as PricingMode[]).map(pm => (
                              <button key={pm} onClick={() => setPricingMode(pm)}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${
                                  pricingMode === pm ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'
                                }`}>{PRICING_MODE_LABELS[pm]}</button>
                            ))}
                          </div>
                          {pricingMode !== 'master' && (
                            <div className="space-y-2">
                              <input type="number" className={INPUT} placeholder={mustQuote ? '金額（未定なら空欄＝見積もり待ち）' : '金額を入力'} value={overridePrice} onChange={e => setOverridePrice(e.target.value)} />
                              <input className={INPUT} placeholder="理由（例: 常連割引 / 難物加算）" value={manualReason} onChange={e => setManualReason(e.target.value)} />
                            </div>
                          )}
                          {mustQuote && pricingMode === 'master' && (
                            <p className="text-xs text-rose-500 font-bold">※要見積もり項目です。金額確定後に「価格調整/個別見積もり」で入力してください</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 写真 */}
                  {curBuildKey === 'photo' && (
                    <div>
                      <p className="text-xl font-black text-gray-800 mb-1">受付写真（任意）</p>
                      <p className="text-sm text-gray-500 mb-5">状態の記録として撮影できます。不要ならそのまま「次へ」。</p>
                      <div className="flex flex-wrap gap-3">
                        {photos.map((p, i) => (
                          <div key={i} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt="" className="w-20 h-20 object-cover rounded-2xl border-2 border-gray-200" />
                            <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12} /></button>
                          </div>
                        ))}
                        <label className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer text-gray-400 gap-1">
                          <Camera size={22} />
                          <span className="text-[10px] font-bold">撮影</span>
                          <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) setPhotos([...photos, { file: f, url: URL.createObjectURL(f) }]) }} />
                        </label>
                      </div>
                      <RefPhotoStrip photos={refPhotos} loading={refLoading} open={refOpen} onToggle={() => setRefOpen(v => !v)} />
                    </div>
                  )}

                  {/* 納期・外注・メモ */}
                  {curBuildKey === 'memo' && (
                    <div>
                      <p className="text-xl font-black text-gray-800 mb-1">仕上がり日・メモ</p>
                      <p className="text-sm text-gray-500 mb-5">希望日と外注先・メモを入力してください</p>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1.5">仕上がり希望日</label>
                            <input type="date" className={INPUT} value={deadline} onChange={e => setDeadline(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1.5">加工業者（外注先・任意）</label>
                            <input className={INPUT} value={vendorName} onChange={e => { setVendorName(e.target.value); setVendorId(null) }} placeholder={vendors.length > 0 ? '下から選択／内製は空欄' : '内製なら空欄'} />
                          </div>
                        </div>
                        {vendors.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => { setVendorName(''); setVendorId(null) }}
                              className={`px-3 py-2 rounded-full text-sm font-bold border-2 ${vendorName === '' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white border-gray-200 text-gray-600'}`}>内製</button>
                            {vendors.map(v => (
                              <button type="button" key={v.id} onClick={() => { setVendorName(v.name); setVendorId(v.id) }}
                                className={`px-3 py-2 rounded-full text-sm font-bold border-2 ${vendorId === v.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-200 text-gray-700'}`}>{v.name}</button>
                            ))}
                          </div>
                        )}
                        <textarea className={INPUT} rows={3} placeholder="社内メモ（任意）" value={memo} onChange={e => setMemo(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {/* 確認 */}
                  {curBuildKey === 'confirm' && (
                    <div>
                      <p className="text-xl font-black text-gray-800 mb-1">内容を確認してください</p>
                      <p className="text-sm text-gray-500 mb-5">同じ方の持込がまだあれば「続けてもう1点」から追加できます</p>
                      <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                        {[
                          { label: 'お客様', value: selectedCust ? `${selectedCust.name}${selectedChild ? ` / ${selectedChild.name}` : ''}` : '未紐付け（後で登録できます）' },
                          { label: `${labels.garment}・${labels.item}`, value: `${garments.find(g => g.id === garmentId)?.name ?? ''} / ${item.name}` },
                          ...(qty > 1 ? [{ label: '数量', value: `${qty}点（1点ずつ登録・印刷されます）` }] : []),
                          { label: '金額', value: (() => {
                            const perUnit = pricingMode === 'master' ? calculated : finalPrice
                            if (perUnit == null) return '見積もり待ち'
                            return qty > 1 ? `¥${perUnit.toLocaleString()}／点　合計 ¥${(perUnit * qty).toLocaleString()}` : `¥${perUnit.toLocaleString()}`
                          })() },
                          ...(deadline ? [{ label: '仕上がり希望', value: deadline }] : []),
                          ...(vendorName ? [{ label: '外注先', value: vendorName }] : []),
                          ...(memo ? [{ label: 'メモ', value: memo }] : []),
                        ].map(({ label, value }) => (
                          <div key={label} className="flex flex-col gap-1 border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                            <p className="text-lg font-bold text-gray-800 leading-relaxed break-words">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          {step === 'customer' ? (
            selectedCust ? (
              <button onClick={() => setStep('build')}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-black transition-colors active:scale-[0.98] flex items-center justify-center gap-2">
                <Check size={22} />{labels.item}へ進む
              </button>
            ) : (
              <button onClick={() => setStep('build')}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-4 rounded-2xl border-2 border-gray-300 text-gray-500 font-bold transition-colors active:scale-[0.98]">
                顧客は後で紐付け → 次へ
              </button>
            )
          ) : isLastBuild ? (
            <div className="space-y-2">
              <button onClick={() => handleSave(true)} disabled={saving}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white text-xl font-black disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
                {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
                {savedItems.length > 0 || qty > 1 ? `受付する（合計${savedItems.length + qty}点）` : '受付する'}
              </button>
              <button onClick={() => handleSave(false)} disabled={saving}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl border-2 border-indigo-300 text-indigo-600 text-sm font-black disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.98]">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                この内容を登録して、続けてもう1点受け付ける
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={goBackBuild}
                style={{ touchAction: 'manipulation' }}
                className="flex-1 py-5 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 font-black active:scale-[0.98]">
                戻る
              </button>
              <button onClick={goNextBuild} disabled={!canNextBuild}
                style={{ touchAction: 'manipulation' }}
                className="flex-[2] py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-black disabled:opacity-40 active:scale-[0.98]">
                次へ →
              </button>
            </div>
          )}
        </div>
      </div>

      {linkSheetOpen && (
        <CustomerLinkSheet
          storeId={storeId}
          selectedCust={selectedCust}
          selectedChild={selectedChild}
          onSelect={(c, ch) => { setSelectedCust(c); setSelectedChild(ch) }}
          onClear={() => { setSelectedCust(null); setSelectedChild(null) }}
          onClose={() => setLinkSheetOpen(false)}
        />
      )}
    </div>
  )
}

function RefPhotoStrip({ photos, loading, open, onToggle }: {
  photos: { url: string; completed_date: string | null }[]
  loading: boolean
  open: boolean
  onToggle: () => void
}) {
  if (loading) return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-2">
      <Loader2 size={11} className="animate-spin" />過去実績を読み込み中...
    </div>
  )
  if (!photos.length) return null
  return (
    <div className="mt-2.5">
      <button type="button" onClick={onToggle}
        className="flex items-center gap-1 text-[11px] font-bold text-indigo-500 active:opacity-70">
        <Camera size={11} />過去の完了写真（{photos.length}件）
        <ChevronRight size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <div key={i} className="shrink-0 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-20 h-20 object-cover rounded-xl border-2 border-emerald-300" />
              {p.completed_date && (
                <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] py-0.5 rounded-b-xl bg-emerald-700/80 text-white font-bold">
                  {p.completed_date.slice(0, 7)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
