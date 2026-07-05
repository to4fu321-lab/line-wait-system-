export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { assertStorePin } from '@/lib/auth/storeAuth'

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const { storeId, enabled, storePin } = await req.json()
  if (!storeId || typeof enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'invalid params' }, { status: 400 })
  }

  // 店舗設定の変更のため、店舗PIN（または super-admin セッション）必須
  const denied = await assertStorePin(req, { storeId, storePin })
  if (denied) return denied
  const { error } = await (supabase.from('stores') as any)
    .update({ is_test_mode: enabled }).eq('id', storeId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, is_test_mode: enabled })
}
