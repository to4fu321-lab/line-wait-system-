// ──────────────────────────────────────────────────────────────
//  簡易レジ（POS）型定義
//  会計(Sale) > 明細(SaleItem)。税はスナップショット保存（税率変更に強い）。
// ──────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'credit' | 'qr' | 'emoney' | 'voucher' | 'other'

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'credit', 'qr', 'emoney', 'voucher', 'other']

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:    '現金',
  credit:  'クレジット',
  qr:      'QR決済',
  emoney:  '電子マネー',
  voucher: '商品券',
  other:   'その他',
}

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: '💴', credit: '💳', qr: '📱', emoney: '🪙', voucher: '🎫', other: '✏️',
}

export type SaleStatus = 'completed' | 'voided'
export type SaleSourceType = 'product' | 'repair' | 'order' | 'deposit' | 'manual'

export const SOURCE_TYPE_LABELS: Record<SaleSourceType, string> = {
  product: '商品',
  repair:  'お直し',
  order:   '注文',
  deposit: '内金',
  manual:  '手入力',
}

export interface Sale {
  id:                  string
  store_id:            string
  sale_number:         string | null
  staff_id:            string | null
  customer_id:         string | null
  child_id:            string | null
  subtotal:            number
  tax:                 number
  total:               number
  tax_rate:            number
  tax_inclusive:       boolean
  payment_method:      PaymentMethod
  cash_received:       number | null
  change:              number | null
  status:              SaleStatus
  note:                string | null
  discount:            number          // 会計全体の値引き(円・税込)
  receipt_name:        string | null   // 領収書 宛名
  receipt_note:        string | null   // 領収書 但し書き
  voided_at:           string | null
  void_reason:         string | null
  register_session_id: string | null
  created_at:          string
  // JOIN時
  items?:              SaleItem[]
}

// 注文への入金履歴（前受金・内金・残金）
export interface OrderPayment {
  id:         string
  store_id:   string
  order_id:   string
  sale_id:    string | null
  amount:     number
  method:     string | null
  kind:       'deposit' | 'balance'
  created_at: string
}

export interface SaleItem {
  id:          string
  sale_id:     string
  store_id:    string
  source_type: SaleSourceType
  source_id:   string | null
  name:        string
  unit_price:  number
  qty:         number
  line_total:  number
  created_at:  string
}

// レジ画面のカート行（保存前）
export interface CartLine {
  key:         string        // React key（クライアント生成）
  source_type: SaleSourceType
  source_id:   string | null
  name:        string
  unit_price:  number
  qty:         number
}

export const lineTotal = (l: Pick<CartLine, 'unit_price' | 'qty'>): number =>
  Math.max(0, Math.round(l.unit_price * l.qty))

// 税の内訳を求める（税込/外税の両対応・スナップショット用）
//  inclusive(内税): total = Σ税込, tax = total - total/(1+r), subtotal = total - tax
//  exclusive(外税): subtotal = Σ, tax = round(subtotal*r), total = subtotal + tax
export function calcTax(
  grossSum: number,
  taxRatePct: number,
  inclusive: boolean,
): { subtotal: number; tax: number; total: number } {
  const r = taxRatePct / 100
  if (inclusive) {
    const total = Math.round(grossSum)
    const subtotal = Math.round(total / (1 + r))
    return { subtotal, tax: total - subtotal, total }
  }
  const subtotal = Math.round(grossSum)
  const tax = Math.round(subtotal * r)
  return { subtotal, tax, total: subtotal + tax }
}

// レシート/領収書の表示データ（POS会計直後・履歴からの再発行で共用）
export interface ReceiptData {
  saleId:       string | null   // 保存済み会計のID（宛名・但し書きの保存先）
  saleNumber:   string
  createdAt:    Date
  lines:        { key: string; name: string; qty: number; unit_price: number }[]
  subtotal:     number
  tax:          number
  total:        number
  discount:     number
  taxRate:      number
  payment:      PaymentMethod
  cashReceived: number | null
  change:       number | null
  custName:     string | null
}

// 値引き適用後の集計（値引きは税込合計から差し引く）
export function calcTotalsWithDiscount(
  grossSum: number,
  discount: number,
  taxRatePct: number,
  inclusive: boolean,
): { subtotal: number; tax: number; total: number; discount: number } {
  const d = Math.max(0, Math.min(Math.round(discount) || 0, Math.round(grossSum)))
  const t = calcTax(Math.max(0, grossSum - d), taxRatePct, inclusive)
  return { ...t, discount: d }
}

// 当日連番のレシート番号（YYYYMMDD-連番）
export function makeSaleNumber(seq: number, now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}-${String(seq).padStart(3, '0')}`
}
