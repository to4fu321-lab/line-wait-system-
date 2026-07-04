// ============================================================================
//  レジ締め API（閉店・精算）
//   POST {
//     storeId, sessionId,
//     closingDenominations?: {金種:枚数},   // 現金の金種計算
//     cashActual?: number,                   // 現金実査値（金種入力が無い場合）
//     actuals: { cash, credit, qr, emoney, voucher, other },  // 各決済の実績値
//     staffId, staffName, note
//   }
//   → 決済種別ごとに理論値 vs 実績を比較し過不足を計算、セッションを closed に更新。
// ============================================================================

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeSessionSummary } from '@/lib/registerSession'
import {
  buildClosingReport, sumDenominations, emptyMethodMap,
  type DenominationCounts,
} from '@/types/register'
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/sales'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      storeId, sessionId, closingDenominations, cashActual, actuals,
      staffId, staffName, note,
    } = body as {
      storeId?: string
      sessionId?: string
      closingDenominations?: DenominationCounts
      cashActual?: number
      actuals?: Partial<Record<PaymentMethod, number>>
      staffId?: string | null
      staffName?: string | null
      note?: string | null
    }
    if (!storeId || !sessionId) return NextResponse.json({ error: 'storeId, sessionId required' }, { status: 400 })

    const db = getSupabase()

    const { data: session } = await db.from('register_sessions')
      .select('*').eq('id', sessionId).eq('store_id', storeId).single()
    if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })
    if (session.status !== 'open') return NextResponse.json({ error: 'レジは既に締められています' }, { status: 409 })

    // オープン中の集計（理論値）
    const summary = await computeSessionSummary(db as any, session as any)

    // 現金実査値：金種入力があれば合算、無ければ cashActual を採用
    const denoms = closingDenominations ?? {}
    const denomSum = sumDenominations(denoms)
    const cashActualVal = denomSum > 0 ? denomSum : (Number(cashActual) || 0)

    // 実績マップを組み立て（現金は実査値、キャッシュレスは入力値）
    const actualMap = emptyMethodMap()
    for (const m of PAYMENT_METHODS) {
      actualMap[m] = m === 'cash' ? cashActualVal : Math.round(Number(actuals?.[m]) || 0)
    }

    const report = buildClosingReport(summary.salesByMethod, summary.cashExpected, actualMap)
    const cashRow = report.find(r => r.method === 'cash')!
    const totalVariance = report.reduce((s, r) => s + r.variance, 0)

    const { data, error } = await db.from('register_sessions').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: staffId ?? null,
      closed_by_name: staffName ?? null,
      closing_denominations: denoms,
      closing_report: report,
      cash_theoretical: cashRow.theoretical,
      cash_actual: cashRow.actual,
      cash_variance: cashRow.variance,
      total_sales: summary.totalSales,
      total_variance: totalVariance,
      note: note ?? session.note ?? null,
    }).eq('id', sessionId).eq('status', 'open').select('*').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, session: data, report, summary })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
