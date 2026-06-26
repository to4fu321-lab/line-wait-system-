'use client'

import type { Availability, Dow } from '@/lib/availability'
import { DOW_ORDER, DOW_LABELS, defaultAvailability } from '@/lib/availability'

// 勤務可能曜日（固定の希望日程）の編集グリッド
export function AvailabilityEditor({ value, onChange }: {
  value: Availability | null
  onChange: (av: Availability) => void
}) {
  const av: Availability = value && Object.keys(value).length ? value : defaultAvailability()

  const update = (d: Dow, patch: Partial<{ on: boolean; start: string; end: string }>) => {
    const cur = av[d] ?? { on: false, start: '10:00', end: '19:00' }
    onChange({ ...av, [d]: { ...cur, ...patch } })
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {DOW_ORDER.map(d => {
        const day = av[d] ?? { on: false, start: '10:00', end: '19:00' }
        const isWeekend = d === 'sat' || d === 'sun'
        return (
          <div key={d} className={`flex items-center gap-2 px-3 py-2 border-t first:border-t-0 border-gray-100 ${day.on ? '' : 'opacity-50'}`}>
            <button type="button" onClick={() => update(d, { on: !day.on })}
              className={`w-9 h-9 rounded-lg text-sm font-black shrink-0 ${
                day.on ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
              } ${isWeekend && day.on ? (d === 'sun' ? 'bg-red-500' : 'bg-blue-500') : ''}`}>
              {DOW_LABELS[d]}
            </button>
            {day.on ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input type="time" value={day.start} onChange={e => update(d, { start: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28" />
                <span className="text-gray-400">〜</span>
                <input type="time" value={day.end} onChange={e => update(d, { end: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28" />
              </div>
            ) : (
              <span className="flex-1 text-sm text-gray-400">勤務不可</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
