export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { storeId, enabled } = await req.json()
  if (!storeId || typeof enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'invalid params' }, { status: 400 })
  }
  const { error } = await (supabase.from('stores') as any)
    .update({ is_test_mode: enabled }).eq('id', storeId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, is_test_mode: enabled })
}
