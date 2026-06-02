'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../_components/BottomNav'
import type { Product } from '@/types/products'
import { CATEGORY_OPTIONS, GENDER_OPTIONS } from '@/types/products'
import {
  Package, Plus, X, Pencil, Trash2, Upload, Search, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, AlertCircle, Loader2,
} from 'lucide-react'

// ─── Toast ──────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error'
function Toast({ message, kind }: { message: string; kind: ToastKind }) {
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold pointer-events-none ${
        kind === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  )
}

// ─── Empty form ──────────────────────────────────────────────────────────────

type FormState = {
  code: string
  name: string
  category: string
  maker: string
  gender: string
  sizes: string
  price: string
  notes: string
  is_active: boolean
  school_names: string
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  category: '',
  maker: '',
  gender: '共通',
  sizes: '',
  price: '',
  notes: '',
  is_active: true,
  school_names: '',
}

function formToRow(f: FormState, storeId: string) {
  return {
    store_id: storeId,
    code:     f.code.trim()  || null,
    name:     f.name.trim(),
    category: f.category     || null,
    maker:    f.maker.trim() || null,
    gender:   f.gender       || null,
    sizes:    f.sizes.trim()
                ? f.sizes.split(',').map(s => s.trim()).filter(Boolean)
                : [],
    price:    f.price !== '' ? Number(f.price) : null,
    notes:    f.notes.trim() || null,
    is_active: f.is_active,
    school_names: f.school_names.trim()
                    ? f.school_names.split('\n').map(s => s.trim()).filter(Boolean)
                    : [],
  }
}

function productToForm(p: Product): FormState {
  return {
    code:         p.code     ?? '',
    name:         p.name,
    category:     p.category ?? '',
    maker:        p.maker    ?? '',
    gender:       p.gender   ?? '共通',
    sizes:        p.sizes?.join(', ') ?? '',
    price:        p.price != null ? String(p.price) : '',
    notes:        p.notes    ?? '',
    is_active:    p.is_active,
    school_names: (p.school_names ?? []).join('\n'),
  }
}

// ─── ProductForm ─────────────────────────────────────────────────────────────

function ProductForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [f, setF] = useState<FormState>(initial)
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(f) }}
      className="grid grid-cols-2 gap-3 p-4 bg-white/95 border border-gray-300 rounded-2xl"
    >
      {/* code */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">品番</label>
        <input
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          placeholder="H001"
          value={f.code}
          onChange={set('code')}
        />
      </div>

      {/* name */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">商品名 <span className="text-red-400">*</span></label>
        <input
          required
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          placeholder="○○高校ブレザー"
          value={f.name}
          onChange={set('name')}
        />
      </div>

      {/* category */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">カテゴリ</label>
        <select
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
          value={f.category}
          onChange={set('category')}
        >
          <option value="">未選択</option>
          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* maker */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">メーカー</label>
        <input
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          placeholder="トンボ"
          value={f.maker}
          onChange={set('maker')}
        />
      </div>

      {/* gender */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">性別</label>
        <select
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
          value={f.gender}
          onChange={set('gender')}
        >
          {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* price */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">標準価格（円）</label>
        <input
          type="number"
          min={0}
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          placeholder="25000"
          value={f.price}
          onChange={set('price')}
        />
      </div>

      {/* sizes */}
      <div className="col-span-2">
        <label className="block text-xs text-gray-500 mb-1">サイズ（カンマ区切り）</label>
        <input
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          placeholder="155A, 160A, 165A, 170A"
          value={f.sizes}
          onChange={set('sizes')}
        />
      </div>

      {/* notes */}
      <div className="col-span-2">
        <label className="block text-xs text-gray-500 mb-1">備考</label>
        <textarea
          rows={2}
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
          placeholder="備考・特記事項"
          value={f.notes}
          onChange={set('notes')}
        />
      </div>

      {/* school_names */}
      <div className="col-span-2">
        <label className="block text-xs text-gray-500 mb-1">
          対象学校（1行1校名）
          <span className="ml-1 text-gray-400">— 空欄=定番商品（全校共通）</span>
        </label>
        <textarea
          rows={3}
          className="w-full bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
          placeholder={"○○中学校\n△△高等学校"}
          value={f.school_names}
          onChange={set('school_names')}
        />
      </div>

      {/* is_active */}
      <div className="col-span-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setF(prev => ({ ...prev, is_active: !prev.is_active }))}
          className="flex items-center gap-2 text-sm"
        >
          {f.is_active
            ? <ToggleRight size={28} className="text-indigo-400" />
            : <ToggleLeft  size={28} className="text-gray-500" />}
          <span className={f.is_active ? 'text-indigo-300' : 'text-gray-500'}>
            {f.is_active ? '有効' : '無効'}
          </span>
        </button>
      </div>

      {/* buttons */}
      <div className="col-span-2 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-400 transition"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          保存
        </button>
      </div>
    </form>
  )
}

// ─── CSV parse ───────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [products,        setProducts]        = useState<Product[]>([])
  const [loading,         setLoading]         = useState(true)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  const [search,          setSearch]          = useState('')
  const [filterCategory,  setFilterCategory]  = useState('')

  const [showAddForm,     setShowAddForm]     = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [editingId,       setEditingId]       = useState<string | null>(null)
  const [editForm,        setEditForm]        = useState<FormState>(EMPTY_FORM)

  const [deleteTarget,    setDeleteTarget]    = useState<Product | null>(null)
  const [deleting,        setDeleting]        = useState(false)

  const [toast,           setToast]           = useState<{ message: string; kind: ToastKind } | null>(null)
  const [csvImporting,    setCsvImporting]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── fetch ────────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('category', { ascending: true })
      .order('code',     { ascending: true })

    if (error) {
      if (
        error.code === '42P01' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('relation')
      ) {
        setMigrationNeeded(true)
      } else {
        showToast('データ取得に失敗しました: ' + error.message, 'error')
      }
      setLoading(false)
      return
    }
    setMigrationNeeded(false)
    setProducts(data ?? [])
    setLoading(false)
  }, [storeId, showToast])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── add ──────────────────────────────────────────────────────────────────

  const handleAdd = async (f: FormState) => {
    if (!storeId) return
    setSaving(true)
    const row = formToRow(f, storeId)
    const { error } = await (supabase as any).from('products').insert(row)
    setSaving(false)
    if (error) { showToast('追加に失敗しました: ' + error.message, 'error'); return }
    showToast('商品を追加しました')
    setShowAddForm(false)
    fetchProducts()
  }

  // ── edit ─────────────────────────────────────────────────────────────────

  const startEdit = (p: Product) => {
    setEditingId(p.id)
    setEditForm(productToForm(p))
    setShowAddForm(false)
  }

  const handleEdit = async (f: FormState) => {
    if (!storeId || !editingId) return
    setSaving(true)
    const row = formToRow(f, storeId)
    const { error } = await (supabase as any)
      .from('products')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', editingId)
      .eq('store_id', storeId)
    setSaving(false)
    if (error) { showToast('更新に失敗しました: ' + error.message, 'error'); return }
    showToast('商品を更新しました')
    setEditingId(null)
    fetchProducts()
  }

  // ── delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!storeId || !deleteTarget) return
    setDeleting(true)
    const { error } = await (supabase as any)
      .from('products')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('store_id', storeId)
    setDeleting(false)
    if (error) { showToast('削除に失敗しました: ' + error.message, 'error'); setDeleteTarget(null); return }
    showToast('商品を削除しました')
    setDeleteTarget(null)
    fetchProducts()
  }

  // ── CSV import ───────────────────────────────────────────────────────────

  const handleCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storeId) return
    setCsvImporting(true)

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      showToast('CSVに有効な行がありません', 'error')
      setCsvImporting(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const upsertRows = rows.map(r => ({
      store_id: storeId,
      code:     r.code?.trim()     || null,
      name:     r.name?.trim()     || '（名称未設定）',
      category: r.category?.trim() || null,
      maker:    r.maker?.trim()    || null,
      gender:   r.gender?.trim()   || null,
      sizes:    r.sizes
                  ? r.sizes.split('/').map((s: string) => s.trim()).filter(Boolean)
                  : [],
      price:    r.price && r.price !== '' ? Number(r.price) : null,
      notes:    r.notes?.trim()    || null,
      is_active: true,
    }))

    const { data, error } = await (supabase as any)
      .from('products')
      .upsert(upsertRows, { onConflict: 'store_id,code' })
      .select('id')

    setCsvImporting(false)
    if (fileRef.current) fileRef.current.value = ''

    if (error) {
      showToast('CSVインポート失敗: ' + error.message, 'error')
      return
    }
    showToast(`${data?.length ?? upsertRows.length} 件をインポートしました`)
    fetchProducts()
  }

  // ── toggle active ────────────────────────────────────────────────────────

  const toggleActive = async (p: Product) => {
    await (supabase as any)
      .from('products')
      .update({ is_active: !p.is_active, updated_at: new Date().toISOString() })
      .eq('id', p.id)
      .eq('store_id', storeId)
    fetchProducts()
  }

  // ── filter ───────────────────────────────────────────────────────────────

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.code  ?? '').toLowerCase().includes(q) ||
      (p.maker ?? '').toLowerCase().includes(q)
    const matchCat = !filterCategory || p.category === filterCategory
    return matchSearch && matchCat
  })

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast message={toast.message} kind={toast.kind} />}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Package size={20} className="text-indigo-400 shrink-0" />
        <h1 className="font-bold text-base flex-1">商品マスタ管理</h1>
        <div className="flex items-center gap-2">
          {/* CSV import */}
          <label
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
              csvImporting
                ? 'bg-gray-300 text-gray-500 pointer-events-none'
                : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
            }`}
          >
            {csvImporting
              ? <Loader2 size={13} className="animate-spin" />
              : <Upload size={13} />}
            CSV
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVFile}
              disabled={csvImporting}
            />
          </label>

          {/* Add button */}
          <button
            onClick={() => { setShowAddForm(v => !v); setEditingId(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-xs font-semibold text-white hover:opacity-90 transition"
          >
            {showAddForm ? <X size={13} /> : <Plus size={13} />}
            {showAddForm ? '閉じる' : '追加'}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-3 py-4 space-y-4">

        {/* Migration warning */}
        {migrationNeeded && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-700/50 bg-amber-950/40 px-4 py-3">
            <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">SQLマイグレーションが必要です</p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                Supabase SQL Editor で <code className="bg-amber-900/50 px-1 rounded">products</code> テーブルを作成してください。
              </p>
              <pre className="mt-2 text-xs text-amber-300/70 bg-amber-950/60 rounded-xl p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
{`create table products (
  id           uuid primary key default gen_random_uuid(),
  store_id     text not null,
  code         text,
  name         text not null,
  category     text,
  maker        text,
  gender       text,
  sizes        text[] default '{}',
  price        integer,
  notes        text,
  is_active    boolean not null default true,
  school_names text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, code)
);
-- 既存テーブルへの追加:
-- alter table products add column if not exists school_names text[] not null default '{}';`}
              </pre>
            </div>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <ProductForm
            initial={EMPTY_FORM}
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        )}

        {/* Search & filter */}
        {!migrationNeeded && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="w-full bg-gray-200 border border-gray-300 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                placeholder="名前・品番・メーカーで検索"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="bg-gray-200 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="">全カテゴリ</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Loading */}
        {loading && !migrationNeeded && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        )}

        {/* Product list */}
        {!loading && !migrationNeeded && (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-12">
                {search || filterCategory ? '条件に一致する商品がありません' : '商品がまだ登録されていません'}
              </p>
            )}

            {filtered.map(p => (
              <div key={p.id}>
                <div
                  className={`rounded-2xl border bg-white/80 border-gray-200 px-4 py-3 ${
                    !p.is_active ? 'opacity-50' : ''
                  }`}
                >
                  {/* Row: main info */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.code && (
                          <span className="text-[10px] bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                            {p.code}
                          </span>
                        )}
                        {p.category && (
                          <span className="text-[10px] bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded">
                            {p.category}
                          </span>
                        )}
                        {p.gender && p.gender !== '共通' && (
                          <span className="text-[10px] bg-violet-900/50 text-violet-300 px-1.5 py-0.5 rounded">
                            {p.gender}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-sm text-gray-900 mt-1 truncate">{p.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {p.maker && (
                          <span className="text-xs text-gray-500">{p.maker}</span>
                        )}
                        {p.price != null && (
                          <span className="text-xs text-emerald-400 font-medium">
                            ¥{p.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {p.sizes && p.sizes.length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          {p.sizes.join(' / ')}
                        </p>
                      )}
                      {p.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">{p.notes}</p>
                      )}
                      {p.school_names && p.school_names.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.school_names.map(s => (
                            <span key={s} className="text-[10px] bg-teal-900/50 text-teal-300 px-1.5 py-0.5 rounded">
                              🏫 {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                          定番商品（全校共通）
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(p)}
                        className="p-1.5 rounded-lg hover:bg-gray-300 transition"
                        title={p.is_active ? '無効にする' : '有効にする'}
                      >
                        {p.is_active
                          ? <ToggleRight size={18} className="text-indigo-400" />
                          : <ToggleLeft  size={18} className="text-gray-500" />}
                      </button>
                      <button
                        onClick={() => editingId === p.id ? setEditingId(null) : startEdit(p)}
                        className="p-1.5 rounded-lg hover:bg-gray-300 transition"
                      >
                        {editingId === p.id
                          ? <ChevronUp   size={16} className="text-gray-500" />
                          : <ChevronDown size={16} className="text-gray-500" />}
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        className="p-1.5 rounded-lg hover:bg-gray-300 transition"
                      >
                        <Pencil size={15} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="p-1.5 rounded-lg hover:bg-red-900/40 transition"
                      >
                        <Trash2 size={15} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === p.id && (
                  <div className="mt-1">
                    <ProductForm
                      initial={editForm}
                      onSave={handleEdit}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white border border-gray-300 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <p className="font-bold text-base text-gray-900">削除の確認</p>
            <p className="text-sm text-gray-700">
              「<span className="font-semibold text-white">{deleteTarget.name}</span>」を削除しますか？
              <br />この操作は元に戻せません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-400 transition"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
