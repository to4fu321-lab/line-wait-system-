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
