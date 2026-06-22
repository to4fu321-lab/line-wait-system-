'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react'
import { loadAttendance, type AttendanceRow } from '../_lib/attendance'
import { fmtHM, fmtDateJp, addDays, todayJst, fmtDurationH } from '../_lib/time'

export function AttendanceTab({ storeId }: { storeId: string }) {
  const [date, setDate] = useState(todayJst())
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loadAttendance(storeId, date).then(r => { setRows(r); setLoading(false) })
  }, [storeId, date])

  const tClock = (ts?: string | null) => ts ? new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-3">
        <button onClick={() => setDate(d => addDays(d, -1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <button onClick={() => setDate(todayJst())} className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50">今日</button>
        <p className="font-black text-gray-900 text-sm w-28 text-center">{fmtDateJp(date)}</p>
        <button onClick={() => setDate(d => addDays(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-gray-400"><Clock size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">この日の予定・打刻はありません</p></div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.staff_id} className={`flex items-center gap-3 p-3 rounded-xl border bg-white ${r.absent ? 'border-red-200' : 'border-gray-200'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500">
                  予定 {r.shift ? `${fmtHM(r.shift.start_time)}-${fmtHM(r.shift.end_time)}` : 'なし'}
                  <span className="mx-1">/</span>
                  実績 {tClock(r.record?.clock_in_at)}-{tClock(r.record?.clock_out_at)}
                </p>
              </div>
              <div className="text-right text-[11px] font-bold space-y-0.5">
                {r.absent && <span className="text-red-500">欠勤</span>}
                {r.lateMin > 0 && <div className="text-amber-600">遅刻 {r.lateMin}分</div>}
                {r.earlyMin > 0 && <div className="text-amber-600">早退 {r.earlyMin}分</div>}
                {r.overtimeMin > 0 && <div className="text-indigo-600">残業 {fmtDurationH(r.overtimeMin)}</div>}
                {!r.absent && r.lateMin === 0 && r.earlyMin === 0 && r.overtimeMin === 0 && r.record && <span className="text-emerald-600">正常</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
