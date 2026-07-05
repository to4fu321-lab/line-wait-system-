export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'

/**
 * POST /api/takeout/lookup
 * Body: { storeId, accessToken }
 * LINE 本人のアクティブ注文(pending/preparing/ready)を返す。
 */
export async function POST(req: Request) {
  try {
    const { storeId, accessToken } = await req.json()
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })

    const line = await verifyLineAccessToken(accessToken)
    if (!line) return NextResponse.json({ order: null })

    const supabase = createAdminClient({ noStore: true })
    const { data } = await supabase
      .from('takeout_orders')
      .select('*, items:takeout_order_items(*)')
      .eq('store_id', storeId)
      .eq('line_user_id', line.userId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(1)
    return NextResponse.json({ order: data?.[0] ?? null, displayName: line.displayName })
  } catch (err) {
    console.error('[takeout/lookup]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
