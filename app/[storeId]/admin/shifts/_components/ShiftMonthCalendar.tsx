'use client'

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { Shift } from '@/types/shifts'

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export function ShiftMonthCalendar({
  ym, shifts, loading, onPrev, onNext, onSelectDay,
}: {
  ym: { y: number; m: number }
  shifts: Shift[]
  loading: boolean
  onPrev: () => void
  onNext: () => void
  onSelectDay: (date: string) => void
}) {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

  // date -> shifts
  const byDate: Record<string, Shift[]> = {}
  for (const s of shifts) (byDate[s.work_date] ||= []).push(s)

  const p = (n: number) => String(n).padStart(2, '0')
  const first = new Date(`${ym.y}-${p(ym.m)}-01T12:00:00Z`)
  const firstDow = first.getUTCDay()
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym.y}-${p(ym.m)}-${p(d)}`)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <p className="font-black text-gray-900 text-sm">{ym.y}年{ym.m}月</p>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK.map((w, i) => (
          <div key={w} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{w}</div>
        ))}
      </div>
      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={`e${idx}`} />
            const list = byDate[date] ?? []
            const isToday = date === today
            const day = Number(date.slice(8, 10))
            // 色チップ（最大4・重複色除外）
            const colors: string[] = []
            for (const s of list) {
              const c = s.is_help ? '#0d9488' : (s.staff?.color || '#94a3b8')
              if (!colors.includes(c) && colors.length < 4) colors.push(c)
            }
            return (
              <button key={date} onClick={() => onSelectDay(date)}
                className={`relative aspect-square rounded-lg border p-1 flex flex-col active:scale-95 transition-all ${
                  isToday ? 'border-indigo-400 ring-1 ring-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                <span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{day}</span>
                {list.length > 0 && (
                  <>
                    <span className="text-[10px] font-black text-gray-500 mt-auto">{list.length}人</span>
                    <div className="flex gap-0.5 flex-wrap mt-0.5">
                      {colors.map((c, i) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />)}
                    </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2 text-center">日付をタップでその日のシフトを編集</p>
    </div>
  )
}
