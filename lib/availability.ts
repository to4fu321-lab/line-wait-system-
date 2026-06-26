// ============================================================
// スタッフの勤務可能曜日（固定の希望日程）availability
//   staff.availability(jsonb) の型とヘルパ。
//   ②自動生成・AI欠員補充の「その曜日に入れるか」に使う。
// ============================================================
export type Dow = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export interface DayAvail { on: boolean; start: string; end: string }
export type Availability = Partial<Record<Dow, DayAvail>>

export const DOW_ORDER: Dow[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const DOW_LABELS: Record<Dow, string> = {
  mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日',
}
// JS getDay() (0=日..6=土) → Dow
const JS_TO_DOW: Dow[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function defaultAvailability(): Availability {
  const av: Availability = {}
  for (const d of DOW_ORDER) av[d] = { on: d !== 'sun', start: '10:00', end: '19:00' }
  return av
}

// 'YYYY-MM-DD' → Dow（JSTで判定）
export function dowKeyOf(date: string): Dow {
  const d = new Date(date + 'T12:00:00+09:00')
  return JS_TO_DOW[d.getUTCDay()]
}

export function isAvailableOn(av: Availability | null | undefined, date: string): boolean {
  if (!av) return false
  const day = av[dowKeyOf(date)]
  return !!day?.on
}

export function availabilityRangeFor(av: Availability | null | undefined, date: string): DayAvail | null {
  if (!av) return null
  const day = av[dowKeyOf(date)]
  return day?.on ? day : null
}
