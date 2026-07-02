export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveFeature } from '@/lib/features'

// 顧客向けに公開する機能可否（リッチメニュー action の遷移先判定に使う）
function customerCaps(rawFeatures: Record<string, unknown>) {
  return {
    queue:    resolveFeature('tab_queue',   rawFeatures),
    reserve:  resolveFeature('reservation', rawFeatures),
    repair:   resolveFeature('repairs',     rawFeatures),
    purchase: resolveFeature('products',    rawFeatures),
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const biz    = searchParams.get('biz') // 'uniform' | 'takeout' | null (null = uniform、両方混在で返す)
  const noStore = { headers: { 'Cache-Control': 'no-store' } }
  if (!userId) return NextResponse.json({ stores: [] }, noStore)

  const supabase = getSupabase()

  // ① 制服店：customers テーブルから登録済み店舗を取得
  // biz=takeout の場合は line-home-takeout 用の呼び出しのため、
  // 制服店の登録は含めず、テイクアウト注文のみで判定する
  let uniformStoreIds: string[] = []
  if (biz !== 'takeout') {
    const { data: customers } = await supabase
      .from('customers')
      .select('store_id')
      .eq('line_user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    uniformStoreIds = Array.from(new Set(
      (customers ?? []).map((c: { store_id: string }) => c.store_id).filter(Boolean)
    ))
  }

  // ② テイクアウト店：過去90日以内に注文した店舗を取得
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: orders } = await supabase
    .from('takeout_orders')
    .select('store_id, created_at')
    .eq('line_user_id', userId)
    .neq('status', 'cancelled')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  const takeoutStoreIds = Array.from(new Set(
    (orders ?? []).map((o: { store_id: string }) => o.store_id).filter(Boolean)
  ))

  // すべてのstoreIdをまとめて店舗情報を取得
  const allIds = Array.from(new Set([...uniformStoreIds, ...takeoutStoreIds]))
  if (allIds.length === 0) return NextResponse.json({ stores: [] }, noStore)

  const { data: storeRows } = await supabase
    .from('stores')
    .select('id, name, is_open, business_type, features')
    .in('id', allIds)

  type StoreRow = { id: string; name: string; is_open: boolean; business_type: string; features: Record<string, unknown> | null }
  const storeMap = Object.fromEntries(
    (storeRows ?? []).map((s: StoreRow) => [s.id, s])
  ) as Record<string, StoreRow>

  // 制服店を先に、次にテイクアウト店（それぞれ最近利用順）
  const uniformStores = uniformStoreIds
    .map(id => storeMap[id]).filter(Boolean)
    .map(s => ({ id: s.id, name: s.name, is_open: s.is_open ?? false, type: 'uniform' as const, caps: customerCaps(s.features ?? {}) }))

  const takeoutStores = takeoutStoreIds
    .filter(id => !uniformStoreIds.includes(id)) // 制服店と重複しない
    .map(id => storeMap[id]).filter(Boolean)
    .map(s => ({ id: s.id, name: s.name, is_open: s.is_open ?? false, type: 'takeout' as const, caps: customerCaps(s.features ?? {}) }))

  return NextResponse.json({ stores: [...uniformStores, ...takeoutStores] }, noStore)
}
