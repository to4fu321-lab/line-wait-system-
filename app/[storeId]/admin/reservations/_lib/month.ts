// ============================================================
// 月単位の「営業日・混み具合」集計（カレンダー表示用）
//   営業日・同時枠数の判断は lib/reservationCapacity に集約している。
//   ここはそれを月ぶん回して、予約件数と突き合わせるだけ。
// ============================================================
import { supabase } from '@/lib/supabase'
import { isFitting, loadServices } from './slots'
import { toJstDateString } from '@/lib/date'
import { capacityOf, loadCapacityInputs } from '@/lib/reservationCapacity'
import { holidayMapOfMonth } from '@/lib/japaneseHolidays'

const sb = supabase as any

export type DayLevel = 'none' | 'closed' | 'free' | 'some' | 'busy' | 'full'
export interface DayInfo {
  date: string          // YYYY-MM-DD
  isOpen: boolean       // 営業日か
  capacity: number      // 当日の採寸キャパ概算（同時枠×スロット数）
  booked: number        // 採寸予約件数
  level: DayLevel       // 混雑度（none=採寸設定なし）
  maxSlots: number      // 同時受付枠数
  holiday: string | null // 祝日名（祝日でなければ null）
  staffOnDuty: number | null // その日の出勤人数（シフト未登録なら null）
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
    const capacity = cap.open && shortest
      ? cap.maxSlots * slotCount(cap.startTime, cap.endTime, shortest.duration_min)
      : 0

    let level: DayLevel
    let isOpen: boolean
    if (!hasFitting) { level = 'none'; isOpen = cap.open }
    else if (!cap.open || capacity <= 0) { level = 'closed'; isOpen = false }
    else {
      isOpen = true
      const ratio = booked / capacity
      level = booked === 0 ? 'free' : ratio < 0.5 ? 'some' : ratio < 1 ? 'busy' : 'full'
    }
    out[date] = {
      date, isOpen, capacity, booked, level,
      maxSlots: cap.maxSlots,
      holiday: holidays[date] ?? null,
      staffOnDuty: cap.staffOnDuty,
    }
  }
  return out
}
