'use client'

import { useEffect, useState } from 'react'
import { Check, X, Loader2, CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ShiftRequest } from '@/types/shifts'
import { SHIFT_REQUEST_KIND_LABELS } from '@/types/shifts'
import { loadPendingRequests } from '../_lib/data'
import { fmtDateJp, fmtHM } from '../_lib/time'

const sb = supabase as any

export function RequestReviewList({ storeId, onChanged, onToast }: {
  storeId: string
  onChanged: () => void
  onToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [list, setList] = useState<ShiftRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    setList(await loadPendingRequests(storeId))
    setLoading(false)
  }
  useEffect(() => { fetch() }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (r: ShiftRequest) => {
    setBusy(r.id)
    if (r.kind === 'off') {
      // 休み希望は承認のみ（シフトは作らない）
      await sb.from('shift_requests').update({ status: 'approved' }).eq('id', r.id)
    } else {
      const { data: shift } = await sb.from('shifts').insert({
        store_id: storeId,
        staff_id: r.staff_id,
        home_store_id: storeId,
        work_date: r.work_date,
        start_time: r.pref_start ?? '10:00',
        end_time: r.pref_end ?? '18:00',
        break_minutes: 60,
        status: 'draft',
        note: '希望シフトから作成',
      }).select().single()
      await sb.from('shift_requests').update({ status: 'approved', resolved_shift_id: shift?.id ?? null }).eq('id', r.id)
    }
    setBusy(null)
    onToast(r.kind === 'off' ? '休み希望を承認しました' : 'シフトを作成しました')
    fetch(); onChanged()
  }

  const reject = async (r: ShiftRequest) => {
    setBusy(r.id)
    await sb.from('shift_requests').update({ status: 'rejected' }).eq('id', r.id)
    setBusy(null)
    onToast('却下しました')
    fetch(); onChanged()
  }

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
  if (list.length === 0) return (
    <div className="py-16 text-center text-gray-400">
      <CalendarClock size={32} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">未確認の希望シフトはありません</p>
    </div>
  )

  // 日付でグループ化
  const byDate: Record<string, ShiftRequest[]> = {}
  for (const r of list) (byDate[r.work_date] ||= []).push(r)

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, reqs]) => (
        <div key={date}>
          <p className="text-xs font-black text-gray-500 mb-1.5">{fmtDateJp(date)}</p>
          <div className="space-y-2">
            {reqs.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.staff?.color || '#94a3b8' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{r.staff?.name ?? 'スタッフ'}</p>
                  <p className="text-xs text-gray-500">
                    <span className={`font-bold ${r.kind === 'off' ? 'text-red-500' : 'text-emerald-600'}`}>{SHIFT_REQUEST_KIND_LABELS[r.kind]}</span>
                    {r.kind !== 'off' && r.pref_start && <span>・{fmtHM(r.pref_start)}{r.pref_end ? `-${fmtHM(r.pref_end)}` : '〜'}</span>}
                    {r.note && <span>・{r.note}</span>}
                  </p>
                </div>
                <button onClick={() => reject(r)} disabled={busy === r.id}
                  className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all disabled:opacity-50">
                  <X size={16} />
                </button>
                <button onClick={() => approve(r)} disabled={busy === r.id}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1">
                  {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}承認
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
