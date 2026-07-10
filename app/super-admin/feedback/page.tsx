'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, MessageSquare, ExternalLink, Sparkles, CheckCircle2, GitPullRequest, Rocket, Send, Bot, User } from 'lucide-react'
import { PinScreen, verifySuperAdminPin } from '@/app/_components/PinScreen'

interface FeedbackPr {
  number: number
  html_url: string
  state: 'open' | 'closed'
  merged: boolean
  title: string
  body: string | null
}

interface FeedbackComment {
  id: number
  body: string
  author: string
  isBot: boolean
  created_at: string
}

interface Feedback {
  id: string
  store_id: string | null
  store_name: string | null
  kind: 'request' | 'bug' | 'question' | string
  body: string
  page_url: string | null
  user_agent: string | null
  image_urls: string[] | null
  status: 'new' | 'triaged' | 'done' | 'wontfix' | string
  issue_number: number | null
  issue_url: string | null
  priority: 'urgent' | 'high' | 'medium' | 'low' | null
  ai_category: string | null
  ai_recommendation: string | null
  ai_implementable: boolean | null
  approved_at: string | null
  created_at: string
  pr: FeedbackPr | null
  prMain: FeedbackPr | null
  comments: FeedbackComment[]
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
  const [mergingPr, setMergingPr] = useState<number | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [sendingReply, setSendingReply] = useState<string | null>(null)
  const [githubError, setGithubError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/super-admin/feedback', { cache: 'no-store' })
    if (res.status === 401) { setAuthed(false); setChecked(true); setLoading(false); return }
    const json = await res.json()
    if (res.ok) { setRows(json.feedback ?? []); setAuthed(true); setGithubError(json.githubError ?? null) }
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

  const mergePr = async (feedbackId: string, prNumber: number, target: 'pr' | 'prMain' = 'pr') => {
    const label = target === 'pr' ? 'dev' : 'main（本番）'
    if (!confirm(`PR #${prNumber} を${label}へマージします。よろしいですか？`)) return
    setMergingPr(prNumber)
    const res = await fetch('/api/super-admin/feedback', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: feedbackId, mergePr: true, prNumber }),
    })
    if (res.ok) {
      setRows(rs => rs.map(r => r.id === feedbackId && r[target] ? { ...r, [target]: { ...r[target]!, merged: true, state: 'closed' } } : r))
    } else {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'PRマージに失敗しました')
    }
    setMergingPr(null)
  }

  const promoteToMain = async (feedbackId: string) => {
    if (!confirm('このPRの内容だけを本番（main）へ反映するPRを作成します。よろしいですか？')) return
    setPromoting(feedbackId)
    const res = await fetch('/api/super-admin/feedback', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: feedbackId, promote: true }),
    })
    if (res.ok) {
      const json = await res.json()
      setRows(rs => rs.map(r => r.id === feedbackId ? { ...r, prMain: json.pr } : r))
    } else {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? '本番PRの作成に失敗しました')
    }
    setPromoting(null)
  }

  const sendReply = async (id: string) => {
    const text = (replyText[id] ?? '').trim()
    if (!text) return
    setSendingReply(id)
    const res = await fetch('/api/super-admin/feedback', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, comment: text }),
    })
    if (res.ok) {
      setReplyText(rt => ({ ...rt, [id]: '' }))
      setRows(rs => rs.map(r => r.id === id ? {
        ...r,
        comments: [...r.comments, { id: Date.now(), body: `**運用者からの返信（スーパー管理画面より）**\n\n${text}`, author: 'あなた', isBot: false, created_at: new Date().toISOString() }],
      } : r))
      // Claudeの再検討には時間がかかるため、少し待ってから自動で最新状態を取得する
      setTimeout(load, 25000)
    } else {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? '送信に失敗しました')
    }
    setSendingReply(null)
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
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <h1 className="font-black text-base flex items-center gap-2"><MessageSquare size={18} /> フィードバック</h1>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="p-2 rounded-xl bg-gray-800 active:scale-90 transition disabled:opacity-50">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {githubError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-xs text-red-300 leading-relaxed">
            <span className="font-bold">GitHub連携エラー：</span>PR・コメントの表示や承認・マージが動きません。<br />
            {githubError}
          </div>
        )}
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
                {Array.isArray(f.image_urls) && f.image_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {f.image_urls.map(u => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="添付画像" className="w-20 h-20 object-cover rounded-lg border border-white/10 hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
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
                      <>
                        <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 pt-0.5">
                          <CheckCircle2 size={12} /> 承認済み（{new Date(f.approved_at).toLocaleString('ja-JP')}）
                        </p>
                        {f.pr ? (
                          f.pr.merged ? (
                            <>
                              <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <CheckCircle2 size={12} /> PR #{f.pr.number} マージ済み（dev反映済み）
                              </p>
                              {f.pr.body && (
                                <div className="bg-gray-900/60 border border-white/10 rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] font-bold text-gray-500 mb-1">対応内容（PR #{f.pr.number}）</p>
                                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed break-words">{f.pr.body}</p>
                                </div>
                              )}
                              {f.prMain ? (
                                f.prMain.merged ? (
                                  <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                    <Rocket size={12} /> 本番反映済み（PR #{f.prMain.number}）
                                  </p>
                                ) : f.prMain.state === 'closed' ? (
                                  <p className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                                    本番PR #{f.prMain.number} はクローズ済み（マージされていません）
                                  </p>
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                    <a href={f.prMain.html_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-indigo-200">
                                      <GitPullRequest size={12} /> 本番PR #{f.prMain.number}
                                    </a>
                                    <button onClick={() => mergePr(f.id, f.prMain!.number, 'prMain')} disabled={mergingPr === f.prMain.number}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 flex items-center gap-1">
                                      {mergingPr === f.prMain.number ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
                                      本番へマージ
                                    </button>
                                  </div>
                                )
                              ) : (
                                <button onClick={() => promoteToMain(f.id)} disabled={promoting === f.id}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600/80 hover:bg-emerald-500 text-white disabled:opacity-40 flex items-center gap-1.5 mt-0.5">
                                  {promoting === f.id ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
                                  本番へ昇格（このPRだけ）
                                </button>
                              )}
                            </>
                          ) : f.pr.state === 'closed' ? (
                            <p className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                              PR #{f.pr.number} はクローズ済み（マージされていません）
                            </p>
                          ) : (
                            <div className="space-y-1.5 pt-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <a href={f.pr.html_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-indigo-200">
                                  <GitPullRequest size={12} /> PR #{f.pr.number}: {f.pr.title}
                                </a>
                                <button onClick={() => mergePr(f.id, f.pr!.number)} disabled={mergingPr === f.pr.number}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 flex items-center gap-1">
                                  {mergingPr === f.pr.number ? <Loader2 size={11} className="animate-spin" /> : <GitPullRequest size={11} />}
                                  devへマージ
                                </button>
                              </div>
                              {f.pr.body && (
                                <div className="bg-gray-900/60 border border-white/10 rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] font-bold text-gray-500 mb-1">対応内容（PR #{f.pr.number}）</p>
                                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed break-words">{f.pr.body}</p>
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <p className="text-[11px] text-gray-500 pt-0.5">自動実装を依頼中（PRはまだ作成されていません）</p>
                        )}

                        {f.comments.length > 0 && (
                          <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                            {f.comments.map(c => (
                              <div key={c.id} className="flex gap-1.5 text-xs">
                                {c.isBot
                                  ? <Bot size={13} className="text-indigo-400 shrink-0 mt-0.5" />
                                  : <User size={13} className="text-gray-400 shrink-0 mt-0.5" />}
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-gray-400">{c.isBot ? 'Claude' : c.author}</span>
                                  <p className="text-gray-200 whitespace-pre-wrap leading-relaxed break-words">{c.body}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!f.pr?.merged && (
                          <div className="flex items-end gap-1.5 pt-1">
                            <textarea
                              value={replyText[f.id] ?? ''}
                              onChange={e => setReplyText(rt => ({ ...rt, [f.id]: e.target.value }))}
                              placeholder="Claudeへの返信・追加の指示を入力"
                              rows={2}
                              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 resize-none focus:border-indigo-500 focus:outline-none" />
                            <button onClick={() => sendReply(f.id)} disabled={sendingReply === f.id || !(replyText[f.id] ?? '').trim()}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 shrink-0">
                              {sendingReply === f.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            </button>
                          </div>
                        )}
                      </>
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
