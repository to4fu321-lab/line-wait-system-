export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const biz    = searchParams.get('biz') // 'uniform' | 'takeout' | null (null = uniform)
  if (!userId) return NextResponse.json({ stores: [] })

  const supabase = getSupabase()

  if (biz === 'takeout') {
    // テイクアウト：過去90日以内に注文した店舗
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: orders } = await supabase
      .from('takeout_orders')
      .select('store_id, created_at')
      .eq('line_user_id', userId)
      .neq('status', 'cancelled')
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    const storeIds = [...new Set(
      (orders ?? []).map((o: { store_id: string }) => o.store_id).filter(Boolean)
    )]

    if (storeIds.length === 0) return NextResponse.json({ stores: [] })

    const { data: storeRows } = await supabase
      .from('stores')
      .select('id, name, is_open')
      .in('id', storeIds)

    const storeMap = Object.fromEntries((storeRows ?? []).map((s: { id: string; name: string; is_open: boolean }) => [s.id, s]))
    const stores = storeIds.map(id => storeMap[id]).filter(Boolean)
      .map((s: { id: string; name: string; is_open: boolean }) => ({ id: s.id, name: s.name, is_open: s.is_open ?? false }))

    return NextResponse.json({ stores })
  }

  // uniform（デフォルト）：customers テーブルから登録済み店舗
  const { data: customers } = await supabase
    .from('customers')
    .select('store_id')
    .eq('line_user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (!customers || customers.length === 0) {
    return NextResponse.json({ stores: [] })
  }

  const storeIds = [...new Set(customers.map((c: { store_id: string }) => c.store_id).filter(Boolean))]

  const { data: storeRows } = await supabase
    .from('stores')
    .select('id, name, is_open')
    .in('id', storeIds)

  const storeMap = Object.fromEntries((storeRows ?? []).map((s: { id: string; name: string; is_open: boolean }) => [s.id, s]))
  const stores = storeIds.map(id => storeMap[id]).filter(Boolean)
    .map((s: { id: string; name: string; is_open: boolean }) => ({ id: s.id, name: s.name, is_open: s.is_open ?? false }))

  return NextResponse.json({ stores })
}
