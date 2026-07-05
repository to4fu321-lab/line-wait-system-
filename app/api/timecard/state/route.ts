export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/timecard/state?storeId=...&date=YYYY-MM-DD
 *
 * 店頭タイムカードkiosk用: アクティブスタッフ一覧と当日の
 * 最新打刻・公開シフトを返す。kiosk は店頭設置端末のため
 * セッション無しで参照できるが、返すのは打刻に必要な最小限のみ
 * (時給・連絡先・PIN等は含めない)。
 */
export async function GET(req: NextRequest) {
  try {
    const storeId = req.nextUrl.searchParams.get('storeId')
    const date = req.nextUrl.searchParams.get('date')
    if (!storeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'storeId / date が必要です' }, { status: 400 })
    }
    const supabase = createAdminClient({ noStore: true })
    const [staffRes, recordRes, shiftRes] = await Promise.all([
      supabase.from('staff')
        .select('id, name, kana, role, color, active, sort_order')
        .eq('store_id', storeId).eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('time_records').select('*')
        .eq('store_id', storeId).eq('work_date', date)
        .order('created_at', { ascending: false }),
      supabase.from('shifts').select('id, staff_id, start_time, end_time, work_date, status')
        .eq('store_id', storeId).eq('work_date', date).eq('status', 'published'),
    ])
    return NextResponse.json({
      staff: staffRes.data ?? [],
      records: recordRes.data ?? [],
      shifts: shiftRes.data ?? [],
    })
  } catch (err) {
    console.error('[timecard/state]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
