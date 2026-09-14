'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Bell, X, Check, Loader2, MessageSquareWarning } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FixNotice {
  id: string
  feedback_id: string | null
  message: string
  created_at: string
}

const POLL_MS = 2 * 60 * 1000

// フィードバックで報告した不具合の修正完了を、運用者から店舗へ知らせるベル。
// feedback_notices（store_id = 自店舗 または null=全店舗）のうち未確認
// (acknowledged_at IS NULL) の件数をバッジ表示し、タップで一覧を開く。
// 「完了」を押すとDBに既読を書き込む（運営側の画面でも確認済みが分かるように）。
// 「まだ直っていない」を押すと、その場で追加のフィードバックを送れる。
//
// variant='floating'（タブレット用）は自前で右上に固定表示する。
// variant='inline'（電話モード用）は位置指定を持たず、呼び出し側の
// AdminTopBar 内に並べる（position:fixedだと各ページ独自のヘッダーと
// 重なっていたため）。
export function FixNoticeBanner({ variant = 'floating' }: { variant?: 'floating' | 'inline' }) {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [notices, setNotices] = useState<FixNotice[]>([])
  const [open, setOpen]       = useState(false)
  const [acking, setAcking]   = useState<string | null>(null)
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null)
  const [replyText, setReplyText]     = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [sentReplyIds, setSentReplyIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!storeId) return
    let cancelled = false

    const load = async () => {
      const { data } = await (supabase as any)
        .from('feedback_notices')
        .select('id, feedback_id, message, created_at, store_id, acknowledged_at')
        .or(`store_id.eq.${storeId},store_id.is.null`)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(30)
      if (!cancelled) setNotices((data ?? []) as FixNotice[])
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [storeId])

  const ack = async (id: string) => {
    setAcking(id)
    const { error } = await (supabase as any)
      .from('feedback_notices')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) setNotices(prev => prev.filter(n => n.id !== id))
    setAcking(null)
  }

  const sendReply = async (notice: FixNotice) => {
    const text = replyText.trim()
    if (!text) return
    setSendingReply(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, kind: 'bug', body: `まだ直っていません: ${text}`,
          relatedFeedbackId: notice.feedback_id,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.ok) {
        setSentReplyIds(prev => new Set(prev).add(notice.id))
        setReplyOpenId(null)
        setReplyText('')
      }
    } finally {
      setSendingReply(false)
    }
  }

  if (notices.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="対応完了のお知らせ"
        style={{ touchAction: 'manipulation' }}
        className={`flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full pl-2.5 pr-3 py-2 shadow-lg active:scale-95 transition-all ${
          variant === 'floating' ? 'fixed top-3 right-3 z-[150]' : ''
        }`}>
        <Bell size={16} />
        <span className="text-xs font-black">{notices.length}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85dvh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5">
                <Bell size={18} className="text-emerald-600" /> 運営からのお知らせ
              </h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              {notices.map(n => (
                <div key={n.id} className="border-2 border-emerald-100 bg-emerald-50/50 rounded-2xl px-4 py-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{n.message}</p>

                  {sentReplyIds.has(n.id) ? (
                    <p className="mt-2 text-xs font-bold text-gray-500">追加の報告を送りました。引き続きご確認します。</p>
                  ) : (
                    <div className="mt-2.5 flex items-center gap-2">
                      <button onClick={() => ack(n.id)} disabled={acking === n.id}
                        style={{ touchAction: 'manipulation' }}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 rounded-full px-3 py-1.5 disabled:opacity-50 active:scale-95 transition-all">
                        {acking === n.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        完了
                      </button>
                      <button onClick={() => { setReplyOpenId(id => id === n.id ? null : n.id); setReplyText('') }}
                        style={{ touchAction: 'manipulation' }}
                        className="flex items-center gap-1 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-full px-3 py-1.5 active:scale-95 transition-all">
                        <MessageSquareWarning size={13} />
                        まだ直っていない
                      </button>
                    </div>
                  )}

                  {replyOpenId === n.id && (
                    <div className="mt-2.5 space-y-2">
                      <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                        rows={3} autoFocus placeholder="どう直っていないか教えてください"
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:border-gray-900 focus:outline-none" />
                      <button onClick={() => sendReply(n)} disabled={sendingReply || !replyText.trim()}
                        style={{ touchAction: 'manipulation' }}
                        className="w-full py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {sendingReply ? <Loader2 size={14} className="animate-spin" /> : null}
                        送信して運営に伝える
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
