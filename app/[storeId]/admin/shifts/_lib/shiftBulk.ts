// ============================================================
// シフトの一括操作（直感的セット）
//   - ペイント（テンプレ即適用）/ 曜日一括 / 先週コピー / 希望(固定曜日)から自動生成
//   生成はすべて draft。既存の「公開」フローで確定する。
// ============================================================
import { supabase } from '@/lib/supabase'
import type { ShiftTemplate } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { availabilityRangeFor } from '@/lib/availability'
import { addDays, dowOf } from './time'

const sb = supabase as any

export async function insertDraftShift(
  storeId: string, staffId: string, date: string,
  start: string, end: string, breakMin = 60, note = '',
) {
  return sb.from('shifts').insert({
    store_id: storeId, staff_id: staffId, home_store_id: storeId, work_date: date,
    start_time: start, end_time: end, break_minutes: breakMin, status: 'draft', note: note || null,
  })
}

// セルの下書きシフトを削除（公開済みは消さない）
export async function deleteDraftShiftsAt(storeId: string, staffId: string, date: string) {
  return sb.from('shifts').delete()
    .eq('store_id', storeId).eq('staff_id', staffId).eq('work_date', date).eq('status', 'draft')
}

// business_hours から定休曜日（0=日..6=土）の集合
async function loadClosedDows(storeId: string): Promise<Set<number>> {
  const { data } = await sb.from('stores').select('business_hours').eq('id', storeId).maybeSingle()
  const hours = data?.business_hours?.hours ?? {}
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const closed = new Set<number>()
  for (let i = 0; i < 7; i++) if (hours[keys[i]]?.closed) closed.add(i)
  return closed
}

async function occupiedSet(storeId: string, from: string, to: string): Promise<Set<string>> {
  const { data } = await sb.from('shifts').select('staff_id, work_date')
    .eq('store_id', storeId).gte('work_date', from).lte('work_date', to).neq('status', 'cancelled')
  return new Set((data ?? []).map((s: any) => `${s.staff_id}_${s.work_date}`))
}

// 1スタッフの週内・営業日すべてにテンプレを適用（既存セルはスキップ）
export async function applyTemplateToRow(storeId: string, staffId: string, weekDays: string[], t: ShiftTemplate): Promise<number> {
  const [closed, occupied] = await Promise.all([loadClosedDows(storeId), occupiedSet(storeId, weekDays[0], weekDays[6])])
  let created = 0
  for (const d of weekDays) {
    if (closed.has(dowOf(d))) continue
    if (occupied.has(`${staffId}_${d}`)) continue
    await insertDraftShift(storeId, staffId, d, t.start_time, t.end_time, t.break_minutes, t.label)
    created++
  }
  return created
}

// 先週のシフトを今週の同曜日に複製（既存セルはスキップ・ヘルプは除外）
export async function copyPreviousWeek(storeId: string, weekDays: string[]): Promise<number> {
  const prevFrom = addDays(weekDays[0], -7), prevTo = addDays(weekDays[6], -7)
  const { data: prev } = await sb.from('shifts').select('*')
    .eq('store_id', storeId).gte('work_date', prevFrom).lte('work_date', prevTo).neq('status', 'cancelled')
  const occupied = await occupiedSet(storeId, weekDays[0], weekDays[6])
  let created = 0
  for (const s of (prev ?? []) as any[]) {
    if (s.is_help) continue
    const newDate = addDays(s.work_date, 7)
    if (occupied.has(`${s.staff_id}_${newDate}`)) continue
    await insertDraftShift(storeId, s.staff_id, newDate, s.start_time, s.end_time, s.break_minutes ?? 60, '先週からコピー')
    created++
  }
  return created
}

// スタッフの固定勤務可能曜日(availability)から今週の下書きを生成
//   off希望・休暇承認日・定休日・既存セルは除外
export async function generateFromAvailability(storeId: string, weekDays: string[], staff: Staff[]): Promise<number> {
  const [closed, occupied] = await Promise.all([loadClosedDows(storeId), occupiedSet(storeId, weekDays[0], weekDays[6])])
  const { data: offs } = await sb.from('shift_requests').select('staff_id, work_date')
    .eq('store_id', storeId).eq('kind', 'off').gte('work_date', weekDays[0]).lte('work_date', weekDays[6])
  const offSet = new Set((offs ?? []).map((o: any) => `${o.staff_id}_${o.work_date}`))

  let created = 0
  for (const st of staff) {
    if (!st.availability) continue
    for (const d of weekDays) {
      if (closed.has(dowOf(d))) continue
      if (occupied.has(`${st.id}_${d}`)) continue
      if (offSet.has(`${st.id}_${d}`)) continue
      const range = availabilityRangeFor(st.availability, d)
      if (!range) continue
      await insertDraftShift(storeId, st.id, d, range.start, range.end, 60, '希望から自動生成')
      created++
    }
  }
  return created
}
