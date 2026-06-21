'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Shift } from '@/types/shifts'
import { fmtHM, workedMinutes, fmtDurationH } from '../../admin/shifts/_lib/time'

const sb = supabase as any
const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export function MyShifts({ staffId, homeStoreId }: { staffId: string; homeStoreId: string }) {
  const t = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const [ym, setYm] = useState({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) })
  const [shifts, setShifts] = useState<Shift[]>([])
  const [storeNames, setStoreNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const today = t

  useEffect(() => {
    setLoading(true)
    const p = (n: number) => String(n).padStart(2, '0')
    const days = new Date(ym.y, ym.m, 0).getDate()
    sb.from('shifts').select('*')
      .eq('staff_id', staffId).eq('status', 'published')
      .gte('work_date', `${ym.y}-${p(ym.m)}-01`).lte('work_date', `${ym.y}-${p(ym.m)}-${p(days)}`)
      .order('work_date', { ascending: true })
      .then(async ({ data }: any) => {
        const list = (data ?? []) as Shift[]
        setShifts(list)
        // ヘルプ先など他店名を解決
        const ids = Array.from(new Set(list.map(s => s.store_id)))
        if (ids.length) {
          const { data: stores } = await sb.from('stores').select('id,name').in('id', ids)
          const m: Record<string, string> = {}
          for (const s of (stores ?? [])) m[s.id] = s.name
          setStoreNames(m)
        }
        setLoading(false)
      })
  }, [staffId, ym])

  const byDate: Record<string, Shift[]> = {}
  for (const s of shifts) (byDate[s.work_date] ||= []).push(s)

  const totalMin = shifts.reduce((sum, s) => sum + workedMinutes(s.start_time, s.end_time, s.break_minutes), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setYm(({ y, m }) => m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <p className="font-black text-gray-900">{ym.y}年{ym.m}月</p>
          <p className="text-[11px] text-gray-400">{shifts.length}日・実働{fmtDurationH(totalMin)}</p>
        </div>
        <button onClick={() => setYm(({ y, m }) => m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : shifts.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">この月の公開シフトはありません</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(byDate).map(([date, list]) => {
            const dow = new Date(date + 'T12:00:00Z').getUTCDay()
            const isToday = date === today
            return (
              <div key={date} className={`flex gap-3 p-3 rounded-2xl border ${isToday ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 bg-white'}`}>
                <div className="w-12 text-center shrink-0">
                  <p className={`text-[11px] font-bold ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{WEEK[dow]}</p>
                  <p className="text-xl font-black text-gray-800">{Number(date.slice(8))}</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {list.map(s => {
                    const isHelp = s.is_help || s.store_id !== homeStoreId
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-sm font-black ${isHelp ? 'bg-teal-600 text-white' : 'bg-indigo-600 text-white'}`}>
                          {fmtHM(s.start_time)}-{fmtHM(s.end_time)}
                        </span>
                        <span className="text-xs text-gray-500">
                          休憩{s.break_minutes}分{s.position ? `・${s.position}` : ''}
                          {isHelp && <span className="text-teal-600 font-bold"> ・{storeNames[s.store_id] ?? '他店'}ヘルプ</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
