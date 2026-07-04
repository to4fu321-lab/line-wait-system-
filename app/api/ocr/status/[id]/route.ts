export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// GET /api/ocr/status/[id] — ジョブ進捗・結果の取得（ポーリング用）
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ocr_jobs')
    .select('id, status, progress, result, tokens_used, error_msg, created_at, updated_at')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
