'use client'

// ============================================================
// マニュアル OCR 一括取込ウィザード（4ステップ）
//   1. アップロード → 2. AI解析 → 3. 確認・編集 → 4. 完了
//   設計: docs/superpowers/specs/2026-06-15-manual-ocr-import-design.md
// ============================================================
import { useState, useMemo } from 'react'
import { Loader2, X, Check, Upload, FileText, AlertTriangle, Sparkles } from 'lucide-react'
import { PRODUCT_CATEGORY_OPTIONS, PRODUCT_GENDER_OPTIONS } from '@/types/master'
import type { SchoolMaster } from '@/types/master'
import type { SchoolManualExtraction, SchoolManualItem } from '@/lib/ocr/schemas/school-manual'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50'
const BTN_GHOST = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50'

type EditItem = SchoolManualItem & { selected: boolean }
type SchoolMode = 'existing' | 'new'
type ReviewTab = 'content' | 'items'

interface ProcessResult {
  extraction: SchoolManualExtraction
  matched_school_id: string | null
  detected_name: string | null
}
interface ImportSummary {
  school_id: string; school_created: boolean
  products_created: number; requirements_created: number; prices_created: number
  size_sets_created: number
  skipped: { item_name: string; reason: string }[]
}

const ACCEPT = 'image/*,.pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

function ConfBadge({ c }: { c: SchoolManualItem['confidence'] }) {
  if (c === 'low') return <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold inline-flex items-center gap-0.5"><AlertTriangle size={10} />要確認</span>
  if (c === 'medium') return <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold">中</span>
  return <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">高</span>
}

export default function ManualImportWizard({ storeId, schools, onClose, onImported }: {
  storeId: string
  schools: SchoolMaster[]
  onClose: () => void
  onImported: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const [jobId, setJobId] = useState<string | null>(null)
  const [result, setResult] = useState<ProcessResult | null>(null)

  // Step3 編集状態
  const [items, setItems] = useState<EditItem[]>([])
  const [reg, setReg] = useState({ wearing_regulations: '', special_notes: '', schedule_notes: '', extra_info: '' })
  const [applyReg, setApplyReg] = useState(true)
  const [reviewTab, setReviewTab] = useState<ReviewTab>('items')

  const [schoolMode, setSchoolMode] = useState<SchoolMode>('new')
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [newName, setNewName] = useState('')

  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const selectedCount = useMemo(() => items.filter((i) => i.selected).length, [items])

  // ── Step1 → Step2: 解析 ───────────────────────────────────
  const startOcr = async () => {
    if (files.length === 0) return
    setStep(2); setError(null)
    try {
      const form = new FormData()
      form.append('storeId', storeId)
      files.forEach((f) => form.append('files', f))
      const res = await fetch('/api/ocr/process', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析に失敗しました')
      const r = data.result as ProcessResult
      setJobId(data.jobId)
      setResult(r)
      initEdit(r)
      setStep(3)
    } catch (e: any) {
      setError(e.message ?? '解析に失敗しました')
      setStep(1)
    }
  }

  const initEdit = (r: ProcessResult) => {
    const ex = r.extraction
    setItems(ex.items.map((it) => ({ ...it, selected: it.confidence !== 'low' })))
    setReg({
      wearing_regulations: ex.wearing_regulations ?? '',
      special_notes: ex.special_notes ?? '',
      schedule_notes: ex.schedule_notes ?? '',
      extra_info: ex.extra_info ?? '',
    })
    // 学校マッチング初期値
    if (r.matched_school_id) {
      setSchoolMode('existing'); setSelectedSchoolId(r.matched_school_id)
    } else if (r.detected_name) {
      setSchoolMode('new'); setNewName(r.detected_name)
    } else {
      setSchoolMode('new'); setNewName('')
    }
  }

  const patchItem = (idx: number, patch: Partial<EditItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const patchSize = (idx: number, sIdx: number, price: string) =>
    setItems((prev) => prev.map((it, i) => i === idx
      ? { ...it, sizes: it.sizes.map((s, j) => j === sIdx ? { ...s, price_tax_in: price === '' ? null : Number(price) } : s) }
      : it))

  const allSelected = items.length > 0 && items.every((i) => i.selected)
  const toggleAll = () => setItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })))

  // ── Step3 → Step4: 取込 ───────────────────────────────────
  const doImport = async (onlySelected: boolean) => {
    setError(null)
    // 学校バリデーション
    if (schoolMode === 'existing' && !selectedSchoolId) { setError('紐付ける学校を選択してください'); return }
    if (schoolMode === 'new' && !newName.trim()) { setError('学校名を入力してください'); return }

    const target = onlySelected ? items.filter((i) => i.selected) : items
    if (target.length === 0) { setError('取り込む商品がありません'); return }

    setImporting(true)
    try {
      const payload = {
        storeId,
        school: schoolMode === 'existing'
          ? { mode: 'existing' as const, id: selectedSchoolId }
          : { mode: 'new' as const, name: newName.trim() },
        apply_regulations: applyReg,
        regulations: {
          wearing_regulations: reg.wearing_regulations || null,
          special_notes: reg.special_notes || null,
          schedule_notes: reg.schedule_notes || null,
          extra_info: reg.extra_info || null,
        },
        items: target.map(({ selected, ...rest }) => rest),
      }
      const res = await fetch(`/api/ocr/import/${jobId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '取込に失敗しました')
      setSummary(data)
      setStep(4)
    } catch (e: any) {
      setError(e.message ?? '取込に失敗しました')
    }
    setImporting(false)
  }

  const reset = () => {
    setStep(1); setFiles([]); setError(null); setJobId(null); setResult(null)
    setItems([]); setSummary(null); setImporting(false)
  }

  // ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[75] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[94vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダ + ステップ表示 */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b rounded-t-3xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-1.5"><Sparkles size={18} className="text-indigo-600" /> マニュアルから取込</h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={22} /></button>
          </div>
          <div className="flex gap-1 mt-3">
            {(['アップロード', 'AI解析', '確認・編集', '完了'] as const).map((label, i) => (
              <div key={label} className={`flex-1 text-center text-[10px] font-bold py-1 rounded-md ${step >= i + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}. {label}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}

          {/* ── Step 1: アップロード ── */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="block border-2 border-dashed border-indigo-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-indigo-50/50">
                <input type="file" accept={ACCEPT} multiple className="hidden"
                  onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
                <Upload size={28} className="mx-auto text-indigo-500 mb-2" />
                <p className="font-bold text-indigo-700">マニュアル・あんちょこ・価格表を選択</p>
                <p className="text-xs text-gray-500 mt-1">JPG / PNG / PDF / Excel / CSV（複数可）</p>
              </label>
              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <FileText size={16} className="text-gray-400 shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-[11px] text-gray-400">{Math.round(f.size / 1024)}KB</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-600"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={startOcr} disabled={files.length === 0} className={`${BTN_PRIMARY} w-full`}>
                <Sparkles size={16} /> AI解析を開始（{files.length}ファイル）
              </button>
            </div>
          )}

          {/* ── Step 2: 解析中 ── */}
          {step === 2 && (
            <div className="py-12 text-center space-y-3">
              <Loader2 size={36} className="mx-auto animate-spin text-indigo-500" />
              <p className="font-bold text-gray-700">AIが読み取り中です…</p>
              <p className="text-xs text-gray-400">ファイル数・ページ数により最大数十秒かかります</p>
            </div>
          )}

          {/* ── Step 3: 確認・編集 ── */}
          {step === 3 && result && (
            <div className="space-y-4">
              {/* 学校マッチング */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-indigo-800">取込先の学校</p>
                <div className="flex gap-2">
                  <button onClick={() => setSchoolMode('new')} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${schoolMode === 'new' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>新規学校として登録</button>
                  <button onClick={() => setSchoolMode('existing')} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${schoolMode === 'existing' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>既存校に紐付け</button>
                </div>
                {schoolMode === 'new' ? (
                  <input className={INPUT} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="学校名（例: 桜ヶ丘中学校）" />
                ) : (
                  <select className={INPUT} value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)}>
                    <option value="">— 学校を選択 —</option>
                    {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                {result.matched_school_id && schoolMode === 'existing' && selectedSchoolId === result.matched_school_id && (
                  <p className="text-[11px] text-emerald-700 font-bold">✓ 読み取った学校名がマスタと一致しました</p>
                )}
                {!result.detected_name && (
                  <p className="text-[11px] text-amber-600">⚠ 学校名を読み取れませんでした。手入力または既存校を選んでください。</p>
                )}
              </div>

              {/* タブ */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([['items', `商品・価格 (${items.length})`], ['content', '着用規定・特記事項']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setReviewTab(k)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${reviewTab === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}>{label}</button>
                ))}
              </div>

              {reviewTab === 'content' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <input type="checkbox" checked={applyReg} onChange={(e) => setApplyReg(e.target.checked)} />
                    これらの内容を学校マスタに保存する
                  </label>
                  {([['wearing_regulations', '着用規定'], ['schedule_notes', '販売スケジュール'], ['special_notes', '特記事項'], ['extra_info', 'その他']] as const).map(([k, label]) => (
                    <div key={k}>
                      <p className="text-xs font-bold text-gray-600 mb-1">{label}</p>
                      <textarea className={INPUT} rows={2} value={reg[k]} onChange={(e) => setReg((p) => ({ ...p, [k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              )}

              {reviewTab === 'items' && (
                <div className="space-y-3">
                  {items.length === 0 && <p className="text-center text-gray-400 text-sm py-6">商品を読み取れませんでした</p>}
                  {items.length > 0 && (
                    <button onClick={toggleAll} className="text-xs font-bold text-indigo-600">{allSelected ? '全選択を解除' : 'すべて選択'}</button>
                  )}
                  {items.map((it, idx) => (
                    <div key={idx} className={`rounded-2xl border p-3 space-y-2 ${it.selected ? 'border-indigo-300 bg-white' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={it.selected} onChange={(e) => patchItem(idx, { selected: e.target.checked })} />
                        <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold" value={it.item_name} onChange={(e) => patchItem(idx, { item_name: e.target.value })} />
                        <ConfBadge c={it.confidence} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={it.category ?? ''} onChange={(e) => patchItem(idx, { category: e.target.value || null })}>
                          <option value="">カテゴリ—</option>
                          {PRODUCT_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value={it.gender ?? ''} onChange={(e) => patchItem(idx, { gender: e.target.value || null })}>
                          <option value="">性別—</option>
                          {PRODUCT_GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => patchItem(idx, { required: !it.required })} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${it.required ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}>{it.required ? '必須' : '任意'}</button>
                        {it.maker_code && <span className="text-[11px] text-gray-400">{it.maker_code}</span>}
                      </div>
                      {it.sizes.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5">
                          {it.sizes.map((s, sIdx) => (
                            <label key={sIdx} className="flex items-center gap-1 text-[11px]">
                              <span className="w-9 text-gray-500 shrink-0 truncate">{s.label || '—'}</span>
                              <input type="number" className="w-full border border-gray-200 rounded px-1 py-1" value={s.price_tax_in ?? ''} onChange={(e) => patchSize(idx, sIdx, e.target.value)} />
                            </label>
                          ))}
                        </div>
                      )}
                      {it.eo_price_tax_in != null && (
                        <p className="text-[11px] text-orange-600">別寸(EO): ¥{it.eo_price_tax_in.toLocaleString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => doImport(true)} disabled={importing || selectedCount === 0} className={`${BTN_PRIMARY} flex-1`}>
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 選択した{selectedCount}件を取込
                </button>
                <button onClick={() => doImport(false)} disabled={importing || items.length === 0} className={`${BTN_GHOST} flex-1`}>すべて取込</button>
              </div>
            </div>
          )}

          {/* ── Step 4: 完了 ── */}
          {step === 4 && summary && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 grid place-items-center mx-auto mb-2"><Check size={28} className="text-emerald-600" /></div>
                <p className="font-bold text-gray-900">取込が完了しました</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-1">
                {summary.school_created && <p className="text-indigo-700 font-bold">＋ 学校を新規作成しました</p>}
                <p>商品: <span className="font-bold">{summary.products_created}</span> 件</p>
                <p>規定品: <span className="font-bold">{summary.requirements_created}</span> 件</p>
                <p>サイズ×価格: <span className="font-bold">{summary.prices_created}</span> 件</p>
                {summary.size_sets_created > 0 && <p>サイズセット自動生成: <span className="font-bold">{summary.size_sets_created}</span> 件</p>}
                {summary.skipped.length > 0 && (
                  <div className="pt-2 text-amber-700">
                    <p className="font-bold">スキップ {summary.skipped.length} 件</p>
                    {summary.skipped.map((s, i) => <p key={i} className="text-[11px]">・{s.item_name}: {s.reason}</p>)}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={reset} className={`${BTN_GHOST} flex-1`}>別のマニュアルを取込む</button>
                <button onClick={onImported} className={`${BTN_PRIMARY} flex-1`}>マスタ管理で確認</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
