'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, MessageSquare, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react'
import { PinScreen, verifySuperAdminPin } from '@/app/_components/PinScreen'

interface Feedback {
  id: string
  store_id: string | null
  store_name: string | null
  kind: 'request' | 'bug' | 'question' | string
  body: string
  page_url: string | null
  user_agent: string | null
  status: 'new' | 'triaged' | 'done' | 'wontfix' | string
  issue_number: number | null
  issue_url: string | null
  priority: 'urgent' | 'high' | 'medium' | 'low' | null
  ai_category: string | null
  ai_recommendation: string | null
  ai_implementable: boolean | null
  approved_at: string | null
  created_at: string
}

const KIND_META: Record<string, { label: string; cls: string }> = {
  request:  { label: '💡 要望',   cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  bug:      { label: '🐞 不具合', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  question: { label: '❓ 質問',   cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
}
const STATUSES: { value: string; label: string }[] = [
  { value: 'new',     label: '未対応' },
  { value: 'triaged', label: '確認済' },
  { value: 'done',    label: '対応済' },
  { value: 'wontfix', label: '見送り' },
]
const PRIORITY_META: Record<string, { label: string; cls: string; order: number }> = {
  urgent: { label: '緊急', cls: 'bg-red-600/30 text-red-200 border-red-500/40',       order: 0 },
  high:   { label: '高',   cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30', order: 1 },
  medium: { label: '中',   cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', order: 2 },
  low:    { label: '低',   cls: 'bg-gray-600/20 text-gray-400 border-gray-600/30',       order: 3 },
}
const priorityOrder = (p: string | null) => (p && PRIORITY_META[p] ? PRIORITY_META[p].order : 99)

export default function FeedbackAdminPage() {
  const [authed, setAuthed]   = useState(false)
  const [checked, setChecked] = useState(false)
  const [rows, setRows]       = useState<Feedback[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]   = useState<string>('all')
  const [approving, setApproving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/super-admin/feedback', { cache: 'no-store' })
    if (res.status === 401) { setAuthed(false); setChecked(true); setLoading(false); return }
    const json = await res.json()
    if (res.ok) { setRows(json.feedback ?? []); setAuthed(true) }
    setChecked(true); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (id: string, status: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r))
    await fetch('/api/super-admin/feedback', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
  }

  const approve = async (id: string) => {
    setApproving(id)
    const res = await fetch('/api/super-admin/feedback', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approve: true }),
    })
    if (res.ok) {
      setRows(rs => rs.map(r => r.id === id ? { ...r, approved_at: new Date().toISOString() } : r))
    } else {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? '承認に失敗しました')
    }
    setApproving(null)
  }

  if (!checked) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-500" /></div>
  }
  if (!authed) return (
    <PinScreen title="フィードバック（運用）" emoji="📨" dark
      verify={verifySuperAdminPin} onAuth={load} />
  )

  const filtered = (filter === 'all' ? rows : rows.filter(r => r.status === filter))
    .slice()
    .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s.value]: rows.filter(r => r.status === s.value).length }), {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="sticky top-0 z-20 bg-gray-900/90 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="font-black text-base flex items-center gap-2"><MessageSquare size={18} /> フィードバック</h1>
          <button onClick={load} disabled={loading} className="p-2 rounded-xl bg-gray-800 active:scale-90 transition disabled:opacity-50">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* フィルタ */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === 'all' ? 'bg-white text-gray-900 border-white' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
            すべて {rows.length}
          </button>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setFilter(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === s.value ? 'bg-white text-gray-900 border-white' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
              {s.label} {counts[s.value] ?? 0}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">該当するフィードバックはありません</p>
          </div>
        ) : (
          filtered.map(f => {
            const k = KIND_META[f.kind] ?? { label: f.kind, cls: 'bg-gray-700 text-gray-300 border-gray-600' }
            const p = f.priority ? PRIORITY_META[f.priority] : null
            return (
              <div key={f.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${k.cls}`}>{k.label}</span>
                  {p && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${p.cls}`}>優先度: {p.label}</span>}
                  {f.store_name && <span className="text-xs text-gray-300 font-bold">{f.store_name}</span>}
                  <span className="text-[11px] text-gray-500 ml-auto">{new Date(f.created_at).toLocaleString('ja-JP')}</span>
                </div>
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{f.body}</p>
                {f.page_url && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <ExternalLink size={11} /> {f.page_url}
                  </p>
                )}
                {f.issue_url && (
                  <a href={f.issue_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-indigo-200">
                    <ExternalLink size={11} /> GitHub Issue #{f.issue_number}
                  </a>
                )}

                {f.ai_recommendation && (
                  <div className="bg-gray-900/60 border border-indigo-500/20 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300">
                      <Sparkles size={12} /> AIによる分析{f.ai_category ? `：${f.ai_category}` : ''}
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{f.ai_recommendation}</p>
                    {f.approved_at ? (
                      <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 pt-0.5">
                        <CheckCircle2 size={12} /> 承認済み（{new Date(f.approved_at).toLocaleString('ja-JP')}）・自動実装を依頼中
                      </p>
                    ) : (
                      <button onClick={() => approve(f.id)} disabled={approving === f.id || !f.issue_number}
                        className="mt-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 flex items-center gap-1.5">
                        {approving === f.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        承認して自動実装を依頼
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-1.5 pt-1">
                  {STATUSES.map(s => (
                    <button key={s.value} onClick={() => setStatus(f.id, s.value)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        f.status === s.value ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-gray-200'
                      }`}>{s.label}</button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
