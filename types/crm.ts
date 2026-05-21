export type RepairStatus = 'received' | 'completed' | 'delivered'

export interface Customer {
  id:           string
  store_id:     string
  name:         string
  kana:         string | null
  parent_name:  string | null
  parent_kana:  string | null
  tel:          string | null
  line_user_id: string | null
  notes:        string | null
  school_name:  string | null
  gender:       string | null
  category:     string | null
  created_at:   string
  updated_at:   string
}

export interface RepairHistory {
  id:             string
  store_id:       string
  customer_id:    string
  slip_number:    string | null
  item_name:      string
  content:        string
  status:         RepairStatus
  received_date:  string
  completed_date: string | null
  delivered_date: string | null
  price:          number | null
  notes:          string | null
  notified:       boolean
  created_at:     string
  updated_at:     string
  // JOIN用（APIレスポンスで付与）
  customer?:      Customer
}

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  received:  '預かり中',
  completed: 'お直し完了',
  delivered: 'お渡し済み',
}

export const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  received:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  delivered: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/50',
}

// ──────────────────────────────────────────────
// 追加購入（発注管理）
// ──────────────────────────────────────────────
export type PurchaseStatus = 'ordered' | 'arrived' | 'delivered'

export interface PurchaseOrder {
  id:             string
  store_id:       string
  customer_id:    string
  item_name:      string
  notes:          string | null
  status:         PurchaseStatus
  price:          number | null
  ordered_date:   string
  arrived_date:   string | null
  delivered_date: string | null
  notified:       boolean
  created_at:     string
  updated_at:     string
  customer?:      Customer
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  ordered:   '注文中',
  arrived:   '入荷済み',
  delivered: 'お渡し済み',
}

export const PURCHASE_STATUS_COLORS: Record<PurchaseStatus, string> = {
  ordered:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  arrived:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  delivered: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/50',
}

// ──────────────────────────────────────────────
// お子様
// ──────────────────────────────────────────────
export interface Child {
  id:          string
  customer_id: string
  store_id:    string
  name:        string
  kana:        string | null
  school_name: string | null
  grade:       string | null
  created_at:  string
  updated_at:  string
}

export const GRADE_OPTIONS = [
  '小1', '小2', '小3', '小4', '小5', '小6',
  '中1', '中2', '中3',
  '高1', '高2', '高3',
  'その他',
]
