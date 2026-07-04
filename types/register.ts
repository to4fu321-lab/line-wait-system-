// ──────────────────────────────────────────────────────────────
//  レジ管理・現金管理（Cash Management）型定義
//   レジセッション(RegisterSession) = オープン〜締めの1単位。
//   会計(sales) は register_session_id でオープン中セッションへ紐付く。
//   理論値はセッションに紐づく sales と入出金(cash movements)から集計する。
// ──────────────────────────────────────────────────────────────

import type { PaymentMethod } from './sales'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from './sales'

export type RegisterSessionStatus = 'open' | 'closed'
export type CashMovementDirection = 'in' | 'out'

// 金種（日本円）。締め・釣銭準備金の枚数入力に使う。
export const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1] as const
export type Denomination = (typeof DENOMINATIONS)[number]

// 金種→枚数（例: {"10000": 2, "1000": 10}）
export type DenominationCounts = Partial<Record<string, number>>

// 入出金の理由カテゴリ（ドロップダウン候補。自由入力は memo で保持）
export const CASH_IN_REASONS = ['釣銭補給', '両替（入）', '前日繰越', 'その他'] as const
export const CASH_OUT_REASONS = ['小口経費', '仕入・立替', '両替（出）', '釣銭回収', 'その他'] as const

export interface RegisterSession {
  id:                    string
  store_id:              string
  session_number:        string | null
  status:                RegisterSessionStatus
  opened_at:             string
  opened_by:             string | null
  opened_by_name:        string | null
  opening_float:         number
  opening_denominations: DenominationCounts
  closed_at:             string | null
  closed_by:             string | null
  closed_by_name:        string | null
  closing_denominations: DenominationCounts | null
  closing_report:        MethodTally[] | null
  cash_theoretical:      number | null
  cash_actual:           number | null
  cash_variance:         number | null
  total_sales:           number | null
  total_variance:        number | null
  note:                  string | null
  created_at:            string
  updated_at:            string
}

export interface CashMovement {
  id:         string
  store_id:   string
  session_id: string
  direction:  CashMovementDirection
  amount:     number
  reason:     string | null
  memo:       string | null
  staff_id:   string | null
  staff_name: string | null
  created_at: string
}

// 決済種別ごとの集計（締めレポートの1行）
export interface MethodTally {
  method:      PaymentMethod
  theoretical: number   // システム理論値
  actual:      number   // 締め時の実績入力値
  variance:    number   // 過不足（実績 - 理論）
}

// オープン中セッションのライブ集計（API /register-session が返す）
export interface SessionSummary {
  session:       RegisterSession
  salesByMethod: Record<PaymentMethod, number>  // 決済種別ごとの売上累計(税込)
  cashIn:        number                          // 営業中入金 合計
  cashOut:       number                          // 営業中出金 合計
  cashExpected:  number                          // 現金 理論残高
  totalSales:    number                          // 総売上(税込)
  saleCount:     number                          // 会計件数
  movements:     CashMovement[]
}

// 空の決済別マップ
export function emptyMethodMap(): Record<PaymentMethod, number> {
  return PAYMENT_METHODS.reduce((acc, m) => {
    acc[m] = 0
    return acc
  }, {} as Record<PaymentMethod, number>)
}

// 金種×枚数 → 合計金額
export function sumDenominations(counts: DenominationCounts): number {
  return DENOMINATIONS.reduce((sum, d) => sum + d * (Number(counts[String(d)]) || 0), 0)
}

// 現金理論値 = 開店釣銭準備金 + 現金売上 + 営業中入金 - 営業中出金
export function calcCashExpected(
  openingFloat: number,
  cashSales: number,
  cashIn: number,
  cashOut: number,
): number {
  return openingFloat + cashSales + cashIn - cashOut
}

// 締めレポート行を組み立てる（現金は理論値・実査値、キャッシュレスは理論値ベース）
export function buildClosingReport(
  salesByMethod: Record<PaymentMethod, number>,
  cashExpected: number,
  actuals: Record<PaymentMethod, number>,
): MethodTally[] {
  return PAYMENT_METHODS.map(method => {
    const theoretical = method === 'cash' ? cashExpected : (salesByMethod[method] ?? 0)
    const actual = actuals[method] ?? 0
    return { method, theoretical, actual, variance: actual - theoretical }
  })
}

// セッション番号 YYYYMMDD-NN
export function makeSessionNumber(seq: number, now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}-${String(seq).padStart(2, '0')}`
}

// 表示ヘルパ
export const methodLabel = (m: PaymentMethod): string => PAYMENT_METHOD_LABELS[m]
export const varianceLabel = (v: number): string =>
  v === 0 ? '一致' : v > 0 ? `+${v.toLocaleString()}（過剰）` : `${v.toLocaleString()}（不足）`
