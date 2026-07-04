// ============================================================================
//  レジセッション API
//   GET  ?storeId=...  → オープン中セッション + ライブ集計（理論残高など）
//   POST { action:'open', storeId, openingFloat, openingDenominations, staffId, staffName, note }
//        → レジオープン（釣銭準備金を記録して新規セッション作成）
// ============================================================================

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOpenSession, computeSessionSummary } from '@/lib/registerSession'
import { makeSessionNumber, sumDenominations } from '@/types/register'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(req: Request) {
  try {
    const storeId = new URL(req.url).searchParams.get('storeId')
    if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })
    const db = getSupabase()
    const session = await fetchOpenSession(db as any, storeId)
    if (!session) return NextResponse.json({ open: false, session: null, summary: null })
    const summary = await computeSessionSummary(db as any, session)
    return NextResponse.json({ open: true, session, summary })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      storeId,
      openingFloat,
      openingDenominations,
      staffId,
      staffName,
      note,
    } = body as {
      storeId?: string
      openingFloat?: number
      openingDenominations?: Record<string, number>
      staffId?: string | null
      staffName?: string | null
      note?: string | null
    }
    if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

    const db = getSupabase()

    // 二重オープン防止
    const existing = await fetchOpenSession(db as any, storeId)
    if (existing) {
      return NextResponse.json(
        { error: '既にオープン中のレジがあります', session: existing },
        { status: 409 },
      )
    }

    // 釣銭準備金：金種入力があれば合算、無ければ数値をそのまま採用
    const denoms = openingDenominations ?? {}
    const floatFromDenoms = sumDenominations(denoms)
    const float = floatFromDenoms > 0 ? floatFromDenoms : (Number(openingFloat) || 0)

    // 当日連番
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const { count } = await db.from('register_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gte('opened_at', start.toISOString())
    const sessionNumber = makeSessionNumber((count ?? 0) + 1)

    const { data, error } = await db.from('register_sessions').insert({
      store_id: storeId,
      session_number: sessionNumber,
      status: 'open',
      opened_by: staffId ?? null,
      opened_by_name: staffName ?? null,
      opening_float: float,
      opening_denominations: denoms,
      note: note ?? null,
    }).select('*').single()

    if (error) {
      // 一意制約（同時オープン）に当たった場合
      const status = /duplicate|unique/i.test(error.message) ? 409 : 500
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ ok: true, session: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
