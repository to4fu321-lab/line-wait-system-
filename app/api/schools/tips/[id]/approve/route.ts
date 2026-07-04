export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// PATCH /api/schools/tips/:id/approve  body: { approved: boolean, updated_by?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { approved, updated_by = '' } = await req.json()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('school_parent_tips')
    .update({ approved, updated_by })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
