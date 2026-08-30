import type { RepairStatus, PurchaseStatus, RequestType, RepairType } from '@/types/crm'

export interface RepairRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  slip_number: string | null; item_name: string; content: string
  status: RepairStatus; received_date: string; completed_date: string | null
  delivered_date: string | null; price: number | null; notes: string | null
  notified: boolean; request_type: RequestType | null; prepaid: boolean | null
  desired_completion_date: string | null; work_started: boolean
  request_no: number | null
  created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null; line_user_id: string | null }
  child?: { name: string; school_name: string | null } | null
  // お直し詳細フィールド
  repair_type: RepairType | null
  hem_length_mm: number | null
  sleeve_adjust_mm: number | null
  waist_adjust_mm: number | null
  embroidery_text: string | null
  embroidery_color: string | null
  embroidery_pos: string | null
  vendor_id: string | null
  vendor_name: string | null
  sent_to_vendor_at: string | null
  expected_return_date: string | null
  inspected_at: string | null
  is_rework: boolean
  rework_reason: string | null
  internal_memo: string | null
  // ▼ お直しマスタ再構築で追加（服種>項目>オプション連携・価格モード）
  garment_type_id?: string | null
  item_id?: string | null
  item_code?: string | null
  garment_name?: string | null
  base_price?: number | null
  calculated_price?: number | null
  final_price?: number | null
  pricing_mode?: 'master' | 'adjusted' | 'manual'
  quote_status?: 'fixed' | 'pending' | 'approved'
  manual_reason?: string | null
  selected_options?: import('@/types/repair').SelectedOptionSnapshot[]
  inputs?: Record<string, string | number>
  /** 一覧の展開表示用のラベル付きスナップショット（受付時に凍結） */
  input_details?: { label: string; value: string }[]
  received_by?: string | null
  strung_by?:   string | null
  /** FK埋め込みで引く担当スタッフ名 */
  received_by_staff?: { name: string } | null
  strung_by_staff?:   { name: string } | null
}

export interface PurchaseRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  item_name: string; maker: string | null; notes: string | null; status: PurchaseStatus
  price: number | null; ordered_date: string; arrived_date: string | null
  delivered_date: string | null; notified: boolean; request_no: number | null
  created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string; school_name: string | null } | null
}

export interface UniformOrderRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  maker: string | null
  priority: 'new_student' | 'normal'
  status: string; payment_status: string; total_amount: number | null
  notes: string | null; expected_delivery_date: string | null
  created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string; school_name: string | null } | null
  items?: { item_name: string; size_label: string | null; quantity: number; unit_price: number | null }[]
}

export interface UniformSizeEntry  { size: string | null; count: number; orders: UniformOrderRow[] }
export interface UniformItemEntry  { item_name: string; sizes: UniformSizeEntry[]; totalCount: number }
export interface UniformSchoolEntry{ school_name: string; items: UniformItemEntry[]; totalCount: number }
export interface UniformMakerEntry { maker: string; schools: UniformSchoolEntry[]; totalCount: number; allOrders: UniformOrderRow[] }

export interface DeliveryItem {
  id:             string
  kind:           'repair' | 'purchase'
  store_id:       string
  customer_id:    string
  child_id:       string | null
  item_name:      string
  sub_label:      string
  status:         string
  prev_status:    string
  request_no:     number | null
  received_date:  string
  ready_date:     string | null
  desired_completion_date: string | null
  delivered_date: string | null
  price:          number | null
  slip_number:    string | null
  notified:       boolean
  payment_status: string | null
  delivered_by:   string | null
  customer:       { name: string; tel: string | null } | null
  child:          { name: string; school_name: string | null } | null
}

export interface CustResult {
  id: string; name: string; tel: string | null; school_name: string | null
  created_at?: string | null
  children?: { id: string; name: string; school_name: string | null }[]
}

export interface CartItem {
  variantId: string | null
  productId: string | null
  productName: string
  category: string | null
  sizeLabel: string
  unitPrice: number
  qty: number
}

export interface SizeEntry  { size: string | null; count: number; orders: PurchaseRow[] }
export interface ItemEntry  { item_name: string; sizes: SizeEntry[]; totalCount: number }
export interface SchoolEntry{ school_name: string; items: ItemEntry[]; totalCount: number }
export interface MakerEntry { maker: string; schools: SchoolEntry[]; totalCount: number; allOrders: PurchaseRow[] }
