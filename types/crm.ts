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
  child_id:       string | null
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
  payment_status: 'unpaid' | 'paid' | null
  created_at:     string
  updated_at:     string
  customer?:      Customer
}

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  received:  '預かり中',
  completed: 'お直し完了連絡済み',
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
export type PurchaseStatus = 'ordered' | 'received' | 'stocked' | 'on_order' | 'arrived' | 'delivered'

export interface PurchaseOrder {
  id:             string
  store_id:       string
  customer_id:    string
  child_id:       string | null
  item_name:      string
  notes:          string | null
  status:         PurchaseStatus
  price:          number | null
  ordered_date:   string
  arrived_date:   string | null
  delivered_date: string | null
  notified:       boolean
  payment_status: 'unpaid' | 'paid' | null
  created_at:     string
  updated_at:     string
  customer?:      Customer
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  ordered:   '依頼受付',
  received:  '依頼受付',
  stocked:   '在庫確保済み',
  on_order:  'メーカー発注済み',
  arrived:   '入荷連絡済み',
  delivered: 'お渡し済み',
}

export const PURCHASE_STATUS_COLORS: Record<PurchaseStatus, string> = {
  ordered:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  received:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  stocked:   'bg-violet-500/20 text-violet-300 border-violet-500/30',
  on_order:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
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
  '中学1年', '中学2年', '中学3年',
  '高校1年', '高校2年', '高校3年',
]

export const SCHOOL_OPTIONS = [
  '○○中学校',
  '○○高等学校',
  'その他',
]
