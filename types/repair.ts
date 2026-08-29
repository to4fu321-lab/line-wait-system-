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

// 単価方式の説明＋具体例（マスタUIのヒント表示用）
export const PRICE_UNIT_HELP: Record<PriceUnit, { desc: string; example: string }> = {
  per_item: { desc: '料金 × 点数（一番ふつう）',                 example: '裾上げ1,200円 × 3点 = 3,600円' },
  per_name: { desc: '料金 × 文字数（空白は除く）',               example: '1文字100円 × 「山田太郎」5文字 = 500円' },
  per_pair: { desc: '（上級）2点1組の料金。計算は1点ごとと同じ', example: '手袋の補修 2点で800円' },
  per_cm:   { desc: '（上級）長さで課金。受付で長さ入力が必要',  example: 'テープ貼り 1cmあたり50円' },
}

// マスタUIで選びやすい並び順（よく使う2つを上に）
export const PRICE_UNIT_ORDER: PriceUnit[] = ['per_item', 'per_name', 'per_pair', 'per_cm']

// 採寸入力の定義（マスタ側で「受付時に聞く数値」を指定）
// ※ 後方互換のため残す。新規は FieldDef を使う（MeasurementDef は FieldDef の部分集合）。
export interface MeasurementDef {
  key:       string   // inputs に格納するキー（例: hem_length_mm）
  label:     string   // 表示ラベル（例: 仕上がり丈）
  unit:      string   // 単位（例: mm / 文字）
  required?: boolean
}

// ── 入力フィールド定義（MeasurementDef の一般化） ─────────────
//  制服の「採寸」だけでなく、ラケットの「ポンド数」「持ち込みガット」など
//  業種ごとに違う入力を、コードではなくマスタ側で定義できるようにする。
export type FieldType = 'text' | 'number' | 'select' | 'bool' | 'material'

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:     '自由入力',
  number:   '数値',
  select:   '選択肢',
  bool:     'はい / いいえ',
  material: '商品から選ぶ',
}

export interface FieldChoice {
  value:        string
  label:        string
  price_delta?: number   // 選ぶと加算される額（Phase 2 で価格計算に参入）
}

export interface FieldDef {
  key:       string
  label:     string
  type?:     FieldType         // 省略時 'text' = 従来の measurements と同じ挙動
  unit?:     string
  required?: boolean
  default?:  string | number | boolean
  // type='number' のガード（例: バドミントンのポンド数 15〜30）
  min?:      number
  max?:      number
  step?:     number
  // type='select'
  choices?:  FieldChoice[]
  // type='material'（Phase 2: products から選ぶ。category で絞る）
  material_category?: string
  // 価格計算に参入するか（Phase 2）
  affects_price?: boolean
  // 補足説明（受付画面でラベル下に小さく出す）
  hint?:     string
  // 同じお客様の過去の入力値を候補として出す（type='text' 用）。
  // ラケットの機種など「毎回同じだが店では覚えられない」値の再入力を省く。
  suggest_from_history?: boolean
  // タップで先頭に差し込む定型語（type='text' 用）。メーカー名など。
  // select と違い排他ではなく、続きは自由入力できる。
  suggest_choices?: string[]
}

// measurements（旧）を FieldDef（新）に正規化する。
//  - fields が入っていればそれを使う
//  - 空なら measurements を FieldDef として読む（mm/cm は数値扱い）
const NUMERIC_UNITS = ['mm', 'cm', '度', '℃']

export function toFieldDefs(
  fields?: FieldDef[] | null,
  measurements?: MeasurementDef[] | null,
): FieldDef[] {
  if (fields && fields.length > 0) return fields
  if (!measurements || measurements.length === 0) return []
  return measurements.map(m => ({
    ...m,
    type: (NUMERIC_UNITS.includes(m.unit) ? 'number' : 'text') as FieldType,
  }))
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
  measurements:    MeasurementDef[]   // 旧。読み取りは toFieldDefs() 経由で
  fields:          FieldDef[]         // 新。受付で聞く入力定義
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
  fields:           FieldDef[]        // 選択時に追加で聞く入力
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
