import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// env vars が未設定のままだと createClient が throw するため fallback を用意
const FALLBACK_URL = 'https://placeholder.supabase.co'
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder'

export const supabase = createClient<Database>(
  supabaseUrl  || FALLBACK_URL,
  supabaseAnonKey || FALLBACK_KEY
)

export function getTodayStart(): string {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  jst.setHours(0, 0, 0, 0)
  return jst.toISOString()
}
