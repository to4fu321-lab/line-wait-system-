export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// Supabase 無料プランは7日間APIアクセスが無いとプロジェクトが自動停止するため、
// Vercel Cron (vercel.json) から1日1回叩いてアクセス実績を作る。
export async function GET() {
  const supabase = createAdminClient()
  const { error } = await supabase.from('stores').select('id').limit(1)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
