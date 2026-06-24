'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, MessageSquare, ExternalLink } from 'lucide-react'

interface Feedback {
  id: string
  store_id: string | null
  store_name: string | null
  kind: 'request' | 'bug' | 'question' | string
  body: string
  page_url: string | null
  user_agent: string | null
  status: 'new' | 'triaged' | 'done' | 'wontfix' | string
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

function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDigit = async (d: string) => {
    if (pin.length >= 4 || loading) return
    const next = pin + d
    setPin(next); setError(false)
    if (next.length === 4) {
      setLoading(true)
      try {
        const res = await fetch('/api/super-admin/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: next }),
        })
        if (res.ok) { sessionStorage.setItem('super_admin_auth', '1'); onAuth() }
        else setTimeout(() => { setPin(''); setError(true); setLoading(false) }, 400)
      } catch { setTimeout(() => { setPin(''); setError(true); setLoading(false) }, 400) }
    }
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">📨</div>
        <h1 className="text-2xl font-bold text-white">フィードバック（運用）</h1>
        <p className="text-gray-400 text-sm mt-1">PINを入力してください</p>
      </div>
      <div className="flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full transition-all ${
            pin.length > i ? (error ? 'bg-red-500' : 'bg-blue-400') : 'bg-gray-600'
          }`} />
        ))}
      </div>
      {error && <p className="text-red-400 text-sm mb-4 font-medium">PINが違います</p>}
      <div className="grid grid-cols-3 gap-4 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} disabled={loading}
            onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
            className={`h-16 rounded-2xl text-2xl font-bold transition-all active:scale-90 disabled:opacity-40 ${
              d === '' ? 'invisible' : d === '⌫' ? 'bg-gray-700 text-gray-300' : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}>{d}</button>
        ))}
      </div>
    </div>
  )
}

export default function FeedbackAdminPage() {
  const [authed, setAuthed]   = useState(false)
  const [checked, setChecked] = useState(false)
  const [rows, setRows]       = useState<Feedback[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]   = useState<string>('all')

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

  if (!checked) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-500" /></div>
  }
  if (!authed) return <PinScreen onAuth={load} />

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)
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
            return (
              <div key={f.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${k.cls}`}>{k.label}</span>
                  {f.store_name && <span className="text-xs text-gray-300 font-bold">{f.store_name}</span>}
                  <span className="text-[11px] text-gray-500 ml-auto">{new Date(f.created_at).toLocaleString('ja-JP')}</span>
                </div>
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{f.body}</p>
                {f.page_url && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <ExternalLink size={11} /> {f.page_url}
                  </p>
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
