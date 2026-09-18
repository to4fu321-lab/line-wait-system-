// ============================================================
// 予約枠の空き計算
//   受付時間・枠の刻み・各枠の受付数は lib/reservationCapacity が決める。
//   ここは「その枠に既に何件入っているか」を数えて残りを出すだけ。
// ============================================================
import { supabase } from '@/lib/supabase'
import { toJstTimeString } from '@/lib/date'
import { loadDayCapacity } from '@/lib/reservationCapacity'
import { isFitting } from '@/lib/fittingTypes'

const sb = supabase as any

// 判定本体は lib/fittingTypes（4か所に写経されていたのを集約）。
// 既存の呼び出し元のために、ここからも再エクスポートしておく。
export { isFitting }

export interface SlotInfo {
  time: string; maxSlots: number; booked: number; remaining: number; available: boolean
}
export interface SlotResult {
  slots: SlotInfo[]; dayClosed: boolean; hasSettings: boolean
}

/** 指定日の空き枠を計算する */
export async function computeSlotInfo(storeId: string, date: string): Promise<SlotResult> {
  const cap = await loadDayCapacity(storeId, date)
  if (!cap.open) return { slots: [], dayClosed: true, hasSettings: true }

  const dayStart = `${date}T00:00:00+09:00`
  const dayEnd   = `${date}T23:59:59+09:00`
  const { data: reservations } = await sb.from('reservations')
    .select('reserved_at, purpose, service_type').eq('store_id', storeId)
    .gte('reserved_at', dayStart).lte('reserved_at', dayEnd).neq('status', 'cancelled')

  // 枠は固定長なので、予約はその開始時刻の枠にそのまま1件として入る
  const bookedAt: Record<string, number> = {}
  for (const r of (reservations ?? []) as { reserved_at: string; purpose: string | null; service_type: string | null }[]) {
    if (!isFitting(r.purpose, r.service_type)) continue // 予約が要らない用件は枠を使わない
    const t = toJstTimeString(r.reserved_at)
    bookedAt[t] = (bookedAt[t] ?? 0) + 1
  }

  const slots: SlotInfo[] = cap.slots.map(s => {
    const booked = bookedAt[s.time] ?? 0
    const remaining = s.capacity - booked
    return { time: s.time, maxSlots: s.capacity, booked, remaining, available: remaining > 0 }
  })

  return { slots, dayClosed: false, hasSettings: true }
}
