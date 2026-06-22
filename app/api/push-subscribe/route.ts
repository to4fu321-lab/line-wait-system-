export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { storeId, subscription, staffId, kind } = await req.json()
  if (!storeId || !subscription?.endpoint) {
    return NextResponse.json({ ok: false, error: 'invalid params' }, { status: 400 })
  }
  const { error } = await (supabase.from('push_subscriptions') as any).upsert({
    store_id: storeId,
    endpoint: subscription.endpoint,
    p256dh:   subscription.keys.p256dh,
    auth:     subscription.keys.auth,
    staff_id: staffId ?? null,
    kind:     kind ?? (staffId ? 'staff' : 'admin'),
  }, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 })
  await (supabase.from('push_subscriptions') as any).delete().eq('endpoint', endpoint)
  return NextResponse.json({ ok: true })
}
