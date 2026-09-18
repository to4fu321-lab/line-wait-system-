// ============================================================
// 月単位の「営業日・混み具合」集計（カレンダー表示用）
//   受付するか・何件受けられるかは lib/reservationCapacity が決める。
//   ここはそれを月ぶん回して、予約件数と突き合わせるだけ。
// ============================================================
import { supabase } from '@/lib/supabase'
import { isFitting } from '@/lib/fittingTypes'
import { toJstDateString } from '@/lib/date'
import { capacityOf, loadCapacityInputs } from '@/lib/reservationCapacity'
import { holidayMapOfMonth } from '@/lib/japaneseHolidays'

const sb = supabase as any

export type DayLevel = 'none' | 'closed' | 'free' | 'some' | 'busy' | 'full'
export interface DayInfo {
  date: string          // YYYY-MM-DD
  isOpen: boolean       // 営業日か
  capacity: number      // その日に受けられる合計件数
  booked: number        // 予約件数
  level: DayLevel       // 混雑度
  holiday: string | null // 祝日名（祝日でなければ null）
  staffOnDuty: number | null // その日の出勤人数（参考）
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// year, month(1-based) の各日の DayInfo を返す
export async function loadMonthInfo(storeId: string, year: number, month: number): Promise<Record<string, DayInfo>> {
  const daysInMonth = new Date(year, month, 0).getDate()   // month(1-based) の末日
  const monthStart = ymd(year, month, 1)
  const monthEnd = ymd(year, month, daysInMonth)

  const [inputs, { data: resv }] = await Promise.all([
    loadCapacityInputs(storeId, monthStart, monthEnd),
    sb.from('reservations')
      .select('reserved_at, status, purpose, service_type').eq('store_id', storeId)
      .gte('reserved_at', `${monthStart}T00:00:00+09:00`)
      .lte('reserved_at', `${monthEnd}T23:59:59+09:00`).neq('status', 'cancelled'),
  ])

  const bookedMap: Record<string, number> = {}
  for (const r of (resv ?? []) as { reserved_at: string; purpose: string | null; service_type: string | null }[]) {
    if (!isFitting(r.purpose, r.service_type)) continue
    const d = toJstDateString(r.reserved_at)
    bookedMap[d] = (bookedMap[d] ?? 0) + 1
  }

  const holidays = holidayMapOfMonth(year, month)

  const out: Record<string, DayInfo> = {}
  for (let day = 1; day <= daysInMonth; day++) {
    const date = ymd(year, month, day)
    const cap = capacityOf(date, inputs)
    const booked = bookedMap[date] ?? 0
    const capacity = cap.slots.reduce((sum, s) => sum + s.capacity, 0)

    let level: DayLevel
    let isOpen: boolean
    if (!cap.open || capacity <= 0) { level = 'closed'; isOpen = false }
    else {
      isOpen = true
      const ratio = booked / capacity
      level = booked === 0 ? 'free' : ratio < 0.5 ? 'some' : ratio < 1 ? 'busy' : 'full'
    }
    out[date] = {
      date, isOpen, capacity, booked, level,
      holiday: holidays[date] ?? null,
      staffOnDuty: cap.staffOnDuty,
    }
  }
  return out
}
