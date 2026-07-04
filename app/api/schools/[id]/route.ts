export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// GET /api/schools/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// PUT /api/schools/:id  body: { name, kana, short_name, notes, active, sort_order, updated_by }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { name, kana, short_name, notes, active, sort_order, updated_by } = body

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('schools')
    .update({ name, kana, short_name, notes, active, sort_order, updated_by })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/schools/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('schools')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
