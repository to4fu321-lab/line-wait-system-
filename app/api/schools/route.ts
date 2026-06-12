export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// GET /api/schools?storeId=xxx
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('schools')
    .select('*, item_count:school_items(count), grade_count:school_grades(count)')
    .eq('store_id', storeId)
    .order('sort_order')
    .order('kana')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/schools  body: { store_id, name, kana, notes, updated_by }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { store_id, name, kana = '', notes = '', updated_by = '' } = body

  if (!store_id || !name?.trim()) {
    return NextResponse.json({ error: 'store_id and name are required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('schools')
    .insert({ store_id, name: name.trim(), kana, notes, updated_by })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
