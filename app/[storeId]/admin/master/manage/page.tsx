'use client'

// ============================================================
// マスタデータ管理(再設計版) — 5マスタ統合UI
//   学校 → [規定品 / 商品マスタ / サイズセット] を一画面で管理。
//   データ層: lib/master.ts (正規化スキーマ)
//   設計: docs/master-data-redesign.md
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, Plus, Pencil, Trash2, GraduationCap, Package, Ruler,
  Loader2, X, Check, Tag, Coins, School as SchoolIcon, Link2, Sparkles, ScanLine,
} from 'lucide-react'
import { BarcodeScannerSheet } from '../../_components/BarcodeScannerSheet'
import {
  listSchools, upsertSchool, deleteSchool,
  listSizeSets, upsertSizeSet, deleteSizeSet, replaceSizeSetItems,
  listProducts, upsertProduct, deleteProduct,
  listRequirements, upsertRequirement, deleteRequirement, assignProductToSchool,
  listPrices, replacePrices,
} from '@/lib/master'
import {
  PRODUCT_CATEGORY_OPTIONS, PRODUCT_GENDER_OPTIONS,
  WASHABLE_OPTIONS, SIZE_SET_CATEGORY_OPTIONS, BODY_TYPE_OPTIONS,
} from '@/types/master'
import ManualImportWizard from './_components/ManualImportWizard'
import { LabelPrintModal } from './_components/LabelPrintModal'
import { Toast } from '@/app/_components/Toast'
import { Field } from '@/app/_components/Field'
import type {
  SchoolMaster, SizeSet, ProductMaster, SchoolRequirement, Price,
} from '@/types/master'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50'
const BTN_GHOST = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50'

// ── 小物 ──────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-5 py-4 border-b flex items-center justify-between z-10">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

type Tab = 'regulations' | 'products' | 'sizesets'

export default function MasterManagePage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const router = useRouter()

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const show = (type: 'ok' | 'err', msg: string) => setToast({ msg, type })

  const [loading, setLoading] = useState(true)
  const [schools, setSchools] = useState<SchoolMaster[]>([])
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([])
  const [selSchool, setSelSchool] = useState<SchoolMaster | null>(null)
  const [tab, setTab] = useState<Tab>('regulations')

  const [requirements, setRequirements] = useState<SchoolRequirement[]>([])
  const [products, setProducts] = useState<ProductMaster[]>([])

  // ── 初期ロード ──────────────────────────────────────────────
  const reloadBase = useCallback(async () => {
    setLoading(true)
    try {
      const [sc, ss] = await Promise.all([listSchools(storeId), listSizeSets(storeId)])
      setSchools(sc); setSizeSets(ss)
    } catch (e: any) { show('err', e.message ?? '読み込み失敗') }
    setLoading(false)
  }, [storeId])

  useEffect(() => { if (storeId) reloadBase() }, [storeId, reloadBase])

  const reloadSchoolData = useCallback(async (school: SchoolMaster) => {
    try {
      const [reqs, prods] = await Promise.all([
        listRequirements(school.id),
        listProducts(storeId, { schoolId: school.id }),
      ])
      setRequirements(reqs); setProducts(prods)
    } catch (e: any) { show('err', e.message ?? '読み込み失敗') }
  }, [storeId])

  const openSchool = async (school: SchoolMaster) => {
    setSelSchool(school); setTab('regulations')
    await reloadSchoolData(school)
  }

  // ════════════════════════════════════════════════════════════
  // 学校マスタ(一覧)
  // ════════════════════════════════════════════════════════════
  const [schoolModal, setSchoolModal] = useState<SchoolMaster | 'new' | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
  }

  // ── 学校未選択: 学校一覧 ────────────────────────────────────
  if (!selSchool) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-4 flex items-center gap-2 sticky top-0 z-20">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)} className="p-1"><ChevronLeft size={24} /></button>
          <h1 className="font-bold text-lg flex items-center gap-2"><GraduationCap size={22} /> マスタ管理</h1>
        </header>

        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <button onClick={() => setWizardOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-sm hover:opacity-95">
            <Sparkles size={18} /> マニュアルから取込（OCR）
          </button>
          <p className="text-xs text-gray-500">
            学校を選ぶと「規定品・価格・商品・サイズセット」を管理できます。
          </p>
          {schools.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 grid place-items-center shrink-0">
                <SchoolIcon size={20} className="text-indigo-600" />
              </div>
              <button onClick={() => openSchool(s)} className="flex-1 text-left">
                <p className="font-bold text-gray-900">{s.name}</p>
                {s.short_name && <p className="text-xs text-gray-400">略称: {s.short_name}</p>}
              </button>
              <button onClick={() => setSchoolModal(s)} className="p-2 text-gray-400 hover:text-indigo-600"><Pencil size={18} /></button>
              <button
                onClick={async () => {
                  if (!confirm(`「${s.name}」を削除しますか？\n関連する規程・別注品も削除されます。`)) return
                  try { await deleteSchool(s.id); show('ok', '削除しました'); reloadBase() }
                  catch (e: any) { show('err', e.message) }
                }}
                className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
            </div>
          ))}
          <button onClick={() => setSchoolModal('new')} className={`${BTN_GHOST} w-full border-dashed py-3`}>
            <Plus size={18} /> 学校を追加
          </button>

          <div className="pt-2">
            <button onClick={() => { setSelSchool({ id: '__sizesets__' } as any); setTab('sizesets') }} className={`${BTN_GHOST} w-full`}>
              <Ruler size={18} /> サイズセットマスタを管理(全校共通)
            </button>
          </div>
        </div>

        {schoolModal && (
          <SchoolModal
            storeId={storeId}
            initial={schoolModal === 'new' ? null : schoolModal}
            nextOrder={schools.length}
            onClose={() => setSchoolModal(null)}
            onSaved={() => { setSchoolModal(null); show('ok', '保存しました'); reloadBase() }}
            onError={(m) => show('err', m)}
          />
        )}

        {wizardOpen && (
          <ManualImportWizard
            storeId={storeId}
            schools={schools}
            onClose={() => setWizardOpen(false)}
            onImported={() => { setWizardOpen(false); show('ok', '取り込みました'); reloadBase() }}
          />
        )}
      </div>
    )
  }

  // ── サイズセット単独管理(学校選択なしで開いた場合) ──────────
  const sizeSetsOnly = (selSchool as any).id === '__sizesets__'

  // ════════════════════════════════════════════════════════════
  // 学校詳細
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button onClick={() => { setSelSchool(null); reloadBase() }} className="p-1"><ChevronLeft size={24} /></button>
          <h1 className="font-bold text-lg truncate">{sizeSetsOnly ? 'サイズセットマスタ' : selSchool.name}</h1>
        </div>
        {!sizeSetsOnly && (
          <div className="flex gap-1 mt-3 bg-white/15 rounded-xl p-1">
            {([['regulations', '規定品', Tag], ['products', '商品マスタ', Package], ['sizesets', 'サイズセット', Ruler]] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold ${tab === k ? 'bg-white text-indigo-700' : 'text-white/90'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="p-4 max-w-3xl mx-auto">
        {(tab === 'sizesets') && (
          <SizeSetsPanel storeId={storeId} sizeSets={sizeSets} onChange={reloadBase} show={show} />
        )}
        {!sizeSetsOnly && tab === 'regulations' && (
          <RegulationsPanel
            storeId={storeId} school={selSchool} requirements={requirements} products={products}
            onChange={() => reloadSchoolData(selSchool)} show={show}
          />
        )}
        {!sizeSetsOnly && tab === 'products' && (
          <ProductsPanel
            storeId={storeId} school={selSchool} products={products} sizeSets={sizeSets}
            onChange={() => reloadSchoolData(selSchool)} show={show}
          />
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 学校 追加/編集モーダル
// ════════════════════════════════════════════════════════════
function SchoolModal({ storeId, initial, nextOrder, onClose, onSaved, onError }: {
  storeId: string; initial: SchoolMaster | null; nextOrder: number
  onClose: () => void; onSaved: () => void; onError: (m: string) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kana, setKana] = useState(initial?.kana ?? '')
  const [shortName, setShortName] = useState(initial?.short_name ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [tel, setTel] = useState(initial?.tel ?? '')
  const [wearingRegulations, setWearingRegulations] = useState(initial?.wearing_regulations ?? '')
  const [specialNotes, setSpecialNotes]              = useState(initial?.special_notes ?? '')
  const [scheduleNotes, setScheduleNotes]             = useState(initial?.schedule_notes ?? '')
  const [extraInfo, setExtraInfo]                     = useState(initial?.extra_info ?? '')
  const [orderDeadline, setOrderDeadline]         = useState(initial?.order_deadline ?? '')
  const [pickupDeadline, setPickupDeadline]       = useState(initial?.pickup_deadline ?? '')
  const [measurementStart, setMeasurementStart]   = useState(initial?.measurement_start ?? '')
  const [measurementEnd, setMeasurementEnd]       = useState(initial?.measurement_end ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) { onError('学校名を入力してください'); return }
    setSaving(true)
    try {
      await upsertSchool({
        id: initial?.id, store_id: storeId, name: name.trim(), kana: kana.trim(),
        short_name: shortName.trim(), notes: notes.trim(),
        sort_order: initial?.sort_order ?? nextOrder, active: initial?.active ?? true,
        address: address.trim() || null,
        tel:     tel.trim()     || null,
        wearing_regulations: wearingRegulations.trim() || null,
        special_notes:       specialNotes.trim()       || null,
        schedule_notes:      scheduleNotes.trim()       || null,
        extra_info:          extraInfo.trim()           || null,
        order_deadline:    orderDeadline   || null,
        pickup_deadline:   pickupDeadline  || null,
        measurement_start: measurementStart || null,
        measurement_end:   measurementEnd   || null,
      })
      onSaved()
    } catch (e: any) { onError(e.message ?? '保存失敗'); setSaving(false) }
  }

  return (
    <Modal title={initial ? '学校を編集' : '学校を追加'} onClose={onClose} wide>
      <Field label="学校名" required><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="桜ヶ丘中学校" /></Field>
      <Field label="ふりがな"><input className={INPUT} value={kana} onChange={(e) => setKana(e.target.value)} placeholder="さくらがおかちゅうがっこう" /></Field>
      <Field label="略称"><input className={INPUT} value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="桜中" /></Field>
      <Field label="メモ"><textarea className={INPUT} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

      {/* 学校情報 */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[11px] font-bold text-gray-400 mb-2">学校情報</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="住所"><input className={INPUT} value={address} onChange={e => setAddress(e.target.value)} placeholder="○○市○○1-2-3" /></Field>
          <Field label="電話番号"><input className={INPUT} value={tel} onChange={e => setTel(e.target.value)} placeholder="03-1234-5678" /></Field>
        </div>
      </div>

      {/* 着用規定・特記事項 */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[11px] font-bold text-gray-400 mb-2">着用規定・特記事項（OCR取込でも入力可。ここで直接編集もできます）</p>
        <div className="space-y-2">
          <Field label="着用規定"><textarea className={INPUT} rows={2} value={wearingRegulations} onChange={e => setWearingRegulations(e.target.value)} placeholder="例: スカート丈は膝下、名札は左胸に付ける" /></Field>
          <Field label="特記事項"><textarea className={INPUT} rows={2} value={specialNotes} onChange={e => setSpecialNotes(e.target.value)} /></Field>
          <Field label="販売スケジュール"><textarea className={INPUT} rows={2} value={scheduleNotes} onChange={e => setScheduleNotes(e.target.value)} /></Field>
          <Field label="その他"><textarea className={INPUT} rows={2} value={extraInfo} onChange={e => setExtraInfo(e.target.value)} /></Field>
        </div>
      </div>

      {/* 締切日管理 */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[11px] font-bold text-gray-400 mb-2">締切日管理（SchoolDeadlineAlert に表示）</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="発注締切日"><input type="date" className={INPUT} value={orderDeadline} onChange={e => setOrderDeadline(e.target.value)} /></Field>
          <Field label="引渡し完了目標日"><input type="date" className={INPUT} value={pickupDeadline} onChange={e => setPickupDeadline(e.target.value)} /></Field>
          <Field label="採寸受付開始日"><input type="date" className={INPUT} value={measurementStart} onChange={e => setMeasurementStart(e.target.value)} /></Field>
          <Field label="採寸受付終了日"><input type="date" className={INPUT} value={measurementEnd} onChange={e => setMeasurementEnd(e.target.value)} /></Field>
        </div>
      </div>
      <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full`}>
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 保存
      </button>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════
// 規定品パネル(規程 + 価格)
// ════════════════════════════════════════════════════════════
function RegulationsPanel({ storeId, school, requirements, products, onChange, show }: {
  storeId: string; school: SchoolMaster; requirements: SchoolRequirement[]; products: ProductMaster[]
  onChange: () => void; show: (t: 'ok' | 'err', m: string) => void
}) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [priceTarget, setPriceTarget] = useState<SchoolRequirement | null>(null)

  const assignedIds = new Set(requirements.map((r) => r.product_id))
  const assignable = products.filter((p) => !assignedIds.has(p.id))

  const patchReq = async (req: SchoolRequirement, patch: Partial<SchoolRequirement>) => {
    try { await upsertRequirement({ id: req.id, ...patch }); onChange() }
    catch (e: any) { show('err', e.message) }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        この学校で扱う商品の「必須/任意・学年色・別寸価格」を設定します。商品自体の追加は「商品マスタ」タブから。
      </p>

      {requirements.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-8">まだ規定品がありません</div>
      )}

      {requirements.map((req) => {
        const p = req.product
        return (
          <div key={req.id} className={`bg-white rounded-2xl border p-4 space-y-3 ${req.required ? 'border-indigo-200' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{p?.name}</p>
                <p className="text-[11px] text-gray-400">
                  {p?.school_id ? '学校別注品' : '自由商品'}
                  {p?.maker_code ? ` ・ ${p.maker_code}` : ''}
                  {p?.size_set?.name ? ` ・ ${p.size_set.name}` : ''}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('この学校の規定品から外しますか？')) return
                  try { await deleteRequirement(req.id); onChange() } catch (e: any) { show('err', e.message) }
                }}
                className="p-1.5 text-gray-300 hover:text-red-600 shrink-0"><Trash2 size={16} /></button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => patchReq(req, { required: !req.required })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${req.required ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>
                {req.required ? '✓ 必須' : '任意'}
              </button>
              <button
                onClick={() => patchReq(req, { uses_grade_color: !req.uses_grade_color })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${req.uses_grade_color ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-500 border-gray-300'}`}>
                学年色あり
              </button>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                平均
                <input
                  type="number" step="0.5"
                  defaultValue={req.avg_qty ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
                    if (v !== req.avg_qty) patchReq(req, { avg_qty: v })
                  }}
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-center" />
                点
              </label>
              <button onClick={() => setPriceTarget(req)} className={`${BTN_GHOST} ml-auto py-1.5`}>
                <Coins size={14} /> 価格設定
              </button>
            </div>
          </div>
        )
      })}

      <button onClick={() => setAssignOpen(true)} className={`${BTN_GHOST} w-full border-dashed py-3`}>
        <Link2 size={18} /> 商品をこの学校に割り当てる
      </button>

      {assignOpen && (
        <Modal title="商品を割り当て" onClose={() => setAssignOpen(false)}>
          {assignable.length === 0 && <p className="text-sm text-gray-400 text-center py-4">割り当て可能な商品がありません。<br />「商品マスタ」タブで商品を追加してください。</p>}
          <div className="space-y-2">
            {assignable.map((p) => (
              <button key={p.id}
                onClick={async () => {
                  try {
                    await assignProductToSchool(storeId, school.id, p.id)
                    setAssignOpen(false); show('ok', '割り当てました'); onChange()
                  } catch (e: any) { show('err', e.message) }
                }}
                className="w-full flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-indigo-400 text-left">
                <Package size={16} className="text-gray-400" />
                <span className="flex-1 text-sm font-bold text-gray-800">{p.name}</span>
                <span className="text-[10px] text-gray-400">{p.school_id ? '別注' : '自由'}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {priceTarget && (
        <PriceModal
          storeId={storeId} schoolId={school.id} req={priceTarget}
          onClose={() => setPriceTarget(null)}
          onSaved={() => { setPriceTarget(null); show('ok', '価格を保存しました'); onChange() }}
          onError={(m) => show('err', m)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 価格設定モーダル(サイズ別 + 別寸EO)
// ════════════════════════════════════════════════════════════
function PriceModal({ storeId, schoolId, req, onClose, onSaved, onError }: {
  storeId: string; schoolId: string; req: SchoolRequirement
  onClose: () => void; onSaved: () => void; onError: (m: string) => void
}) {
  const product = req.product!
  const items = (product.size_set?.items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // サイズごとの価格(item_id -> 価格)
  const [sizePrices, setSizePrices] = useState<Record<string, string>>({})
  const [basePrice, setBasePrice] = useState<string>(product.base_price_tax_in?.toString() ?? '')
  const [eoPrice, setEoPrice] = useState<string>('')

  useEffect(() => {
    (async () => {
      try {
        const rows = await listPrices(schoolId, product.id)
        const map: Record<string, string> = {}
        let base = '', eo = ''
        for (const r of rows) {
          if (r.is_eo) eo = r.price_tax_in?.toString() ?? ''
          else if (r.size_set_item_id) map[r.size_set_item_id] = r.price_tax_in?.toString() ?? ''
          else base = r.price_tax_in?.toString() ?? ''
        }
        setSizePrices(map); setEoPrice(eo)
        if (base) setBasePrice(base)
      } catch (e: any) { onError(e.message) }
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyBaseToAll = () => {
    const v = basePrice
    if (!v) return
    const map: Record<string, string> = {}
    for (const it of items) map[it.id] = v
    setSizePrices(map)
  }

  const save = async () => {
    setSaving(true)
    try {
      const rows: Partial<Price>[] = []
      if (items.length > 0) {
        for (const it of items) {
          const v = sizePrices[it.id]
          if (v) rows.push({ size_set_item_id: it.id, size_label: it.label, price_tax_in: Number(v), is_eo: false })
        }
      } else if (basePrice) {
        // サイズセット無し: 商品共通価格を1行
        rows.push({ size_label: null, price_tax_in: Number(basePrice), is_eo: false })
      }
      if (eoPrice) rows.push({ size_label: '別寸', price_tax_in: Number(eoPrice), is_eo: true })
      await replacePrices(storeId, schoolId, product.id, rows)
      onSaved()
    } catch (e: any) { onError(e.message ?? '保存失敗'); setSaving(false) }
  }

  return (
    <Modal title={`価格設定 — ${product.name}`} onClose={onClose} wide>
      {loading ? <div className="py-8 grid place-items-center"><Loader2 className="animate-spin text-indigo-500" /></div> : (
        <>
          <Field label="標準価格(税込) — 全サイズ一括入力に使用">
            <div className="flex gap-2">
              <input type="number" className={INPUT} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="14500" />
              {items.length > 0 && <button onClick={applyBaseToAll} className={BTN_GHOST}>全サイズへ</button>}
            </div>
          </Field>

          {items.length > 0 ? (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">サイズ別価格(税込) — {product.size_set?.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {items.map((it) => (
                  <label key={it.id} className="flex items-center gap-2 text-sm">
                    <span className="w-16 text-gray-600 shrink-0">{it.label}</span>
                    <input type="number" className="w-full border border-gray-300 rounded-lg px-2 py-1.5"
                      value={sizePrices[it.id] ?? ''} onChange={(e) => setSizePrices((m) => ({ ...m, [it.id]: e.target.value }))} />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              この商品にサイズセットが未設定です。「商品マスタ」でサイズセットを割り当てるとサイズ別価格を入力できます。
            </p>
          )}

          <Field label="別寸(EO)価格(税込)">
            <input type="number" className={INPUT} value={eoPrice} onChange={(e) => setEoPrice(e.target.value)} placeholder="17500" />
          </Field>

          <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full`}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 保存
          </button>
        </>
      )}
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════
// 商品マスタパネル
// ════════════════════════════════════════════════════════════
function ProductsPanel({ storeId, school, products, sizeSets, onChange, show }: {
  storeId: string; school: SchoolMaster; products: ProductMaster[]; sizeSets: SizeSet[]
  onChange: () => void; show: (t: 'ok' | 'err', m: string) => void
}) {
  const [modal, setModal] = useState<ProductMaster | 'new' | null>(null)
  const [labelOpen, setLabelOpen] = useState(false)
  const free = products.filter((p) => !p.school_id)
  const owned = products.filter((p) => p.school_id === school.id)

  const card = (p: ProductMaster) => (
    <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900 truncate">{p.name}</p>
        <p className="text-[11px] text-gray-400">
          {[p.category, p.gender, p.maker, p.maker_code, p.size_set?.name, p.barcode ? `🏷 ${p.barcode}` : null].filter(Boolean).join(' ・ ')}
        </p>
        {p.body_types?.length > 0 && (
          <div className="flex gap-1 mt-1">
            {p.body_types.map((b) => (
              <span key={b} className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">{b}体</span>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => setModal(p)} className="p-2 text-gray-400 hover:text-indigo-600"><Pencil size={18} /></button>
      <button onClick={async () => {
        if (!confirm(`「${p.name}」を削除しますか？`)) return
        try { await deleteProduct(p.id); show('ok', '削除しました'); onChange() } catch (e: any) { show('err', e.message) }
      }} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setLabelOpen(true)} className={BTN_GHOST}>
          <Tag size={15} /> 値札（バーコード）印刷
        </button>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1"><Package size={16} /> 学校別注品（{school.name}専用）</h2>
        {owned.length === 0 && <p className="text-xs text-gray-400">まだありません</p>}
        {owned.map(card)}
        <button onClick={() => setModal('new')} className={`${BTN_GHOST} w-full border-dashed py-2.5`}>
          <Plus size={16} /> 学校別注品を追加
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1"><Package size={16} /> 自由商品（全校共通）</h2>
        {free.length === 0 && <p className="text-xs text-gray-400">まだありません</p>}
        {free.map(card)}
      </section>

      {modal && (
        <ProductModal
          storeId={storeId} school={school} sizeSets={sizeSets}
          initial={modal === 'new' ? null : modal} nextOrder={products.length}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); show('ok', '保存しました'); onChange() }}
          onError={(m) => show('err', m)}
        />
      )}

      {labelOpen && (
        <LabelPrintModal products={products} onClose={() => setLabelOpen(false)} />
      )}
    </div>
  )
}

function ProductModal({ storeId, school, sizeSets, initial, nextOrder, onClose, onSaved, onError }: {
  storeId: string; school: SchoolMaster; sizeSets: SizeSet[]
  initial: ProductMaster | null; nextOrder: number
  onClose: () => void; onSaved: () => void; onError: (m: string) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '男女共通')
  const [maker, setMaker] = useState(initial?.maker ?? '')
  const [makerCode, setMakerCode] = useState(initial?.maker_code ?? '')
  const [barcode, setBarcode] = useState(initial?.barcode ?? '')
  const [stockStr, setStockStr] = useState(initial?.stock != null ? String(initial.stock) : '')
  const [scanOpen, setScanOpen] = useState(false)
  const [washable, setWashable] = useState(initial?.washable ?? '')
  const [bodyTypes, setBodyTypes] = useState<string[]>(initial?.body_types ?? [])
  const [sizeSetId, setSizeSetId] = useState(initial?.size_set_id ?? '')
  const [basePrice, setBasePrice] = useState(initial?.base_price_tax_in?.toString() ?? '')
  // 新規: 自由商品 or 学校別注品
  const [isFree, setIsFree] = useState(initial ? !initial.school_id : false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) { onError('商品名を入力してください'); return }
    setSaving(true)
    try {
      await upsertProduct({
        id: initial?.id, store_id: storeId,
        school_id: isFree ? null : (initial?.school_id ?? school.id),
        name: name.trim(), category: category || null, gender: gender || null,
        maker: maker.trim() || null, maker_code: makerCode.trim() || null,
        barcode: barcode.trim() || null,
        stock: stockStr.trim() === '' ? null : Math.round(Number(stockStr) || 0),
        washable: washable || null, size_set_id: sizeSetId || null,
        body_types: bodyTypes,
        base_price_tax_in: basePrice ? Number(basePrice) : null,
        sort_order: initial?.sort_order ?? nextOrder, active: initial?.active ?? true,
      })
      onSaved()
    } catch (e: any) { onError(e.message ?? '保存失敗'); setSaving(false) }
  }

  return (
    <Modal title={initial ? '商品を編集' : '商品を追加'} onClose={onClose} wide>
      {!initial && (
        <div className="flex gap-2">
          <button onClick={() => setIsFree(false)} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${!isFree ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>
            学校別注品
          </button>
          <button onClick={() => setIsFree(true)} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${isFree ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>
            自由商品(全校共通)
          </button>
        </div>
      )}
      <Field label="商品名" required><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="ブレザー" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="カテゴリ">
          <select className={INPUT} value={category ?? ''} onChange={(e) => setCategory(e.target.value)}>
            <option value="">—</option>
            {PRODUCT_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="性別">
          <select className={INPUT} value={gender ?? ''} onChange={(e) => setGender(e.target.value)}>
            {PRODUCT_GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="メーカー"><input className={INPUT} value={maker} onChange={(e) => setMaker(e.target.value)} placeholder="トンボ" /></Field>
        <Field label="メーカー品番"><input className={INPUT} value={makerCode} onChange={(e) => setMakerCode(e.target.value)} placeholder="BL-101" /></Field>
        <Field label="洗濯">
          <select className={INPUT} value={washable ?? ''} onChange={(e) => setWashable(e.target.value)}>
            <option value="">—</option>
            {WASHABLE_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="サイズセット">
          <select className={INPUT} value={sizeSetId ?? ''} onChange={(e) => setSizeSetId(e.target.value)}>
            <option value="">—</option>
            {sizeSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="体型区分">
        <div className="flex gap-2">
          {BODY_TYPE_OPTIONS.map((b) => {
            const on = bodyTypes.includes(b.value)
            return (
              <button key={b.value} type="button"
                onClick={() => setBodyTypes((prev) => on ? prev.filter((v) => v !== b.value) : [...prev, b.value])}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>
                {b.label}<span className="block text-[10px] font-medium opacity-70">{b.desc}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">未選択＝体型区分なし（号数のみで管理）</p>
      </Field>
      <Field label="標準価格(税込)"><input type="number" className={INPUT} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="14500" /></Field>
      <Field label="バーコード / QRコード（レジのスキャン読み取り用）">
        <div className="flex gap-2">
          <input className={INPUT} value={barcode} onChange={(e) => setBarcode(e.target.value)}
            placeholder="4901234567894" inputMode="numeric" />
          <button type="button" onClick={() => setScanOpen(true)} className={`${BTN_GHOST} shrink-0`}>
            <ScanLine size={16} /> スキャン
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">商品タグのJANコードやQRを登録すると、レジでスキャンするだけでカートに入ります。</p>
      </Field>
      <Field label="在庫数（空欄=在庫管理しない）">
        <input type="number" className={INPUT} value={stockStr} onChange={(e) => setStockStr(e.target.value)} placeholder="—" inputMode="numeric" />
        <p className="text-[10px] text-gray-400 mt-1">入力するとレジ会計で自動減算されます（取消で戻ります）。</p>
      </Field>
      <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full`}>
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 保存
      </button>
      {scanOpen && (
        <BarcodeScannerSheet
          title="バーコードを読み取り"
          hint="商品タグのバーコード・QRを枠に合わせてください"
          onDetect={(code) => setBarcode(code)}
          onClose={() => setScanOpen(false)}
        />
      )}
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════
// サイズセットパネル
// ════════════════════════════════════════════════════════════
function SizeSetsPanel({ storeId, sizeSets, onChange, show }: {
  storeId: string; sizeSets: SizeSet[]; onChange: () => void; show: (t: 'ok' | 'err', m: string) => void
}) {
  const [modal, setModal] = useState<SizeSet | 'new' | null>(null)

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">メーカーごとのサイズ規格。商品マスタから参照され、価格設定のサイズ候補になります。</p>
      {sizeSets.map((s) => (
        <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Ruler size={18} className="text-cyan-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">{s.name}</p>
              <p className="text-[11px] text-gray-400">
                {SIZE_SET_CATEGORY_OPTIONS.find((c) => c.value === s.category)?.label ?? s.category ?? '汎用'}
                ・{(s.items ?? []).length}サイズ
              </p>
            </div>
            <button onClick={() => setModal(s)} className="p-2 text-gray-400 hover:text-indigo-600"><Pencil size={18} /></button>
            <button onClick={async () => {
              if (!confirm(`「${s.name}」を削除しますか？`)) return
              try { await deleteSizeSet(s.id); show('ok', '削除しました'); onChange() } catch (e: any) { show('err', e.message) }
            }} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
          </div>
          {(s.items ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(s.items ?? []).map((it) => (
                <span key={it.id} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[11px]">{it.label}</span>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={() => setModal('new')} className={`${BTN_GHOST} w-full border-dashed py-3`}>
        <Plus size={18} /> サイズセットを追加
      </button>

      {modal && (
        <SizeSetModal
          storeId={storeId} initial={modal === 'new' ? null : modal} nextOrder={sizeSets.length}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); show('ok', '保存しました'); onChange() }}
          onError={(m) => show('err', m)}
        />
      )}
    </div>
  )
}

function SizeSetModal({ storeId, initial, nextOrder, onClose, onSaved, onError }: {
  storeId: string; initial: SizeSet | null; nextOrder: number
  onClose: () => void; onSaved: () => void; onError: (m: string) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'general')
  const [labels, setLabels] = useState((initial?.items ?? []).map((i) => i.label).join('\n'))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) { onError('名称を入力してください'); return }
    setSaving(true)
    try {
      const saved = await upsertSizeSet({
        id: initial?.id, store_id: storeId, name: name.trim(),
        category: category || null, sort_order: initial?.sort_order ?? nextOrder, active: true,
      })
      const list = labels.split(/[\n,、]/).map((l) => l.trim()).filter(Boolean)
      await replaceSizeSetItems(saved.id, list)
      onSaved()
    } catch (e: any) { onError(e.message ?? '保存失敗'); setSaving(false) }
  }

  return (
    <Modal title={initial ? 'サイズセットを編集' : 'サイズセットを追加'} onClose={onClose}>
      <Field label="名称" required><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="標準 上衣サイズ" /></Field>
      <Field label="区分">
        <select className={INPUT} value={category ?? ''} onChange={(e) => setCategory(e.target.value)}>
          {SIZE_SET_CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="サイズ一覧(改行 / カンマ区切り)">
        <textarea className={INPUT} rows={6} value={labels} onChange={(e) => setLabels(e.target.value)} placeholder={'150\n155\n160\n165'} />
      </Field>
      <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full`}>
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 保存
      </button>
    </Modal>
  )
}
