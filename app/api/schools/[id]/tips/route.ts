export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

// GET /api/schools/:id/tips?approved=true|false  (omit for all)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const approvedParam = req.nextUrl.searchParams.get('approved')
  const supabase = getSupabase()

  let query = supabase
    .from('school_parent_tips')
    .select('*')
    .eq('school_id', params.id)
    .order('created_at', { ascending: false })

  if (approvedParam === 'true')  query = query.eq('approved', true)
  if (approvedParam === 'false') query = query.eq('approved', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
