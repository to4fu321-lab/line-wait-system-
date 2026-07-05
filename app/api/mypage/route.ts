export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'

/**
 * POST /api/mypage
 * Body: { storeId, accessToken }
 *
 * マイページ表示用データ一式(本人の顧客・お子様・注文・お直し・採寸履歴)。
 * LIFF トークンで本人確認した LINE ユーザー自身のデータのみ返す。
 */
export async function POST(req: Request) {
  try {
    const { storeId, accessToken } = await req.json()
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })

    const line = await verifyLineAccessToken(accessToken)
    if (!line) return NextResponse.json({ error: 'LINE認証に失敗しました' }, { status: 401 })

    const supabase = createAdminClient({ noStore: true })
    const { data: custRows } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('line_user_id', line.userId)
      .order('created_at', { ascending: false })
      .limit(1)
    const customer = custRows?.[0] && !custRows[0].deleted_at ? custRows[0] : null
    if (!customer) return NextResponse.json({ customer: null })

    const [childRes, purchaseRes, repairRes] = await Promise.all([
      supabase.from('children').select('*')
        .eq('customer_id', customer.id).order('created_at', { ascending: true }),
      supabase.from('purchase_orders').select('*')
        .eq('customer_id', customer.id).eq('store_id', storeId)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('repair_histories').select('*')
        .eq('customer_id', customer.id).eq('store_id', storeId)
        .order('created_at', { ascending: false }).limit(20),
    ])

    const children = childRes.data ?? []
    let queueMeasurements: unknown[] = []
    if (children.length > 0) {
      const { data: queueRows } = await supabase
        .from('queues')
        .select('child_id, created_at, details')
        .in('child_id', children.map((c: { id: string }) => c.id))
        .not('details', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)
      queueMeasurements = queueRows ?? []
    }

    return NextResponse.json({
      customer,
      children,
      purchases: purchaseRes.data ?? [],
      repairs: repairRes.data ?? [],
      queueMeasurements,
    })
  } catch (err) {
    console.error('[mypage]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
