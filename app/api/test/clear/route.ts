import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { storeId } = await req.json()
  if (!storeId) return NextResponse.json({ ok: false, error: 'no storeId' }, { status: 400 })

  const deleted: string[] = []

  try {
    // 【テスト】タグ付き顧客を取得
    const { data: testCustomers } = await supabase.from('customers')
      .select('id').eq('store_id', storeId).like('name', '【テスト】%')

    const ids = (testCustomers ?? []).map(c => c.id)

    if (ids.length) {
      // 取置き依頼を削除
      const { count: pc } = await (supabase.from('purchase_orders') as any)
        .delete({ count: 'exact' }).in('customer_id', ids)
      if (pc) deleted.push(`取置き依頼 ${pc}件`)

      // お直し依頼を削除
      const { count: rc } = await supabase.from('repair_histories')
        .delete({ count: 'exact' }).in('customer_id', ids)
      if (rc) deleted.push(`お直し依頼 ${rc}件`)

      // お子様を削除
      await supabase.from('children').delete().in('customer_id', ids)

      // 顧客自体を削除
      const { count: cc } = await supabase.from('customers')
        .delete({ count: 'exact' }).in('id', ids)
      if (cc) deleted.push(`顧客 ${cc}名`)
    }

    // 整理券（customer_name に【テスト】が含まれるもの、またはcustomer_idが一致するもの）
    const { count: qc } = await supabase.from('queues')
      .delete({ count: 'exact' })
      .eq('store_id', storeId).like('customer_name', '%テスト%')
    if (qc) deleted.push(`整理券 ${qc}件`)

    // customer_id が一致する整理券も削除（customer_name変換後のもの）
    if (ids.length) {
      await supabase.from('queues').delete().eq('store_id', storeId).in('customer_id', ids)
    }

    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    console.error('[test/clear]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
