'use client'

// ============================================================================
//  お直しマスタ管理 — 服種 > 項目 > オプション の3階層CRUD
//  基本料金=項目 / 加算=オプション。採寸定義・マニュアル(参考画像)もここで編集。
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Plus, Pencil, Trash2, Loader2, X, Scissors, ChevronDown, ChevronRight,
  Ruler, ImagePlus, AlertTriangle, Sparkles, Camera,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { REPAIR_PRESETS } from '@/lib/repairPresets'
import { RepairIcon, GarmentIconPicker } from '@/lib/garmentIcons'
import { BulkImportModal, bulkFromParsed, type ImportGarment } from './_components/BulkImportModal'
import {
  PRICE_UNIT_LABELS, PRICE_UNIT_HELP, MANUAL_SEVERITY_LABELS, REPAIR_PHOTOS_BUCKET,
  type RepairGarmentType, type RepairItem, type RepairOption,
  FIELD_TYPE_LABELS,
  type PriceUnit, type MeasurementDef, type FieldDef, type RepairManual, type ManualSeverity,
} from '@/types/repair'
import { seedRepairPresets, SIZE_RANGE_PRESETS } from '@/lib/repairPresets'
import { useRepairProfile } from '@/lib/useRepairProfile'
import { PROFILE_DEFAULTS, PROFILE_ORDER, type RepairProfileKey } from '@/lib/repairProfile'
import { Toast } from '@/app/_components/Toast'
import { Field } from '@/app/_components/Field'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

// ── 小物 ──────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-black text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

const PRICE_UNITS: PriceUnit[] = ['per_item', 'per_name', 'per_pair', 'per_cm']
const SEVERITIES: ManualSeverity[] = ['info', 'warn', 'danger']

// マニュアル編集ブロック（項目/オプション共用）
function ManualEditor({ value, onChange, storeId, onToast }: {
  value: RepairManual | null
  onChange: (m: RepairManual | null) => void
  storeId: string
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const enabled = value != null
  const m = value ?? { title: '', body: '', severity: 'warn' as ManualSeverity, images: [] }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `manuals/${storeId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(REPAIR_PHOTOS_BUCKET).upload(path, file, { upsert: true })
      if (error) throw error
      onChange({ ...m, images: [...m.images, { path }] })
    } catch { onToast('err', '画像アップロード失敗') }
    finally { setUploading(false) }
  }
  const pub = (path: string) => supabase.storage.from(REPAIR_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-amber-50/40">
      <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <input type="checkbox" checked={enabled} onChange={e => onChange(e.target.checked ? m : null)} />
        <AlertTriangle size={15} className="text-amber-500" /> 特殊ケースのマニュアル（受付時に表示）
      </label>
      {enabled && (
        <div className="mt-3 space-y-2">
          <input className={INPUT} placeholder="タイトル（例: 特殊素材の注意）" value={m.title} onChange={e => onChange({ ...m, title: e.target.value })} />
          <textarea className={INPUT} rows={2} placeholder="注意書き本文" value={m.body} onChange={e => onChange({ ...m, body: e.target.value })} />
          <div className="flex gap-1.5">
            {SEVERITIES.map(sv => (
              <button key={sv} type="button" onClick={() => onChange({ ...m, severity: sv })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                  m.severity === sv
                    ? sv === 'danger' ? 'bg-red-500 text-white border-red-500'
                      : sv === 'warn' ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-500 border-gray-200'}`}>
                {MANUAL_SEVERITY_LABELS[sv]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {m.images.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pub(img.path)} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                <button type="button" onClick={() => onChange({ ...m, images: m.images.filter((_, j) => j !== i) })}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button>
              </div>
            ))}
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer text-gray-400 hover:border-indigo-400">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RepairMasterPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = (type: 'ok' | 'err', msg: string) => setToast({ msg, type })

  // ── 一括取込（プリセット / 写真OCR）────────────────────────
  const [importData, setImportData] = useState<{ title: string; initial: ImportGarment[] } | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleOcr = async (file: File) => {
    setOcrLoading(true)
    try {
      const imageBase64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const storePin = sessionStorage.getItem(`admin_pin_${storeId}`) ?? ''
      const resp = await fetch('/api/repair-ocr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: file.type, storeId, storePin }),
      })
      const json = await resp.json()
      if (!json.ok) { showToast('err', json.error ?? '読み取りに失敗しました'); return }
      const garments = bulkFromParsed(json.garments ?? [])
      if (garments.length === 0) { showToast('err', '価格表を読み取れませんでした。鮮明に撮影してください。'); return }
      setImportData({ title: '写真から一括取込', initial: garments })
    } catch {
      showToast('err', '読み取りに失敗しました')
    } finally { setOcrLoading(false) }
  }

  const [garments, setGarments] = useState<RepairGarmentType[]>([])
  const [items, setItems] = useState<RepairItem[]>([])
  const [optionsByItem, setOptionsByItem] = useState<Record<string, RepairOption[]>>({})
  const [selectedGarment, setSelectedGarment] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // 業種プロファイル（画面の語彙とプリセットの中身を切り替える）
  const { profile, labels, save: saveProfile } = useRepairProfile(storeId)
  const [switching, setSwitching] = useState(false)

  const changeProfile = async (next: RepairProfileKey) => {
    if (next === profile || switching) return
    setSwitching(true)
    const ok = await saveProfile({ profile: next })
    showToast(ok ? 'ok' : 'err', ok ? `業種を「${PROFILE_DEFAULTS[next].label}」に変更しました` : '業種の変更に失敗しました')
    setSwitching(false)
  }

  // ── fetch ──────────────────────────────────────────────────
  const fetchGarments = useCallback(async () => {
    const { data } = await (supabase as any).from('repair_garment_types')
      .select('*').eq('store_id', storeId).order('sort_order')
    const list = (data ?? []) as RepairGarmentType[]
    setGarments(list)
    setSelectedGarment(prev => prev && list.some(g => g.id === prev) ? prev : (list[0]?.id ?? null))
    setLoading(false)
  }, [storeId])

  const fetchItems = useCallback(async (garmentId: string) => {
    const { data } = await (supabase as any).from('repair_items')
      .select('*').eq('store_id', storeId).eq('garment_type_id', garmentId).order('sort_order')
    setItems((data ?? []) as RepairItem[])
  }, [storeId])

  const fetchOptions = useCallback(async (itemId: string) => {
    const { data } = await (supabase as any).from('repair_options')
      .select('*').eq('item_id', itemId).order('sort_order')
    setOptionsByItem(prev => ({ ...prev, [itemId]: (data ?? []) as RepairOption[] }))
  }, [])

  useEffect(() => { if (storeId) fetchGarments() }, [storeId, fetchGarments])
  useEffect(() => { if (selectedGarment) fetchItems(selectedGarment) }, [selectedGarment, fetchItems])

  // ── 標準お直しを一括取り込み（追記式・既存は壊さない）──────────
  const handleSeedPreset = async () => {
    if (seeding) return
    const presetLabel = PROFILE_DEFAULTS[profile].label
    if (!confirm(`「${presetLabel}」の標準一式（${labels.garment}・${labels.item}・${labels.option}）を取り込みます。\n既存の設定はそのまま、不足分のみ追加します。よろしいですか？\n※金額は仮の値で入ります。取り込み後に各${labels.item}で調整してください。`)) return
    setSeeding(true)
    try {
      const r = await seedRepairPresets(storeId, profile)
      if (r.garments + r.items + r.options === 0) {
        showToast('ok', '追加分はありませんでした（既に取り込み済み）')
      } else {
        showToast('ok', `${labels.garment}${r.garments}・${labels.item}${r.items}・${labels.option}${r.options}件を追加しました`)
      }
      await fetchGarments()
    } catch {
      showToast('err', '取り込みに失敗しました')
    } finally {
      setSeeding(false)
    }
  }

  // ── 服種 modal ──────────────────────────────────────────────
  const [gModal, setGModal] = useState(false)
  const [editingG, setEditingG] = useState<RepairGarmentType | null>(null)
  const [gName, setGName] = useState(''); const [gIcon, setGIcon] = useState('')
  const openG = (g?: RepairGarmentType) => {
    setEditingG(g ?? null); setGName(g?.name ?? ''); setGIcon(g?.icon ?? ''); setGModal(true)
  }
  const saveG = async () => {
    if (!gName.trim()) return showToast('err', '名称は必須です')
    const code = editingG?.code ?? `g_${Date.now().toString(36)}`
    if (editingG) {
      await (supabase as any).from('repair_garment_types').update({ name: gName.trim(), icon: gIcon || null }).eq('id', editingG.id)
    } else {
      await (supabase as any).from('repair_garment_types').insert({ store_id: storeId, code, name: gName.trim(), icon: gIcon || null, sort_order: (garments.at(-1)?.sort_order ?? 0) + 10 })
    }
    setGModal(false); showToast('ok', '保存しました'); fetchGarments()
  }
  const delG = async (g: RepairGarmentType) => {
    if (!confirm(`「${g.name}」と配下の項目・オプションを削除します。よろしいですか？`)) return
    await (supabase as any).from('repair_garment_types').delete().eq('id', g.id)
    showToast('ok', '削除しました'); fetchGarments()
  }

  // ── 項目 modal ──────────────────────────────────────────────
  const [iModal, setIModal] = useState(false)
  const [editingI, setEditingI] = useState<RepairItem | null>(null)
  const [iName, setIName] = useState(''); const [iIcon, setIIcon] = useState('')
  const [iBase, setIBase] = useState('0'); const [iUnit, setIUnit] = useState<PriceUnit>('per_item')
  const [iLead, setILead] = useState(''); const [iQuote, setIQuote] = useState(false)
  const [iMeas, setIMeas] = useState<MeasurementDef[]>([])
  // プリセット由来の入力定義。saveI の payload に含めない＝update で保持される
  const [iFields, setIFields] = useState<FieldDef[]>([])
  const [iManual, setIManual] = useState<RepairManual | null>(null)
  const [iSaving, setISaving] = useState(false)
  const openI = (it?: RepairItem) => {
    setEditingI(it ?? null)
    setIName(it?.name ?? ''); setIIcon(it?.icon ?? '✂️')
    setIBase(String(it?.base_price ?? 0)); setIUnit(it?.price_unit ?? 'per_item')
    setILead(it?.lead_time_days != null ? String(it.lead_time_days) : '')
    setIQuote(it?.requires_quote ?? false)
    setIMeas(it?.measurements ?? []); setIManual(it?.manual ?? null)
    setIFields(it?.fields ?? [])
    setIModal(true)
  }
  const saveI = async () => {
    if (!selectedGarment) return
    if (!iName.trim()) return showToast('err', '項目名は必須です')
    setISaving(true)
    const payload = {
      name: iName.trim(), icon: iIcon || null,
      base_price: Number(iBase) || 0, price_unit: iUnit,
      lead_time_days: iLead ? Number(iLead) : null,
      requires_quote: iQuote, measurements: iMeas, manual: iManual,
    }
    try {
      if (editingI) {
        await (supabase as any).from('repair_items').update(payload).eq('id', editingI.id)
      } else {
        await (supabase as any).from('repair_items').insert({
          ...payload, store_id: storeId, garment_type_id: selectedGarment,
          code: `i_${Date.now().toString(36)}`, sort_order: (items.at(-1)?.sort_order ?? 0) + 10,
        })
      }
      setIModal(false); showToast('ok', '保存しました'); fetchItems(selectedGarment)
    } catch { showToast('err', '保存に失敗しました') }
    finally { setISaving(false) }
  }
  const delI = async (it: RepairItem) => {
    if (!confirm(`「${it.name}」と配下のオプションを削除します。よろしいですか？`)) return
    await (supabase as any).from('repair_items').delete().eq('id', it.id)
    showToast('ok', '削除しました'); if (selectedGarment) fetchItems(selectedGarment)
  }

  // ── オプション modal ────────────────────────────────────────
  const [oModal, setOModal] = useState(false)
  const [oItemId, setOItemId] = useState<string | null>(null)
  const [editingO, setEditingO] = useState<RepairOption | null>(null)
  const [oName, setOName] = useState(''); const [oGroup, setOGroup] = useState('')
  const [oSelect, setOSelect] = useState<'single' | 'multi'>('multi')
  const [oDelta, setODelta] = useState('0'); const [oUnit, setOUnit] = useState<PriceUnit>('per_item')
  const [oDefault, setODefault] = useState(false); const [oQuote, setOQuote] = useState(false)
  const [oManual, setOManual] = useState<RepairManual | null>(null)
  const openO = (itemId: string, o?: RepairOption) => {
    setOItemId(itemId); setEditingO(o ?? null)
    setOName(o?.name ?? ''); setOGroup(o?.group_label ?? ''); setOSelect(o?.group_select ?? 'multi')
    setODelta(String(o?.price_delta ?? 0)); setOUnit(o?.price_unit ?? 'per_item')
    setODefault(o?.default_selected ?? false); setOQuote(o?.requires_quote ?? false)
    setOManual(o?.manual ?? null); setOModal(true)
  }
  const saveO = async () => {
    if (!oItemId) return
    if (!oName.trim()) return showToast('err', 'オプション名は必須です')
    const list = optionsByItem[oItemId] ?? []
    const payload = {
      group_label: oGroup.trim() || null, group_select: oSelect,
      name: oName.trim(), price_delta: Number(oDelta) || 0, price_unit: oUnit,
      default_selected: oDefault, requires_quote: oQuote, manual: oManual,
    }
    if (editingO) {
      await (supabase as any).from('repair_options').update(payload).eq('id', editingO.id)
    } else {
      await (supabase as any).from('repair_options').insert({
        ...payload, store_id: storeId, item_id: oItemId,
        code: `o_${Date.now().toString(36)}`, sort_order: (list.at(-1)?.sort_order ?? 0) + 10,
      })
    }
    setOModal(false); showToast('ok', '保存しました'); fetchOptions(oItemId)
  }
  const delO = async (o: RepairOption) => {
    if (!confirm(`「${o.name}」を削除します。`)) return
    await (supabase as any).from('repair_options').delete().eq('id', o.id)
    showToast('ok', '削除しました'); fetchOptions(o.item_id)
  }

  // ── サイズ段階を一括生成 modal ──────────────────────────────
  //  「〜5cm まで」「サイズで金額が変わる」を、タップ選択の択一オプション一式として生成。
  const [szModal, setSzModal]   = useState(false)
  const [szItemId, setSzItemId] = useState<string | null>(null)
  const [szGroup, setSzGroup]   = useState('詰め幅')
  const [szUnit, setSzUnit]     = useState('cm')
  const [szMin, setSzMin]       = useState('1')
  const [szMax, setSzMax]       = useState('5')
  const [szStep, setSzStep]     = useState('1')
  const [szLabel, setSzLabel]   = useState<'upto' | 'exact'>('upto') // 〜Ncm / Ncm
  const [szPrice, setSzPrice]   = useState<'flat' | 'increment'>('flat')
  const [szBaseAdd, setSzBaseAdd] = useState('0') // 最小サイズの加算額
  const [szStepAdd, setSzStepAdd] = useState('0') // 1段ふえるごとの加算額
  const [szSaving, setSzSaving] = useState(false)

  const openSize = (itemId: string) => {
    setSzItemId(itemId); setSzGroup('詰め幅'); setSzUnit('cm')
    setSzMin('1'); setSzMax('5'); setSzStep('1')
    setSzLabel('upto'); setSzPrice('flat'); setSzBaseAdd('0'); setSzStepAdd('0')
    setSzModal(true)
  }
  // プレビュー用に生成内容を計算
  const szPreview = (() => {
    const min = Number(szMin), max = Number(szMax), step = Number(szStep)
    if (!(step > 0) || !(max >= min)) return [] as { name: string; delta: number }[]
    const baseAdd = Number(szBaseAdd) || 0, stepAdd = Number(szStepAdd) || 0
    const out: { name: string; delta: number }[] = []
    let idx = 0
    for (let v = min; v <= max + 1e-9 && out.length < 60; v += step) {
      const val = Math.round(v * 100) / 100
      out.push({
        name:  szLabel === 'upto' ? `〜${val}${szUnit}` : `${val}${szUnit}`,
        delta: szPrice === 'flat' ? 0 : Math.round(baseAdd + stepAdd * idx),
      })
      idx++
    }
    return out
  })()
  const generateSizes = async () => {
    if (!szItemId) return
    if (!szGroup.trim()) return showToast('err', 'グループ名は必須です')
    const rows = szPreview
    if (rows.length === 0) return showToast('err', '最小・最大・刻みを確認してください')
    if (rows.length > 50) return showToast('err', '段階が多すぎます（50以下にしてください）')
    setSzSaving(true)
    const list = optionsByItem[szItemId] ?? []
    let sort = (list.at(-1)?.sort_order ?? 0) + 10
    const payload = rows.map((r, i) => ({
      store_id: storeId, item_id: szItemId,
      group_label: szGroup.trim(), group_select: 'single' as const,
      code: `o_${Date.now().toString(36)}_${i}`,
      name: r.name, price_delta: r.delta, price_unit: 'per_item' as const,
      default_selected: false, requires_quote: false, manual: null,
      sort_order: (sort += 10),
    }))
    try {
      const { error } = await (supabase as any).from('repair_options').insert(payload)
      if (error) throw error
      setSzModal(false); showToast('ok', `${payload.length}件のサイズを追加しました`)
      setExpandedItem(szItemId); fetchOptions(szItemId)
    } catch { showToast('err', '生成に失敗しました') }
    finally { setSzSaving(false) }
  }

  const toggleItem = (itemId: string) => {
    if (expandedItem === itemId) { setExpandedItem(null); return }
    setExpandedItem(itemId)
    if (!optionsByItem[itemId]) fetchOptions(itemId)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ヘッダ */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-30">
        <Link href={`/${storeId}/admin/settings/staff`} className="text-white/90"><ChevronLeft size={22} /></Link>
        <Scissors size={18} className="text-white" />
        <h1 className="text-white font-black text-base">{labels.domain}マスタ（{labels.garment}・{labels.item}・{labels.option}）</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" size={32} /></div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 業種プロファイル: 画面の呼び名とプリセットの中身が切り替わる */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">業種</p>
            <div className="grid grid-cols-3 gap-2">
              {PROFILE_ORDER.map(k => (
                <button
                  key={k}
                  onClick={() => changeProfile(k)}
                  disabled={switching}
                  className={`rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition disabled:opacity-60 ${
                    profile === k ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >{PROFILE_DEFAULTS[k].label}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              画面の呼び名（{labels.garment}・{labels.item}・{labels.measurement}）と、下の一括取り込みの中身が変わります。
              登録済みのデータは変わりません。
            </p>
          </div>

          {/* 服種が空のとき: 標準お直しを一括取り込み CTA */}
          {garments.length === 0 && (
            <button onClick={handleSeedPreset} disabled={seeding}
              className="w-full flex items-center gap-3 rounded-2xl bg-indigo-600 text-white px-4 py-4 shadow-sm hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-60">
              <span className="text-2xl">{seeding ? '⏳' : '⚡'}</span>
              <span className="flex-1 text-left">
                <span className="block font-black text-base">{PROFILE_DEFAULTS[profile].label}の標準セットを取り込む</span>
                <span className="block text-[11px] text-white/80">{labels.garment}・{labels.item}・{labels.option}を一括作成。金額はあとから調整できます。</span>
              </span>
              {seeding ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} className="opacity-80" />}
            </button>
          )}

          {/* 服種チップ */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">{labels.garment}（大項目）</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setImportData({ title: 'プリセットから一括追加', initial: bulkFromParsed(REPAIR_PRESETS) })}
                  className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-700 active:scale-95">
                  <Sparkles size={13} />プリセット
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={ocrLoading}
                  className="flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700 active:scale-95 disabled:opacity-50">
                  {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}写真で取込
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleOcr(f); e.target.value = '' }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {garments.map(g => (
                <div key={g.id} className={`group flex items-center rounded-full border ${selectedGarment === g.id ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <button onClick={() => { setSelectedGarment(g.id); setExpandedItem(null) }} className="pl-3 pr-1 py-1.5 text-sm font-bold flex items-center gap-1">
                    <RepairIcon icon={g.icon} /> {g.name}
                  </button>
                  <button onClick={() => openG(g)} className="p-1 opacity-60 hover:opacity-100"><Pencil size={12} /></button>
                  <button onClick={() => delG(g)} className="pr-2 pl-0.5 py-1 opacity-60 hover:opacity-100"><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={() => openG()} className="flex items-center gap-1 rounded-full border-2 border-dashed border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-400 hover:border-amber-400 hover:text-amber-500">
                <Plus size={14} /> 服種を追加
              </button>
            </div>
          </div>

          {/* 項目一覧 */}
          {selectedGarment && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">項目（基本料金）</p>
                <button onClick={() => openI()} className="flex items-center gap-1 text-amber-600 text-sm font-bold">
                  <Plus size={15} /> 項目を追加
                </button>
              </div>

              {items.length === 0 ? (
                <div className="bg-white rounded-2xl py-12 text-center text-gray-400">
                  <Scissors size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">項目がありません</p>
                </div>
              ) : items.map(it => {
                const opts = optionsByItem[it.id] ?? []
                const open = expandedItem === it.id
                return (
                  <div key={it.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 p-3.5">
                      <button onClick={() => toggleItem(it.id)} className="text-gray-400">
                        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <div className="flex-1 min-w-0" onClick={() => toggleItem(it.id)} role="button">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-gray-900 inline-flex items-center gap-1"><RepairIcon icon={it.icon} /> {it.name}</span>
                          <span className="text-indigo-600 font-black">¥{it.base_price.toLocaleString()}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 font-bold">{PRICE_UNIT_LABELS[it.price_unit]}</span>
                          {it.requires_quote && <span className="text-[10px] bg-rose-100 text-rose-600 rounded px-1.5 py-0.5 font-bold">要見積もり</span>}
                          {it.manual && <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-bold">📋マニュアル</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                          {it.measurements.length > 0 && <span className="flex items-center gap-0.5"><Ruler size={11} />採寸{it.measurements.length}項目</span>}
                          {it.lead_time_days != null && <span>納期{it.lead_time_days}営業日</span>}
                          <span>オプション{opts.length || (optionsByItem[it.id] ? 0 : '…')}</span>
                        </div>
                      </div>
                      <button onClick={() => openI(it)} className="p-1.5 text-gray-400 hover:text-indigo-600"><Pencil size={15} /></button>
                      <button onClick={() => delI(it)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>

                    {open && (
                      <div className="border-t bg-gray-50/60 p-3 space-y-1.5">
                        {opts.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">オプション未設定</p>
                        ) : opts.map(o => (
                          <div key={o.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 text-sm">
                            {o.group_label && <span className="text-[10px] bg-indigo-50 text-indigo-500 rounded px-1.5 py-0.5 font-bold">{o.group_label}/{o.group_select === 'single' ? '択一' : '複数'}</span>}
                            <span className="font-bold text-gray-800">{o.name}</span>
                            <span className={`font-bold ${o.price_delta < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>{o.price_delta >= 0 ? '+' : ''}¥{o.price_delta.toLocaleString()}</span>
                            {o.default_selected && <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1 py-0.5">初期選択</span>}
                            {o.requires_quote && <span className="text-[10px] bg-rose-100 text-rose-600 rounded px-1 py-0.5">要見積</span>}
                            {o.manual && <span className="text-[10px]">📋</span>}
                            <div className="ml-auto flex gap-1">
                              <button onClick={() => openO(it.id, o)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                              <button onClick={() => delO(o)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button onClick={() => openO(it.id)} className="flex-1 flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 py-2 text-xs font-bold text-gray-400 hover:border-amber-400 hover:text-amber-500">
                            <Plus size={13} /> オプションを追加
                          </button>
                          <button onClick={() => openSize(it.id)} className="flex-1 flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-indigo-200 py-2 text-xs font-bold text-indigo-400 hover:border-indigo-400 hover:text-indigo-600">
                            <Ruler size={13} /> サイズ段階を一括生成
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 一括取込 Modal（プリセット / 写真OCR 共用）── */}
      {importData && (
        <BulkImportModal
          storeId={storeId}
          title={importData.title}
          initial={importData.initial}
          onClose={() => setImportData(null)}
          onDone={(m) => {
            setImportData(null); showToast('ok', m)
            fetchGarments(); if (selectedGarment) fetchItems(selectedGarment)
          }}
        />
      )}

      {/* ── 服種 Modal ── */}
      {gModal && (
        <Modal title={editingG ? '服種を編集' : '服種を追加'} onClose={() => setGModal(false)}>
          <Field label="アイコン"><GarmentIconPicker value={gIcon} onChange={setGIcon} inputClassName={INPUT} /></Field>
          <Field label="名称" required><input className={INPUT} value={gName} onChange={e => setGName(e.target.value)} placeholder="スラックス" /></Field>
          <button onClick={saveG} className="w-full bg-amber-500 text-white font-black py-3 rounded-xl">保存</button>
        </Modal>
      )}

      {/* ── 項目 Modal ── */}
      {iModal && (
        <Modal title={editingI ? '項目を編集' : '項目を追加'} onClose={() => setIModal(false)} wide>
          <div className="grid grid-cols-4 gap-3">
            <Field label="アイコン"><input className={INPUT} value={iIcon} onChange={e => setIIcon(e.target.value)} /></Field>
            <div className="col-span-3"><Field label="項目名" required><input className={INPUT} value={iName} onChange={e => setIName(e.target.value)} placeholder="裾上げ" /></Field></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="基本料金（円・税込）" required><input type="number" className={INPUT} value={iBase} onChange={e => setIBase(e.target.value)} /></Field>
            <Field label="単価方式">
              <select className={INPUT} value={iUnit} onChange={e => setIUnit(e.target.value as PriceUnit)}>{PRICE_UNITS.map(u => <option key={u} value={u}>{PRICE_UNIT_LABELS[u]}</option>)}</select>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">{PRICE_UNIT_HELP[iUnit].desc}<br /><span className="text-gray-400">例: {PRICE_UNIT_HELP[iUnit].example}</span></p>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="標準納期（営業日）" hint="空欄=店舗既定"><input type="number" className={INPUT} value={iLead} onChange={e => setILead(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 pb-2.5">
              <input type="checkbox" checked={iQuote} onChange={e => setIQuote(e.target.checked)} /> 金額未定で受付可（要見積もり）
            </label>
          </div>

          {/* プリセット由来の入力定義（fields）— 表示のみ。編集は Phase 2 */}
          {iFields.length > 0 && (
            <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-3">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-1 mb-2">
                <Ruler size={14} className="text-indigo-500" /> {labels.measurement}入力（プリセット定義）
              </span>
              <div className="space-y-1.5">
                {iFields.map(f => (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-gray-700">{f.label}</span>
                    <span className="rounded bg-white border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                      {FIELD_TYPE_LABELS[f.type ?? 'text']}
                    </span>
                    {f.type === 'number' && (f.min != null || f.max != null) && (
                      <span className="text-gray-400">{f.min ?? ''}〜{f.max ?? ''}{f.unit ?? ''}</span>
                    )}
                    {f.required && <span className="text-red-500 font-bold">必須</span>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                この{labels.measurement}はプリセットで定義されています。画面からの編集は次回対応予定です（保存しても消えません）。
              </p>
            </div>
          )}

          {/* 採寸定義 */}
          <div className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-1"><Ruler size={14} className="text-indigo-500" /> {labels.measurement}入力（受付で聞く数値）</span>
              <button type="button" onClick={() => setIMeas([...iMeas, { key: `m_${Date.now().toString(36)}`, label: '', unit: 'mm', required: false }])} className="text-indigo-600 text-xs font-bold flex items-center gap-1"><Plus size={13} />追加</button>
            </div>
            <div className="space-y-2">
              {iMeas.map((md, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input className={INPUT + ' flex-1'} placeholder="ラベル（例: 仕上がり丈）" value={md.label} onChange={e => setIMeas(iMeas.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
                  <input className={INPUT + ' w-20'} placeholder="単位" value={md.unit} onChange={e => setIMeas(iMeas.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                  <label className="text-[11px] font-bold text-gray-500 flex items-center gap-0.5"><input type="checkbox" checked={!!md.required} onChange={e => setIMeas(iMeas.map((x, i) => i === idx ? { ...x, required: e.target.checked } : x))} />必須</label>
                  <button type="button" onClick={() => setIMeas(iMeas.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {iMeas.length === 0 && <p className="text-xs text-gray-400">なし</p>}
            </div>
          </div>

          <ManualEditor value={iManual} onChange={setIManual} storeId={storeId} onToast={showToast} />

          <button onClick={saveI} disabled={iSaving} className="w-full bg-amber-500 text-white font-black py-3 rounded-xl disabled:opacity-50">{iSaving ? '保存中…' : '保存'}</button>
        </Modal>
      )}

      {/* ── オプション Modal ── */}
      {oModal && (
        <Modal title={editingO ? 'オプションを編集' : 'オプションを追加'} onClose={() => setOModal(false)} wide>
          <Field label="オプション名" required><input className={INPUT} value={oName} onChange={e => setOName(e.target.value)} placeholder="千鳥がけ" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="グループ名" hint="同名でまとめ表示・空欄=単独"><input className={INPUT} value={oGroup} onChange={e => setOGroup(e.target.value)} placeholder="仕上げ方法" /></Field>
            <Field label="選択方式"><select className={INPUT} value={oSelect} onChange={e => setOSelect(e.target.value as 'single' | 'multi')}><option value="multi">複数選択（チェック）</option><option value="single">択一（ラジオ）</option></select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="加算額（円・マイナス可）"><input type="number" className={INPUT} value={oDelta} onChange={e => setODelta(e.target.value)} /></Field>
            <Field label="単価方式">
              <select className={INPUT} value={oUnit} onChange={e => setOUnit(e.target.value as PriceUnit)}>{PRICE_UNITS.map(u => <option key={u} value={u}>{PRICE_UNIT_LABELS[u]}</option>)}</select>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">{PRICE_UNIT_HELP[oUnit].desc}<br /><span className="text-gray-400">例: {PRICE_UNIT_HELP[oUnit].example}</span></p>
            </Field>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700"><input type="checkbox" checked={oDefault} onChange={e => setODefault(e.target.checked)} /> 初期選択</label>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700"><input type="checkbox" checked={oQuote} onChange={e => setOQuote(e.target.checked)} /> 選ぶと要見積もり</label>
          </div>
          <ManualEditor value={oManual} onChange={setOManual} storeId={storeId} onToast={showToast} />
          <button onClick={saveO} className="w-full bg-amber-500 text-white font-black py-3 rounded-xl">保存</button>
        </Modal>
      )}

      {/* ── サイズ段階を一括生成 Modal ── */}
      {szModal && (
        <Modal title="サイズ・文字数の段階を一括生成" onClose={() => setSzModal(false)} wide>
          <p className="text-xs text-gray-500 leading-relaxed -mt-1">
            受付画面で<strong>タップで選べる段階</strong>を一式作ります（択一）。長さ(cm)でも文字数でも使えます。<br />
            「<strong>〜5cmまで</strong>」は最大を5に。ネーム刺繍は<strong>単位「文字」＋「サイズごとに加算」</strong>で「3文字まで→超過1文字ごと加算」を作れます。
          </p>
          <Field label="グループ名" required hint="受付で見出しになります">
            <input className={INPUT} value={szGroup} onChange={e => setSzGroup(e.target.value)} placeholder="例: 詰め幅 / 出し幅 / 文字数" />
          </Field>
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">クイック範囲 <span className="font-normal text-gray-400">タップで下の欄を自動入力</span></p>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_RANGE_PRESETS.map(p => (
                <button key={p.label} type="button"
                  onClick={() => { setSzMin(String(p.min)); setSzMax(String(p.max)); setSzStep(String(p.step)); setSzUnit(p.unit); setSzLabel(p.labelStyle) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-indigo-200 text-indigo-600 bg-white hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="最小"><input type="number" className={INPUT} value={szMin} onChange={e => setSzMin(e.target.value)} /></Field>
            <Field label="最大"><input type="number" className={INPUT} value={szMax} onChange={e => setSzMax(e.target.value)} /></Field>
            <Field label="刻み"><input type="number" className={INPUT} value={szStep} onChange={e => setSzStep(e.target.value)} /></Field>
            <Field label="単位"><input className={INPUT} value={szUnit} onChange={e => setSzUnit(e.target.value)} placeholder="cm" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="表示形式">
              <select className={INPUT} value={szLabel} onChange={e => setSzLabel(e.target.value as 'upto' | 'exact')}>
                <option value="upto">〜Ncm（◯◯まで）</option>
                <option value="exact">Ncm（ぴったり）</option>
              </select>
            </Field>
            <Field label="金額の付け方">
              <select className={INPUT} value={szPrice} onChange={e => setSzPrice(e.target.value as 'flat' | 'increment')}>
                <option value="flat">一律（基本料金のまま）</option>
                <option value="increment">サイズごとに加算</option>
              </select>
            </Field>
          </div>
          {szPrice === 'increment' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="最小サイズの加算額（円）" hint="基本料金への上乗せ"><input type="number" className={INPUT} value={szBaseAdd} onChange={e => setSzBaseAdd(e.target.value)} /></Field>
              <Field label="1段ふえるごとに（円）"><input type="number" className={INPUT} value={szStepAdd} onChange={e => setSzStepAdd(e.target.value)} /></Field>
            </div>
          )}
          {/* プレビュー */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <p className="text-xs font-bold text-gray-500 mb-2">プレビュー（{szPreview.length}件）</p>
            {szPreview.length === 0 ? (
              <p className="text-xs text-gray-400">最小・最大・刻みを確認してください</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {szPreview.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-white border-2 border-indigo-200 rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-700">
                    {p.name}{p.delta !== 0 && <span className="text-gray-400">{p.delta > 0 ? '+' : ''}¥{p.delta.toLocaleString()}</span>}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2">
              受付時の金額 = 基本料金{szPrice === 'increment' ? ' + サイズの加算額' : ''}。生成後も1つずつ編集できます。
            </p>
          </div>
          <button onClick={generateSizes} disabled={szSaving || szPreview.length === 0}
            className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl disabled:opacity-50">
            {szSaving ? '生成中…' : `${szPreview.length}件のサイズを追加`}
          </button>
        </Modal>
      )}
    </div>
  )
}
