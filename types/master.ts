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
