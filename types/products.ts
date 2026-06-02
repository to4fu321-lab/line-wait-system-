export interface Product {
  id: string
  store_id: string
  code: string | null
  name: string
  category: string | null
  maker: string | null
  gender: string | null
  sizes: string[]
  price: number | null
  notes: string | null
  is_active: boolean
  school_names: string[]
  created_at: string
  updated_at: string
}

export const CATEGORY_OPTIONS = ['制服', '体操着', '上靴', 'カバン', 'その他'] as const
export const GENDER_OPTIONS   = ['男', '女', '共通'] as const
