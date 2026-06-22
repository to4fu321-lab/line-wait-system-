'use client'

import { useEffect, useState } from 'react'
import { Check, X, Loader2, Inbox, ArrowLeftRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { LeaveRequest, ShiftSwap } from '@/types/shifts'
import { LEAVE_TYPE_LABELS } from '@/types/shifts'
import { fmtDateJp } from '../_lib/time'

const sb = supabase as any

export function LeaveReviewList({ storeId, useSwap, onToast }: {
  storeId: string; useSwap: boolean; onToast: (m: string, t?: 'ok' | 'err') => void
}) {
  const [leaves, setLeaves] = useState<(LeaveRequest & { staff?: any })[]>([])
  const [swaps, setSwaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const [{ data: lv }, { data: sw }] = await Promise.all([
      sb.from('leave_requests').select('*, staff:staff(name,color)').eq('store_id', storeId).eq('status', 'submitted').order('start_date'),
      useSwap
        ? sb.from('shift_swaps').select('*, from_staff:staff!shift_swaps_from_staff_id_fkey(name), to_staff:staff!shift_swaps_to_staff_id_fkey(name), shift:shifts(work_date,start_time,end_time)').eq('store_id', storeId).eq('status', 'accepted')
        : Promise.resolve({ data: [] }),
    ])
    setLeaves((lv ?? []))
    setSwaps((sw ?? []))
    setLoading(false)
  }
  useEffect(() => { load() }, [storeId, useSwap]) // eslint-disable-line react-hooks/exhaustive-deps

  const reviewLeave = async (r: LeaveRequest, approve: boolean) => {
    setBusy(r.id)
    await sb.from('leave_requests').update({ status: approve ? 'approved' : 'rejected' }).eq('id', r.id)
    if (approve) {
      // 承認した休暇日を希望(off)として連動（同日のシフト作成を抑止する目印）
      const days: string[] = []
      let d = r.start_date
      for (let i = 0; i < 31 && d <= r.end_date; i++) { days.push(d); const nx = new Date(new Date(d + 'T12:00:00Z').getTime() + 86400000); d = nx.toISOString().slice(0, 10) }
      for (const day of days) {
        await sb.from('shift_requests').upsert({ store_id: storeId, staff_id: r.staff_id, work_date: day, kind: 'off', status: 'approved', note: `休暇(${LEAVE_TYPE_LABELS[r.leave_type]})` })
      }
    }
    setBusy(null); onToast(approve ? '休暇を承認しました' : '却下しました'); load()
  }

  const approveSwap = async (id: string) => {
    setBusy(id)
    const res = await fetch('/api/shift-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', storeId, swap_id: id }) })
    setBusy(null)
    if (!res.ok) { onToast('承認に失敗しました', 'err'); return }
    onToast('交換を承認しました（シフト入替）'); load()
  }
  const rejectSwap = async (id: string) => {
    setBusy(id)
    await fetch('/api/shift-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject', storeId, swap_id: id }) })
    setBusy(null); onToast('交換を却下しました'); load()
  }

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>

  const empty = leaves.length === 0 && swaps.length === 0
  if (empty) return (
    <div className="py-16 text-center text-gray-400"><Inbox size={30} className="mx-auto mb-2 opacity-40" /><p className="text-sm">未処理の休暇・交換申請はありません</p></div>
  )

  return (
    <div className="space-y-5">
      {leaves.length > 0 && (
        <div>
          <p className="text-xs font-black text-gray-500 mb-2">休暇申請</p>
          <div className="space-y-2">
            {leaves.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                <span className="px-2 py-1 rounded-lg bg-gray-100 text-xs font-bold text-gray-600">{LEAVE_TYPE_LABELS[r.leave_type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{r.staff?.name ?? 'スタッフ'}</p>
                  <p className="text-xs text-gray-500">{fmtDateJp(r.start_date)}{r.start_date !== r.end_date ? `〜${fmtDateJp(r.end_date)}` : ''}{r.reason ? `・${r.reason}` : ''}</p>
                </div>
                <button onClick={() => reviewLeave(r, false)} disabled={busy === r.id} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:text-red-600"><X size={16} /></button>
                <button onClick={() => reviewLeave(r, true)} disabled={busy === r.id} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center gap-1">
                  {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}承認
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {swaps.length > 0 && (
        <div>
          <p className="text-xs font-black text-gray-500 mb-2">シフト交換（承諾済み・承認待ち）</p>
          <div className="space-y-2">
            {swaps.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
                <ArrowLeftRight size={16} className="text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-bold text-gray-900">{s.from_staff?.name} → {s.to_staff?.name}</p>
                  <p className="text-xs text-gray-500">{s.shift ? fmtDateJp(s.shift.work_date) : ''}</p>
                </div>
                <button onClick={() => rejectSwap(s.id)} disabled={busy === s.id} className="p-2 rounded-lg bg-white text-gray-400 hover:text-red-600"><X size={16} /></button>
                <button onClick={() => approveSwap(s.id)} disabled={busy === s.id} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center gap-1">
                  {busy === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}承認
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
