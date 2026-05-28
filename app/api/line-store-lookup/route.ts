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
  if (!userId) return NextResponse.json({ storeId: null })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('customers')
    .select('store_id')
    .eq('line_user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ storeId: data?.store_id ?? null })
}
