// ──────────────────────────────────────────────────────────────
//  レジセッション 集計ロジック（isomorphic: サーバー/クライアント両用）
//   supabase クライアントを引数で受け取り、オープン中セッションの
//   決済種別ごとの売上・入出金・現金理論残高をリアルタイム集計する。
// ──────────────────────────────────────────────────────────────

import type { PaymentMethod } from '@/types/sales'
import {
  emptyMethodMap, calcCashExpected,
  type CashMovement, type RegisterSession, type SessionSummary,
} from '@/types/register'

type AnyDb = {
  from: (t: string) => any
}

// オープン中セッションを取得（無ければ null）
export async function fetchOpenSession(
  db: AnyDb,
  storeId: string,
): Promise<RegisterSession | null> {
  const { data } = await db
    .from('register_sessions')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as RegisterSession) ?? null
}

// セッションに紐づく売上・入出金を集計して理論値を返す
export async function computeSessionSummary(
  db: AnyDb,
  session: RegisterSession,
): Promise<SessionSummary> {
  const [{ data: sales }, { data: movements }] = await Promise.all([
    db.from('sales')
      .select('payment_method, total, status')
      .eq('register_session_id', session.id),
    db.from('register_cash_movements')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
  ])

  const salesByMethod = emptyMethodMap()
  let totalSales = 0
  let saleCount = 0
  for (const s of (sales ?? []) as any[]) {
    if (s.status === 'voided') continue
    const amt = Number(s.total) || 0
    const m = (s.payment_method ?? 'other') as PaymentMethod
    if (m in salesByMethod) salesByMethod[m] += amt
    else salesByMethod.other += amt
    totalSales += amt
    saleCount++
  }

  let cashIn = 0
  let cashOut = 0
  const movs = (movements ?? []) as CashMovement[]
  for (const mv of movs) {
    const amt = Number(mv.amount) || 0
    if (mv.direction === 'in') cashIn += amt
    else cashOut += amt
  }

  const cashExpected = calcCashExpected(
    session.opening_float || 0,
    salesByMethod.cash,
    cashIn,
    cashOut,
  )

  return {
    session,
    salesByMethod,
    cashIn,
    cashOut,
    cashExpected,
    totalSales,
    saleCount,
    movements: movs,
  }
}
