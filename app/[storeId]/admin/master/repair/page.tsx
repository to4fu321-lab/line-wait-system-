'use client'

// ============================================================================
//  受付マスタ管理 — 種類 > 作業 > オプション の3階層CRUD
//  基本料金=作業 / 加算=オプション。仕様定義・マニュアル(参考画像)もここで編集。
//  語彙は業種を問わない中立語（lib/repairProfile.ts）。店ごとの設定は持たない。
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Plus, Pencil, Trash2, Loader2, X, Scissors, ChevronDown, ChevronRight,
  Ruler, ImagePlus, AlertTriangle, Sparkles, Camera, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { REPAIR_PRESETS } from '@/lib/repairPresets'
import { RepairIcon, GarmentIconPicker } from '@/lib/garmentIcons'
import { BulkImportModal, bulkFromParsed, type ImportGarment } from './_components/BulkImportModal'
import {
  PRICE_UNIT_LABELS, PRICE_UNIT_HELP, MANUAL_SEVERITY_LABELS, REPAIR_PHOTOS_BUCKET,
  type RepairGarmentType, type RepairItem, type RepairOption,
  toFieldDefs,
  type PriceUnit, type FieldDef, type RepairManual, type ManualSeverity,
} from '@/types/repair'
import { FieldsEditor } from './_components/FieldsEditor'
import { TierWizard } from './_components/TierWizard'
import { seedRepairPresets } from '@/lib/repairPresets'
import {
  REPAIR_LABELS as labels, PRESET_KEYS, PRESET_SET_LABELS, type PresetKey,
} from '@/lib/repairProfile'
import { useLongPressReorder, renumber, type Sortable } from '@/lib/useLongPressReorder'
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

  const [switching, setSwitching] = useState(false)

  // 標準セットは業種に縛らない。追記式・冪等なので、どの店でも好きなものを
  // 好きな順に取り込めた方が実態に合う（制服とラケットを両方やる店もある）。
  const presetSets: PresetKey[] = PRESET_KEYS

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
  const handleSeedPreset = async (key: PresetKey) => {
    if (seeding) return
    if (!confirm(`「${PRESET_SET_LABELS[key]}」を取り込みます。\n既存の設定はそのまま、不足分のみ追加します。よろしいですか？\n※金額は仮の値で入ります。取り込み後に各${labels.item}で調整してください。`)) return
    setSeeding(true)
    try {
      const r = await seedRepairPresets(storeId, key)
      const added = r.garments + r.items + r.options
      if (r.error) {
        // 以前はエラーを握りつぶして「取り込み済み」と嘘の成功を出していた
        showToast('err', added > 0
          ? `一部だけ追加されました（${added}件）。エラー: ${r.error}`
          : `取り込みに失敗しました: ${r.error}`)
      } else if (added === 0) {
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
  const [iFields, setIFields] = useState<FieldDef[]>([])
  const [iManual, setIManual] = useState<RepairManual | null>(null)
  const [iSaving, setISaving] = useState(false)
  const [iAdvanced, setIAdvanced] = useState(false)
  const openI = (it?: RepairItem) => {
    setEditingI(it ?? null)
    setIName(it?.name ?? ''); setIIcon(it?.icon ?? '✂️')
    setIBase(String(it?.base_price ?? 0)); setIUnit(it?.price_unit ?? 'per_item')
    setILead(it?.lead_time_days != null ? String(it.lead_time_days) : '')
    setIQuote(it?.requires_quote ?? false)
    setIManual(it?.manual ?? null)
    // 旧 measurements しか持たない作業もここで fields に寄せる。
    // 保存時に measurements を空にするので、二重管理が残らない。
    setIFields(toFieldDefs(it?.fields, it?.measurements))
    setIAdvanced(false)
    setIModal(true)
  }
  const saveI = async () => {
    if (!selectedGarment) return
    if (!iName.trim()) return showToast('err', `${labels.item}名は必須です`)
    setISaving(true)
    const payload = {
      name: iName.trim(), icon: iIcon || null,
      base_price: Number(iBase) || 0, price_unit: iUnit,
      lead_time_days: iLead ? Number(iLead) : null,
      requires_quote: iQuote, manual: iManual,
      // 入力欄は fields に一本化。旧 measurements は空にして残骸を消す
      // （toFieldDefs が fields 優先なので、空にしないと古い定義が復活する）
      fields: iFields, measurements: [],
    }
    try {
      // PostgREST はエラーを throw せず { error } で返す。握りつぶすと
      // 「保存しました」と出たのに保存されていない、が起きる
      const { error } = editingI
        ? await (supabase as any).from('repair_items').update(payload).eq('id', editingI.id)
        : await (supabase as any).from('repair_items').insert({
            ...payload, store_id: storeId, garment_type_id: selectedGarment,
            code: `i_${Date.now().toString(36)}`, sort_order: (items.at(-1)?.sort_order ?? 0) + 10,
          })
      if (error) throw error
      setIModal(false); showToast('ok', '保存しました'); fetchItems(selectedGarment)
    } catch (e) { showToast('err', `保存に失敗しました: ${(e as Error).message}`) }
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

  // ── 段階で選ぶ選択肢のウィザード ────────────────────────────
  //  設定項目を一度に並べると何を触ればよいか分からなかったので、
  //  1画面1問のウィザード（TierWizard）に出す。ここは「どの作業に足すか」だけ持つ。
  const [szItemId, setSzItemId] = useState<string | null>(null)

  const toggleItem = (itemId: string) => {
    if (expandedItem === itemId) { setExpandedItem(null); return }
    setExpandedItem(itemId)
    if (!optionsByItem[itemId]) fetchOptions(itemId)
  }

  // ── 並べ替え（長押し→ドラッグ）──────────────────────────────
  //  変わった行だけ update する。全件 upsert にすると、他の列まで
  //  こちらの持っている古い値で上書きしてしまう。
  const persistOrder = async (table: string, next: Sortable[]) => {
    const changes = renumber(next)
    if (changes.length === 0) return true
    const res = await Promise.all(changes.map(c =>
      (supabase as any).from(table).update({ sort_order: c.sort_order }).eq('id', c.id)))
    return !res.some(r => r.error)
  }

  const reorderGarments = useCallback(async (next: RepairGarmentType[]) => {
    const prev = garments
    setGarments(next.map((g, i) => ({ ...g, sort_order: (i + 1) * 10 })))
    if (!(await persistOrder('repair_garment_types', next))) {
      setGarments(prev); showToast('err', '並び順を保存できませんでした')
    }
  }, [garments])

  const reorderItems = useCallback(async (next: RepairItem[]) => {
    const prev = items
    setItems(next.map((it, i) => ({ ...it, sort_order: (i + 1) * 10 })))
    if (!(await persistOrder('repair_items', next))) {
      setItems(prev); showToast('err', '並び順を保存できませんでした')
    }
  }, [items])

  const gDrag = useLongPressReorder(garments, reorderGarments)
  const iDrag = useLongPressReorder(items, reorderItems)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ヘッダ */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-30">
        <Link href={`/${storeId}/admin/settings/staff`} className="text-white/90"><ChevronLeft size={22} /></Link>
        <Scissors size={18} className="text-white" />
        <h1 className="text-white font-black text-base">受付マスタ（{labels.garment}・{labels.item}・{labels.option}）</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" size={32} /></div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 材料をタップ選択にするための入口（material フィールドの参照先） */}
          {(
            <Link href={`/${storeId}/admin/master/materials`}
              className="w-full flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm active:scale-[0.99] transition-all">
              <span className="text-xl">🧵</span>
              <span className="flex-1 text-left">
                <span className="block font-black text-sm text-gray-800">糸・部材マスタ</span>
                <span className="block text-[11px] text-gray-400">登録すると受付で〈銘柄→色〉のタップ選択になります</span>
              </span>
              <ChevronRight size={18} className="text-gray-300" />
            </Link>
          )}

          {/* 標準セットの取り込み。両方やる店は2つ出る。
              一度取り込んだ後も押せる必要がある（制服→ラケットと順に足すため）。*/}
          {presetSets.length > 0 && (
            garments.length === 0 ? (
              <div className="space-y-2">
                {presetSets.map(key => (
                  <button key={key} onClick={() => handleSeedPreset(key)} disabled={seeding}
                    className="w-full flex items-center gap-3 rounded-2xl bg-indigo-600 text-white px-4 py-4 shadow-sm hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-60">
                    <span className="text-2xl">{seeding ? '⏳' : '⚡'}</span>
                    <span className="flex-1 text-left">
                      <span className="block font-black text-base">{PRESET_SET_LABELS[key]}を取り込む</span>
                      <span className="block text-[11px] text-white/80">{labels.garment}・{labels.item}・{labels.option}を一括作成。金額はあとから調整できます。</span>
                    </span>
                    {seeding ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} className="opacity-80" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-3 shadow-sm">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">標準セットの追加取り込み</p>
                <div className="flex flex-wrap gap-2">
                  {presetSets.map(key => (
                    <button key={key} onClick={() => handleSeedPreset(key)} disabled={seeding}
                      className="flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 active:scale-95 disabled:opacity-60">
                      {seeding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {PRESET_SET_LABELS[key]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">不足分のみ追加されます。取り込み済みのものは重複しません。</p>
              </div>
            )
          )}

          {/* 大分類チップ */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                {labels.garment}（大項目）
                <span className="ml-1.5 normal-case tracking-normal text-[10px] font-bold text-gray-300">長押しで並べ替え</span>
              </p>
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
              {gDrag.order.map(g => (
                <div key={g.id} {...gDrag.bind(g.id)}
                  style={{ WebkitTouchCallout: 'none' }}
                  className={`group flex items-center rounded-full border select-none touch-manipulation transition-all
                    ${gDrag.dragId === g.id ? 'ring-2 ring-amber-400 shadow-lg scale-105 z-10' : ''}
                    ${gDrag.dragging && gDrag.dragId !== g.id ? 'opacity-60' : ''}
                    ${selectedGarment === g.id ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <button onClick={() => { if (gDrag.ignoreClick()) return; setSelectedGarment(g.id); setExpandedItem(null) }} className="pl-3 pr-1 py-1.5 text-sm font-bold flex items-center gap-1">
                    <RepairIcon icon={g.icon} /> {g.name}
                  </button>
                  <button onClick={() => { if (gDrag.ignoreClick()) return; openG(g) }} className="p-1 opacity-60 hover:opacity-100"><Pencil size={12} /></button>
                  <button onClick={() => { if (gDrag.ignoreClick()) return; delG(g) }} className="pr-2 pl-0.5 py-1 opacity-60 hover:opacity-100"><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={() => openG()} className="flex items-center gap-1 rounded-full border-2 border-dashed border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-400 hover:border-amber-400 hover:text-amber-500">
                <Plus size={14} /> {labels.garment}を追加
              </button>
            </div>
            {gDrag.dragging && (
              <p className="mt-2 text-[11px] font-bold text-amber-600">指を動かして位置を決め、離すと確定します</p>
            )}
          </div>

          {/* 項目一覧 */}
          {selectedGarment && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                  {labels.item}（基本料金）
                  <span className="ml-1.5 normal-case tracking-normal text-[10px] font-bold text-gray-300">長押しで並べ替え</span>
                </p>
                <button onClick={() => openI()} className="flex items-center gap-1 text-amber-600 text-sm font-bold">
                  <Plus size={15} /> {labels.item}を追加
                </button>
              </div>

              {items.length === 0 ? (
                <div className="bg-white rounded-2xl py-12 text-center text-gray-400">
                  <Scissors size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">{labels.item}がありません</p>
                </div>
              ) : iDrag.order.map(it => {
                const opts = optionsByItem[it.id] ?? []
                const open = expandedItem === it.id
                return (
                  <div key={it.id} {...iDrag.bindTarget(it.id)}
                    className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all
                      ${iDrag.dragId === it.id ? 'ring-2 ring-amber-400 shadow-lg scale-[1.02]' : ''}
                      ${iDrag.dragging && iDrag.dragId !== it.id ? 'opacity-60' : ''}`}>
                    {/* 掴むのは見出し行だけ。展開したオプション欄の操作を邪魔しない */}
                    <div {...iDrag.bindHandle(it.id)} style={{ WebkitTouchCallout: 'none' }}
                      className="flex items-center gap-2 p-3.5 select-none touch-manipulation">
                      <button onClick={() => { if (iDrag.ignoreClick()) return; toggleItem(it.id) }} className="text-gray-400">
                        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <div className="flex-1 min-w-0" onClick={() => { if (iDrag.ignoreClick()) return; toggleItem(it.id) }} role="button">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-gray-900 inline-flex items-center gap-1"><RepairIcon icon={it.icon} /> {it.name}</span>
                          <span className="text-indigo-600 font-black">¥{it.base_price.toLocaleString()}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 font-bold">{PRICE_UNIT_LABELS[it.price_unit]}</span>
                          {it.requires_quote && <span className="text-[10px] bg-rose-100 text-rose-600 rounded px-1.5 py-0.5 font-bold">要見積もり</span>}
                          {it.manual && <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-bold">📋マニュアル</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                          {toFieldDefs(it.fields, it.measurements).length > 0 && (
                            <span className="flex items-center gap-0.5"><Ruler size={11} />入力{toFieldDefs(it.fields, it.measurements).length}件</span>
                          )}
                          {it.lead_time_days != null && <span>納期{it.lead_time_days}営業日</span>}
                          <span>オプション{opts.length || (optionsByItem[it.id] ? 0 : '…')}</span>
                        </div>
                      </div>
                      <button onClick={() => { if (iDrag.ignoreClick()) return; openI(it) }} className="p-1.5 text-gray-400 hover:text-indigo-600"><Pencil size={15} /></button>
                      <button onClick={() => { if (iDrag.ignoreClick()) return; delI(it) }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
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
                          <button onClick={() => setSzItemId(it.id)} className="flex-1 flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-indigo-200 py-2 text-xs font-bold text-indigo-400 hover:border-indigo-400 hover:text-indigo-600">
                            <Ruler size={13} /> 段階で一括作成
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

      {/* ── 大分類 Modal ── */}
      {gModal && (
        <Modal title={editingG ? `${labels.garment}を編集` : `${labels.garment}を追加`} onClose={() => setGModal(false)}>
          <Field label="アイコン"><GarmentIconPicker value={gIcon} onChange={setGIcon} inputClassName={INPUT} /></Field>
          <Field label="名称" required><input className={INPUT} value={gName} onChange={e => setGName(e.target.value)} placeholder="スラックス" /></Field>
          <button onClick={saveG} className="w-full bg-amber-500 text-white font-black py-3 rounded-xl">保存</button>
        </Modal>
      )}

      {/* ── 項目 Modal ── */}
      {iModal && (
        <Modal title={editingI ? `${labels.item}を編集` : `${labels.item}を追加`} onClose={() => setIModal(false)} wide>
          <div className="grid grid-cols-4 gap-3">
            <Field label="アイコン"><input className={INPUT} value={iIcon} onChange={e => setIIcon(e.target.value)} /></Field>
            <div className="col-span-3"><Field label={`${labels.item}名`} required><input className={INPUT} value={iName} onChange={e => setIName(e.target.value)} placeholder="裾上げ" /></Field></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="基本料金（円・税込）" required><input type="number" inputMode="numeric" className={INPUT} value={iBase} onChange={e => setIBase(e.target.value)} /></Field>
            <Field label="標準納期（営業日）" hint="空欄=店舗既定"><input type="number" inputMode="numeric" className={INPUT} value={iLead} onChange={e => setILead(e.target.value)} /></Field>
          </div>

          <FieldsEditor value={iFields} onChange={setIFields} />

          {/* ふだん触らない設定は畳んでおく。開くのは単価方式を変えるときぐらい */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setIAdvanced(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-gray-600">
              <span>詳細設定<span className="ml-1.5 text-[11px] font-normal text-gray-400">単価方式・要見積もり・参考画像</span></span>
              {iAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {iAdvanced && (
              <div className="border-t p-3 space-y-3">
                <Field label="単価方式">
                  <select className={INPUT} value={iUnit} onChange={e => setIUnit(e.target.value as PriceUnit)}>{PRICE_UNITS.map(u => <option key={u} value={u}>{PRICE_UNIT_LABELS[u]}</option>)}</select>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">{PRICE_UNIT_HELP[iUnit].desc}<br /><span className="text-gray-400">例: {PRICE_UNIT_HELP[iUnit].example}</span></p>
                </Field>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <input type="checkbox" checked={iQuote} onChange={e => setIQuote(e.target.checked)} /> 金額未定で受付可（要見積もり）
                </label>
                <ManualEditor value={iManual} onChange={setIManual} storeId={storeId} onToast={showToast} />
              </div>
            )}
          </div>

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

      {/* ── 段階で選ぶ選択肢のウィザード ── */}
      {szItemId && (
        <TierWizard
          storeId={storeId}
          itemId={szItemId}
          startSort={(optionsByItem[szItemId]?.at(-1)?.sort_order ?? 0) + 10}
          onClose={() => setSzItemId(null)}
          onError={msg => showToast('err', msg)}
          onDone={added => {
            const id = szItemId
            setSzItemId(null)
            showToast('ok', `${added}件の段階を追加しました`)
            setExpandedItem(id); fetchOptions(id)
          }}
        />
      )}
    </div>
  )
}
