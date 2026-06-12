export interface School {
  id: string
  store_id: string
  name: string
  kana: string
  notes: string
  created_at: string
  updated_at: string
  updated_by: string
}

export interface SchoolGrade {
  id: string
  school_id: string
  grade_name: string   // 例: '1年生', '2年生'
  color_name: string   // 例: '赤', 'ネイビー'
  color_hex: string    // 例: '#DC2626'（空文字可）
  sort_order: number
  created_at: string
  updated_at: string
  updated_by: string
}

export interface SchoolItem {
  id: string
  school_id: string
  name: string
  required: boolean
  price_tax_in: number | null
  price_tax_out: number | null
  size_spec: string
  product_code: string
  growth_adjust: boolean
  washable: string
  avg_qty: number | null
  uses_grade_color: boolean
  grade_color_note: string
  item_notes: string
  sort_order: number
  created_at: string
  updated_at: string
  updated_by: string
}

export interface SchoolParentTip {
  id: string
  school_id: string
  store_id: string
  item_name: string
  tip_text: string
  line_uid: string
  approved: boolean
  created_at: string
  updated_at: string
  updated_by: string
}

export interface Coupon {
  id: string
  store_id: string
  code: string
  label: string
  discount: string
  valid_until: string | null
  issued_to: string
  used: boolean
  used_at: string | null
  created_at: string
  updated_at: string
  updated_by: string
}

// API レスポンス型
export interface SchoolWithCounts extends School {
  item_count: number
  grade_count: number
}

export interface SchoolDetail extends School {
  items: SchoolItem[]
  grades: SchoolGrade[]
}

// OCR API レスポンス
export interface OcrResultItem {
  name: string
  required: boolean
  price_tax_in: number | null
  price_tax_out: number | null
  size_spec: string
  product_code: string
  growth_adjust: boolean
  washable: string
  uses_grade_color: boolean
  grade_color_note: string
  item_notes: string
  confidence: 'high' | 'low'  // lowのとき⚠表示
}

export interface OcrResult {
  items: OcrResultItem[]
  notes: string        // 学校全体の注意事項
  raw_text: string     // デバッグ用
}
