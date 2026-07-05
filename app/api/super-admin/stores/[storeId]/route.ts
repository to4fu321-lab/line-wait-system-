export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { hashPin } from '@/lib/auth/pinHash'

export async function PUT(req: Request, { params }: { params: { storeId: string } }) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { storeId } = params
    const body = await req.json()
    const update: Record<string, unknown> = {}
    if (body.name     !== undefined) update.name     = body.name.trim()
    // PIN は空文字なら「変更なし」。設定時はハッシュ化して保存(平文は保存しない)
    if (body.pin) update.pin = await hashPin(String(body.pin))
    if (body.group_id !== undefined) update.group_id = body.group_id || null
    if (body.features !== undefined) {
      // features.owner_pin は平文で保持しない。指定があれば owner_pin_hash へ移送
      const features = { ...(body.features as Record<string, unknown>) }
      const ownerPin = features.owner_pin
      delete features.owner_pin
      if (typeof ownerPin === 'string' && ownerPin) {
        update.owner_pin_hash = await hashPin(ownerPin)
      }
      update.features = features
    }
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
