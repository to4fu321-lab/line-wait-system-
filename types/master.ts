// ──────────────────────────────────────────────────────────────
// 学校マスタ
// ──────────────────────────────────────────────────────────────
export interface School {
  id:          string
  store_id:    string
  name:        string
  short_name:  string | null
  sort_order:  number
  active:      boolean
  created_at:  string
  updated_at:  string
}

// ──────────────────────────────────────────────────────────────
// 商品マスタ（学校ごとに独立レコード）
// 重要: maker_code に UNIQUE 制約なし —— 同品番でも学校が違えば別商品
// ──────────────────────────────────────────────────────────────
export interface SchoolProduct {
  id:               string
  store_id:         string
  school_id:        string
  item_name:        string
  maker:            string | null   // メーカー名（例：トンボ、スクールフォーラム）
  maker_code:       string | null   // メーカー品番（重複許可）
  color_code:       string | null   // 色番
  category:         string | null
  gender:           string | null
  notes:            string | null
  barcode:          string | null   // JAN/EAN/QRコード・バーコード値
  sort_order:       number
  active:           boolean
  // 規定品フィールド（学校ごとの採寸ルール）
  required:         boolean         // 必須品かどうか
  avg_qty:          number | null   // 平均購入点数
  uses_grade_color: boolean         // 学年によって色が変わる
  grade_color_note: string          // 学年色メモ
  eo_price_tax_in:  number | null   // EO（別寸）税込価格
  eo_price_tax_out: number | null   // EO（別寸）税抜価格
  created_at:       string
  updated_at:       string
  // JOIN 時のリレーション
  school?:          School
  variants?:        SchoolProductVariant[]
}

// ──────────────────────────────────────────────────────────────
// サイズ・価格マスタ（SchoolProduct のバリエーション）
// 例: ○○中学校の SL-100 / 160cm → ¥8,800
//     △△高校の  SL-100 / 160cm → ¥9,300  （同品番・別価格）
// ──────────────────────────────────────────────────────────────
export interface SchoolProductVariant {
  id:          string
  product_id:  string
  store_id:    string
  size_label:  string        // 例: 150, 155, M, L, 170B
  price:       number        // 販売価格（円）
  cost:        number | null // 仕入価格（円）
  stock:       number        // 在庫数
  active:      boolean
  sort_order:  number
  created_at:  string
  updated_at:  string
}

// ──────────────────────────────────────────────────────────────
// 選択肢定数
// ──────────────────────────────────────────────────────────────
export const PRODUCT_CATEGORY_OPTIONS = [
  '制服（上着）',
  'スラックス・スカート',
  'シャツ・ブラウス',
  'セーター・ベスト',
  'ネクタイ・リボン',
  '体操着',
  '上靴',
  'カバン・バッグ',
  'その他',
] as const

export const PRODUCT_GENDER_OPTIONS = ['男子用', '女子用', '男女共通'] as const

// 体型区分(全国共通規格)。号数(W○/cm)と組み合わせて学生服のサイズを表す。
export const BODY_TYPE_OPTIONS = [
  { value: 'Y', label: 'Y体', desc: 'やせ型' },
  { value: 'A', label: 'A体', desc: '標準' },
  { value: 'B', label: 'B体', desc: 'がっちり' },
] as const

// 加工オプションの入力タイプ
export const PROCESSING_INPUT_TYPE_OPTIONS = [
  { value: 'toggle', label: '有無(チェック)' },
  { value: 'text',   label: '文字入力(刺繍名など)' },
  { value: 'length', label: '寸法入力(裾上げcmなど)' },
  { value: 'select', label: '選択肢から選ぶ' },
] as const

// ══════════════════════════════════════════════════════════════
// ▼▼ 再設計マスタ(正規化スキーマ。docs/master-data-redesign.md) ▼▼
//    旧 SchoolProduct/SchoolProductVariant は互換ビュー用に残置。
//    新規開発は以下の正規化型を使用する。
// ══════════════════════════════════════════════════════════════

// 1. 学校マスタ(再設計版。kana/notes を含む)
export interface SchoolMaster {
  id:         string
  store_id:   string
  name:       string
  kana:       string
  short_name: string
  sort_order: number
  active:     boolean
  notes:      string
  created_at: string
  updated_at: string
}

// 3. サイズセットマスタ(メーカーごとのサイズ規格)
export interface SizeSet {
  id:          string
  store_id:    string
  supplier_id: string | null
  name:        string
  category:    string | null
  notes:       string | null
  active:      boolean
  sort_order:  number
  created_at:  string
  updated_at:  string
  items?:      SizeSetItem[]
}

export interface SizeSetItem {
  id:          string
  size_set_id: string
  label:       string
  sort_order:  number
}

// 2. 商品マスタ(自由商品 school_id=null / 学校別注品)
export interface ProductMaster {
  id:                 string
  store_id:           string
  school_id:          string | null   // null=自由商品(全校共通)
  name:               string
  category:           string | null
  gender:             string | null
  supplier_id:        string | null
  maker:              string | null
  maker_code:         string | null
  color_code:         string | null
  barcode:            string | null
  washable:           string | null
  size_set_id:        string | null
  body_types:         string[]         // 対応体型(Y/A/B)。空=体型区分なし
  base_price_tax_in:  number | null
  base_price_tax_out: number | null
  notes:              string | null
  active:             boolean
  sort_order:         number
  created_at:         string
  updated_at:         string
  size_set?:          SizeSet | null
  school?:            SchoolMaster | null
}

// 6. 新品加工オプションマスタ(刺繍・裾上げ・校章等)
//    お直し(repair_*)とは別概念=新品購入時の加工。
//    applies_to_category が空なら全商品、値ありなら該当カテゴリ商品に自動提示。
export interface ProcessingOption {
  id:                  string
  store_id:            string
  name:                string
  input_type:          string          // toggle/text/length/select
  unit:                string | null   // 例: cm
  default_price:       number | null
  required:            boolean          // 標準で付帯(必須加工)
  applies_to_category: string[]        // 連動カテゴリ(空=全商品)
  choices:             string[]        // input_type=select の選択肢
  notes:               string | null
  sort_order:          number
  is_active:           boolean
  created_at:          string
  updated_at:          string
}

// 4. 学校別規程マスタ(School × Product)
export interface SchoolRequirement {
  id:               string
  store_id:         string
  school_id:        string
  product_id:       string
  required:         boolean
  avg_qty:          number | null
  uses_grade_color: boolean
  grade_color_note: string
  item_notes:       string
  sort_order:       number
  created_at:       string
  updated_at:       string
  product?:         ProductMaster
}

// 5. 価格マスタ(School × Product × サイズ・別寸EO)
export interface Price {
  id:               string
  store_id:         string
  school_id:        string
  product_id:       string
  size_set_item_id: string | null
  size_label:       string | null
  price_tax_in:     number
  price_tax_out:    number | null
  cost:             number | null
  is_eo:            boolean
  valid_from:       string | null
  active:           boolean
  sort_order:       number
  created_at:       string
  updated_at:       string
}

export const WASHABLE_OPTIONS = [
  { value: 'washable', label: '洗濯機OK' },
  { value: 'hand',     label: '手洗い' },
  { value: 'dry',      label: 'ドライのみ' },
  { value: 'none',     label: '不可' },
] as const

export const SIZE_SET_CATEGORY_OPTIONS = [
  { value: 'tops',    label: '上衣' },
  { value: 'bottoms', label: '下衣' },
  { value: 'shoes',   label: '靴' },
  { value: 'general', label: '汎用' },
] as const

// 採寸シート行(getMeasurementSheet の戻り値)
export interface MeasurementRow extends SchoolRequirement {
  product: ProductMaster & { size_set?: SizeSet | null }
  sizes:   { item_id: string | null; label: string; price_tax_in: number | null }[]
  eo_price_tax_in: number | null
}

// ──────────────────────────────────────────────────────────────
// スタッフマスタ
// ──────────────────────────────────────────────────────────────
export interface Staff {
  id:          string
  store_id:    string
  name:        string
  kana:        string | null  // ふりがな
  role:        string | null  // 役職
  color:       string | null  // 表示カラー (#hex)
  pin:         string | null  // 4桁PIN（個人識別用）
  active:      boolean
  sort_order:  number
  created_at:  string
  updated_at:  string
}

export const STAFF_ROLE_OPTIONS = [
  '店長', 'リーダー', 'スタッフ', 'パート', 'アルバイト',
] as const

export const STAFF_COLOR_OPTIONS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate
] as const
