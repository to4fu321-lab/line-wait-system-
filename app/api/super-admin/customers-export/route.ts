export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/super-admin/customers-export?storeId=...
 * CSVエクスポート用の顧客+お子様一覧(super-admin 専用)。
 */
export async function GET(req: NextRequest) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const storeId = req.nextUrl.searchParams.get('storeId')
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })
    const supabase = createAdminClient({ noStore: true })
    const { data, error } = await supabase
      .from('customers')
      .select('name, kana, tel, line_user_id, created_at, children(name, school_name, grade, admission_year)')
      .eq('store_id', storeId)
      .is('deleted_at', null)
      .order('kana', { ascending: true })
      .limit(5000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ customers: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
