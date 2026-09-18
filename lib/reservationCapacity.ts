// ============================================================
// 予約枠（受付する時間と、その枠で何件受けられるか）を決める唯一の場所
//
//  考え方はできるだけ単純にしている。
//    ・受付する時間帯 …… 営業時間(stores.business_hours)
//    ・枠の刻み     …… 店舗の枠の長さ(stores.reservation_slot_min)
//    ・1枠の受付数   …… 既定値 → 日付ごと → 日付×時間ごと の順で上書き
//
//  以前は採寸メニューごとに所要時間・受付時間帯・曜日別枠数を持たせ、
//  お客様が選んだメニューで枠の刻みが変わる作りだったが、
//  設定も予約導線も複雑になるためやめた。
//  出勤人数は枠を自動で削らず、設定画面に参考として出すだけにしている
//  （勝手に枠が変わると、なぜ予約が取れないのか店舗にも分からなくなるため）。
// ============================================================
import { supabase } from './supabase'
import type { BusinessHours, DayKey } from './pop'

const sb = supabase as any

const DOW_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** 営業時間が未設定の店舗向けの既定値 */
const FALLBACK_OPEN  = '10:00'
const FALLBACK_CLOSE = '17:00'

export const SLOT_MIN_OPTIONS = [15, 30, 45, 60, 90, 120]

export interface SlotCapacity {
  /** 'HH:MM' */
  time: string
  /** この枠で受けられる件数 */
  capacity: number
  /** 既定値ではなく個別に指定された枠か（設定画面で色を変えるため） */
  overridden: boolean
}

export interface DayCapacity {
  /** 受付を行うか。定休日・臨時休業なら false */
  open: boolean
  /** 受付開始 HH:MM（営業時間から） */
  startTime: string
  /** 受付終了 HH:MM（営業時間から） */
  endTime: string
  /** 枠の長さ(分) */
  slotMin: number
  /** その日の各枠 */
  slots: SlotCapacity[]
  /** 何によってこの状態になったか */
  reason: 'closed_weekday' | 'date_closed' | 'open'
  /** その日の出勤人数（シフト未登録なら null）。参考表示にだけ使う */
  staffOnDuty: number | null
}

export interface CapacityInputs {
  businessHours: BusinessHours | null
  slotMin: number
  defaultCapacity: number
  /** 日付ごとの枠数。0 は臨時休業 */
  dateOverrides: Record<string, number>
  /** 日付×時間ごとの枠数。キーは `YYYY-MM-DD HH:MM` */
  slotOverrides: Record<string, number>
  /** 日付ごとの出勤人数（参考表示用） */
  staffByDate: Record<string, number>
}

/** start から end まで step 分刻みの 'HH:MM' を作る */
export function generateSlotTimes(start: string, end: string, step: number): string[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const stop = eh * 60 + em
  const out: string[] = []
  const safeStep = step > 0 ? step : 60
  for (let cur = sh * 60 + sm; cur < stop; cur += safeStep) {
    out.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`)
  }
  return out
}

export const slotKey = (date: string, time: string) => `${date} ${time}`

/** 店舗の設定と当日の指定から、その日の受付枠を決める */
export function capacityOf(date: string, input: CapacityInputs): DayCapacity {
  const dow = new Date(date + 'T12:00:00Z').getUTCDay()
  const day = input.businessHours?.hours?.[DOW_KEYS[dow]]
  const startTime = day?.open  || FALLBACK_OPEN
  const endTime   = day?.close || FALLBACK_CLOSE
  const slotMin   = input.slotMin > 0 ? input.slotMin : 60
  const staffOnDuty = date in input.staffByDate ? input.staffByDate[date] : null

  const closed = (reason: DayCapacity['reason']): DayCapacity =>
    ({ open: false, startTime, endTime, slotMin, slots: [], reason, staffOnDuty })

  // 臨時休業（日付指定で0）は定休日より優先して見る
  if (input.dateOverrides[date] === 0) return closed('date_closed')
  if (day?.closed && !(date in input.dateOverrides)) return closed('closed_weekday')

  const dayDefault = input.dateOverrides[date] ?? input.defaultCapacity

  const slots: SlotCapacity[] = generateSlotTimes(startTime, endTime, slotMin).map(time => {
    const key = slotKey(date, time)
    const has = key in input.slotOverrides
    return {
      time,
      capacity: has ? input.slotOverrides[key] : dayDefault,
      overridden: has,
    }
  })

  return { open: true, startTime, endTime, slotMin, slots, reason: 'open', staffOnDuty }
}

/** capacityOf に渡す材料を、指定期間ぶんまとめて取ってくる */
export async function loadCapacityInputs(
  storeId: string, fromDate: string, toDate: string,
): Promise<CapacityInputs> {
  const [{ data: store }, { data: dateOvr }, { data: slotOvr }, { data: shifts }] = await Promise.all([
    sb.from('stores')
      .select('business_hours, reservation_slot_min, reservation_slot_capacity')
      .eq('id', storeId).maybeSingle(),
    sb.from('reservation_date_overrides').select('date, max_slots')
      .eq('store_id', storeId).gte('date', fromDate).lte('date', toDate),
    sb.from('reservation_slot_overrides').select('date, start_time, capacity')
      .eq('store_id', storeId).gte('date', fromDate).lte('date', toDate),
    sb.from('shifts').select('work_date, staff_id')
      .eq('store_id', storeId).gte('work_date', fromDate).lte('work_date', toDate)
      .neq('status', 'cancelled'),
  ])

  const dateOverrides: Record<string, number> = {}
  for (const o of (dateOvr ?? []) as { date: string; max_slots: number }[]) {
    dateOverrides[o.date] = o.max_slots
  }

  const slotOverrides: Record<string, number> = {}
  for (const o of (slotOvr ?? []) as { date: string; start_time: string; capacity: number }[]) {
    slotOverrides[slotKey(o.date, o.start_time)] = o.capacity
  }

  // 同じ人が同じ日に複数シフトを持つことがあるので人数として数え直す
  const staffSets: Record<string, Set<string>> = {}
  for (const s of (shifts ?? []) as { work_date: string; staff_id: string }[]) {
    ;(staffSets[s.work_date] ??= new Set()).add(s.staff_id)
  }
  const staffByDate: Record<string, number> = {}
  for (const [d, set] of Object.entries(staffSets)) staffByDate[d] = set.size

  return {
    businessHours: (store?.business_hours as BusinessHours | null) ?? null,
    slotMin: Number(store?.reservation_slot_min ?? 60) || 60,
    // 予約はシーズン時のみ使うので既定は0（受付なし）。
    // 0 を 1 に丸めないよう、|| ではなく NaN だけを弾く
    defaultCapacity: Math.max(0, Number(store?.reservation_slot_capacity ?? 0) || 0),
    dateOverrides,
    slotOverrides,
    staffByDate,
  }
}

/** 1日ぶんだけ欲しいとき */
export async function loadDayCapacity(storeId: string, date: string): Promise<DayCapacity> {
  return capacityOf(date, await loadCapacityInputs(storeId, date, date))
}

export const CAPACITY_REASON_LABELS: Record<DayCapacity['reason'], string> = {
  closed_weekday: '定休日',
  date_closed:    '臨時休業',
  open:           '受付中',
}
