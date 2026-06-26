'use client'

// ============================================================
// 新品加工オプションマスタ
//   ネーム刺繍 / 裾上げ / 校章付け 等(新品購入時の加工)。
//   applies_to_category でカテゴリ連動 → 採寸接客時に自動提示する想定。
//   データ層: lib/master.ts (processing_options テーブル)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Pencil, Trash2, Loader2, Check, X, Scissors,
} from 'lucide-react'
import {
  listProcessingOptions, upsertProcessingOption, deleteProcessingOption,
} from '@/lib/master'
import {
  PRODUCT_CATEGORY_OPTIONS, PROCESSING_INPUT_TYPE_OPTIONS,
} from '@/types/master'
import type { ProcessingOption } from '@/types/master'

const INPUT = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none'

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-[11px] font-bold text-gray-600 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

const INPUT_TYPE_LABEL = (v: string) =>
  PROCESSING_INPUT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v

export default function ProcessingOptionsMasterPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [rows, setRows]       = useState<ProcessingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  // フォーム
  const [editing, setEditing] = useState<ProcessingOption | 'new' | null>(null)
  const [name, setName]               = useState('')
  const [inputType, setInputType]     = useState('toggle')
  const [unit, setUnit]               = useState('')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [required, setRequired]       = useState(false)
  const [categories, setCategories]   = useState<string[]>([])
  const [choices, setChoices]         = useState('')
  const [notes, setNotes]             = useState('')
  const [isActive, setIsActive]       = useState(true)

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg }); setTimeout(() => setToast(null), 2400)
  }

  const fetchRows = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try { setRows(await listProcessingOptions(storeId)) }
    catch (e: any) { showToast('err', `取得失敗: ${e.message}`) }
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchRows() }, [fetchRows])

  const openNew = () => {
    setEditing('new')
    setName(''); setInputType('toggle'); setUnit(''); setDefaultPrice('')
    setRequired(false); setCategories([]); setChoices(''); setNotes(''); setIsActive(true)
  }
  const openEdit = (o: ProcessingOption) => {
    setEditing(o)
    setName(o.name); setInputType(o.input_type); setUnit(o.unit ?? '')
    setDefaultPrice(o.default_price != null ? String(o.default_price) : '')
    setRequired(o.required); setCategories(o.applies_to_category ?? [])
    setChoices((o.choices ?? []).join('、')); setNotes(o.notes ?? ''); setIsActive(o.is_active)
  }
  const closeForm = () => setEditing(null)

  const toggleCategory = (c: string) =>
    setCategories((prev) => prev.includes(c) ? prev.filter((v) => v !== c) : [...prev, c])

  const handleSave = async () => {
    if (!name.trim()) { showToast('err', '加工名を入力してください'); return }
    setSaving(true)
    try {
      const base = editing && editing !== 'new' ? editing : undefined
      await upsertProcessingOption({
        id: base?.id,
        store_id: storeId,
        name: name.trim(),
        input_type: inputType,
        unit: unit.trim() || null,
        default_price: defaultPrice === '' ? null : Number(defaultPrice),
        required,
        applies_to_category: categories,
        choices: inputType === 'select'
          ? choices.split(/[、,]/).map((c) => c.trim()).filter(Boolean)
          : [],
        notes: notes.trim() || null,
        is_active: isActive,
        sort_order: base?.sort_order ?? rows.length,
      })
      showToast('ok', base ? '更新しました' : '追加しました')
      closeForm(); fetchRows()
    } catch (e: any) { showToast('err', `保存失敗: ${e.message}`) }
    setSaving(false)
  }

  const handleDelete = async (o: ProcessingOption) => {
    if (!confirm(`「${o.name}」を削除しますか？`)) return
    try { await deleteProcessingOption(o.id); showToast('ok', '削除しました'); fetchRows() }
    catch (e: any) { showToast('err', `削除失敗: ${e.message}`) }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-fuchsia-700 to-purple-700" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-white font-black text-base">✂️ 新品加工オプション</h1>
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-bold transition-colors">
            <Plus size={15} />追加
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-28">
        <p className="text-xs text-gray-500">
          ネーム刺繍・裾上げ・校章付けなど、新品購入時の加工を登録します。
          連動カテゴリを設定すると、その種類の商品で自動的に提示されます。
        </p>

        {/* 入力フォーム */}
        {editing && (
          <div className="bg-white rounded-2xl border-2 border-fuchsia-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">{editing === 'new' ? '新規追加' : '編集'}</p>
              <button onClick={closeForm} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="加工名" full>
                <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="例: ネーム刺繍 / 裾上げ" />
              </Field>
              <Field label="入力方式">
                <select className={INPUT} value={inputType} onChange={(e) => setInputType(e.target.value)}>
                  {PROCESSING_INPUT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="単位（任意）">
                <input className={INPUT} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="例: cm" />
              </Field>
              <Field label="標準料金（税込・任意）">
                <input type="number" className={INPUT} value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} placeholder="500" />
              </Field>
              <Field label="必須加工">
                <button type="button" onClick={() => setRequired((v) => !v)}
                  className={`w-full py-2 rounded-xl text-sm font-bold border transition-colors ${required ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-white text-gray-500 border-gray-300'}`}>
                  {required ? '標準で付帯' : '任意'}
                </button>
              </Field>
              {inputType === 'select' && (
                <Field label="選択肢（、で区切る）" full>
                  <input className={INPUT} value={choices} onChange={(e) => setChoices(e.target.value)} placeholder="例: 金、銀、黒" />
                </Field>
              )}
              <Field label="連動カテゴリ（未選択＝全商品）" full>
                <div className="flex flex-wrap gap-1.5">
                  {PRODUCT_CATEGORY_OPTIONS.map((c) => {
                    const on = categories.includes(c)
                    return (
                      <button key={c} type="button" onClick={() => toggleCategory(c)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${on ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-white text-gray-500 border-gray-300'}`}>
                        {c}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="メモ（任意）" full>
                <textarea rows={2} className={`${INPUT} resize-none`} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <Field label="状態">
                <button type="button" onClick={() => setIsActive((v) => !v)}
                  className={`w-full py-2 rounded-xl text-sm font-bold border transition-colors ${isActive ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-300'}`}>
                  {isActive ? '有効' : '無効'}
                </button>
              </Field>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {editing === 'new' ? '追加する' : '更新する'}
            </button>
          </div>
        )}

        {/* 一覧 */}
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Scissors size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">加工オプションがまだありません</p>
            <button onClick={openNew} className="mt-3 text-fuchsia-600 text-sm font-bold">+ 最初の1件を追加</button>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((o) => (
              <div key={o.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 ${o.is_active ? '' : 'opacity-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-gray-800 truncate">{o.name}</p>
                    {o.required && <span className="px-1.5 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-700 text-[10px] font-bold">必須</span>}
                    {o.default_price != null && <span className="text-[11px] text-gray-500">¥{o.default_price.toLocaleString()}</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {INPUT_TYPE_LABEL(o.input_type)}
                    {o.unit ? `（${o.unit}）` : ''}
                    {' ・ '}
                    {o.applies_to_category.length > 0 ? o.applies_to_category.join('、') : '全商品'}
                  </p>
                </div>
                <button onClick={() => openEdit(o)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(o)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg ${toast.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
