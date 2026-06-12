export type RepairStatus = 'received' | 'completed' | 'delivered'
export type RequestType = 'repair' | 'walk_in' | 'hold_request' | 'inquiry' | 'repair_consult' | 'payment_pending'

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  repair:          'お直し',
  walk_in:         '来店依頼',
  hold_request:    '取置き依頼',
  inquiry:         'その他問合せ',
  repair_consult:  'お直し相談',
  payment_pending: 'お支払い・入金待ち',
}

export const REQUEST_TYPE_COLORS: Record<RequestType, string> = {
  repair:          'bg-amber-100 text-amber-700 border-amber-300',
  walk_in:         'bg-sky-100 text-sky-700 border-sky-300',
  hold_request:    'bg-violet-100 text-violet-700 border-violet-300',
  inquiry:         'bg-rose-100 text-rose-700 border-rose-300',
  repair_consult:  'bg-teal-100 text-teal-700 border-teal-300',
  payment_pending: 'bg-red-100 text-red-700 border-red-300',
}

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
  staff_notes:  string | null
  school_name:  string | null
  school_id:    string | null
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
  request_type:   RequestType
  prepaid:        boolean
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
  received:  'bg-amber-100 text-amber-700 border-amber-300',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  delivered: 'bg-gray-200 text-gray-500 border-gray-300',
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
  ordered:   'bg-blue-100 text-blue-700 border-blue-300',
  received:  'bg-blue-100 text-blue-700 border-blue-300',
  stocked:   'bg-violet-100 text-violet-700 border-violet-300',
  on_order:  'bg-orange-100 text-orange-700 border-orange-300',
  arrived:   'bg-emerald-100 text-emerald-700 border-emerald-300',
  delivered: 'bg-gray-200 text-gray-500 border-gray-300',
}

// ──────────────────────────────────────────────
// お子様
// ──────────────────────────────────────────────
export interface Child {
  id:             string
  customer_id:    string
  store_id:       string
  name:           string
  kana:           string | null
  school_name:    string | null
  school_id:      string | null
  grade:          string | null
  gender:         string | null  // 'male' | 'female'
  admission_year: number | null
  created_at:     string
  updated_at:     string
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

// ──────────────────────────────────────────────
// お直し種別
// ──────────────────────────────────────────────
export type RepairType =
  | 'hem'           // 裾上げ
  | 'sleeve'        // 袖丈直し
  | 'waist'         // ウエスト調整
  | 'embroidery'    // 刺繍
  | 'button'        // ボタン
  | 'tear'          // 修理・補修
  | 'badge'         // 校章付け
  | 'size_exchange' // サイズ交換
  | 'other'         // その他

export const REPAIR_TYPE_LABELS: Record<RepairType, string> = {
  hem:          '裾上げ',
  sleeve:       '袖丈直し',
  waist:        'ウエスト調整',
  embroidery:   '刺繍',
  button:       'ボタン',
  tear:         '修理・補修',
  badge:        '校章付け',
  size_exchange:'サイズ交換',
  other:        'その他',
}

export const REPAIR_TYPE_ICONS: Record<RepairType, string> = {
  hem:          '✂️',
  sleeve:       '👔',
  waist:        '📏',
  embroidery:   '🔤',
  button:       '🔘',
  tear:         '🩹',
  badge:        '🏅',
  size_exchange:'↕️',
  other:        '📝',
}

export const REPAIR_TYPE_COLORS: Record<RepairType, string> = {
  hem:          'bg-amber-100 text-amber-700 border-amber-300',
  sleeve:       'bg-blue-100 text-blue-700 border-blue-300',
  waist:        'bg-purple-100 text-purple-700 border-purple-300',
  embroidery:   'bg-pink-100 text-pink-700 border-pink-300',
  button:       'bg-gray-100 text-gray-600 border-gray-300',
  tear:         'bg-red-100 text-red-700 border-red-300',
  badge:        'bg-indigo-100 text-indigo-700 border-indigo-300',
  size_exchange:'bg-teal-100 text-teal-700 border-teal-300',
  other:        'bg-slate-100 text-slate-600 border-slate-300',
}

export const REWORK_REASON_LABELS: Record<string, string> = {
  size_error:        'サイズ誤り',
  embroidery_error:  '刺繍ミス',
  measurement_error: '寸法書き違い',
  quality:           '仕上がり品質',
  customer_change:   'お客様希望変更',
  other:             'その他',
}
