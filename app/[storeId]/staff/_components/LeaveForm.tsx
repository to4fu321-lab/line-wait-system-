'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { LeaveRequest, LeaveType } from '@/types/shifts'
import { LEAVE_TYPE_LABELS } from '@/types/shifts'
import { fmtDateJp } from '../../admin/shifts/_lib/time'
import { todayJst } from '@/lib/date'

const sb = supabase as any
const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500'

export function LeaveForm({ storeId, staffId, onToast }: {
  storeId: string; staffId: string; onToast: (m: string, t?: 'ok' | 'err') => void
}) {
  const today = todayJst()
  const [list, setList] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<LeaveType>('paid')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const fetch = async () => {
    const { data } = await sb.from('leave_requests').select('*').eq('staff_id', staffId)
      .order('start_date', { ascending: false }).limit(20)
    setList((data ?? []) as LeaveRequest[]); setLoading(false)
  }
  useEffect(() => { fetch() }, [staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (to < from) { onToast('終了日は開始日以降にしてください', 'err'); return }
    setBusy(true)
    const { error } = await sb.from('leave_requests').insert({
      store_id: storeId, staff_id: staffId, leave_type: type, start_date: from, end_date: to,
      reason: reason.trim() || null, status: 'submitted',
    })
    setBusy(false)
    if (error) { onToast('申請に失敗しました', 'err'); return }
    onToast('休暇を申請しました'); setOpen(false); setReason(''); fetch()
  }

  return (
    <div>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="w-full mb-4 py-3 rounded-xl bg-indigo-600 text-white font-black active:scale-95 transition-all flex items-center justify-center gap-2">
          <Plus size={18} />休暇を申請する
        </button>
      )}

      {open && (
        <div className="mb-4 p-4 rounded-2xl border border-gray-200 bg-white space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">種別</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(k => (
                <button key={k} onClick={() => setType(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${type === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>
                  {LEAVE_TYPE_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">開始</label><input type="date" className={INPUT} value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">終了</label><input type="date" className={INPUT} value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">理由（任意）</label><input className={INPUT} value={reason} onChange={e => setReason(e.target.value)} /></div>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold">やめる</button>
            <button onClick={submit} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}申請
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : list.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">申請履歴はありません</p>
      ) : (
        <div className="space-y-2">
          {list.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
              <span className="px-2 py-1 rounded-lg bg-gray-100 text-xs font-bold text-gray-600">{LEAVE_TYPE_LABELS[r.leave_type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{fmtDateJp(r.start_date)}{r.start_date !== r.end_date ? `〜${fmtDateJp(r.end_date)}` : ''}</p>
                {r.reason && <p className="text-xs text-gray-400 truncate">{r.reason}</p>}
              </div>
              <span className={`text-xs font-black ${r.status === 'approved' ? 'text-emerald-600' : r.status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>
                {r.status === 'approved' ? '承認' : r.status === 'rejected' ? '却下' : r.status === 'cancelled' ? '取消' : '申請中'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
