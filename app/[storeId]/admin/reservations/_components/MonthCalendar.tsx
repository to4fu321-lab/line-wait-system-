'use client'

// ============================================================
// 月カレンダー（営業日・混み具合をひと目で）
//   採寸枠の混雑度を色/ドットで表示。日付タップで onChange。
// ============================================================
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { loadMonthInfo, type DayInfo, type DayLevel } from '../_lib/month'

function todayJst(): string { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) }

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

const LEVEL_STYLE: Record<DayLevel, string> = {
  none:   'bg-white border-gray-200 text-gray-800',
  closed: 'bg-gray-100 border-gray-200 text-gray-300',
  free:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  some:   'bg-amber-50 border-amber-200 text-amber-700',
  busy:   'bg-orange-50 border-orange-300 text-orange-700',
  full:   'bg-red-50 border-red-300 text-red-400',
}
const DOT: Record<DayLevel, string> = {
  none: '', closed: '', free: 'bg-emerald-400', some: 'bg-amber-400', busy: 'bg-orange-500', full: 'bg-red-500',
}

export function MonthCalendar({ storeId, value, onChange }: {
  storeId: string; value: string; onChange: (d: string) => void
}) {
  const [ym, setYm] = useState(() => { const [y, m] = value.split('-').map(Number); return { y, m } })
  const [info, setInfo] = useState<Record<string, DayInfo>>({})
  const [loading, setLoading] = useState(true)
  const today = todayJst()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadMonthInfo(storeId, ym.y, ym.m).then(r => { if (!cancelled) { setInfo(r); setLoading(false) } })
    return () => { cancelled = true }
  }, [storeId, ym.y, ym.m])

  const first = new Date(`${ym.y}-${String(ym.m).padStart(2, '0')}-01T12:00:00Z`)
  const firstDow = first.getUTCDay()
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym.y}-${String(ym.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

  const prevMonth = () => setYm(({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }))
  const nextMonth = () => setYm(({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <p className="font-black text-gray-900 text-sm">{ym.y}年{ym.m}月</p>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK.map((w, i) => (
          <div key={w} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{w}</div>
        ))}
      </div>
      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={`e${idx}`} />
            const level = info[date]?.level ?? 'none'
            const sel = date === value
            const isToday = date === today
            const day = Number(date.slice(8, 10))
            return (
              <button key={date} onClick={() => onChange(date)}
                className={`relative aspect-square rounded-lg border text-sm font-bold flex items-center justify-center active:scale-95 transition-all ${
                  sel ? 'border-indigo-600 bg-indigo-600 text-white' : LEVEL_STYLE[level]
                } ${isToday && !sel ? 'ring-1 ring-indigo-400' : ''}`}>
                {day}
                {!sel && DOT[level] && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${DOT[level]}`} />}
              </button>
            )
          })}
        </div>
      )}
      {/* 凡例 */}
      <div className="flex items-center justify-center gap-2.5 mt-2 text-[9px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />空き</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />やや</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />混雑</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />満</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-200" />休</span>
      </div>
    </div>
  )
}
