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
  if (!userId) return NextResponse.json({ stores: [] })

  const supabase = getSupabase()

  // 登録済みの全店舗を取得（重複store_idを除外）
  const { data: customers } = await supabase
    .from('customers')
    .select('store_id')
    .eq('line_user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (!customers || customers.length === 0) {
    return NextResponse.json({ stores: [] })
  }

  // ユニークなstore_idのリスト（最近更新順）
  const storeIds = [...new Set(customers.map(c => c.store_id).filter(Boolean))]

  // 店舗名を取得
  const { data: storeRows } = await supabase
    .from('stores')
    .select('id, name, is_open')
    .in('id', storeIds)

  const storeMap = Object.fromEntries((storeRows ?? []).map(s => [s.id, s]))

  const stores = storeIds
    .map(id => storeMap[id])
    .filter(Boolean)
    .map(s => ({ id: s.id, name: s.name, is_open: s.is_open ?? false }))

  return NextResponse.json({ stores })
}
