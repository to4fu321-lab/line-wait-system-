// ============================================================
// シフトデータ取得(client・anon supabase)
//   月内の shifts(自店勤務＋他店ヘルプで来る人) と
//   希望シフト、スタッフ一覧をまとめて取得する。
// ============================================================
import { supabase } from '@/lib/supabase'
import type { Shift, ShiftRequest } from '@/types/shifts'
import type { Staff } from '@/types/master'

const sb = supabase as any

function monthRange(year: number, month: number): { start: string; end: string } {
  const days = new Date(year, month, 0).getDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return { start: `${year}-${p(month)}-01`, end: `${year}-${p(month)}-${p(days)}` }
}

export async function loadStaff(storeId: string): Promise<Staff[]> {
  const { data } = await sb.from('staff').select('*')
    .eq('store_id', storeId).eq('active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as Staff[]
}

// 自店で勤務する全シフト(自店所属＋他店からのヘルプ)を期間で取得
export async function loadShifts(storeId: string, start: string, end: string): Promise<Shift[]> {
  const { data } = await sb.from('shifts')
    .select('*, staff:staff(id,name,kana,role,color,hourly_wage)')
    .eq('store_id', storeId)
    .gte('work_date', start).lte('work_date', end)
    .neq('status', 'cancelled')
    .order('work_date', { ascending: true })
  return (data ?? []) as Shift[]
}

export async function loadShiftsMonth(storeId: string, year: number, month: number): Promise<Shift[]> {
  const { start, end } = monthRange(year, month)
  return loadShifts(storeId, start, end)
}

export async function loadRequests(storeId: string, start: string, end: string): Promise<ShiftRequest[]> {
  const { data } = await sb.from('shift_requests')
    .select('*, staff:staff(id,name,color,role)')
    .eq('store_id', storeId)
    .gte('work_date', start).lte('work_date', end)
    .order('work_date', { ascending: true })
  return (data ?? []) as ShiftRequest[]
}

export async function loadPendingRequests(storeId: string): Promise<ShiftRequest[]> {
  const { data } = await sb.from('shift_requests')
    .select('*, staff:staff(id,name,color,role)')
    .eq('store_id', storeId).eq('status', 'submitted')
    .order('work_date', { ascending: true })
  return (data ?? []) as ShiftRequest[]
}

export function staffMapOf(staff: Staff[]): Record<string, Staff> {
  const m: Record<string, Staff> = {}
  for (const s of staff) m[s.id] = s
  return m
}
