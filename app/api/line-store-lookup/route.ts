export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveFeature } from '@/lib/features'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// 'available' = 今すぐ使える
// 'paused'    = 機能はあるが一時停止中（順番待ちが閉店中など）
// 'unavailable' = この店舗ではそもそも非搭載
export type FeatureStatus = 'available' | 'paused' | 'unavailable'

function computeActionFeatures(
  isOpen: boolean,
  businessType: string,
  rawFeatures: Record<string, unknown>,
): Record<string, FeatureStatus> {
  const hasQueue   = resolveFeature('queue', rawFeatures) || resolveFeature('tab_queue', rawFeatures)
  const hasReserve = resolveFeature('reservation', rawFeatures)
  const hasRepair  = resolveFeature('repairs', rawFeatures)
  const hasOrder   = businessType === 'takeout' || resolveFeature('takeout', rawFeatures)
  const hasPurchase = resolveFeature('customer_self_order', rawFeatures)

  return {
    queue:    !hasQueue   ? 'unavailable' : isOpen ? 'available' : 'paused',
    reserve:  hasReserve  ? 'available'   : 'unavailable',
    repair:   hasRepair   ? 'available'   : 'unavailable',
    order:    hasOrder    ? 'available'   : 'unavailable',
    purchase: hasPurchase ? 'available'   : 'unavailable',
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ stores: [] })

  const supabase = getSupabase()

  // ① 制服店：customers テーブルから登録済み店舗を取得
  const { data: customers } = await supabase
    .from('customers')
    .select('store_id')
    .eq('line_user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  const uniformStoreIds: string[] = Array.from(new Set(
    ((customers ?? []).map((c: { store_id: string }) => c.store_id).filter(Boolean) as string[])
  ))

  // ② テイクアウト店：過去90日以内に注文した店舗を取得
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: orders } = await supabase
    .from('takeout_orders')
    .select('store_id, created_at')
    .eq('line_user_id', userId)
    .neq('status', 'cancelled')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  const takeoutStoreIds: string[] = Array.from(new Set(
    ((orders ?? []).map((o: { store_id: string }) => o.store_id).filter(Boolean) as string[])
  ))

  const allIds = Array.from(new Set([...uniformStoreIds, ...takeoutStoreIds]))
  if (allIds.length === 0) return NextResponse.json({ stores: [] })

  // features カラムを含めて取得
  const { data: storeRows } = await supabase
    .from('stores')
    .select('id, name, is_open, business_type, features')
    .in('id', allIds)

  const storeMap = Object.fromEntries(
    (storeRows ?? []).map((s: {
      id: string; name: string; is_open: boolean; business_type: string; features: unknown
    }) => [s.id, s])
  )

  const uniformStores = uniformStoreIds
    .map(id => storeMap[id]).filter(Boolean)
    .map(s => {
      const isOpen = s.is_open ?? false
      const biz    = s.business_type ?? 'uniform'
      const raw    = (s.features ?? {}) as Record<string, unknown>
      return {
        id:            s.id,
        name:          s.name,
        is_open:       isOpen,
        business_type: biz,
        type:          'uniform' as const,
        features:      computeActionFeatures(isOpen, biz, raw),
      }
    })

  const takeoutStores = takeoutStoreIds
    .filter(id => !uniformStoreIds.includes(id))
    .map(id => storeMap[id]).filter(Boolean)
    .map(s => {
      const isOpen = s.is_open ?? false
      const biz    = s.business_type ?? 'takeout'
      const raw    = (s.features ?? {}) as Record<string, unknown>
      return {
        id:            s.id,
        name:          s.name,
        is_open:       isOpen,
        business_type: biz,
        type:          'takeout' as const,
        features:      computeActionFeatures(isOpen, biz, raw),
      }
    })

  const verbose = searchParams.get('verbose') === '1'
  if (verbose) {
    const { data: customersNoFilter } = await supabase
      .from('customers')
      .select('store_id, deleted_at, updated_at')
      .eq('line_user_id', userId)
      .order('updated_at', { ascending: false })
    return NextResponse.json({
      debug: {
        userId,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        customersWithFilter: customers ?? [],
        customersNoFilter: customersNoFilter ?? [],
        uniformStoreIds,
        takeoutStoreIds,
        storeRows: storeRows ?? [],
        uniformStores,
        takeoutStores,
      },
      stores: [...uniformStores, ...takeoutStores],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const verbose = searchParams.get('verbose') === '1'
  if (verbose) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '(not set)'
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    // ひものや直接クエリ（デバッグ用）
    const himonoyaStoreId = 'befb5519-e488-4c6f-983f-f18b577ed7ad'
    const { data: himonoyaDirect } = await supabase
      .from('customers')
      .select('id, store_id, line_user_id, deleted_at, updated_at')
      .eq('store_id', himonoyaStoreId)
      .eq('line_user_id', userId)
    // deleted_at IS NULL フィルタなしで全件
    const { data: himonoyaAll } = await supabase
      .from('customers')
      .select('id, store_id, line_user_id, deleted_at, updated_at')
      .eq('store_id', himonoyaStoreId)
    return NextResponse.json({
      debug: {
        supabaseUrl,
        hasServiceKey,
        userId,
        himonoyaDirect: himonoyaDirect ?? [],
        himonoyaAll: himonoyaAll ?? [],
        customersRaw: customers ?? [],
        uniformStoreIds,
        takeoutStoreIds,
        allIds,
        storeRows: storeRows ?? [],
        uniformStores,
        takeoutStores,
      },
      stores: [...uniformStores, ...takeoutStores],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(
    { stores: [...uniformStores, ...takeoutStores] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
