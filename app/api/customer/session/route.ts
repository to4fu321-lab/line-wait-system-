export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'

/**
 * POST /api/customer/session
 * Body: { storeId, accessToken }
 *
 * LIFF アクセストークンをサーバー検証し、その LINE ユーザーの
 * 顧客レコードとお子様一覧を返す(未登録なら customer: null)。
 * 顧客テーブルは RLS でクライアント直読み不可のため、顧客本人の
 * データ取得は必ずこの API を経由する。
 */
export async function POST(req: Request) {
  try {
    const { storeId, accessToken } = await req.json()
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })

    const line = await verifyLineAccessToken(accessToken)
    if (!line) return NextResponse.json({ error: 'LINE認証に失敗しました' }, { status: 401 })

    const supabase = createAdminClient({ noStore: true })
    const { data: rows } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('line_user_id', line.userId)
      .order('created_at', { ascending: false })
      .limit(1)

    const customer = rows?.[0] && !rows[0].deleted_at ? rows[0] : null
    let children: unknown[] = []
    if (customer) {
      const { data: kids } = await supabase
        .from('children')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: true })
      children = kids ?? []
    }
    return NextResponse.json({ customer, children, lineUserId: line.userId, displayName: line.displayName })
  } catch (err) {
    console.error('[customer/session]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
