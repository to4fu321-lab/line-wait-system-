export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// GET /api/schools/:id/grades
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('school_grades')
    .select('*')
    .eq('school_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PUT /api/schools/:id/grades  body: { grades: Partial<SchoolGrade>[], updated_by: string }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { grades, updated_by = '' } = await req.json()

  const supabase = createAdminClient()

  await supabase.from('school_grades').delete().eq('school_id', params.id)

  if (!grades || grades.length === 0) return NextResponse.json([])

  const rows = grades.map((g: Record<string, unknown>, i: number) => ({
    school_id:  params.id,
    grade_name: g.grade_name ?? '',
    color_name: g.color_name ?? '',
    color_hex:  g.color_hex ?? '',
    sort_order: i,
    updated_by,
  }))

  const { data, error } = await supabase
    .from('school_grades')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
