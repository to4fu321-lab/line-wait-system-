// ============================================================
// 予約の「受付時間帯」と「同時受付枠数」を決める唯一の場所
//
//  以前は reservation_settings に メニューごとの受付開始/終了 と
//  曜日別の枠数7つを店舗が手入力する作りだった。しかし
//   ・営業時間(stores.business_hours)
//   ・試着室数(stores.active_fittings)
//   ・出勤シフト(shifts)
//  という「すでに店舗が入力している事実」から決まるはずの値で、
//  二重管理になったうえ設定画面が複雑になっていた。
//
//  ここでは事実から自動で決め、例外日だけ
//  reservation_date_overrides で上書きする形に統一する。
//  予約1件あたりの所要時間はメニュー(duration_min)から決まるので、
//  ここでは扱わない。
// ============================================================
import { supabase } from './supabase'
import type { BusinessHours, DayKey } from './pop'

const sb = supabase as any

const DOW_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** 営業時間が未設定の店舗向けの既定値（従来の 10:00-17:00 に合わせる） */
const FALLBACK_OPEN  = '10:00'
const FALLBACK_CLOSE = '17:00'

export interface DayCapacity {
  /** 受付を行うか。定休日・臨時休業・枠0なら false */
  open: boolean
  /** 受付開始 HH:MM（営業時間から） */
  startTime: string
  /** 受付終了 HH:MM（営業時間から） */
  endTime: string
  /** 同時に受けられる件数 */
  maxSlots: number
  /** 何によってこの枠数になったか（画面で理由を出すため） */
  reason: 'closed_weekday' | 'date_closed' | 'date_override' | 'staff_limited' | 'rooms'
  /** その日の出勤人数（シフト未登録なら null＝人数による制限をかけない） */
  staffOnDuty: number | null
}

export interface CapacityInputs {
  businessHours: BusinessHours | null
  activeFittings: number
  /** スタッフ1人が同時に見られる試着室数（staffing_settings.per_person_rooms） */
  perPersonRooms: number
  /** 日付別の上書き（max_slots=0 は臨時休業） */
  overrides: Record<string, number>
  /** 日付ごとの出勤人数。キーが無い日はシフト未登録として人数制限をかけない */
  staffByDate: Record<string, number>
}

/** 店舗の設定と当日の状況から、その日の受付枠を決める */
export function capacityOf(date: string, input: CapacityInputs): DayCapacity {
  const dow = new Date(date + 'T12:00:00Z').getUTCDay()
  const day = input.businessHours?.hours?.[DOW_KEYS[dow]]
  const startTime = day?.open  || FALLBACK_OPEN
  const endTime   = day?.close || FALLBACK_CLOSE
  const staffOnDuty = date in input.staffByDate ? input.staffByDate[date] : null

  const base = (open: boolean, maxSlots: number, reason: DayCapacity['reason']): DayCapacity =>
    ({ open, startTime, endTime, maxSlots, reason, staffOnDuty })

  // 日付指定の上書きが最優先（臨時休業・臨時増枠のどちらにも使う）
  if (date in input.overrides) {
    const m = input.overrides[date]
    return m > 0 ? base(true, m, 'date_override') : base(false, 0, 'date_closed')
  }

  // 定休日
  if (day?.closed) return base(false, 0, 'closed_weekday')

  const rooms = Math.max(0, input.activeFittings || 0)

  // 出勤人数による上限。シフトを使っていない店舗（登録が無い日）は
  // 人数で絞ると常に0枠になってしまうため、試着室数だけで判断する。
  if (staffOnDuty !== null) {
    if (staffOnDuty <= 0) return base(false, 0, 'date_closed')
    const byStaff = Math.floor(staffOnDuty * (input.perPersonRooms || 1))
    if (byStaff < rooms) return base(byStaff > 0, Math.max(0, byStaff), 'staff_limited')
  }

  return base(rooms > 0, rooms, 'rooms')
}

/** capacityOf に渡す材料を、指定期間ぶんまとめて取ってくる */
export async function loadCapacityInputs(
  storeId: string, fromDate: string, toDate: string,
): Promise<CapacityInputs> {
  const [{ data: store }, { data: staffing }, { data: ovr }, { data: shifts }] = await Promise.all([
    sb.from('stores').select('business_hours, active_fittings').eq('id', storeId).maybeSingle(),
    sb.from('staffing_settings').select('per_person_rooms').eq('store_id', storeId).maybeSingle(),
    sb.from('reservation_date_overrides').select('date, max_slots')
      .eq('store_id', storeId).gte('date', fromDate).lte('date', toDate),
    sb.from('shifts').select('work_date, staff_id')
      .eq('store_id', storeId).gte('work_date', fromDate).lte('work_date', toDate)
      .neq('status', 'cancelled'),
  ])

  const overrides: Record<string, number> = {}
  for (const o of (ovr ?? []) as { date: string; max_slots: number }[]) overrides[o.date] = o.max_slots

  // 同じ人が同じ日に複数シフトを持つことがあるので人数として数え直す
  const staffSets: Record<string, Set<string>> = {}
  for (const s of (shifts ?? []) as { work_date: string; staff_id: string }[]) {
    ;(staffSets[s.work_date] ??= new Set()).add(s.staff_id)
  }
  const staffByDate: Record<string, number> = {}
  for (const [d, set] of Object.entries(staffSets)) staffByDate[d] = set.size

  return {
    businessHours: (store?.business_hours as BusinessHours | null) ?? null,
    activeFittings: Number(store?.active_fittings ?? 1) || 1,
    perPersonRooms: Number(staffing?.per_person_rooms ?? 1.5) || 1.5,
    overrides,
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
  date_override:  'この日だけ枠を変更',
  staff_limited:  '出勤人数による上限',
  rooms:          '試着室数による上限',
}
