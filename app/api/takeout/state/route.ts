export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/takeout/state?storeId=...&orderId=...
 * 注文UUID(能力ベアラー)で自注文のステータスを取得(ポーリング用)。
 */
export async function GET(req: NextRequest) {
  try {
    const storeId = req.nextUrl.searchParams.get('storeId')
    const orderId = req.nextUrl.searchParams.get('orderId')
    if (!storeId || !orderId) {
      return NextResponse.json({ error: 'storeId / orderId が必要です' }, { status: 400 })
    }
    const supabase = createAdminClient({ noStore: true })
    const { data: order } = await supabase
      .from('takeout_orders')
      .select('*, items:takeout_order_items(*)')
      .eq('id', orderId)
      .eq('store_id', storeId)
      .maybeSingle()
    if (!order) return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (err) {
    console.error('[takeout/state]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
