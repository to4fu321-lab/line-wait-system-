'use client'

import { useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import type { Shift } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { fmtDateJp, fmtHM, workedMinutes, fmtDurationH, laborCost, yen } from '../_lib/time'

export function DayShiftSheet({
  date, shifts, staffMap, onClose, onAdd, onEdit,
}: {
  date: string
  shifts: Shift[]
  staffMap: Record<string, Staff>
  onClose: () => void
  onAdd: () => void
  onEdit: (s: Shift) => void
}) {
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  const list = shifts.filter(s => s.work_date === date).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const totalCost = list.reduce((sum, s) => sum + laborCost(s, staffMap), 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[88dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-black text-gray-900">{fmtDateJp(date)} のシフト</h2>
            <p className="text-xs text-gray-400">{list.length}人 / 人件費 {yen(totalCost)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="px-5 py-4 space-y-2">
          {list.length === 0 && <p className="text-center text-gray-400 text-sm py-6">シフトはまだありません</p>}
          {list.map(s => {
            const name = s.staff?.name ?? staffMap[s.staff_id]?.name ?? 'スタッフ'
            const color = s.is_help ? '#0d9488' : (s.staff?.color ?? staffMap[s.staff_id]?.color ?? '#94a3b8')
            const min = workedMinutes(s.start_time, s.end_time, s.break_minutes)
            return (
              <button key={s.id} onClick={() => onEdit(s)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.99] transition-all text-left">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {name}
                    {s.is_help && <span className="ml-1.5 text-[10px] font-black text-teal-600">ヘルプ</span>}
                    {s.status === 'draft' && <span className="ml-1.5 text-[10px] font-bold text-amber-500">下書き</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {fmtHM(s.start_time)}-{fmtHM(s.end_time)}・実働{fmtDurationH(min)}{s.position ? `・${s.position}` : ''}
                  </p>
                </div>
                <span className="text-xs font-black text-gray-600">{yen(laborCost(s, staffMap))}</span>
              </button>
            )
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4">
          <button onClick={onAdd}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black active:scale-95 transition-all flex items-center justify-center gap-2">
            <Plus size={18} />この日にシフトを追加
          </button>
        </div>
      </div>
    </div>
  )
}
