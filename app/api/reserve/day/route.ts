export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/reserve/day?storeId=...&date=YYYY-MM-DD
 *
 * 予約スロット空き計算用に、対象日の予約を非PII列
 * (reserved_at / service_type / purpose)のみで返す。
 * 氏名・備考等は含めない(reservations 本体は RLS でスタッフ専用)。
 */
export async function GET(req: NextRequest) {
  try {
    const storeId = req.nextUrl.searchParams.get('storeId')
    const date = req.nextUrl.searchParams.get('date')
    if (!storeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'storeId / date が必要です' }, { status: 400 })
    }
    const supabase = createAdminClient({ noStore: true })
    const { data } = await supabase
      .from('reservations')
      .select('reserved_at, service_type, purpose')
      .eq('store_id', storeId)
      .gte('reserved_at', `${date}T00:00:00+09:00`)
      .lte('reserved_at', `${date}T23:59:59+09:00`)
      .neq('status', 'cancelled')
    return NextResponse.json({ reservations: data ?? [] })
  } catch (err) {
    console.error('[reserve/day]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
