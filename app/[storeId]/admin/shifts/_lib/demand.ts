// ============================================================
// 試着予約連動の必要人員算出（透明な式・調整可能）
//   入力: reservations(isFitting・時間帯別件数) / stores.active_fittings(試着室数)
//         / reservation_settings.duration_min / staffing_settings(係数)
//   出力: 時間帯ブロック別の必要人員。
// ============================================================
import { supabase } from '@/lib/supabase'
import type { StaffingSettings, Shift } from '@/types/shifts'
import { isFitting } from '../../reservations/_lib/slots'
import { toMinutes } from './time'

const sb = supabase as any

export const DEFAULT_STAFFING: Omit<StaffingSettings, 'id' | 'store_id' | 'created_at' | 'updated_at'> = {
  time_block_min: 60, min_staff: 1, max_staff: 12,
  fitting_minutes: 20, per_person_rooms: 1.5, conversion_rate: 0.6, visit_factor: 1.2,
}

export interface DemandBlock {
  block: string          // 'HH:MM'
  reservations: number   // ブロック内の試着予約数
  required: number       // 必要人員
  assigned: number       // 配置済み（shifts から）
}

export async function loadStaffingSettings(storeId: string): Promise<StaffingSettings> {
  const { data } = await sb.from('staffing_settings').select('*').eq('store_id', storeId).maybeSingle()
  if (data) return data as StaffingSettings
  return { id: '', store_id: storeId, created_at: '', updated_at: '', ...DEFAULT_STAFFING }
}

export async function saveStaffingSettings(storeId: string, s: Partial<StaffingSettings>) {
  await sb.from('staffing_settings').upsert({ store_id: storeId, ...s }, { onConflict: 'store_id' })
}

// 必要人員の式（1ブロックあたり）
export function requiredFor(reservations: number, s: StaffingSettings, rooms: number): number {
  if (reservations <= 0) return 0
  // 同時に必要な試着室数 = 予約数 × 来店係数 × (試着時間/ブロック) を、室数上限で頭打ち
  const blockMin = s.time_block_min || 60
  const concurrentRooms = Math.min(rooms || 1, reservations * s.visit_factor * (s.fitting_minutes / blockMin))
  // スタッフ1人で per_person_rooms 室を捌く + 成約対応の補正
  const base = concurrentRooms / (s.per_person_rooms || 1)
  const conversionExtra = reservations * s.visit_factor * s.conversion_rate * (s.fitting_minutes / blockMin) * 0.3
  const raw = Math.ceil(base + conversionExtra)
  return Math.max(s.min_staff, Math.min(s.max_staff, raw))
}

// 指定日の時間帯別 需要・必要人員・配置を算出
export async function loadDemandDay(storeId: string, date: string, shiftsForDate: Shift[]): Promise<DemandBlock[]> {
  const settings = await loadStaffingSettings(storeId)
  const blockMin = settings.time_block_min || 60

  // 試着室数（active_fittings）＋試着サービスの所要時間
  const [{ data: store }, { data: rsvSettings }, { data: resv }] = await Promise.all([
    sb.from('stores').select('active_fittings, business_hours').eq('id', storeId).maybeSingle(),
    sb.from('reservation_settings').select('duration_min, start_time, end_time, is_active').eq('store_id', storeId).eq('is_active', true),
    sb.from('reservations').select('reserved_at, purpose, service_type, status').eq('store_id', storeId)
      .gte('reserved_at', `${date}T00:00:00+09:00`).lte('reserved_at', `${date}T23:59:59+09:00`).neq('status', 'cancelled'),
  ])
  const rooms = Number(store?.active_fittings ?? 4) || 4
  const services = (rsvSettings ?? []) as { duration_min: number; start_time: string; end_time: string }[]
  if (services.length && settings.fitting_minutes === DEFAULT_STAFFING.fitting_minutes) {
    settings.fitting_minutes = Math.min(...services.map(s => s.duration_min))
  }

  // 営業時間の範囲（reservation_settings の最小start〜最大end、無ければ10-19）
  let startMin = 10 * 60, endMin = 19 * 60
  if (services.length) {
    startMin = Math.min(...services.map(s => toMinutes(s.start_time)))
    endMin = Math.max(...services.map(s => toMinutes(s.end_time)))
  }

  // 予約をブロックに割当
  const counts: Record<string, number> = {}
  for (const r of (resv ?? []) as any[]) {
    if (!isFitting(r.purpose, r.service_type)) continue
    const d = new Date(new Date(r.reserved_at).getTime() + 9 * 3600000)
    const min = d.getUTCHours() * 60 + d.getUTCMinutes()
    const block = Math.floor(min / blockMin) * blockMin
    const key = `${String(Math.floor(block / 60)).padStart(2, '0')}:${String(block % 60).padStart(2, '0')}`
    counts[key] = (counts[key] ?? 0) + 1
  }

  // 配置済み（その時間に勤務しているshift数）
  const assignedAt = (blockStart: number): number =>
    shiftsForDate.filter(s => toMinutes(s.start_time) <= blockStart && toMinutes(s.end_time) > blockStart).length

  const out: DemandBlock[] = []
  for (let m = Math.floor(startMin / blockMin) * blockMin; m < endMin; m += blockMin) {
    const key = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const rv = counts[key] ?? 0
    out.push({ block: key, reservations: rv, required: requiredFor(rv, settings, rooms), assigned: assignedAt(m) })
  }
  return out
}
