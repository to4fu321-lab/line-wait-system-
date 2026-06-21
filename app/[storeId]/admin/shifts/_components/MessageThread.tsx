'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ShiftMessage, MessageSender } from '@/types/shifts'

const sb = supabase as any

// 店長↔スタッフ(または全体)の1スレッド。manager/staff 双方から利用。
export function MessageThread({
  storeId, staffId, sender, heightClass = 'h-[60vh]',
}: {
  storeId: string
  staffId: string | null     // null = 全体お知らせスレッド
  sender: MessageSender      // 自分がどちら側か
  heightClass?: string
}) {
  const [msgs, setMsgs] = useState<ShiftMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetch = async () => {
    let q = sb.from('shift_messages').select('*').eq('store_id', storeId).order('created_at', { ascending: true })
    q = staffId ? q.eq('staff_id', staffId) : q.is('staff_id', null)
    const { data } = await q
    setMsgs((data ?? []) as ShiftMessage[])
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true); fetch()
    const ch = sb.channel(`msg-${storeId}-${staffId ?? 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_messages', filter: `store_id=eq.${storeId}` },
        (payload: any) => {
          const m = payload.new as ShiftMessage
          const match = staffId ? m.staff_id === staffId : m.staff_id == null
          if (match) setMsgs(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
        })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [storeId, staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  // 相手の未読を既読化
  useEffect(() => {
    const unread = msgs.filter(m => m.sender !== sender && !m.read_at).map(m => m.id)
    if (unread.length) sb.from('shift_messages').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => {})
  }, [msgs, sender])

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setSending(true)
    const { error } = await sb.from('shift_messages').insert({ store_id: storeId, staff_id: staffId, sender, body })
    setSending(false)
    if (!error) { setText(''); fetch() }
  }

  return (
    <div className="flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
      <div className={`flex-1 overflow-y-auto p-3 space-y-2 ${heightClass}`}>
        {loading ? (
          <div className="h-full grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
        ) : msgs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">まだメッセージはありません</p>
        ) : msgs.map(m => {
          const mine = m.sender === sender
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[9px] mt-0.5 ${mine ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {mine && m.read_at && '・既読'}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-2 bg-white border-t border-gray-100">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="メッセージを入力…" className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
        <button onClick={send} disabled={sending || !text.trim()}
          className="p-2.5 rounded-xl bg-indigo-600 text-white active:scale-95 transition-all disabled:opacity-40">
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}
