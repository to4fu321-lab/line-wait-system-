// ============================================================
// シフトの時間・人件費計算ヘルパー(client/server 共用の純関数)
// ============================================================
import type { Shift } from '@/types/shifts'
import type { Staff } from '@/types/master'

// 後方互換のための再エクスポート（実装は lib/date.ts）
export { todayJst } from '@/lib/date'

// 'HH:MM' / 'HH:MM:SS' → 分
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function fmtHM(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

// 実働分 = (終了-開始) - 休憩。日跨ぎは終了に+24h
export function workedMinutes(start: string, end: string, breakMin: number): number {
  let s = toMinutes(start)
  let e = toMinutes(end)
  if (e <= s) e += 24 * 60
  return Math.max(0, e - s - (breakMin || 0))
}

export function fmtDurationH(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

// shift単位の時給(上書き) ?? staff既定時給
export function wageOf(shift: Pick<Shift, 'hourly_wage' | 'staff_id'>, staffMap: Record<string, Staff>): number {
  if (shift.hourly_wage != null) return shift.hourly_wage
  const w = staffMap[shift.staff_id]?.hourly_wage
  return w ?? 0
}

// 1シフトの人件費(円)
export function laborCost(shift: Shift, staffMap: Record<string, Staff>): number {
  const min = workedMinutes(shift.start_time, shift.end_time, shift.break_minutes)
  return Math.round((min / 60) * wageOf(shift, staffMap))
}

export const yen = (n: number) => '¥' + n.toLocaleString('ja-JP')

// YYYY-MM-DD の曜日(0=日)
export function dowOf(date: string): number {
  return new Date(date + 'T12:00:00Z').getUTCDay()
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
export function fmtDateJp(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}(${WEEK[dowOf(date)]})`
}

// その週(月曜始まり)の7日分の日付配列
export function weekDates(anchor: string): string[] {
  const base = new Date(anchor + 'T12:00:00Z')
  const dow = base.getUTCDay()           // 0=日
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(base.getTime() + mondayOffset * 86400000)
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10))
}

export function addDays(date: string, days: number): string {
  return new Date(new Date(date + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)
}

export function yearMonthOf(date: string): string {
  return date.slice(0, 7)
}
