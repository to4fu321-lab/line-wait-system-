'use client'

import { useState } from 'react'
import { Send, Loader2, Sparkles, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { LEAVE_TYPE_LABELS } from '@/types/shifts'
import type { LeaveType } from '@/types/shifts'
import { fmtDateJp } from '../../admin/shifts/_lib/time'

const sb = supabase as any

type Proposal = {
  intent: 'leave' | 'work' | 'off' | 'swap' | 'unknown'
  leave_type: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  target_staff_name: string | null
  target_staff_id: string | null
  summary: string
  needs_clarification: boolean
  clarification: string | null
}

// 自然言語でシフト申請。Anthropicで意図抽出→確認カード→確定でDBへ。
export function ChatAssistant({ storeId, staffId, onToast }: {
  storeId: string; staffId: string; onToast: (m: string, t?: 'ok' | 'err') => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [committing, setCommitting] = useState(false)

  const interpret = async () => {
    if (!text.trim()) return
    setLoading(true); setProposal(null)
    try {
      const res = await fetch('/api/shift-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storeId, text }) })
      const j = await res.json()
      if (!j.ok) { onToast(j.error || '読み取れませんでした', 'err'); setLoading(false); return }
      setProposal(j.proposal)
    } catch { onToast('通信に失敗しました', 'err') }
    setLoading(false)
  }

  const commit = async () => {
    if (!proposal) return
    setCommitting(true)
    try {
      if (proposal.intent === 'leave') {
        await sb.from('leave_requests').insert({
          store_id: storeId, staff_id: staffId, leave_type: proposal.leave_type || 'paid',
          start_date: proposal.start_date, end_date: proposal.end_date || proposal.start_date, status: 'submitted',
        })
      } else if (proposal.intent === 'work' || proposal.intent === 'off') {
        await sb.from('shift_requests').insert({
          store_id: storeId, staff_id: staffId, work_date: proposal.start_date,
          kind: proposal.intent, pref_start: proposal.start_time, pref_end: proposal.end_time, status: 'submitted',
        })
      } else if (proposal.intent === 'swap') {
        if (!proposal.target_staff_id) { onToast('交換相手が特定できませんでした。交換タブから選んでください', 'err'); setCommitting(false); return }
        // 対象日の自分のシフトを探す
        const { data: shifts } = await sb.from('shifts').select('id').eq('staff_id', staffId).eq('work_date', proposal.start_date).eq('status', 'published').limit(1)
        const shiftId = (shifts ?? [])[0]?.id
        if (!shiftId) { onToast('その日の自分のシフトが見つかりません', 'err'); setCommitting(false); return }
        const r = await fetch('/api/shift-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', storeId, from_shift_id: shiftId, from_staff_id: staffId, to_staff_id: proposal.target_staff_id }) })
        if (!r.ok) { onToast('交換依頼に失敗しました', 'err'); setCommitting(false); return }
      }
      onToast('申請しました（店長の承認をお待ちください）')
      setProposal(null); setText('')
    } catch { onToast('申請に失敗しました', 'err') }
    setCommitting(false)
  }

  const intentLabel = (p: Proposal) =>
    p.intent === 'leave' ? `休暇申請（${LEAVE_TYPE_LABELS[((p.leave_type as LeaveType) || 'paid')]}）`
    : p.intent === 'work' ? '出勤可の希望'
    : p.intent === 'off' ? '休み希望'
    : p.intent === 'swap' ? `シフト交換（${p.target_staff_name ?? '相手未特定'}）` : '不明'

  return (
    <div>
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 mb-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-indigo-700 mb-2"><Sparkles size={16} />AIに話しかけて申請</p>
        <p className="text-xs text-gray-500 mb-3">例：「来週金曜休みたい」「今週土曜10時から出られます」「3日の鈴木さんと交換したい」</p>
        <div className="flex items-center gap-2">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && interpret()}
            placeholder="申請内容を入力…" className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          <button onClick={interpret} disabled={loading || !text.trim()} className="p-2.5 rounded-xl bg-indigo-600 text-white disabled:opacity-40 active:scale-95">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {proposal && (
        proposal.needs_clarification || proposal.intent === 'unknown' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {proposal.clarification || 'もう少し具体的に入力してください（日付や用件）。'}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-400 font-bold mb-1">この内容で申請します</p>
            <p className="text-base font-black text-gray-900">{intentLabel(proposal)}</p>
            <p className="text-sm text-gray-600 mt-1">
              {proposal.start_date && fmtDateJp(proposal.start_date)}
              {proposal.end_date && proposal.end_date !== proposal.start_date && `〜${fmtDateJp(proposal.end_date)}`}
              {proposal.start_time && `・${proposal.start_time}${proposal.end_time ? `-${proposal.end_time}` : ''}`}
            </p>
            <p className="text-xs text-gray-400 mt-1">{proposal.summary}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setProposal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold">やめる</button>
              <button onClick={commit} disabled={committing} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                {committing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}この内容で申請
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}
