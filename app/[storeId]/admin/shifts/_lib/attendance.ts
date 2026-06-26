// ============================================================
// 勤怠（予定shift vs 実績time_records）の突合・集計
// ============================================================
import { supabase } from '@/lib/supabase'
import type { Shift, TimeRecord } from '@/types/shifts'
import { toMinutes } from './time'

const sb = supabase as any

export interface AttendanceRow {
  staff_id: string
  name: string
  color: string
  shift?: Shift
  record?: TimeRecord
  lateMin: number      // 遅刻（分）
  earlyMin: number     // 早退（分）
  overtimeMin: number  // 残業（分）
  absent: boolean      // 予定あり・打刻なし
}

function hm(ts: string): number {
  const d = new Date(new Date(ts).getTime() + 9 * 3600000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export async function loadAttendance(storeId: string, date: string): Promise<AttendanceRow[]> {
  const [{ data: shifts }, { data: recs }] = await Promise.all([
    sb.from('shifts').select('*, staff:staff(id,name,color)').eq('store_id', storeId).eq('work_date', date).neq('status', 'cancelled'),
    sb.from('time_records').select('*, staff:staff(id,name,color)').eq('store_id', storeId).eq('work_date', date),
  ])
  const shiftList = (shifts ?? []) as Shift[]
  const recList = (recs ?? []) as TimeRecord[]

  // staff_id 単位で統合
  const ids = Array.from(new Set<string>([...shiftList.map(s => s.staff_id), ...recList.map(r => r.staff_id)]))
  const rows: AttendanceRow[] = []
  for (const id of ids) {
    const shift = shiftList.find(s => s.staff_id === id)
    const record = recList.find(r => r.staff_id === id)
    const staff = (shift?.staff ?? record?.staff)
    let lateMin = 0, earlyMin = 0, overtimeMin = 0, absent = false
    if (shift && record?.clock_in_at) {
      lateMin = Math.max(0, hm(record.clock_in_at) - toMinutes(shift.start_time))
    }
    if (shift && record?.clock_out_at) {
      const out = hm(record.clock_out_at)
      earlyMin = Math.max(0, toMinutes(shift.end_time) - out)
      overtimeMin = Math.max(0, out - toMinutes(shift.end_time))
    }
    if (shift && !record) absent = true
    rows.push({
      staff_id: id, name: staff?.name ?? 'スタッフ', color: staff?.color ?? '#94a3b8',
      shift, record, lateMin, earlyMin, overtimeMin, absent,
    })
  }
  return rows.sort((a, b) => (a.shift?.start_time ?? '99').localeCompare(b.shift?.start_time ?? '99'))
}
