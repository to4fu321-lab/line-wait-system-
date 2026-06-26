export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// POST /api/customers/link-line { storeId, customerId, lineUserId }
// 既存顧客レコードに line_user_id を後付け（LINE連携QR用）
export async function POST(req: NextRequest) {
  try {
    const { storeId, customerId, lineUserId } = (await req.json()) as {
      storeId?: string; customerId?: string; lineUserId?: string
    }
    if (!storeId || !customerId || !lineUserId) {
      return NextResponse.json({ ok: false, error: 'storeId, customerId, lineUserId required' }, { status: 400 })
    }
    const supabase = getSupabase()

    // 同一 line_user_id が他レコードに付いている場合は外す（重複防止）
    await supabase.from('customers')
      .update({ line_user_id: null })
      .eq('store_id', storeId).eq('line_user_id', lineUserId).neq('id', customerId)

    const { data, error } = await supabase.from('customers')
      .update({ line_user_id: lineUserId, updated_at: new Date().toISOString() })
      .eq('id', customerId).eq('store_id', storeId)
      .select('id, name')
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, customer: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
