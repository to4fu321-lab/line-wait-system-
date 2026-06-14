// ──────────────────────────────────────────────────────────────
//  お直し受付システム — 型定義
//  服種(GarmentType) > 項目(Item) > オプション(Option) のマスタと、
//  受付(Order) > 明細(OrderLine) > 写真(Photo) のトランザクション。
// ──────────────────────────────────────────────────────────────

// ── 共通 ──────────────────────────────────────────────────────
export type PriceUnit = 'per_item' | 'per_pair' | 'per_cm' | 'per_name'

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  per_item: '1点ごと',
  per_pair: '2点1組ごと',
  per_cm:   'cm単価',
  per_name: '1文字ごと',
}

// 採寸入力の定義（マスタ側で「受付時に聞く数値」を指定）
export interface MeasurementDef {
  key:       string   // inputs に格納するキー（例: hem_length_mm）
  label:     string   // 表示ラベル（例: 仕上がり丈）
  unit:      string   // 単位（例: mm / 文字）
  required?: boolean
}

// 特殊ケースのマニュアル（参考画像・注意書き）
export type ManualSeverity = 'info' | 'warn' | 'danger'

export interface RepairManual {
  title:    string
  body:     string
  severity: ManualSeverity
  images:   { path: string; caption?: string }[]
}

// ── マスタ：服種 ──────────────────────────────────────────────
export interface RepairGarmentType {
  id:         string
  store_id:   string
  code:       string
  name:       string
  icon:       string | null
  sort_order: number
  active:     boolean
  created_at: string
  updated_at: string
  // JOIN 時
  items?:     RepairItem[]
}

// ── マスタ：項目（= 基本料金） ────────────────────────────────
export interface RepairItem {
  id:              string
  store_id:        string
  garment_type_id: string
  code:            string          // hem/sleeve/waist/embroidery/badge/button/tear/other
  name:            string
  icon:            string | null
  base_price:      number
  price_unit:      PriceUnit
  measurements:    MeasurementDef[]
  manual:          RepairManual | null
  lead_time_days:  number | null
  requires_quote:  boolean
  sort_order:      number
  active:          boolean
  created_at:      string
  updated_at:      string
  // JOIN 時
  options?:        RepairOption[]
}

// ── マスタ：オプション（= 価格差分） ──────────────────────────
export interface RepairOption {
  id:               string
  store_id:         string
  item_id:          string
  group_label:      string | null   // 同ラベルでUIまとめ表示。null=単独
  group_select:     'single' | 'multi'
  code:             string
  name:             string
  price_delta:      number
  price_unit:       PriceUnit
  default_selected: boolean
  requires_quote:   boolean
  manual:           RepairManual | null
  sort_order:       number
  active:           boolean
  created_at:       string
  updated_at:       string
}

// ── トランザクション：受付伝票 ────────────────────────────────
export type RepairOrderStatus =
  | 'received' | 'in_progress' | 'completed' | 'delivered' | 'cancelled'

export const REPAIR_ORDER_STATUS_LABELS: Record<RepairOrderStatus, string> = {
  received:    '預かり中',
  in_progress: '作業中',
  completed:   '完了',
  delivered:   'お渡し済み',
  cancelled:   'キャンセル',
}

export type PaymentStatus = 'unpaid' | 'prepaid' | 'paid'

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid:  '未入金',
  prepaid: '前金あり',
  paid:    '入金済み',
}

export interface RepairOrder {
  id:                   string
  store_id:             string
  customer_id:          string
  child_id:             string | null
  slip_number:          string | null
  status:               RepairOrderStatus
  received_date:        string
  desired_date:         string | null
  completed_date:       string | null
  delivered_date:       string | null
  total_price:          number
  has_pending_quote:    boolean
  payment_status:       PaymentStatus
  notified:             boolean
  notes:                string | null
  internal_memo:        string | null
  vendor_name:          string | null
  sent_to_vendor_at:    string | null
  expected_return_date: string | null
  is_rework:            boolean
  rework_reason:        string | null
  created_by:           string | null
  created_at:           string
  updated_at:           string
  // JOIN 時
  customer?:            { id: string; name: string; tel: string | null; line_user_id: string | null }
  child?:               { name: string; school_name: string | null } | null
  lines?:               RepairOrderLine[]
  photos?:              RepairPhoto[]
}

// ── トランザクション：明細 ────────────────────────────────────
export type PricingMode = 'master' | 'adjusted' | 'manual'

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  master:   'マスタ価格',
  adjusted: '価格調整',
  manual:   '個別見積もり',
}

export type QuoteStatus = 'fixed' | 'pending' | 'approved'

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  fixed:    '確定',
  pending:  '見積もり待ち',
  approved: '見積もり確定（承認待ち）',
}

// 明細に保存するオプション選択のスナップショット
export interface SelectedOptionSnapshot {
  option_id:   string
  code:        string
  name:        string
  group_label: string | null
  price_delta: number
  price_unit:  PriceUnit
}

export interface RepairOrderLine {
  id:               string
  order_id:         string
  store_id:         string
  garment_type_id:  string | null
  item_id:          string | null
  garment_name:     string | null
  item_name:        string
  item_code:        string | null
  pricing_mode:     PricingMode
  base_price:       number
  calculated_price: number
  final_price:      number | null    // null = 見積もり待ち
  manual_reason:    string | null
  quote_status:     QuoteStatus
  inputs:           Record<string, string | number>
  options:          SelectedOptionSnapshot[]
  qty:              number
  notes:            string | null
  sort_order:       number
  created_at:       string
  updated_at:       string
}

// ── トランザクション：実績写真 ────────────────────────────────
export type RepairPhotoPhase = 'intake' | 'before' | 'after' | 'rework' | 'delivery'

export const REPAIR_PHOTO_PHASE_LABELS: Record<RepairPhotoPhase, string> = {
  intake:   '受付前',
  before:   '加工前',
  after:    '完成',
  rework:   '再加工',
  delivery: 'お渡し',
}

export interface RepairPhoto {
  id:         string
  store_id:   string
  order_id:   string
  line_id:    string | null
  phase:      RepairPhotoPhase
  path:       string
  url:        string | null
  note:       string | null
  taken_by:   string | null
  created_at: string
}

export const REPAIR_PHOTOS_BUCKET = 'repair-photos'
