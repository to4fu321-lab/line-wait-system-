'use client'

// ============================================================
// 伝票OCRテンプレート管理（/admin/master/ocr-templates）
//   店舗ごとに「受付伝票」「お直し伝票」「加工伝票」等を作り、
//   伝票種別ごとにOCRで読み取る項目を自由に編集できる。
//   さらに「サンプル伝票を撮影」すると、AIが項目を提案し、
//   微修正して保存＝その伝票専用のOCRに自己最適化できる。
//
//   通信は API 経由（storePin 認証）。lib/supabase を直接使わないのは
//   RLS が JWT セッション前提で、この画面は storePin 認証のため。
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { FeatureLocked } from '@/app/_components/FeatureGuard'
import {
  ArrowLeft, Plus, Pencil, Trash2, Camera, Loader2, X,
  GripVertical, ChevronUp, ChevronDown, Sparkles, Save,
} from 'lucide-react'
import { Toast } from '@/app/_components/Toast'
import { fileToJpegBase64 } from '@/lib/imageResize'
import type { ExtractionField, FieldType, FieldScope, FieldRole } from '@/lib/extraction-schema'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

const TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'テキスト' },
  { value: 'number', label: '数値' },
  { value: 'date', label: '日付' },
]

// 意味役割（受付保存時に顧客解決・合計計算へ使う）
const ROLE_OPTIONS: { value: FieldRole | ''; label: string }[] = [
  { value: '', label: '（なし）' },
  { value: 'customer_name', label: '顧客名' },
  { value: 'customer_tel', label: '電話番号' },
  { value: 'date', label: '日付' },
  { value: 'line_name', label: '品目名' },
  { value: 'quantity', label: '数量' },
  { value: 'unit_price', label: '単価・金額' },
  { value: 'note', label: '備考' },
]

interface TemplateWithFields {
  id: string
  key: string
  label: string
  description: string | null
  sort_order: number
  fields: ExtractionField[]
}

// 編集中フォームの1行（field_key は保存時にサーバが補完するので任意）
interface FieldRow {
  field_key: string
  field_label: string
  field_type: FieldType
  description: string
  is_required: boolean
  scope: FieldScope
  role: FieldRole | null
}

function toRows(fields: ExtractionField[]): FieldRow[] {
  return fields.map((f) => ({
    field_key: f.field_key,
    field_label: f.field_label,
    field_type: f.field_type,
    description: f.description ?? '',
    is_required: f.is_required,
    scope: f.scope ?? 'item',
    role: f.role ?? null,
  }))
}

function emptyRow(scope: FieldScope = 'item'): FieldRow {
  return { field_key: '', field_label: '', field_type: 'text', description: '', is_required: false, scope, role: null }
}

export default function OcrTemplatesPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const { hasFeature, loaded: featLoaded } = useStoreFeatures(storeId)
  const router = useRouter()

  const [templates, setTemplates] = useState<TemplateWithFields[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = useCallback((type: 'ok' | 'err', msg: string) => setToast({ type, msg }), [])

  // 編集フォーム状態
  const [editing, setEditing] = useState<TemplateWithFields | null>(null) // null=未編集, id空=新規
  const [formOpen, setFormOpen] = useState(false)
  const [fLabel, setFLabel] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [rows, setRows] = useState<FieldRow[]>([])
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TemplateWithFields | null>(null)

  // 試し読み（テンプレ別OCRの実写トライアル）状態
  const [scanTarget, setScanTarget] = useState<TemplateWithFields | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanItems, setScanItems] = useState<Record<string, unknown>[] | null>(null)
  const [scanHeader, setScanHeader] = useState<Record<string, unknown>>({})

  const fileRef = useRef<HTMLInputElement>(null)
  const scanFileRef = useRef<HTMLInputElement>(null)

  const storePin = () =>
    typeof window !== 'undefined' ? (sessionStorage.getItem(`admin_pin_${storeId}`) ?? '') : ''

  const api = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/extraction-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, storePin: storePin(), ...payload }),
      })
      return res.json()
    },
    [storeId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const json = await api({ action: 'list' })
      if (!json.ok) throw new Error(json.error ?? '読み込みに失敗しました')
      setTemplates(json.templates ?? [])
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [api, showToast])

  useEffect(() => { if (storeId) load() }, [storeId, load])

  // ── フォーム開閉 ──
  const openNew = (label = '', desc = '', initRows: FieldRow[] = [emptyRow()]) => {
    setEditing({ id: '', key: '', label, description: desc, sort_order: 0, fields: [] })
    setFLabel(label); setFDesc(desc); setRows(initRows)
    setFormOpen(true)
  }
  const openEdit = (t: TemplateWithFields) => {
    setEditing(t)
    setFLabel(t.label); setFDesc(t.description ?? '')
    setRows(t.fields.length ? toRows(t.fields) : [emptyRow()])
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditing(null) }

  // ── 行操作 ──
  const updateRow = (i: number, patch: Partial<FieldRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, emptyRow()])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))
  const moveRow = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir
      if (j < 0 || j >= rs.length) return rs
      const copy = [...rs]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  // ── サンプル伝票 → AI提案 ──
  const onPickSample = async (file: File) => {
    setSuggesting(true)
    try {
      const base64 = await fileToJpegBase64(file)
      const res = await fetch('/api/extraction-templates/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, storePin: storePin(), imageBase64: base64, mimeType: 'image/jpeg' }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '自動提案に失敗しました')
      const suggested = (json.fields ?? []) as ExtractionField[]
      openNew(json.suggestedLabel || '', '', toRows(suggested))
      showToast('ok', `${suggested.length}項目を提案しました。内容を確認して保存してください`)
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    } finally {
      setSuggesting(false)
    }
  }

  // ── 保存 ──
  const save = async () => {
    if (!fLabel.trim()) { showToast('err', 'テンプレート名を入力してください'); return }
    const fields = rows
      .filter((r) => r.field_label.trim() || r.field_key.trim())
      .map((r, i) => ({
        field_key: r.field_key,
        field_label: r.field_label,
        field_type: r.field_type,
        description: r.description,
        is_required: r.is_required,
        scope: r.scope,
        role: r.role,
        sort_order: i + 1,
      }))
    if (fields.length === 0) { showToast('err', '項目を1つ以上追加してください'); return }

    setSaving(true)
    try {
      const isNew = !editing?.id
      const json = await api(
        isNew
          ? { action: 'create', label: fLabel, description: fDesc || null, fields }
          : { action: 'update', templateId: editing!.id, label: fLabel, description: fDesc || null, fields },
      )
      if (!json.ok) throw new Error(json.error ?? '保存に失敗しました')
      showToast('ok', isNew ? 'テンプレートを作成しました' : '保存しました')
      closeForm()
      await load()
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // ── 削除 ──
  const doDelete = async () => {
    if (!deleteTarget) return
    try {
      const json = await api({ action: 'delete', templateId: deleteTarget.id })
      if (!json.ok) throw new Error(json.error ?? '削除に失敗しました')
      showToast('ok', '削除しました')
      setDeleteTarget(null)
      await load()
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    }
  }

  // ── 試し読み（テンプレを指定して実物の伝票を撮影→抽出）──
  const openScan = (t: TemplateWithFields) => {
    setScanTarget(t)
    setScanItems(null)
    setScanHeader({})
    setTimeout(() => scanFileRef.current?.click(), 0)
  }
  const onPickScan = async (file: File) => {
    if (!scanTarget) return
    setScanning(true)
    setScanItems(null)
    setScanHeader({})
    try {
      const base64 = await fileToJpegBase64(file)
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipType: 'dynamic', storeId, storePin: storePin(),
          templateId: scanTarget.id, imageBase64: base64, mimeType: 'image/jpeg',
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '読み取りに失敗しました')
      const items = (json.items ?? []) as Record<string, unknown>[]
      setScanHeader((json.header ?? {}) as Record<string, unknown>)
      setScanItems(items)
      showToast('ok', `${items.length}件の明細を読み取りました`)
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
      setScanTarget(null)
    } finally {
      setScanning(false)
    }
  }

  // 伝票OCROFFの店に、URL直打ちで入らせない
  if (featLoaded && !hasFeature('repairs_ocr')) return <FeatureLocked />

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-700 to-violet-700" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-white font-black text-base">🧾 伝票OCRテンプレート</h1>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickSample(f); e.target.value = '' }} />
      <input ref={scanFileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickScan(f); e.target.value = '' }} />

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-28">
        <p className="text-xs text-gray-500 leading-relaxed">
          伝票種別ごとにOCRで読み取る項目を設定します。「サンプル伝票から作成」で実際の紙を撮影すると、AIが項目を提案します。
        </p>

        {/* 作成ボタン */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={suggesting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-sm disabled:opacity-60">
            {suggesting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            サンプル伝票から作成
          </button>
          <button onClick={() => openNew()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border-2 border-indigo-200 text-indigo-700 font-bold text-sm">
            <Plus size={16} />空から作成
          </button>
        </div>

        {/* 一覧 */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : templates.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-12">
            まだテンプレートがありません。<br />上のボタンから作成してください。
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.fields.length}項目
                    {t.description ? ` ・ ${t.description}` : ''}
                  </p>
                </div>
                <button onClick={() => openScan(t)} title="試し読み"
                  className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"><Camera size={16} /></button>
                <button onClick={() => openEdit(t)}
                  className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50"><Pencil size={16} /></button>
                <button onClick={() => setDeleteTarget(t)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
              </div>
              {t.fields.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.fields.map((f) => (
                    <span key={f.field_key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 text-xs">
                      {f.field_label}
                      {f.is_required && <span className="text-red-500">*</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 編集フォーム（モーダル） */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
              <h2 className="flex-1 font-black text-gray-900">
                {editing?.id ? 'テンプレートを編集' : '新しいテンプレート'}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">伝票種別の名前 <span className="text-red-500">*</span></label>
                <input className={INPUT} value={fLabel} onChange={(e) => setFLabel(e.target.value)}
                  placeholder="例: お直し伝票 / 購入承り書 / 加工伝票" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">メモ（任意）</label>
                <input className={INPUT} value={fDesc} onChange={(e) => setFDesc(e.target.value)}
                  placeholder="用途などのメモ" />
              </div>

              {/* 項目リスト */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-500">読み取り項目</label>
                  <span className="text-[11px] text-gray-400">*=必須</span>
                </div>
                <div className="space-y-2">
                  {rows.map((r, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-gray-300 shrink-0" />
                        <input className={`${INPUT} flex-1`} value={r.field_label}
                          onChange={(e) => updateRow(i, { field_label: e.target.value })}
                          placeholder="項目名（例: 品名, ガットテンション）" />
                        <div className="flex flex-col">
                          <button onClick={() => moveRow(i, -1)} className="text-gray-400 hover:text-gray-700"><ChevronUp size={14} /></button>
                          <button onClick={() => moveRow(i, 1)} className="text-gray-400 hover:text-gray-700"><ChevronDown size={14} /></button>
                        </div>
                        <button onClick={() => removeRow(i)} className="p-1 rounded text-red-400 hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                      <div className="flex items-center gap-2 pl-6 flex-wrap">
                        {/* 見出し/明細トグル */}
                        <div className="flex rounded-lg overflow-hidden border border-gray-300 text-xs shrink-0">
                          <button type="button" onClick={() => updateRow(i, { scope: 'header' })}
                            className={`px-2.5 py-2 font-bold ${r.scope === 'header' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>見出し</button>
                          <button type="button" onClick={() => updateRow(i, { scope: 'item' })}
                            className={`px-2.5 py-2 font-bold ${r.scope !== 'header' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>明細</button>
                        </div>
                        <select className={`${INPUT} w-24`} value={r.field_type}
                          onChange={(e) => updateRow(i, { field_type: e.target.value as FieldType })}>
                          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select className={`${INPUT} w-32`} value={r.role ?? ''}
                          onChange={(e) => updateRow(i, { role: (e.target.value || null) as FieldRole | null })}>
                          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none">
                          <input type="checkbox" checked={r.is_required}
                            onChange={(e) => updateRow(i, { is_required: e.target.checked })} />
                          必須
                        </label>
                        <input className={`${INPUT} flex-1 min-w-[8rem]`} value={r.description}
                          onChange={(e) => updateRow(i, { description: e.target.value })}
                          placeholder="読み取りヒント（任意）" />
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addRow}
                  className="mt-2 flex items-center gap-1.5 text-indigo-600 text-sm font-bold px-2 py-1.5">
                  <Plus size={15} />項目を追加
                </button>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => fileRef.current?.click()} disabled={suggesting}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-indigo-50 text-indigo-700 font-bold text-sm disabled:opacity-60">
                {suggesting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                AI再提案
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 試し読み結果 */}
      {scanTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
              <h2 className="flex-1 font-black text-gray-900 truncate">試し読み: {scanTarget.label}</h2>
              <button onClick={() => setScanTarget(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              {scanning ? (
                <div className="flex flex-col items-center gap-3 py-12 text-gray-500">
                  <Loader2 className="animate-spin" />
                  <p className="text-sm">読み取り中…</p>
                </div>
              ) : scanItems === null ? (
                <div className="text-center text-gray-400 text-sm py-8">伝票を撮影してください</div>
              ) : (
                <div className="space-y-4">
                  {/* 見出し項目 */}
                  {scanTarget.fields.filter((f) => f.scope === 'header').length > 0 && (
                    <div className="space-y-1">
                      {scanTarget.fields.filter((f) => f.scope === 'header').map((f) => {
                        const v = scanHeader[f.field_key]
                        return (
                          <div key={f.field_key} className="flex gap-2 text-sm">
                            <span className="text-gray-500 w-28 shrink-0">{f.field_label}</span>
                            <span className="text-gray-900">
                              {v === null || v === undefined || v === '' ? <span className="text-gray-300">—</span> : String(v)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* 明細 */}
                  {scanItems.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-4">明細を検出できませんでした</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-200">
                            <th className="py-2 pr-2 font-bold">#</th>
                            {scanTarget.fields.filter((f) => f.scope !== 'header').map((f) => (
                              <th key={f.field_key} className="py-2 px-2 font-bold whitespace-nowrap">{f.field_label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {scanItems.map((it, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="py-2 pr-2 text-gray-400">{idx + 1}</td>
                              {scanTarget.fields.filter((f) => f.scope !== 'header').map((f) => {
                                const v = it[f.field_key]
                                return (
                                  <td key={f.field_key} className="py-2 px-2 text-gray-900 whitespace-nowrap">
                                    {v === null || v === undefined || v === '' ? <span className="text-gray-300">—</span> : String(v)}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400">※ ここは読み取り確認用です。実際の受付保存は「伝票受付」画面から行えます。</p>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => scanFileRef.current?.click()} disabled={scanning}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm disabled:opacity-60">
                {scanning ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                {scanItems === null ? '撮影して読み取り' : 'もう一度撮影'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 space-y-4">
            <p className="text-gray-900 font-bold text-center">「{deleteTarget.label}」を削除しますか？</p>
            <p className="text-xs text-gray-500 text-center">このテンプレートの項目もすべて削除されます。</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm">キャンセル</button>
              <button onClick={doDelete} className="flex-1 px-4 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm">削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
