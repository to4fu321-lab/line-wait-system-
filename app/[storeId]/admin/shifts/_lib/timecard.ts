// ============================================================
// タイムカード（打刻）の共通ロジック
//   個人スマホ(ClockPanel)と店頭kiosk(TimecardKiosk)で共用。
// ============================================================
import { supabase } from '@/lib/supabase'
import type { TimeRecord, Shift } from '@/types/shifts'

const sb = supabase as any

export type ClockPhase = 'before' | 'working' | 'done'

export function phaseOf(rec: TimeRecord | null | undefined): ClockPhase {
  if (!rec) return 'before'
  return rec.status === 'done' ? 'done' : 'working'
}

// 当日の各スタッフの最新打刻（staff_id -> TimeRecord）
export async function loadTodayRecords(storeId: string, date: string): Promise<Map<string, TimeRecord>> {
  const { data } = await sb.from('time_records').select('*')
    .eq('store_id', storeId).eq('work_date', date)
    .order('created_at', { ascending: false })
  const map = new Map<string, TimeRecord>()
  for (const r of (data ?? []) as TimeRecord[]) {
    if (!map.has(r.staff_id)) map.set(r.staff_id, r)   // 先頭＝最新
  }
  return map
}

// 当日の各スタッフの公開シフト（staff_id -> Shift）
export async function loadTodayShifts(storeId: string, date: string): Promise<Map<string, Shift>> {
  const { data } = await sb.from('shifts').select('*')
    .eq('store_id', storeId).eq('work_date', date).eq('status', 'published')
  const map = new Map<string, Shift>()
  for (const s of (data ?? []) as Shift[]) {
    if (!map.has(s.staff_id)) map.set(s.staff_id, s)
  }
  return map
}

export async function clockIn(storeId: string, staffId: string, date: string, shiftId?: string | null, lat?: number | null, lng?: number | null) {
  return sb.from('time_records').insert({
    store_id: storeId, staff_id: staffId, shift_id: shiftId ?? null, work_date: date,
    clock_in_at: new Date().toISOString(), clock_in_lat: lat ?? null, clock_in_lng: lng ?? null, status: 'working',
  })
}

export async function clockOut(recordId: string) {
  return sb.from('time_records').update({ clock_out_at: new Date().toISOString(), status: 'done' }).eq('id', recordId)
}

// PIN確認（店頭kioskで require_pin 時）。一致かつ本人なら true。
export async function verifyStaffPin(storeId: string, staffId: string, pin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/staff/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, pin }),
    })
    if (!res.ok) return false
    const json = await res.json()
    return json?.staff?.id === staffId
  } catch { return false }
}
