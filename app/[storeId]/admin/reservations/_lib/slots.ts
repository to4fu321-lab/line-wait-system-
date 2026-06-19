// ============================================================
// 予約枠（試着室）の空き計算ヘルパー
//   reserve/page.tsx のロジックを抽出。容量にカウントするのは
//   採寸系（isFitting）の予約のみ＝試着室を使う予約だけが枠を消費。
// ============================================================
import { supabase } from '@/lib/supabase'

const sb = supabase as any

export interface SlotInfo {
  time: string
  maxSlots: number
  booked: number
  remaining: number
  available: boolean
}
export interface SlotResult {
  slots: SlotInfo[]
  dayClosed: boolean   // 予約不可日（max_slots=0）
  hasSettings: boolean // reservation_settings 未設定なら false
}

interface Setting {
  service_type: string; label: string; duration_min: number
  start_time: string; end_time: string; is_active: boolean
  [k: string]: unknown
}

const WEEKDAY_KEYS = ['slots_sun', 'slots_mon', 'slots_tue', 'slots_wed', 'slots_thu', 'slots_fri', 'slots_sat'] as const

// 採寸系の予約か（枠を消費する対象）
export function isFitting(purpose: string | null | undefined, serviceType: string | null | undefined): boolean {
  return (purpose ?? '').includes('採寸') || ['uniform', 'jersey', 'fitting'].includes(serviceType ?? '')
}

function genSlots(start: string, end: string, stepMin: number): string[] {
  const out: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const stop = eh * 60 + em
  while (cur < stop) {
    out.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`)
    cur += stepMin
  }
  return out
}

export async function computeSlotInfo(storeId: string, date: string): Promise<SlotResult> {
  const { data: rawSettings } = await sb.from('reservation_settings')
    .select('*').eq('store_id', storeId).eq('is_active', true)
  const settings = (rawSettings ?? []) as Setting[]
  if (settings.length === 0) return { slots: [], dayClosed: false, hasSettings: false }

  const dow = new Date(date + 'T12:00:00Z').getUTCDay()
  const weekdayKey = WEEKDAY_KEYS[dow]
  let maxSlots = Math.min(...settings.map(s => Number((s as Record<string, unknown>)[weekdayKey] ?? 0)))

  try {
    const { data: override } = await sb.from('reservation_date_overrides')
      .select('max_slots').eq('store_id', storeId).eq('date', date).limit(1).maybeSingle()
    if (override != null) maxSlots = override.max_slots
  } catch { /* テーブル無ければ無視 */ }

  if (maxSlots <= 0) return { slots: [], dayClosed: true, hasSettings: true }

  // 営業時間は全サービスの最小start〜最大end、所要時間は採寸サービス基準
  const startTime = settings.reduce((a, s) => (s.start_time < a ? s.start_time : a), '23:59')
  const endTime   = settings.reduce((a, s) => (s.end_time > a ? s.end_time : a), '00:00')
  const fittingSvc = settings.find(s => isFitting(null, s.service_type) || s.label.includes('採寸')) ?? settings[0]
  const slotDuration = fittingSvc.duration_min || 60
  const durationMap: Record<string, number> = {}
  for (const s of settings) durationMap[s.service_type] = s.duration_min

  const dayStart = `${date}T00:00:00+09:00`
  const dayEnd   = `${date}T23:59:59+09:00`
  const { data: reservations } = await sb.from('reservations')
    .select('reserved_at, purpose, service_type').eq('store_id', storeId)
    .gte('reserved_at', dayStart).lte('reserved_at', dayEnd).neq('status', 'cancelled')

  const [eh, em] = endTime.split(':').map(Number)
  const endOfDay = eh * 60 + em

  const slots: SlotInfo[] = genSlots(startTime, endTime, 30).map(time => {
    const [th, tm] = time.split(':').map(Number)
    const tStart = th * 60 + tm
    const tEnd = tStart + slotDuration
    if (tEnd > endOfDay) return { time, maxSlots: 0, booked: 0, remaining: 0, available: false }
    let overlap = 0
    for (const r of (reservations ?? []) as { reserved_at: string; purpose: string | null; service_type: string | null }[]) {
      if (!isFitting(r.purpose, r.service_type)) continue // ★採寸のみ枠消費
      const jst = new Date(new Date(r.reserved_at).getTime() + 9 * 3600000).toISOString().slice(11, 16)
      const [rh, rm] = jst.split(':').map(Number)
      const rStart = rh * 60 + rm
      const rEnd = rStart + (durationMap[r.service_type ?? ''] ?? slotDuration)
      if (tStart < rEnd && tEnd > rStart) overlap++
    }
    const remaining = maxSlots - overlap
    return { time, maxSlots, booked: overlap, remaining, available: remaining > 0 }
  }).filter(s => s.maxSlots > 0)

  return { slots, dayClosed: false, hasSettings: true }
}
