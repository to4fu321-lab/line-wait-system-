export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/super-admin/notification-logs?since=YYYY-MM-DD
 * 請求集計用の通知ログ(super-admin 専用)。
 */
export async function GET(req: NextRequest) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const since = req.nextUrl.searchParams.get('since')
    if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      return NextResponse.json({ error: 'since が必要です' }, { status: 400 })
    }
    const supabase = createAdminClient({ noStore: true })
    const { data, error } = await supabase
      .from('notification_logs')
      .select('store_id, recipient_count, total_amount, sent_at')
      .gte('sent_at', since)
      .order('sent_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ logs: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
