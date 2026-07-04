// ============================================================================
//  レジ入出金 API（営業中の現金変動）
//   POST { storeId, sessionId, direction:'in'|'out', amount, reason, memo, staffId, staffName }
// ============================================================================

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, sessionId, direction, amount, reason, memo, staffId, staffName } = body as {
      storeId?: string
      sessionId?: string
      direction?: 'in' | 'out'
      amount?: number
      reason?: string | null
      memo?: string | null
      staffId?: string | null
      staffName?: string | null
    }
    if (!storeId || !sessionId) return NextResponse.json({ error: 'storeId, sessionId required' }, { status: 400 })
    if (direction !== 'in' && direction !== 'out') return NextResponse.json({ error: 'direction must be in|out' }, { status: 400 })
    const amt = Math.round(Number(amount) || 0)
    if (amt <= 0) return NextResponse.json({ error: 'amount must be positive' }, { status: 400 })

    const db = getSupabase()

    // セッションがオープン中か検証（締め後の追加を防止）
    const { data: session } = await db.from('register_sessions')
      .select('id, status').eq('id', sessionId).single()
    if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })
    if (session.status !== 'open') return NextResponse.json({ error: 'レジは既に締められています' }, { status: 409 })

    const { data, error } = await db.from('register_cash_movements').insert({
      store_id: storeId,
      session_id: sessionId,
      direction,
      amount: amt,
      reason: reason ?? null,
      memo: memo ?? null,
      staff_id: staffId ?? null,
      staff_name: staffName ?? null,
    }).select('*').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, movement: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
