export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, {
    global: { fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: 'no-store' }) },
  })
}

// 運用側のみ閲覧・更新可（assertSuperAdmin）。現場フィードバックの一覧/ステータス更新。
export async function GET(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ feedback: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { id, status } = await req.json() as { id?: string; status?: string }
    if (!id || !status) return NextResponse.json({ error: 'id と status が必要です' }, { status: 400 })
    if (!['new', 'triaged', 'done', 'wontfix'].includes(status)) {
      return NextResponse.json({ error: 'status の値が不正です' }, { status: 400 })
    }
    const supabase = getSupabase()
    const { error } = await supabase
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
