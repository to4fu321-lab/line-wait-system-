export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function PUT(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { storeId } = params
    const body = await req.json()
    const update: Record<string, unknown> = {}
    if (body.name     !== undefined) update.name     = body.name.trim()
    if (body.pin      !== undefined) update.pin      = body.pin
    if (body.group_id !== undefined) update.group_id = body.group_id || null
    if (body.features      !== undefined) update.features      = body.features
    if (body.business_type !== undefined) update.business_type = body.business_type

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase.from('stores').update(update).eq('id', storeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { storeId } = params
    const supabase = getSupabase()
    const { error } = await supabase.from('stores').delete().eq('id', storeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
