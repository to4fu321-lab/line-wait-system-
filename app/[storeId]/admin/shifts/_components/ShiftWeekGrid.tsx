'use client'

import { ChevronLeft, ChevronRight, Plus, Loader2, Send } from 'lucide-react'
import type { Shift } from '@/types/shifts'
import type { Staff } from '@/types/master'
import type { PaintValue } from './ShiftPaintBar'
import { fmtHM, dowOf, workedMinutes, fmtDurationH } from '../_lib/time'
import { todayJst } from '@/lib/date'

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export function ShiftWeekGrid({
  staff, shifts, days, loading, onPrev, onNext, onToday, onAdd, onEdit, onPublish, publishing,
  paint = null, onPaintCell, onPaintRow,
}: {
  staff: Staff[]
  shifts: Shift[]
  days: string[]                 // 7日分 YYYY-MM-DD（月曜始まり）
  loading: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onAdd: (staffId: string, date: string) => void
  onEdit: (shift: Shift) => void
  onPublish: () => void
  publishing: boolean
  paint?: PaintValue
  onPaintCell?: (staffId: string, date: string) => void
  onPaintRow?: (staffId: string) => void
}) {
  const painting = paint !== null
  const today = todayJst()
  const draftCount = shifts.filter(s => s.status === 'draft').length

  // staff_id+date -> shifts
  const byCell: Record<string, Shift[]> = {}
  for (const s of shifts) {
    const key = `${s.staff_id}_${s.work_date}`
    ;(byCell[key] ||= []).push(s)
  }

  // ヘルプで来ているスタッフ（自店staff以外）も行に出す
  const staffIds = new Set(staff.map(s => s.id))
  const helpStaff: Staff[] = []
  const seen = new Set<string>()
  for (const s of shifts) {
    if (!staffIds.has(s.staff_id) && s.staff && !seen.has(s.staff_id)) {
      seen.add(s.staff_id); helpStaff.push(s.staff)
    }
  }
  const rows = [...staff, ...helpStaff]

  const rangeLabel = `${days[0].slice(5).replace('-', '/')}〜${days[6].slice(5).replace('-', '/')}`

  return (
    <div>
      {/* ヘッダ */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
          <button onClick={onToday} className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50">今週</button>
          <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
          <p className="font-black text-gray-900 text-sm ml-1">{rangeLabel}</p>
        </div>
        <button onClick={onPublish} disabled={publishing || draftCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black active:scale-95 transition-all disabled:opacity-40">
          {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          公開{draftCount > 0 ? `（下書き${draftCount}）` : ''}
        </button>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          スタッフが登録されていません。<br />「設定 → スタッフマスタ」から追加してください。
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[640px]">
            {/* 曜日ヘッダ */}
            <div className="grid grid-cols-[88px_repeat(7,1fr)] gap-1 mb-1">
              <div />
              {days.map(d => {
                const dow = dowOf(d)
                const isToday = d === today
                return (
                  <div key={d} className={`text-center py-1 rounded-lg ${isToday ? 'bg-indigo-50' : ''}`}>
                    <p className={`text-[10px] font-bold ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{WEEK[dow]}</p>
                    <p className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{Number(d.slice(8))}</p>
                  </div>
                )
              })}
            </div>

            {/* スタッフ行 */}
            {rows.map(s => (
              <div key={s.id} className="grid grid-cols-[88px_repeat(7,1fr)] gap-1 mb-1">
                <button type="button"
                  onClick={() => { if (painting && staffIds.has(s.id)) onPaintRow?.(s.id) }}
                  className={`flex items-center gap-1.5 px-1 min-w-0 text-left rounded-lg ${painting && staffIds.has(s.id) ? 'hover:bg-indigo-50 active:scale-[0.98]' : 'cursor-default'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color || '#cbd5e1' }} />
                  <span className="text-xs font-bold text-gray-800 truncate">{s.name}</span>
                </button>
                {days.map(d => {
                  const cell = byCell[`${s.id}_${d}`] ?? []
                  const cellTap = () => painting ? onPaintCell?.(s.id, d) : (cell.length ? onEdit(cell[0]) : onAdd(s.id, d))
                  return (
                    <button key={d} onClick={cellTap}
                      className={`min-h-[44px] rounded-lg border text-left p-1 active:scale-[0.98] transition-all ${
                        cell.length
                          ? 'border-transparent'
                          : `border-dashed grid place-items-center ${painting ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40'}`
                      }`}>
                      {cell.length === 0 ? (
                        <Plus size={14} className={painting ? 'text-indigo-400' : 'text-gray-300'} />
                      ) : (
                        <div className="space-y-0.5">
                          {cell.map(sh => {
                            const min = workedMinutes(sh.start_time, sh.end_time, sh.break_minutes)
                            const bg = sh.is_help ? '#0d9488' : (s.color || '#6366f1')
                            return (
                              <div key={sh.id} onClick={e => { e.stopPropagation(); painting ? onPaintCell?.(s.id, d) : onEdit(sh) }}
                                className="rounded-md px-1.5 py-1 text-white leading-tight"
                                style={{ background: bg, opacity: sh.status === 'draft' ? 0.6 : 1 }}>
                                <p className="text-[10px] font-black">{fmtHM(sh.start_time)}-{fmtHM(sh.end_time)}</p>
                                <p className="text-[9px] opacity-90">{fmtDurationH(min)}{sh.is_help ? '・助' : ''}{sh.status === 'draft' ? '・下書' : ''}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-3 text-center">
        セルをタップで追加・編集。うすい色＝下書き（未公開）。<span className="text-teal-600">緑＝他店ヘルプ</span>
      </p>
    </div>
  )
}
