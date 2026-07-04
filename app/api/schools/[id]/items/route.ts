export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// GET /api/schools/:id/items
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('school_items')
    .select('*')
    .eq('school_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PUT /api/schools/:id/items  body: { items: Partial<SchoolItem>[], updated_by: string }
// Full replacement: delete all → re-insert
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { items, updated_by = '' } = await req.json()

  const supabase = createAdminClient()

  // Delete all existing items for this school
  const { error: delError } = await supabase
    .from('school_items')
    .delete()
    .eq('school_id', params.id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  if (!items || items.length === 0) return NextResponse.json([])

  // Re-insert with sort_order from index
  const rows = items.map((item: Record<string, unknown>, i: number) => ({
    school_id:        params.id,
    name:             item.name ?? '',
    required:         item.required ?? true,
    price_tax_in:     item.price_tax_in ?? null,
    price_tax_out:    item.price_tax_out ?? null,
    size_spec:        item.size_spec ?? '',
    product_code:     item.product_code ?? '',
    growth_adjust:    item.growth_adjust ?? false,
    washable:         item.washable ?? '',
    avg_qty:          item.avg_qty ?? null,
    uses_grade_color: item.uses_grade_color ?? false,
    grade_color_note: item.grade_color_note ?? '',
    item_notes:       item.item_notes ?? '',
    sort_order:       i,
    updated_by,
  }))

  const { data, error } = await supabase
    .from('school_items')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
