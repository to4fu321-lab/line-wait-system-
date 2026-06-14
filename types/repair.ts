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

export const MANUAL_SEVERITY_LABELS: Record<ManualSeverity, string> = {
  info: '案内', warn: '注意', danger: '要確認',
}

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

// ── トランザクション：価格モード（取引は repair_histories フラット1行） ──
//  受付の取引行そのものの型は app/[storeId]/admin/repairs/_components/types.ts の
//  RepairRow が担う（既存アプリ互換）。ここでは再構築で追加した「価格モード・
//  見積もり状態・オプションスナップショット」の共通型のみ定義する。
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

// 取引行(selected_options)に保存するオプション選択のスナップショット
export interface SelectedOptionSnapshot {
  option_id:   string
  code:        string
  name:        string
  group_label: string | null
  price_delta: number
  price_unit:  PriceUnit
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
  repair_id:  string            // repair_histories.id
  phase:      RepairPhotoPhase
  path:       string
  url:        string | null
  note:       string | null
  taken_by:   string | null
  created_at: string
}

export const REPAIR_PHOTOS_BUCKET = 'repair-photos'
