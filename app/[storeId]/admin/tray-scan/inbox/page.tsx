'use client'

// ── 置くだけスキャン 受信箱 ──────────────────────────────────
// 「あとで直す」にした読取結果の確認・修正・本登録・破棄

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  SLIP_TYPE_LABELS, summarizeScan, promoteScan,
  type ScanInboxRow, type ScanSlipType,
} from '@/lib/scanPromote'

export default function ScanInboxPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [rows, setRows] = useState<ScanInboxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editJson, setEditJson] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const load = useCallback(async () => {
    if (!storeId) return
    const { data } = await (supabase as any)
      .from('scan_inbox')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50)
    setRows((data ?? []) as ScanInboxRow[])
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  // 編集対象フィールド（種別ごとの主要項目のみ・シンプルに）
  const editableFields = (slipType: ScanSlipType): { key: string; label: string }[] =>
    slipType === 'repair' ? [
      { key: 'customer_name', label: 'お名前' },
      { key: 'tel',           label: '電話' },
      { key: 'item_name',     label: '品物' },
      { key: 'content',       label: '内容' },
      { key: 'price',         label: '金額（円）' },
      { key: 'desired_completion_date', label: '仕上がり希望（YYYY-MM-DD）' },
    ] : slipType === 'order' ? [
      { key: 'customer_name', label: 'お名前' },
      { key: 'school_name',   label: '学校' },
      { key: 'notes',         label: '備考' },
    ] : [
      { key: 'customer_name', label: 'お名前' },
      { key: 'content',       label: '内容' },
    ]

  const startEdit = (row: ScanInboxRow) => {
    const init: Record<string, string> = {}
    for (const f of editableFields(row.slip_type)) {
      const v = row.extracted?.[f.key]
      init[f.key] = v == null ? '' : String(v)
    }
    setEditJson(init)
    setEditId(row.id)
  }

  const saveEdit = async (row: ScanInboxRow) => {
    const merged = { ...row.extracted }
    for (const [k, v] of Object.entries(editJson)) {
      merged[k] = v.trim() === '' ? null : (k === 'price' ? Number(v) || null : v)
    }
    const { error } = await (supabase as any)
      .from('scan_inbox').update({ extracted: merged }).eq('id', row.id)
    if (error) { showToast('err', '保存に失敗しました'); return }
    setEditId(null)
    load()
    showToast('ok', '修正を保存しました')
  }

  const handlePromote = async (row: ScanInboxRow) => {
    setBusyId(row.id)
    const r = await promoteScan(row)
    setBusyId(null)
    if (!r.ok) { showToast('err', r.error ?? '登録に失敗しました'); return }
    showToast('ok', `${SLIP_TYPE_LABELS[row.slip_type]} を登録しました`)
    load()
  }

  const handleDiscard = async (row: ScanInboxRow) => {
    if (!window.confirm('この読取結果を破棄しますか？')) return
    setBusyId(row.id)
    await (supabase as any).from('scan_inbox').update({ status: 'discarded' }).eq('id', row.id)
    setBusyId(null)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <div className="bg-gray-950 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <p className="font-black text-lg">📥 スキャン受信箱</p>
        <button onClick={() => router.push(`/${storeId}/admin/tray-scan`)}
          className="bg-gray-800 rounded-xl px-4 py-2 text-sm font-bold active:scale-95 transition-all">
          スキャンに戻る
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-4 space-y-4">
        {loading && <p className="text-center text-gray-400 py-10 font-bold">読み込み中...</p>}
        {!loading && rows.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🎉</p>
            <p className="font-black text-gray-500 text-lg">確認待ちはありません</p>
          </div>
        )}

        {rows.map(row => (
          <div key={row.id} className="bg-white rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xl font-black">{SLIP_TYPE_LABELS[row.slip_type]}</p>
              <p className="text-xs text-gray-400 font-bold">
                {new Date(row.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="flex gap-4">
              {row.image_data && (
                <img src={row.image_data} alt="スキャン画像"
                  className="w-28 h-36 object-cover rounded-xl border border-gray-200 shrink-0" />
              )}
              <div className="flex-1 space-y-1.5 min-w-0">
                {editId === row.id ? (
                  editableFields(row.slip_type).map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-bold text-gray-500">{f.label}</label>
                      <input
                        value={editJson[f.key] ?? ''}
                        onChange={e => setEditJson(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-base font-bold"
                      />
                    </div>
                  ))
                ) : (
                  <>
                    {summarizeScan(row.slip_type, row.extracted).map((r, i) => (
                      <p key={i} className="text-sm truncate">
                        <span className="text-gray-400 font-bold mr-2">{r.label}</span>
                        <span className="font-black">{r.value}</span>
                      </p>
                    ))}
                    {(row.warnings ?? []).map((w, i) => (
                      <p key={i} className="text-amber-600 text-xs font-bold">⚠️ {w}</p>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              {editId === row.id ? (
                <>
                  <button onClick={() => saveEdit(row)}
                    className="col-span-2 bg-indigo-500 text-white rounded-2xl py-3 font-black active:scale-95 transition-all">
                    修正を保存
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="bg-gray-100 text-gray-600 rounded-2xl py-3 font-black active:scale-95 transition-all">
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handlePromote(row)} disabled={busyId === row.id}
                    className="bg-emerald-500 text-white rounded-2xl py-3 font-black active:scale-95 transition-all disabled:opacity-50">
                    ✓ 登録
                  </button>
                  <button onClick={() => startEdit(row)}
                    className="bg-gray-100 text-gray-700 rounded-2xl py-3 font-black active:scale-95 transition-all">
                    ✏️ 直す
                  </button>
                  <button onClick={() => handleDiscard(row)} disabled={busyId === row.id}
                    className="bg-gray-100 text-gray-400 rounded-2xl py-3 font-black active:scale-95 transition-all disabled:opacity-50">
                    破棄
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-black text-white shadow-xl z-50 ${toast.kind === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
