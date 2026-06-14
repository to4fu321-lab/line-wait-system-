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
  Loader2, X, Check, Tag, Coins, School as SchoolIcon, Link2,
  LayoutGrid, AlertCircle,
} from 'lucide-react'
import {
  listSchools, upsertSchool, deleteSchool,
  listSizeSets, upsertSizeSet, deleteSizeSet, replaceSizeSetItems,
  listProducts, upsertProduct, deleteProduct,
  listRequirements, upsertRequirement, deleteRequirement, assignProductToSchool,
  listPrices, listPriceBands, replacePriceBands, deriveBandsFromPrices, expandBandsToPrices,
  getStoreCoverage,
} from '@/lib/master'
import type { SchoolCoverage } from '@/lib/master'
import {
  PRODUCT_CATEGORY_OPTIONS, PRODUCT_GENDER_OPTIONS,
  WASHABLE_OPTIONS, SIZE_SET_CATEGORY_OPTIONS, BODY_TYPE_OPTIONS,
} from '@/types/master'
import type {
  SchoolMaster, SizeSet, SizeSetItem, ProductMaster, SchoolRequirement, PriceBand,
} from '@/types/master'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50'
const BTN_GHOST = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50'

// ── 小物 ──────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-900'
    }`}>{msg}</div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

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
  const [coverage, setCoverage] = useState<Record<string, SchoolCoverage>>({})
  const [showCoverage, setShowCoverage] = useState(false)

  // ── 初期ロード ──────────────────────────────────────────────
  const reloadBase = useCallback(async () => {
    setLoading(true)
    try {
      const [sc, ss, cov] = await Promise.all([
        listSchools(storeId), listSizeSets(storeId), getStoreCoverage(storeId),
      ])
      setSchools(sc); setSizeSets(ss); setCoverage(cov)
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

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
  }

  // ── 学校未選択: 学校一覧 ────────────────────────────────────
  if (!selSchool) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-4 flex items-center gap-2 sticky top-0 z-20">
          <button onClick={() => router.push(`/${storeId}/admin/settings`)} className="p-1"><ChevronLeft size={24} /></button>
          <h1 className="font-bold text-lg flex items-center gap-2"><GraduationCap size={22} /> マスタ管理</h1>
        </header>

        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 flex-1">
              学校を選ぶと「規定品・価格・商品・サイズセット」を管理できます。
            </p>
            <button onClick={() => setShowCoverage((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shrink-0 ${showCoverage ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>
              <LayoutGrid size={13} /> 俯瞰
            </button>
          </div>
          {schools.map((s) => {
            const cov = coverage[s.id]
            const done = cov ? cov.priced >= cov.total && cov.total > 0 : false
            return (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 grid place-items-center shrink-0">
                  <SchoolIcon size={20} className="text-indigo-600" />
                </div>
                <button onClick={() => openSchool(s)} className="flex-1 text-left min-w-0">
                  <p className="font-bold text-gray-900 truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.short_name && <span className="text-xs text-gray-400">略称: {s.short_name}</span>}
                    {cov && cov.total > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
                        価格 {cov.priced}/{cov.total}
                      </span>
                    )}
                  </div>
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
              {/* 俯瞰: 価格未設定の商品一覧 */}
              {showCoverage && cov && cov.unset.length > 0 && (
                <button onClick={() => openSchool(s)}
                  className="mt-2 w-full text-left bg-amber-50 rounded-xl px-3 py-2 flex items-start gap-1.5">
                  <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-amber-800 leading-snug">
                    価格未設定: {cov.unset.join('、')}
                  </span>
                </button>
              )}
              {showCoverage && cov && cov.total > 0 && cov.unset.length === 0 && (
                <p className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1"><Check size={12} /> 全規定品の価格設定済み</p>
              )}
            </div>
          )})}
          <button onClick={() => setSchoolModal('new')} className={`${BTN_GHOST} w-full border-dashed py-3`}>
            <Plus size={18} /> 学校を追加
          </button>

          <div className="pt-2">
            <button onClick={() => { setSelSchool({ id: '__sizesets__' } as any); setTab('sizesets') }} className={`${BTN_GHOST} w-full`}>
              <Ruler size={18} /> サイズセットマスタを管理(全校共通)
            </button>
          </div>

          {/* その他のマスタ(このハブから集約して開く) */}
          <div className="pt-4">
            <p className="text-[11px] font-bold text-gray-400 mb-2 px-1">その他のマスタ</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: `/${storeId}/admin/master/suppliers`,  emoji: '🏭', label: 'メーカー・仕入先' },
                { href: `/${storeId}/admin/master/sizes`,      emoji: '📏', label: 'サイズ表記' },
                { href: `/${storeId}/admin/master/processing`, emoji: '✂️', label: '新品加工オプション' },
                { href: `/${storeId}/admin/master/repair`,     emoji: '🧵', label: 'お直し料金' },
                { href: `/${storeId}/admin/master?tab=staff`,  emoji: '🧑‍💼', label: 'スタッフ' },
                { href: `/${storeId}/admin/master/tags`,       emoji: '🏷️', label: '顧客タグ' },
                { href: `/${storeId}/admin/master/templates`,  emoji: '💬', label: '定型文' },
              ].map((m) => (
                <button key={m.label} onClick={() => router.push(m.href)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left active:bg-gray-50">
                  <span className="text-base shrink-0">{m.emoji}</span>
                  <span className="text-xs font-bold text-gray-700 leading-tight">{m.label}</span>
                </button>
              ))}
            </div>
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
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) { onError('学校名を入力してください'); return }
    setSaving(true)
    try {
      await upsertSchool({
        id: initial?.id, store_id: storeId, name: name.trim(), kana: kana.trim(),
        short_name: shortName.trim(), notes: notes.trim(),
        sort_order: initial?.sort_order ?? nextOrder, active: initial?.active ?? true,
      })
      onSaved()
    } catch (e: any) { onError(e.message ?? '保存失敗'); setSaving(false) }
  }

  return (
    <Modal title={initial ? '学校を編集' : '学校を追加'} onClose={onClose}>
      <Field label="学校名" required><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="桜ヶ丘中学校" /></Field>
      <Field label="ふりがな"><input className={INPUT} value={kana} onChange={(e) => setKana(e.target.value)} placeholder="さくらがおかちゅうがっこう" /></Field>
      <Field label="略称"><input className={INPUT} value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="桜中" /></Field>
      <Field label="メモ"><textarea className={INPUT} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
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
// 価格設定モーダル(価格帯バンド + 別寸EO)
//   サイズ範囲(例 150〜180)ごとに価格を入力 → 保存時に prices へ展開。
// ════════════════════════════════════════════════════════════
type BandRow = { key: string; from: string; to: string; price: string }
let bandKeySeq = 0
const newKey = () => `b${++bandKeySeq}`

function PriceModal({ storeId, schoolId, req, onClose, onSaved, onError }: {
  storeId: string; schoolId: string; req: SchoolRequirement
  onClose: () => void; onSaved: () => void; onError: (m: string) => void
}) {
  const product = req.product!
  const items: SizeSetItem[] = (product.size_set?.items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  const hasSizes = items.length > 0
  const labelOf = (id: string | null) => items.find((it) => it.id === id)?.label ?? '—'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [bands, setBands]     = useState<BandRow[]>([])
  const [commonPrice, setCommonPrice] = useState('') // サイズセット無し商品の共通価格
  const [eoPrice, setEoPrice] = useState('')

  useEffect(() => {
    (async () => {
      try {
        // 価格帯が未登録なら既存 prices から推定して初期表示
        let src = await listPriceBands(schoolId, product.id)
        if (src.length === 0) {
          const prices = await listPrices(schoolId, product.id)
          src = deriveBandsFromPrices(prices, items) as PriceBand[]
          const eo = prices.find((p) => p.is_eo)
          if (eo) setEoPrice(String(eo.price_tax_in))
        } else {
          const eo = src.find((b) => b.is_eo)
          if (eo) setEoPrice(String(eo.price_tax_in))
        }
        const rows: BandRow[] = src.filter((b) => !b.is_eo && b.from_item_id).map((b) => ({
          key: newKey(), from: b.from_item_id!, to: b.to_item_id ?? b.from_item_id!,
          price: String(b.price_tax_in),
        }))
        setBands(rows)
        const common = src.find((b) => !b.is_eo && !b.from_item_id)
        if (common) setCommonPrice(String(common.price_tax_in))
      } catch (e: any) { onError(e.message) }
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addBand = () => {
    const last = items[items.length - 1]
    setBands((prev) => [...prev, { key: newKey(), from: items[0]?.id ?? '', to: last?.id ?? '', price: '' }])
  }
  const patchBand = (key: string, patch: Partial<BandRow>) =>
    setBands((prev) => prev.map((b) => b.key === key ? { ...b, ...patch } : b))
  const removeBand = (key: string) => setBands((prev) => prev.filter((b) => b.key !== key))

  // プレビュー: 現在の入力をサイズ別価格に展開
  const preview = (() => {
    const pseudo = bands.filter((b) => b.price && b.from).map((b, i) => ({
      from_item_id: b.from, to_item_id: b.to || b.from,
      price_tax_in: Number(b.price), price_tax_out: null, cost: null,
      is_eo: false, sort_order: i,
    })) as PriceBand[]
    const rows = expandBandsToPrices(pseudo, items)
    const map = new Map(rows.filter((r) => r.size_set_item_id).map((r) => [r.size_set_item_id, r.price_tax_in!]))
    return items.map((it) => ({ label: it.label, price: map.get(it.id) ?? null }))
  })()
  const unsetCount = preview.filter((p) => p.price == null).length

  const save = async () => {
    setSaving(true)
    try {
      const payload: Array<Partial<PriceBand>> = []
      if (hasSizes) {
        for (const b of bands) {
          if (!b.price || !b.from) continue
          payload.push({
            from_item_id: b.from, to_item_id: b.to || b.from,
            price_tax_in: Number(b.price), is_eo: false,
            label: b.from === b.to ? labelOf(b.from) : `${labelOf(b.from)}〜${labelOf(b.to)}`,
          })
        }
      } else if (commonPrice) {
        payload.push({ from_item_id: null, to_item_id: null, price_tax_in: Number(commonPrice), is_eo: false })
      }
      if (eoPrice) payload.push({ from_item_id: null, to_item_id: null, price_tax_in: Number(eoPrice), is_eo: true, label: '別寸' })
      await replacePriceBands(storeId, schoolId, product.id, payload, items)
      onSaved()
    } catch (e: any) { onError(e.message ?? '保存失敗'); setSaving(false) }
  }

  return (
    <Modal title={`価格設定 — ${product.name}`} onClose={onClose} wide>
      {loading ? <div className="py-8 grid place-items-center"><Loader2 className="animate-spin text-indigo-500" /></div> : (
        <>
          {hasSizes ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600">価格帯 — {product.size_set?.name}</p>
                <span className="text-[10px] text-gray-400">サイズ範囲ごとに価格を設定</span>
              </div>

              <div className="space-y-2">
                {bands.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">「+ 価格帯を追加」から範囲と価格を入力してください</p>
                )}
                {bands.map((b) => (
                  <div key={b.key} className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-2">
                    <select className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                      value={b.from} onChange={(e) => patchBand(b.key, { from: e.target.value })}>
                      {items.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
                    </select>
                    <span className="text-gray-400 text-sm shrink-0">〜</span>
                    <select className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                      value={b.to} onChange={(e) => patchBand(b.key, { to: e.target.value })}>
                      {items.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
                    </select>
                    <div className="relative shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">¥</span>
                      <input type="number" inputMode="numeric" placeholder="価格"
                        className="w-24 border border-gray-300 rounded-lg pl-5 pr-2 py-1.5 text-sm"
                        value={b.price} onChange={(e) => patchBand(b.key, { price: e.target.value })} />
                    </div>
                    <button onClick={() => removeBand(b.key)} className="p-1.5 text-gray-300 hover:text-red-600 shrink-0"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <button onClick={addBand} className={`${BTN_GHOST} w-full border-dashed py-2`}>
                <Plus size={16} /> 価格帯を追加
              </button>

              {/* プレビュー: 全サイズの確定価格 */}
              <div className="bg-indigo-50/50 rounded-xl p-3">
                <p className="text-[11px] font-bold text-gray-500 mb-1.5">
                  確定プレビュー{unsetCount > 0 && <span className="text-amber-600 ml-1">(未設定 {unsetCount}件)</span>}
                </p>
                <div className="flex flex-wrap gap-1">
                  {preview.map((p) => (
                    <span key={p.label}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${p.price == null ? 'bg-amber-100 text-amber-700' : 'bg-white text-gray-700 border border-gray-200'}`}>
                      {p.label}{p.price != null ? ` ¥${p.price.toLocaleString()}` : ' 未'}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <Field label="共通価格(税込)">
              <input type="number" className={INPUT} value={commonPrice} onChange={(e) => setCommonPrice(e.target.value)} placeholder="14500" />
              <p className="text-[11px] text-amber-600 mt-1">
                サイズセット未設定のため共通価格になります。サイズ別にするには「商品マスタ」でサイズセットを割り当ててください。
              </p>
            </Field>
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
  const free = products.filter((p) => !p.school_id)
  const owned = products.filter((p) => p.school_id === school.id)

  const card = (p: ProductMaster) => (
    <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900 truncate">{p.name}</p>
        <p className="text-[11px] text-gray-400">
          {[p.category, p.gender, p.maker, p.maker_code, p.size_set?.name].filter(Boolean).join(' ・ ')}
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
      <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full`}>
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 保存
      </button>
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
