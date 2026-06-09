export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function PUT(req: Request, { params }: { params: { groupId: string } }) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { groupId } = params
    const body = await req.json()
    const update: Record<string, unknown> = {}
    if (body.name !== undefined) update.name = body.name.trim()
    if (body.code !== undefined) update.code = body.code.trim() || null
    if (body.pin  !== undefined) update.pin  = body.pin

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase.from('groups').update(update).eq('id', groupId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { groupId: string } }) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { groupId } = params
    const supabase = getSupabase()
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
