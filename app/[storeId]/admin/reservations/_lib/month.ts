// ============================================================
// 月単位の「営業日・混み具合」集計（カレンダー表示用）
//   採寸(reservation_settings)の曜日別キャパシティを前計算し、
//   月内の採寸予約件数(isFitting)と突き合わせて混雑度を出す。
// ============================================================
import { supabase } from '@/lib/supabase'
import { isFitting, loadServices } from './slots'
import { toJstDateString } from '@/lib/date'

const sb = supabase as any
const WEEKDAY_KEYS = ['slots_sun', 'slots_mon', 'slots_tue', 'slots_wed', 'slots_thu', 'slots_fri', 'slots_sat'] as const

export type DayLevel = 'none' | 'closed' | 'free' | 'some' | 'busy' | 'full'
export interface DayInfo {
  date: string          // YYYY-MM-DD
  isOpen: boolean       // 営業日か
  capacity: number      // 当日の採寸キャパ概算（同時枠×スロット数）
  booked: number        // 採寸予約件数
  level: DayLevel       // 混雑度（none=採寸設定なし）
}

// 営業時間内のスロット数（混雑度の分母用の概算）
function slotCount(start: string, end: string, step: number): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const stop = eh * 60 + em
  let n = 0
  while (cur < stop) { n++; cur += step }
  return n
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// year, month(1-based) の各日の DayInfo を返す
export async function loadMonthInfo(storeId: string, year: number, month: number): Promise<Record<string, DayInfo>> {
  const services = await loadServices(storeId)
  const hasFitting = services.length > 0
  const shortest = hasFitting ? services.reduce((a, b) => (b.duration_min < a.duration_min ? b : a)) : null

  // 曜日別の同時枠(最小)とキャパシティ概算を前計算
  const weekdayMax: number[] = []
  const weekdayCap: number[] = []
  for (let dow = 0; dow < 7; dow++) {
    if (!hasFitting || !shortest) { weekdayMax[dow] = 0; weekdayCap[dow] = 0; continue }
    const key = WEEKDAY_KEYS[dow]
    const maxSlots = Math.min(...services.map(s => Number((s as Record<string, unknown>)[key] ?? 0)))
    weekdayMax[dow] = maxSlots
    weekdayCap[dow] = maxSlots > 0 ? maxSlots * slotCount(shortest.start_time, shortest.end_time, shortest.duration_min) : 0
  }

  const daysInMonth = new Date(year, month, 0).getDate()   // month(1-based) の末日
  const monthStart = ymd(year, month, 1)
  const monthEnd = ymd(year, month, daysInMonth)

  // 日別の枠上書き
  const overrideMap: Record<string, number> = {}
  try {
    const { data: ovr } = await sb.from('reservation_date_overrides')
      .select('date, max_slots').eq('store_id', storeId)
      .gte('date', monthStart).lte('date', monthEnd)
    for (const o of (ovr ?? []) as { date: string; max_slots: number }[]) overrideMap[o.date] = o.max_slots
  } catch { /* テーブル無ければ無視 */ }

  // 月内の採寸予約件数
  const startTs = `${monthStart}T00:00:00+09:00`
  const endTs = `${monthEnd}T23:59:59+09:00`
  const { data: resv } = await sb.from('reservations')
    .select('reserved_at, status, purpose, service_type').eq('store_id', storeId)
    .gte('reserved_at', startTs).lte('reserved_at', endTs).neq('status', 'cancelled')
  const bookedMap: Record<string, number> = {}
  for (const r of (resv ?? []) as { reserved_at: string; purpose: string | null; service_type: string | null }[]) {
    if (!isFitting(r.purpose, r.service_type)) continue
    const d = toJstDateString(r.reserved_at)
    bookedMap[d] = (bookedMap[d] ?? 0) + 1
  }

  const out: Record<string, DayInfo> = {}
  for (let day = 1; day <= daysInMonth; day++) {
    const date = ymd(year, month, day)
    const dow = new Date(date + 'T12:00:00Z').getUTCDay()
    let capacity = weekdayCap[dow]
    if (date in overrideMap) {
      const m = overrideMap[date]
      capacity = m > 0 && shortest ? m * slotCount(shortest.start_time, shortest.end_time, shortest.duration_min) : 0
    }
    const booked = bookedMap[date] ?? 0
    let level: DayLevel
    let isOpen: boolean
    if (!hasFitting) { level = 'none'; isOpen = true }
    else if (capacity <= 0) { level = 'closed'; isOpen = false }
    else {
      isOpen = true
      const ratio = booked / capacity
      level = booked === 0 ? 'free' : ratio < 0.5 ? 'some' : ratio < 1 ? 'busy' : 'full'
    }
    out[date] = { date, isOpen, capacity, booked, level }
  }
  return out
}
