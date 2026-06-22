'use client'

import { useEffect, useState } from 'react'
import { Check, X, Loader2, CalendarClock, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ShiftRequest } from '@/types/shifts'
import { SHIFT_REQUEST_KIND_LABELS } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { loadPendingRequests } from '../_lib/data'
import { fmtDateJp, fmtHM, todayJst } from '../_lib/time'

const sb = supabase as any
const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500'

export function RequestReviewList({ storeId, staff = [], onChanged, onToast }: {
  storeId: string
  staff?: Staff[]
  onChanged: () => void
  onToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [list, setList] = useState<ShiftRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  // 店長代理入力（月別の例外希望）
  const [addOpen, setAddOpen] = useState(false)
  const [aStaff, setAStaff] = useState('')
  const [aDate, setADate] = useState(todayJst())
  const [aKind, setAKind] = useState<'work' | 'off'>('work')
  const [aStart, setAStart] = useState('10:00')
  const [aEnd, setAEnd] = useState('18:00')
  const [aBusy, setABusy] = useState(false)

  const addProxy = async () => {
    const sid = aStaff || staff[0]?.id
    if (!sid) { onToast('スタッフを選んでください', 'err'); return }
    setABusy(true)
    const { error } = await sb.from('shift_requests').insert({
      store_id: storeId, staff_id: sid, work_date: aDate, kind: aKind,
      pref_start: aKind === 'work' ? aStart : null, pref_end: aKind === 'work' ? aEnd : null,
      status: 'submitted', note: '店長代理入力',
    })
    setABusy(false)
    if (error) { onToast('追加に失敗しました', 'err'); return }
    onToast('希望を追加しました'); setAddOpen(false); fetch()
  }

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

  // 日付でグループ化
  const byDate: Record<string, ShiftRequest[]> = {}
  for (const r of list) (byDate[r.work_date] ||= []).push(r)

  const addForm = (
    <div className="mb-4">
      {!addOpen ? (
        <button onClick={() => { setAStaff(staff[0]?.id ?? ''); setAddOpen(true) }}
          className="w-full py-2.5 rounded-xl border border-dashed border-indigo-300 text-indigo-600 text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-50">
          <Plus size={16} />希望を代理で追加（月別の例外）
        </button>
      ) : (
        <div className="p-3 rounded-2xl border border-gray-200 bg-white space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className={INPUT} value={aStaff} onChange={e => setAStaff(e.target.value)}>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" className={INPUT} value={aDate} onChange={e => setADate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {(['work', 'off'] as const).map(k => (
              <button key={k} onClick={() => setAKind(k)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${aKind === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>
                {SHIFT_REQUEST_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          {aKind === 'work' && (
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className={INPUT} value={aStart} onChange={e => setAStart(e.target.value)} />
              <input type="time" className={INPUT} value={aEnd} onChange={e => setAEnd(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setAddOpen(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm">やめる</button>
            <button onClick={addProxy} disabled={aBusy} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
              {aBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}追加
            </button>
          </div>
        </div>
      )}
    </div>
  )

  if (loading) return <div>{addForm}<div className="py-12 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div></div>
  if (list.length === 0) return (
    <div>
      {addForm}
      <div className="py-12 text-center text-gray-400">
        <CalendarClock size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">未確認の希望シフトはありません</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {addForm}
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
