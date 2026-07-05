export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { assertStorePin } from '@/lib/auth/storeAuth'

export async function POST(req: NextRequest) {
  const { storeId, storePin } = await req.json()
  if (!storeId) return NextResponse.json({ ok: false, error: 'no storeId' }, { status: 400 })

  // 顧客・整理券を削除する破壊的APIのため、店舗PIN（または super-admin）必須
  const denied = await assertStorePin(req, { storeId, storePin })
  if (denied) return denied
  const supabase = createAdminClient()

  const deleted: string[] = []

  try {
    // 【テスト】タグ付き顧客を取得
    const { data: testCustomers } = await (supabase as any).from('customers')
      .select('id').eq('store_id', storeId).like('name', '【テスト】%')

    const ids = (testCustomers ?? []).map((c: any) => c.id)

    if (ids.length) {
      // 1. 整理券の FK 参照を外す（customer_id → null）
      await (supabase as any).from('queues')
        .update({ customer_id: null, child_id: null })
        .in('customer_id', ids)

      // 2. 関連レコードを削除
      const { count: pc } = await ((supabase as any).from('purchase_orders') as any)
        .delete({ count: 'exact' }).in('customer_id', ids)
      if (pc) deleted.push(`取置き依頼 ${pc}件`)

      const { count: rc } = await (supabase as any).from('repair_histories')
        .delete({ count: 'exact' }).in('customer_id', ids)
      if (rc) deleted.push(`お直し依頼 ${rc}件`)

      await (supabase as any).from('children').delete().in('customer_id', ids)

      // 3. 顧客本体を削除
      const { count: cc } = await (supabase as any).from('customers')
        .delete({ count: 'exact' }).in('id', ids)
      if (cc) deleted.push(`顧客 ${cc}名`)
    }

    // 4. テスト整理券を削除（customer_name に「テスト」を含むもの）
    const { count: qc } = await (supabase as any).from('queues')
      .delete({ count: 'exact' })
      .eq('store_id', storeId).like('customer_name', '%テスト%')
    if (qc) deleted.push(`整理券 ${qc}件`)

    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    console.error('[test/clear]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
