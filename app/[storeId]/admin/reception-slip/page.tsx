'use client'

// ============================================================
// 伝票受付（/admin/reception-slip）
//   テンプレを選び、実物の伝票を撮影 → AIが見出し(header)と明細(items)を
//   読み取り → その場で確認・修正 → 受付として slip_records に保存する。
//   店ごとの伝票（制服お直し／ガット張替 等）を同じ流れで受付できる。
//
//   通信は API 経由（storePin 認証）。
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Loader2, Plus, Trash2, Save } from 'lucide-react'
import { Toast } from '@/app/_components/Toast'
import { fileToJpegBase64 } from '@/lib/imageResize'
import { computeTotal } from '@/lib/slip-records'
import type { ExtractionField } from '@/lib/extraction-schema'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-500 bg-white'

interface TemplateWithFields {
  id: string
  key: string
  label: string
  description: string | null
  fields: ExtractionField[]
}

interface SlipRecord {
  id: string
  header: Record<string, unknown>
  items: Record<string, unknown>[]
  total_amount: number | null
  received_date: string
  customers: { name: string } | null
}

function htmlInputType(t: string): string {
  return t === 'number' ? 'number' : t === 'date' ? 'date' : 'text'
}

export default function ReceptionSlipPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const router = useRouter()

  const [templates, setTemplates] = useState<TemplateWithFields[]>([])
  const [records, setRecords] = useState<SlipRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = useCallback((type: 'ok' | 'err', msg: string) => setToast({ type, msg }), [])

  const [view, setView] = useState<'pick' | 'confirm'>('pick')
  const [selected, setSelected] = useState<TemplateWithFields | null>(null)
  const [header, setHeader] = useState<Record<string, unknown>>({})
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const storePin = () =>
    typeof window !== 'undefined' ? (sessionStorage.getItem(`admin_pin_${storeId}`) ?? '') : ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, rRes] = await Promise.all([
        fetch('/api/extraction-templates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', storeId, storePin: storePin() }),
        }).then((r) => r.json()),
        fetch('/api/slip-records', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', storeId, storePin: storePin(), limit: 30 }),
        }).then((r) => r.json()),
      ])
      if (!tRes.ok) throw new Error(tRes.error ?? 'テンプレ取得に失敗しました')
      setTemplates(tRes.templates ?? [])
      if (rRes.ok) setRecords(rRes.records ?? [])
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [storeId, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (storeId) load() }, [storeId, load])

  const headerDefs = (t: TemplateWithFields | null) => (t?.fields ?? []).filter((f) => f.scope === 'header')
  const itemDefs = (t: TemplateWithFields | null) => (t?.fields ?? []).filter((f) => f.scope !== 'header')

  // ── テンプレ選択 → 撮影 ──
  const startScan = (t: TemplateWithFields) => {
    setSelected(t)
    setTimeout(() => fileRef.current?.click(), 0)
  }
  const onPick = async (file: File) => {
    if (!selected) return
    setScanning(true)
    try {
      const base64 = await fileToJpegBase64(file)
      const res = await fetch('/api/slip-ocr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipType: 'dynamic', storeId, storePin: storePin(),
          templateId: selected.id, imageBase64: base64, mimeType: 'image/jpeg',
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '読み取りに失敗しました')
      const its = (json.items ?? []) as Record<string, unknown>[]
      setHeader((json.header ?? {}) as Record<string, unknown>)
      setItems(its.length ? its : [{}])
      setView('confirm')
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  // ── 確認画面の編集 ──
  const setHeaderVal = (key: string, v: string) => setHeader((h) => ({ ...h, [key]: v === '' ? null : v }))
  const setItemVal = (i: number, key: string, v: string) =>
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: v === '' ? null : v } : r)))
  const addItem = () => setItems((rows) => [...rows, {}])
  const removeItem = (i: number) => setItems((rows) => rows.filter((_, idx) => idx !== i))

  const totalPreview = selected ? computeTotal(selected.fields, items) : null

  // ── 保存 ──
  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      // 空行（全項目空）は除外
      const cleanItems = items.filter((it) => Object.values(it).some((v) => v !== null && v !== undefined && String(v).trim() !== ''))
      const res = await fetch('/api/slip-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', storeId, storePin: storePin(), templateId: selected.id, header, items: cleanItems }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '保存に失敗しました')
      showToast('ok', '受付を保存しました')
      setView('pick'); setSelected(null); setHeader({}); setItems([])
      await load()
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sticky top-0 z-40 bg-gradient-to-r from-emerald-700 to-teal-700" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => view === 'confirm' ? (setView('pick'), setSelected(null)) : router.push(`/${storeId}/admin/today`)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-white font-black text-base">🧾 伝票受付</h1>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />

      {scanning && (
        <div className="fixed inset-0 z-50 bg-black/40 flex flex-col items-center justify-center gap-3 text-white">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm font-bold">読み取り中…</p>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : view === 'pick' ? (
          <div className="space-y-4">
            {/* テンプレ選択 */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">伝票種別を選んで撮影</p>
              {templates.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  テンプレートがありません。<br />
                  「設定 → マスタ管理 → 伝票OCRテンプレート」で作成してください。
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => startScan(t)}
                      className="flex flex-col items-start gap-1 px-4 py-4 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-400 active:scale-[0.98] transition-all text-left">
                      <Camera size={18} className="text-emerald-600" />
                      <span className="font-bold text-gray-900 text-sm">{t.label}</span>
                      <span className="text-[11px] text-gray-400">{t.fields.length}項目</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 最近の受付 */}
            {records.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 mt-4">最近の受付</p>
                <div className="space-y-2">
                  {records.map((r) => (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {r.customers?.name ?? '（顧客未設定）'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {r.received_date} ・ 明細{Array.isArray(r.items) ? r.items.length : 0}件
                          {r.total_amount != null ? ` ・ ${r.total_amount.toLocaleString()}円` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : selected ? (
          /* ── 確認・編集 ── */
          <div className="space-y-5">
            <p className="text-xs font-bold text-emerald-700">{selected.label} の内容を確認</p>

            {/* 見出し */}
            {headerDefs(selected).length > 0 && (
              <div className="space-y-2">
                {headerDefs(selected).map((f) => (
                  <div key={f.field_key}>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      {f.field_label}{f.is_required && <span className="text-red-500"> *</span>}
                    </label>
                    <input className={INPUT} type={htmlInputType(f.field_type)}
                      value={header[f.field_key] == null ? '' : String(header[f.field_key])}
                      onChange={(e) => setHeaderVal(f.field_key, e.target.value)} />
                  </div>
                ))}
              </div>
            )}

            {/* 明細 */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">明細</p>
              <div className="space-y-3">
                {items.map((it, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                      <button onClick={() => removeItem(i)} className="p-1 rounded text-red-400 hover:bg-red-50"><Trash2 size={15} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {itemDefs(selected).map((f) => (
                        <div key={f.field_key} className={f.field_type === 'text' ? 'col-span-2' : ''}>
                          <label className="block text-[11px] text-gray-500 mb-0.5">{f.field_label}</label>
                          <input className={INPUT} type={htmlInputType(f.field_type)}
                            value={it[f.field_key] == null ? '' : String(it[f.field_key])}
                            onChange={(e) => setItemVal(i, f.field_key, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="mt-2 flex items-center gap-1.5 text-emerald-700 text-sm font-bold px-2 py-1.5">
                <Plus size={15} />明細を追加
              </button>
            </div>

            {totalPreview != null && (
              <div className="flex justify-end text-sm font-bold text-gray-900">
                合計: {totalPreview.toLocaleString()}円
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 確認画面の保存バー */}
      {view === 'confirm' && selected && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2 max-w-2xl mx-auto"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <button onClick={() => fileRef.current?.click()} disabled={scanning || saving}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm disabled:opacity-60">
            <Camera size={15} />撮り直す
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            受付を保存
          </button>
        </div>
      )}
    </div>
  )
}
