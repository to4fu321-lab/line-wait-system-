export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { createAdminClient } from '@/lib/supabaseAdmin'

export async function PUT(req: Request, { params }: { params: { storeId: string } }) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { storeId } = params
    const body = await req.json()
    const update: Record<string, unknown> = {}
    if (body.name     !== undefined) update.name     = body.name.trim()
    if (body.pin      !== undefined) update.pin      = body.pin
    if (body.group_id !== undefined) update.group_id = body.group_id || null
    if (body.features        !== undefined) update.features        = body.features
    if (body.business_type   !== undefined) update.business_type   = body.business_type
    if (body.welcome_message !== undefined) update.welcome_message = body.welcome_message || null

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('stores').update(update).eq('id', storeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { storeId: string } }) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { storeId } = params
    const supabase = createAdminClient()
    const { error } = await supabase.from('stores').delete().eq('id', storeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
