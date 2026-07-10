'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Check, X, Camera } from 'lucide-react'

// ============================================================
// 汎用マスタCRUDコンポーネント
// store_id / sort_order / is_active を持つシンプルなマスタテーブル用。
// 仕入先・サイズ・定型文・顧客タグなどで共有する。
// ============================================================

export interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'tel' | 'email' | 'color' | 'select'
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  full?: boolean // フォームで横幅いっぱい
}

interface SimpleMasterProps {
  table: string
  title: string
  emoji: string
  headerGrad: string // 例: 'from-indigo-700 to-violet-700'
  fields: FieldDef[]
  primaryKey: string // 一覧の主タイトルに使うフィールド
  secondaryKeys?: string[] // 一覧の副情報に使うフィールド
  emptyHint?: string
  seedDefaults?: Row[] // 初回（マスタが空）に一度だけ投入する初期データ
  ocrMapping?: { nameKey?: string; telKey?: string } // OCRで自動入力するフィールドのキー
}

type Row = Record<string, any>

export default function SimpleMaster({
  table, title, emoji, headerGrad, fields, primaryKey, secondaryKeys = [], emptyHint, seedDefaults, ocrMapping,
}: SimpleMasterProps) {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [rows, setRows]       = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [tableOk, setTableOk] = useState<boolean | null>(null)
  const [form, setForm]       = useState<Row | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const ocrRef = useRef<HTMLInputElement>(null)

  const handleOcr = async (file: File) => {
    if (!ocrMapping) return
    setOcrLoading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/ocr-receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const json = await res.json()
      if (!json.ok) { showToast('err', 'OCR失敗'); return }
      setForm((prev: Row | null) => {
        if (!prev) return prev
        const next = { ...prev }
        if (ocrMapping.nameKey && json.name) next[ocrMapping.nameKey] = json.name
        if (ocrMapping.telKey  && json.tel)  next[ocrMapping.telKey]  = json.tel
        return next
      })
      showToast('ok', '📷 読み取りました')
    } catch {
      showToast('err', 'OCRエラー')
    } finally {
      setOcrLoading(false)
    }
  }

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg }); setTimeout(() => setToast(null), 2200)
  }

  const fetchRows = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const select = () => (supabase as any)
      .from(table).select('*').eq('store_id', storeId)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    let { data, error } = await select()
    if (error) { setTableOk(false); setLoading(false); return }
    setTableOk(true)
    // 初回だけデフォルトを投入（削除した状態は localStorage で記憶し再投入しない）
    if ((!data || data.length === 0) && seedDefaults?.length && typeof window !== 'undefined') {
      const flag = `master_seeded:${table}:${storeId}`
      if (!localStorage.getItem(flag)) {
        const toInsert = seedDefaults.map((d, i) => ({ ...d, store_id: storeId, sort_order: i }))
        const { error: seedErr } = await (supabase as any).from(table).insert(toInsert)
        localStorage.setItem(flag, '1')
        if (!seedErr) { const re = await select(); data = re.data }
      }
    }
    setRows(data ?? []); setLoading(false)
  }, [storeId, table, seedDefaults])

  useEffect(() => { fetchRows() }, [fetchRows])

  const openNew = () => {
    const blank: Row = {}
    fields.forEach(f => { blank[f.key] = f.type === 'color' ? '#6366F1' : '' })
    setForm(blank); setEditingId(null)
  }
  const openEdit = (row: Row) => {
    const f: Row = {}
    fields.forEach(fd => { f[fd.key] = row[fd.key] ?? (fd.type === 'color' ? '#6366F1' : '') })
    setForm(f); setEditingId(row.id)
  }
  const closeForm = () => { setForm(null); setEditingId(null) }

  const handleSave = async () => {
    if (!form) return
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) { showToast('err', `${f.label}を入力してください`); return }
    }
    setSaving(true)
    const payload: Row = {}
    fields.forEach(f => {
      let v = form[f.key]
      if (f.type === 'number') v = v === '' || v == null ? null : Number(v)
      else if (typeof v === 'string') v = v.trim() === '' ? null : v.trim()
      payload[f.key] = v
    })
    if (editingId) {
      const { error } = await (supabase as any).from(table)
        .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      setSaving(false)
      if (error) { showToast('err', `更新失敗: ${error.message}`); return }
      showToast('ok', '更新しました')
    } else {
      const { error } = await (supabase as any).from(table)
        .insert({ ...payload, store_id: storeId, sort_order: rows.length })
      setSaving(false)
      if (error) { showToast('err', `追加失敗: ${error.message}`); return }
      showToast('ok', '追加しました')
    }
    closeForm(); fetchRows()
  }

  const handleDelete = async (row: Row) => {
    if (!confirm(`「${row[primaryKey]}」を削除しますか？`)) return
    const { error } = await (supabase as any).from(table).delete().eq('id', row.id)
    if (error) { showToast('err', `削除失敗: ${error.message}`); return }
    showToast('ok', '削除しました'); fetchRows()
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className={`sticky top-0 z-40 bg-gradient-to-r ${headerGrad}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-white font-black text-base">{emoji} {title}</h1>
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-bold transition-colors">
            <Plus size={15} />追加
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-28">
        {tableOk === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
            <p className="font-bold mb-1">テーブル「{table}」が見つかりません</p>
            <p>Supabase SQL Editor で <code>supabase/migrations/20260613_additional_masters.sql</code> を実行してください。</p>
          </div>
        )}

        {/* 入力フォーム */}
        {form && (
          <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm p-4 space-y-3">
            {ocrMapping && (
              <input ref={ocrRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleOcr(f); e.target.value = '' }} />
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">{editingId ? '編集' : '新規追加'}</p>
              <div className="flex items-center gap-1.5">
                {ocrMapping && (
                  <button onClick={() => ocrRef.current?.click()} disabled={ocrLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-60">
                    {ocrLoading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    {ocrLoading ? '解析中...' : '名刺読取'}
                  </button>
                )}
                <button onClick={closeForm} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {fields.map(f => (
                <div key={f.key} className={f.full || f.type === 'textarea' ? 'col-span-2' : ''}>
                  <label className="text-[11px] font-bold text-gray-600 mb-1 block">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea value={form[f.key] ?? ''} rows={4} placeholder={f.placeholder}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none resize-none" />
                  ) : f.type === 'select' ? (
                    <select value={form[f.key] ?? ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none">
                      <option value="">選択</option>
                      {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'color' ? (
                    <div className="flex items-center gap-2">
                      <input type="color" value={form[f.key] || '#6366F1'}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-10 h-9 rounded-lg border border-gray-200 bg-white p-0.5" />
                      <input type="text" value={form[f.key] ?? ''} placeholder="#6366F1"
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none" />
                    </div>
                  ) : (
                    <input type={f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'}
                      value={form[f.key] ?? ''} placeholder={f.placeholder}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none" />
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {editingId ? '更新する' : '追加する'}
            </button>
          </div>
        )}

        {/* 一覧 */}
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
        ) : rows.length === 0 && tableOk !== false ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">{emoji}</p>
            <p className="text-sm">{emptyHint ?? 'まだ登録がありません'}</p>
            <button onClick={openNew} className="mt-3 text-indigo-600 text-sm font-bold">+ 最初の1件を追加</button>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(row => {
              const sub = secondaryKeys.map(k => row[k]).filter(Boolean).join('　/　')
              return (
                <div key={row.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                  {fields.some(f => f.type === 'color') && (
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-gray-200"
                      style={{ backgroundColor: row.color || '#6366F1' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{row[primaryKey] || '（無題）'}</p>
                    {sub && <p className="text-[11px] text-gray-400 truncate mt-0.5">{sub}</p>}
                  </div>
                  <button onClick={() => openEdit(row)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(row)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                </div>
              )
            })}
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
