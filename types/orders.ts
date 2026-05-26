export type OrderStatus =
  | 'draft'        // 入力中
  | 'confirmed'    // 注文確定
  | 'processing'   // 手配中
  | 'ready'        // 準備完了
  | 'delivered'    // お渡し済み
  | 'cancelled'    // キャンセル

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export type OrderItemStatus =
  | 'ordered'    // 受注
  | 'on_order'   // メーカー発注済み
  | 'stocked'    // 入荷済み
  | 'ready'      // 準備完了
  | 'delivered'  // お渡し済み
  | 'cancelled'  // キャンセル

export interface Order {
  id:              string
  store_id:        string
  customer_id:     string | null
  child_id:        string | null
  queue_id:        string | null
  reservation_id:  string | null
  order_number:    string | null
  status:          OrderStatus
  payment_status:  PaymentStatus
  total_amount:    number | null
  height:          number | null
  weight:          number | null
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export interface OrderItem {
  id:          string
  order_id:    string
  item_name:   string
  size_label:  string | null
  quantity:    number
  unit_price:  number | null
  status:      OrderItemStatus
  notes:       string | null
  created_at:  string
  updated_at:  string
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft:      '入力中',
  confirmed:  '注文確定',
  processing: '手配中',
  ready:      '準備完了',
  delivered:  'お渡し済み',
  cancelled:  'キャンセル',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  draft:      'bg-zinc-700/60 text-zinc-400 border-zinc-600/50',
  confirmed:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  processing: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  ready:      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  delivered:  'bg-zinc-800/60 text-zinc-500 border-zinc-700/50',
  cancelled:  'bg-red-500/20 text-red-400 border-red-500/30',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid:  '未入金',
  partial: '一部入金',
  paid:    '入金済み',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid:  'bg-red-500/20 text-red-400 border-red-500/30',
  partial: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  paid:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  ordered:   '受注',
  on_order:  '発注済み',
  stocked:   '入荷済み',
  ready:     '準備完了',
  delivered: 'お渡し済み',
  cancelled: 'キャンセル',
}
