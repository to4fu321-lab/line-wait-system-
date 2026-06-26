// ============================================================
// 経営ダッシュボードの指標集計（月次）
// ============================================================
import { supabase } from '@/lib/supabase'
import type { Shift, TimeRecord, StaffingRequirement } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { workedMinutes, laborCost, toMinutes } from './time'
import { staffMapOf } from './data'

const sb = supabase as any

export interface ShiftMetrics {
  plannedShifts: number   // 公開シフト数
  attended: number        // 打刻あり
  absent: number          // 予定あり打刻なし
  late: number            // 遅刻回数
  attendanceRate: number  // 出勤率
  absenceRate: number     // 欠勤率
  lateRate: number        // 遅刻率
  laborCost: number       // 人件費合計
  fulfillRate: number     // シフト充足率（配置/必要）
  requiredTotal: number
  assignedTotal: number
}

function hm(ts: string): number {
  const d = new Date(new Date(ts).getTime() + 9 * 3600000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export async function loadMetrics(storeId: string, year: number, month: number): Promise<ShiftMetrics> {
  const days = new Date(year, month, 0).getDate()
  const p = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${p(month)}-01`, end = `${year}-${p(month)}-${p(days)}`

  const [{ data: shifts }, { data: recs }, { data: reqs }, { data: staff }] = await Promise.all([
    sb.from('shifts').select('*').eq('store_id', storeId).gte('work_date', start).lte('work_date', end).eq('status', 'published'),
    sb.from('time_records').select('*').eq('store_id', storeId).gte('work_date', start).lte('work_date', end),
    sb.from('staffing_requirements').select('*').eq('store_id', storeId).gte('work_date', start).lte('work_date', end),
    sb.from('staff').select('*').eq('store_id', storeId),
  ])
  const shiftList = (shifts ?? []) as Shift[]
  const recList = (recs ?? []) as TimeRecord[]
  const reqList = (reqs ?? []) as StaffingRequirement[]
  const staffMap = staffMapOf((staff ?? []) as Staff[])

  // 出勤/欠勤/遅刻
  const recKey = (r: TimeRecord) => `${r.staff_id}_${r.work_date}`
  const recMap = new Map(recList.map(r => [recKey(r), r]))
  let attended = 0, absent = 0, late = 0
  for (const s of shiftList) {
    const r = recMap.get(`${s.staff_id}_${s.work_date}`)
    if (r?.clock_in_at) {
      attended++
      if (hm(r.clock_in_at) - toMinutes(s.start_time) > 5) late++
    } else absent++
  }
  const planned = shiftList.length
  const cost = shiftList.reduce((a, s) => a + laborCost(s, staffMap), 0)

  // 充足率（配置=その時間に勤務しているshift / 必要）
  let requiredTotal = 0, assignedTotal = 0
  // shift を日付ごとにまとめて、各 requirement block に対し配置数を数える
  const byDate: Record<string, Shift[]> = {}
  for (const s of shiftList) (byDate[s.work_date] ||= []).push(s)
  for (const req of reqList) {
    requiredTotal += req.required
    const blockStart = toMinutes(req.time_block)
    const assigned = (byDate[req.work_date] ?? []).filter(s => toMinutes(s.start_time) <= blockStart && toMinutes(s.end_time) > blockStart).length
    assignedTotal += Math.min(assigned, req.required)
  }

  return {
    plannedShifts: planned, attended, absent, late,
    attendanceRate: planned ? attended / planned : 0,
    absenceRate: planned ? absent / planned : 0,
    lateRate: attended ? late / attended : 0,
    laborCost: cost,
    fulfillRate: requiredTotal ? assignedTotal / requiredTotal : 0,
    requiredTotal, assignedTotal,
  }
}
