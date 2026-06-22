'use client'

// ============================================================================
//  お直し受付モーダル（再構築版）
//  フロー: お客様 → 服種 > 項目 > オプション → 価格/見積もり → 受付写真 → 保存
//  価格 = 基本料金(項目) + Σオプション加算。特殊ケースはマニュアル表示。
//  マスタにない特殊対応は「個別見積もり(manual)」で金額自由入力・未定受付も可。
// ============================================================================

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Loader2, ChevronLeft, User, Check, X, Search, Camera, AlertTriangle, Scissors,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RepairType } from '@/types/crm'
import {
  PRICE_UNIT_LABELS, PRICING_MODE_LABELS, REPAIR_PHOTOS_BUCKET,
  type RepairGarmentType, type RepairItem, type RepairOption,
  type PricingMode, type SelectedOptionSnapshot, type RepairManual,
} from '@/types/repair'
import { calcLinePrice, needsQuote, toOptionSnapshot, addBusinessDays } from '@/lib/repairPricing'
import type { CustResult } from './types'
import { CustomerLinkSheet } from './CustomerLinkSheet'
import { RecentCustomers, type RecentCust } from '../../_components/RecentCustomers'
import { OcrCaptureButton, type OcrResult } from '../../_components/OcrCaptureButton'

// item.code → 既存 repair_type 列へのマッピング（互換表示用）
const REPAIR_TYPE_CODES: RepairType[] = ['hem', 'sleeve', 'waist', 'embroidery', 'button', 'tear', 'badge', 'size_exchange', 'other']
// measurements.key → 既存の代表カラム
const LEGACY_MEAS: Record<string, 'hem_length_mm' | 'sleeve_adjust_mm' | 'waist_adjust_mm'> = {
  hem_length_mm: 'hem_length_mm', sleeve_adjust_mm: 'sleeve_adjust_mm', waist_adjust_mm: 'waist_adjust_mm',
}

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

export function NewRepairModal({ storeId, onClose, onSave, onToast }: {
  storeId: string; onClose: () => void; onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
  showOcr?: boolean
}) {
  type Step = 'customer' | 'build'
  const [step, setStep] = useState<Step>('customer')
  const [buildStep, setBuildStep] = useState(0) // build内サブステップ index
  const [linkSheetOpen, setLinkSheetOpen] = useState(false) // 顧客インライン紐付け

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
      if (error) { setRegistering(false); onToast('err', error.message ?? '登録に失敗しました'); return }
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
    setItem(null)
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
  const [vendorName, setVendorName] = useState('')
  const [memo, setMemo] = useState('')
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [saving, setSaving] = useState(false)

  // 直近登録の顧客をワンタップ選択
  const pickRecent = (c: RecentCust, child: { id: string; name: string; school_name: string | null } | null) => {
    setSelectedCust({ id: c.id, name: c.name, tel: c.tel, school_name: c.school_name ?? null, children: c.children })
    setSelectedChild(child)
    setShowReg(false); setPhoneMode(false)
  }

  // OCR読み取り結果を受付フォームへ反映
  const handleOcr = async (r: OcrResult) => {
    // 希望納期・お直し内容（メモへ）を自動入力
    if (r.desiredDate) setDeadline(r.desiredDate)
    if (r.items.length > 0) setMemo(prev => [prev, r.items.join(' / ')].filter(Boolean).join(' / '))
    // 顧客：電話番号でDB検索 → ヒットすれば紐付け
    if (r.tel) {
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId).is('deleted_at', null).eq('tel', r.tel).limit(1)
      if (data?.[0]) {
        setSelectedCust(data[0]); setSelectedChild(null)
        onToast('ok', `📷 ${data[0].name}様を読み取りました`)
        return
      }
    }
    // 未登録 → 名前・電話を入力欄に流し込み、電話番号登録を開く
    if (r.name && !/\d/.test(r.name)) setNewName(r.name)
    if (r.tel) setNewTel(r.tel)
    if (r.name || r.tel) { setShowReg(true); setPhoneMode(true); setStep('customer') }
    onToast('ok', '📷 読み取りました。内容をご確認ください')
  }

  const selectItem = useCallback(async (it: RepairItem) => {
    setItem(it)
    setPricingMode(it.requires_quote ? 'manual' : 'master')
    setOverridePrice(''); setManualReason(''); setManualConfirmed(false)
    setManualItemName(it.code === 'other' ? '' : it.name); setManualContent('')
    setQty(1); setInputs({})
    const { data } = await (supabase as any).from('repair_options')
      .select('*').eq('item_id', it.id).eq('active', true).order('sort_order')
    const opts = (data ?? []) as RepairOption[]
    setOptions(opts)
    // 初期選択
    const init: Record<string, boolean> = {}
    opts.forEach(o => { if (o.default_selected) init[o.id] = true })
    setOptSel(init)
  }, [])

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

  const calculated = useMemo(() => {
    if (!item) return 0
    return calcLinePrice({ item, options: snapshots, inputs, qty })
  }, [item, snapshots, inputs, qty])

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
    // 採寸の要約
    const meas = (item.measurements ?? []).filter(m => inputs[m.key]).map(m => `${m.label}${inputs[m.key]}${m.unit}`)
    if (meas.length) parts.push(meas.join(' '))
    return parts.join(' ').trim()
  }

  async function handleSave() {
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

    const payload: Record<string, unknown> = {
      store_id: storeId, customer_id: selectedCust.id, child_id: selectedChild?.id ?? null,
      item_name: itemName, content: buildContent(),
      request_type: finalPrice == null ? 'repair_consult' : 'repair',
      repair_type: repairTypeCode,
      status: 'received', received_date: new Date().toISOString().slice(0, 10),
      desired_completion_date: deadline || defaultDeadline(),
      price: finalPrice, final_price: finalPrice,
      prepaid: false, notified: false, work_started: false,
      internal_memo: memo || null,
      vendor_name: vendorName || null,
      // ▼ 新マスタ連携
      garment_type_id: item.garment_type_id, item_id: item.id, item_code: item.code,
      garment_name: garments.find(g => g.id === item.garment_type_id)?.name ?? null,
      base_price: item.base_price, calculated_price: calculated,
      pricing_mode: pricingMode, quote_status,
      manual_reason: pricingMode === 'master' ? null : (manualReason || null),
      selected_options: snapshots, inputs,
    }
    // 既存カラムへ採寸の代表値を反映（カード/編集画面の互換）
    for (const m of item.measurements ?? []) {
      const col = LEGACY_MEAS[m.key]
      if (col && inputs[m.key] != null && inputs[m.key] !== '') payload[col] = Number(inputs[m.key])
    }
    if (inputs.text) payload.embroidery_text = inputs.text

    const { data: inserted, error } = await (supabase as any)
      .from('repair_histories').insert(payload).select('id').single()
    if (error || !inserted) { setSaving(false); onToast('err', `保存失敗: ${error?.message ?? ''}`); return }

    // 受付写真アップロード
    if (photos.length) {
      const repairId = inserted.id as string
      for (let i = 0; i < photos.length; i++) {
        const f = photos[i].file
        const ext = f.name.split('.').pop() || 'jpg'
        const path = `repairs/${storeId}/${repairId}/intake_${Date.now()}_${i}.${ext}`
        const up = await supabase.storage.from(REPAIR_PHOTOS_BUCKET).upload(path, f, { upsert: true })
        if (!up.error) {
          await (supabase as any).from('repair_photos').insert({
            store_id: storeId, repair_id: repairId, phase: 'intake', path, url: pubUrl(path),
          })
        }
      }
    }

    setSaving(false)
    onToast('ok', finalPrice == null ? '✂️ 見積もり待ちで受付しました' : '✂️ お直しを受付しました')
    onSave(); onClose()
  }

  function defaultDeadline(): string | null {
    if (item?.lead_time_days == null) return null
    return addBusinessDays(new Date(), item.lead_time_days).toISOString().slice(0, 10)
  }

  // ── 採寸入力（既存 mm 系は±ボタン、それ以外はテキスト） ──
  const renderMeasurement = (key: string, label: string, unit: string, required: boolean) => {
    const isMm = unit === 'mm'
    const val = inputs[key] ?? ''
    if (isMm) {
      const n = Number(val) || 0
      return (
        <div key={key}>
          <label className="text-xs font-bold text-gray-600 block mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
            <button type="button" onClick={() => setInputs({ ...inputs, [key]: String(n - 5) })} className="w-10 h-10 rounded-lg bg-white border font-black text-lg">−</button>
            <div className="flex-1 text-center font-black text-2xl text-gray-800">{n > 0 ? '+' : ''}{n}<span className="text-sm ml-0.5">mm</span></div>
            <button type="button" onClick={() => setInputs({ ...inputs, [key]: String(n + 5) })} className="w-10 h-10 rounded-lg bg-white border font-black text-lg">＋</button>
          </div>
        </div>
      )
    }
    return (
      <div key={key}>
        <label className="text-xs font-bold text-gray-600 block mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
        <input className={INPUT} value={val} onChange={e => setInputs({ ...inputs, [key]: e.target.value })} placeholder={unit} />
      </div>
    )
  }

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
      { key: 'garment', label: '服種' },
      { key: 'item',    label: '項目' },
    ]
    if (item && ((item.measurements ?? []).length > 0 || manuals.length > 0)) defs.push({ key: 'measure', label: '採寸' })
    if (item && groupedOptions.length > 0) defs.push({ key: 'options', label: 'オプション' })
    if (item) {
      defs.push({ key: 'price',   label: '価格' })
      defs.push({ key: 'photo',   label: '写真' })
      defs.push({ key: 'memo',    label: '納期・メモ' })
      defs.push({ key: 'confirm', label: '確認' })
    }
    return defs
  }, [item, manuals, groupedOptions])

  const curBuildIdx = Math.min(buildStep, buildStepDefs.length - 1)
  const curBuildKey = buildStepDefs[curBuildIdx]?.key ?? 'garment'
  const isLastBuild = curBuildKey === 'confirm'

  const canNextBuild = (() => {
    if (curBuildKey === 'garment') return !!garmentId
    if (curBuildKey === 'item')    return !!item
    if (curBuildKey === 'measure') return !(hasDanger && !manualConfirmed)
    return true
  })()

  const goBackBuild = () => { if (curBuildIdx <= 0) setStep('customer'); else setBuildStep(curBuildIdx - 1) }
  const goNextBuild = () => { if (canNextBuild && curBuildIdx < buildStepDefs.length - 1) setBuildStep(curBuildIdx + 1) }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[94vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* ヘッダ */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-2 z-10">
          {step === 'build' && <button onClick={goBackBuild} className="p-1 text-gray-400"><ChevronLeft size={20} /></button>}
          <Scissors size={18} className="text-amber-500" />
          <h2 className="font-black text-gray-900 flex-1">お直し受付{step === 'build' && buildStepDefs[curBuildIdx] ? `・${buildStepDefs[curBuildIdx].label}（${curBuildIdx + 1}/${buildStepDefs.length}）` : ''}</h2>
          {step === 'build' && (
            <button onClick={() => setLinkSheetOpen(true)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border max-w-[40%] truncate ${selectedCust ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
              {selectedCust ? `👤 ${selectedChild?.name ?? selectedCust.name}` : '＋顧客を紐付け'}
            </button>
          )}
          <OcrCaptureButton onResult={handleOcr} onError={m => onToast('err', m)} />
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        {/* ── 顧客選択 ── */}
        {step === 'customer' && (
          <div className="p-4 space-y-3">
            {selectedCust ? (
              <div className="space-y-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center"><User size={18} className="text-indigo-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900">{selectedCust.name}</p>
                    {selectedCust.tel && <p className="text-xs text-gray-500">{selectedCust.tel}</p>}
                  </div>
                  <button onClick={() => { setSelectedCust(null); setSelectedChild(null) }} className="p-1.5 text-gray-400"><X size={15} /></button>
                </div>
                {selectedCust.children && selectedCust.children.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-2">お子様（任意）</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSelectedChild(null)} className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${!selectedChild ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>選択しない</button>
                      {selectedCust.children.map(ch => (
                        <button key={ch.id} onClick={() => setSelectedChild(ch)} className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${selectedChild?.id === ch.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>{ch.name}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => setStep('build')} className="w-full py-3.5 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-2"><Check size={18} />お直し内容へ進む</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input autoFocus className={INPUT + ' pl-9'} placeholder="お名前・電話・学校で検索" value={custSearch} onChange={e => setCustSearch(e.target.value)} />
                  {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-300" />}
                </div>
                <RecentCustomers storeId={storeId} visible={custSearch.trim() === '' && !showReg} withChildren onPick={pickRecent} />
                <div className="space-y-1.5">
                  {custResults.map(c => (
                    (c.children && c.children.length > 0) ? (
                      // 子ども（生徒）を主役に表示。タップで保護者＋子を即リンク
                      c.children.map(ch => (
                        <button key={ch.id} onClick={() => { setSelectedCust(c); setSelectedChild(ch) }} className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300">
                          {ch.school_name && <p className="text-[11px] font-black text-amber-600 leading-none mb-0.5">{ch.school_name}</p>}
                          <p className="font-bold text-gray-900">{ch.name}</p>
                          <p className="text-xs text-gray-400">保護者: {c.name}{c.tel ? ` / ${c.tel}` : ''}</p>
                        </button>
                      ))
                    ) : (
                      <button key={c.id} onClick={() => { setSelectedCust(c); setSelectedChild(null) }} className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300">
                        <p className="font-bold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{[c.tel, c.school_name].filter(Boolean).join(' / ')}</p>
                      </button>
                    )
                  ))}
                  {custSearch && !searching && custResults.length === 0 && <p className="text-center text-sm text-gray-400 py-4">該当なし。新規登録できます。</p>}
                </div>

                {/* 新規顧客を登録（LINE / 電話番号） */}
                {!showReg ? (
                  <button onClick={() => { setShowReg(true); if (!newName && custSearch && !/\d/.test(custSearch)) setNewName(custSearch.trim()) }}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-bold flex items-center justify-center gap-1.5">
                    ➕ 新規顧客を登録する
                  </button>
                ) : (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
                    {/* 電話番号で登録 */}
                    {phoneMode ? (
                      <div className="space-y-2">
                        <p className="text-xs font-black text-indigo-800">電話番号で登録・紐付け</p>
                        <input className={INPUT} placeholder="お名前" value={newName} onChange={e => setNewName(e.target.value)} />
                        <input className={INPUT} type="tel" inputMode="numeric" placeholder="電話番号（携帯可）" value={newTel} onChange={e => setNewTel(e.target.value)} />
                        <div className="flex gap-2">
                          <button onClick={() => { setPhoneMode(false); setNewTel('') }} className="flex-1 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                          <button onClick={handlePhoneRegister} disabled={registering} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
                            {registering ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}登録して選択
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setPhoneMode(true)} className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-1.5">
                        📞 電話番号で登録する
                      </button>
                    )}
                    {/* LINEで登録（QR） */}
                    <div className="border-t border-indigo-200 pt-3 text-center space-y-2">
                      <p className="text-xs font-black text-indigo-800">またはLINEで登録（QRを読み取ってもらう）</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}/${storeId}`)}`}
                        alt="受付QR" width={180} height={180}
                        className="mx-auto rounded-xl bg-white p-1 shadow-sm"
                      />
                      <p className="text-[10px] text-indigo-500 leading-relaxed">LINE登録後、上の検索欄でお名前を検索してください</p>
                    </div>
                    <button onClick={() => { setShowReg(false); setPhoneMode(false); setNewTel('') }}
                      className="w-full py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-white">閉じる</button>
                  </div>
                )}

                {/* 顧客は後で紐付け（先に内容入力でもOK） */}
                <button onClick={() => setStep('build')}
                  className="w-full py-2.5 text-sm font-bold text-gray-500 rounded-2xl hover:bg-gray-50">
                  顧客は後で紐付け → 先に内容を入力
                </button>
              </>
            )}
          </div>
        )}

        {/* ── お直し内容 ── */}
        {step === 'build' && (
          <div className="p-4 space-y-4">
            {/* 服種 */}
            {curBuildKey === 'garment' && (
            <div>
              <p className="text-[11px] font-black text-gray-400 mb-1.5">① 服種を選択</p>
              <div className="flex flex-wrap gap-2">
                {garments.map(g => (
                  <button key={g.id} onClick={() => setGarmentId(g.id)} className={`px-3 py-2 rounded-xl text-sm font-bold border-2 ${garmentId === g.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-200 text-gray-700'}`}>{g.icon} {g.name}</button>
                ))}
              </div>
            </div>
            )}

            {/* 項目 */}
            {curBuildKey === 'item' && (
            <div>
              <p className="text-[11px] font-black text-gray-400 mb-1.5">② 項目を選択</p>
              <div className="grid grid-cols-2 gap-2">
                {items.map(it => (
                  <button key={it.id} onClick={() => selectItem(it)} className={`text-left p-3 rounded-xl border-2 ${item?.id === it.id ? 'bg-amber-50 border-amber-400' : 'bg-white border-gray-200'}`}>
                    <p className="font-bold text-gray-900 text-sm">{it.icon} {it.name}</p>
                    <p className="text-indigo-600 font-black text-sm mt-0.5">{it.requires_quote ? '見積もり' : `¥${it.base_price.toLocaleString()}`}</p>
                  </button>
                ))}
                {items.length === 0 && <p className="col-span-2 text-center text-xs text-gray-400 py-4">この服種の項目がありません</p>}
              </div>
            </div>
            )}

            {item && (
              <>
                {/* 採寸・特殊ケース */}
                {curBuildKey === 'measure' && (<>
                {manuals.map((m, i) => (
                  <div key={i} className={`rounded-xl p-3 border-2 ${m.severity === 'danger' ? 'bg-red-50 border-red-300' : m.severity === 'warn' ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-200'}`}>
                    <p className="font-black text-sm flex items-center gap-1 text-gray-800"><AlertTriangle size={14} className={m.severity === 'danger' ? 'text-red-500' : 'text-amber-500'} />{m.title}</p>
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{m.body}</p>
                    {m.images.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {m.images.map((img, j) => <img key={j} src={pubUrl(img.path)} alt="" className="w-20 h-20 object-cover rounded-lg border" />)}
                      </div>
                    )}
                  </div>
                ))}
                {hasDanger && (
                  <label className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 rounded-xl px-3 py-2">
                    <input type="checkbox" checked={manualConfirmed} onChange={e => setManualConfirmed(e.target.checked)} />内容を確認しました
                  </label>
                )}

                {/* 採寸 */}
                {(item.measurements ?? []).length > 0 && (
                  <div>
                    <p className="text-[11px] font-black text-gray-400 mb-1.5">採寸・入力</p>
                    <div className="space-y-2">{item.measurements.map(m => renderMeasurement(m.key, m.label, m.unit, !!m.required))}</div>
                  </div>
                )}
                </>)}

                {/* オプション */}
                {curBuildKey === 'options' && (
                  <div>
                    <p className="text-[11px] font-black text-gray-400 mb-1.5">③ オプション</p>
                    <div className="space-y-2.5">
                      {groupedOptions.map(([gl, opts]) => (
                        <div key={gl}>
                          {!gl.startsWith('__single_') && <p className="text-xs font-bold text-gray-500 mb-1">{gl}{opts[0].group_select === 'single' ? '（択一）' : ''}</p>}
                          <div className="flex flex-wrap gap-1.5">
                            {opts.map(o => (
                              <button key={o.id} onClick={() => toggleOption(o)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${optSel[o.id] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-700'}`}>
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
                {curBuildKey === 'price' && (<>
                {/* 個別見積もり: その他の品名/内容 */}
                {pricingMode === 'manual' && item.code === 'other' && (
                  <div className="space-y-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <p className="text-xs font-black text-rose-600">個別見積もり（マスタにない特殊対応）</p>
                    <input className={INPUT} placeholder="品名（例: 学ラン 襟交換）" value={manualItemName} onChange={e => setManualItemName(e.target.value)} />
                    <textarea className={INPUT} rows={2} placeholder="内容・メモ" value={manualContent} onChange={e => setManualContent(e.target.value)} />
                  </div>
                )}

                {/* 価格 */}
                <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">基本 ¥{item.base_price.toLocaleString()}（{PRICE_UNIT_LABELS[item.price_unit]}）</span>
                    <span className="text-2xl font-black text-indigo-600">{pricingMode === 'master' ? `¥${calculated.toLocaleString()}` : (finalPrice != null ? `¥${finalPrice.toLocaleString()}` : '見積もり待ち')}</span>
                  </div>
                  {/* 価格モード切替 */}
                  <div className="flex gap-1.5">
                    {(['master', 'adjusted', 'manual'] as PricingMode[]).map(pm => (
                      <button key={pm} onClick={() => setPricingMode(pm)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border ${pricingMode === pm ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>{PRICING_MODE_LABELS[pm]}</button>
                    ))}
                  </div>
                  {pricingMode !== 'master' && (
                    <div className="space-y-1.5">
                      <input type="number" className={INPUT} placeholder={mustQuote ? '金額（未定なら空欄＝見積もり待ち）' : '金額を入力'} value={overridePrice} onChange={e => setOverridePrice(e.target.value)} />
                      <input className={INPUT} placeholder="理由（例: 常連割引 / 難物加算）" value={manualReason} onChange={e => setManualReason(e.target.value)} />
                    </div>
                  )}
                  {mustQuote && pricingMode === 'master' && <p className="text-[11px] text-rose-500 font-bold">※要見積もり項目です。金額確定後に「価格調整/個別見積もり」で入力してください</p>}
                </div>
                </>)}

                {/* 写真 */}
                {curBuildKey === 'photo' && (
                <div>
                  <label className="text-[11px] font-black text-gray-400 block mb-1">受付時の写真（状態の記録）</label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                        <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer text-gray-400">
                      <Camera size={18} />
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setPhotos([...photos, { file: f, url: URL.createObjectURL(f) }]) }} />
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">任意です。不要ならそのまま「次へ」。</p>
                </div>
                )}

                {/* 納期・外注・メモ */}
                {curBuildKey === 'memo' && (<>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-black text-gray-400 block mb-1">仕上がり希望日</label>
                    <input type="date" className={INPUT} value={deadline} onChange={e => setDeadline(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-gray-400 block mb-1">外注先（任意）</label>
                    <input className={INPUT} value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="内製なら空欄" />
                  </div>
                </div>
                <textarea className={INPUT} rows={2} placeholder="社内メモ（任意）" value={memo} onChange={e => setMemo(e.target.value)} />
                </>)}

                {/* 確認 */}
                {curBuildKey === 'confirm' && (
                <div className="space-y-2">
                  <p className="text-[11px] font-black text-gray-400">内容を確認して受付</p>
                  <div className="rounded-2xl border border-gray-200 text-sm divide-y">
                    {[
                      ['お客様', selectedCust ? `${selectedCust.name}${selectedChild ? ` / ${selectedChild.name}` : ''}` : '未紐付け（上部の「顧客」から登録してください）'],
                      ['服種・項目', `${garments.find(g => g.id === garmentId)?.name ?? ''} / ${item.name}`],
                      ['金額', pricingMode === 'master' ? `¥${calculated.toLocaleString()}` : (finalPrice != null ? `¥${finalPrice.toLocaleString()}` : '見積もり待ち')],
                      ...(deadline ? [['仕上がり希望', deadline]] : []),
                      ...(vendorName ? [['外注先', vendorName]] : []),
                      ...(memo ? [['メモ', memo]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-3 px-3 py-2">
                        <span className="text-gray-400 font-bold w-20 shrink-0">{k}</span>
                        <span className="text-gray-900 font-bold flex-1 break-words">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                )}

              </>
            )}

            {/* フッターナビ（全サブステップ共通） */}
            <div className="flex gap-2 pt-1">
              <button onClick={goBackBuild} className="flex-1 py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 font-black">戻る</button>
              {isLastBuild ? (
                <button onClick={handleSave} disabled={saving} className="flex-[2] py-3 bg-amber-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}受付する
                </button>
              ) : (
                <button onClick={goNextBuild} disabled={!canNextBuild} className="flex-[2] py-3 bg-indigo-600 text-white font-black rounded-2xl disabled:opacity-40">次へ</button>
              )}
            </div>
          </div>
        )}
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
