export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(
  req: Request,
  { params }: { params: { companyId: string } }
) {
  try {
    const { pin } = await req.json()
    const { companyId } = params
    const supabase = getSupabase()

    // 会社（グループ）をcodeで検索
    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .select('*')
      .eq('code', companyId)
      .single()

    if (groupErr || !group) {
      return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 })
    }

    // PIN照合
    if ((group as any).pin !== pin) {
      return NextResponse.json({ error: 'PINが違います' }, { status: 401 })
    }

    // 配下の店舗を取得
    const { data: stores } = await supabase
      .from('stores')
      .select('*')
      .eq('group_id', group.id)
      .order('name', { ascending: true })

    if (!stores || stores.length === 0) {
      return NextResponse.json({ company: group, stores: [] })
    }

    // 各店舗の統計を並行取得
    const storeStats = await Promise.all(stores.map(async (store) => {
      const [
        { data: repairs },
        { data: purchases },
        { data: queues },
      ] = await Promise.all([
        supabase.from('repair_histories')
          .select('status, prepaid')
          .eq('store_id', store.id)
          .in('status', ['received', 'completed']),
        supabase.from('purchase_orders')
          .select('status')
          .eq('store_id', store.id)
          .in('status', ['ordered', 'received', 'stocked', 'on_order', 'arrived']),
        supabase.from('queues')
          .select('status')
          .eq('store_id', store.id)
          .in('status', ['waiting', 'calling']),
      ])

      const r = repairs   ?? []
      const p = purchases ?? []
      const q = queues    ?? []

      return {
        store,
        repairReceived:     r.filter(x => x.status === 'received').length,
        repairCompleted:    r.filter(x => x.status === 'completed').length,
        purchaseInProgress: p.filter(x => ['ordered','received','stocked','on_order'].includes(x.status)).length,
        purchaseArrived:    p.filter(x => x.status === 'arrived').length,
        unpaidCount:        r.filter(x => !(x as any).prepaid).length,
        queueWaiting:       q.filter(x => x.status === 'waiting').length,
        queueCalling:       q.filter(x => x.status === 'calling').length,
      }
    }))

    return NextResponse.json({ company: group, stores: storeStats })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
