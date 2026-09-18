// ============================================================
// 予約枠（試着室）の空き計算ヘルパー
//   採寸サービス(reservation_settings)ごとの所要時間で枠を生成し、
//   容量にカウントするのは採寸系(isFitting)の予約のみ。
// ============================================================
import { supabase } from '@/lib/supabase'
import { toJstTimeString } from '@/lib/date'
import { loadDayCapacity } from '@/lib/reservationCapacity'
import { isFitting } from '@/lib/fittingTypes'

const sb = supabase as any

export interface ResvService {
  service_type: string
  label: string
  duration_min: number
  start_time: string
  end_time: string
  [k: string]: unknown // slots_sun..slots_sat
}

export interface SlotInfo {
  time: string; maxSlots: number; booked: number; remaining: number; available: boolean
}
export interface SlotResult {
  slots: SlotInfo[]; dayClosed: boolean; hasSettings: boolean
}


// 判定本体は lib/fittingTypes（4か所に写経されていたのを集約）。
// 既存の呼び出し元のために、ここからも再エクスポートしておく。
export { isFitting }

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

// 有効な採寸サービス一覧（来店内容カードの「採寸」に使用）
export async function loadServices(storeId: string): Promise<ResvService[]> {
  const { data } = await sb.from('reservation_settings')
    .select('*').eq('store_id', storeId).eq('is_active', true).order('duration_min', { ascending: false })
  return (data ?? []) as ResvService[]
}

// 指定サービスの所要時間で当日の空き枠を計算
//   受付時間帯・同時枠数は lib/reservationCapacity に集約している
//   （営業時間・試着室数・出勤人数・日付別の上書きから自動で決まる）。
//   ここが持つのは「メニューの所要時間で時間を刻み、既存予約と重ねる」部分だけ。
export async function computeSlotInfo(storeId: string, date: string, service: ResvService): Promise<SlotResult> {
  const all = await loadServices(storeId)
  if (all.length === 0) return { slots: [], dayClosed: false, hasSettings: false }

  const cap = await loadDayCapacity(storeId, date)
  if (!cap.open || cap.maxSlots <= 0) return { slots: [], dayClosed: true, hasSettings: true }
  const maxSlots = cap.maxSlots

  const slotDuration = service.duration_min || 60
  const durationMap: Record<string, number> = {}
  for (const s of all) durationMap[s.service_type] = s.duration_min

  const dayStart = `${date}T00:00:00+09:00`
  const dayEnd   = `${date}T23:59:59+09:00`
  const { data: reservations } = await sb.from('reservations')
    .select('reserved_at, purpose, service_type').eq('store_id', storeId)
    .gte('reserved_at', dayStart).lte('reserved_at', dayEnd).neq('status', 'cancelled')

  const [eh, em] = cap.endTime.split(':').map(Number)
  const endOfDay = eh * 60 + em

  const slots: SlotInfo[] = genSlots(cap.startTime, cap.endTime, slotDuration).map(time => {
    const [th, tm] = time.split(':').map(Number)
    const tStart = th * 60 + tm
    const tEnd = tStart + slotDuration
    if (tEnd > endOfDay) return { time, maxSlots: 0, booked: 0, remaining: 0, available: false }
    let overlap = 0
    for (const r of (reservations ?? []) as { reserved_at: string; purpose: string | null; service_type: string | null }[]) {
      if (!isFitting(r.purpose, r.service_type)) continue // ★採寸のみ枠消費
      const jst = toJstTimeString(r.reserved_at)
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
