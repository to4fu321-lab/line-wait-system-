import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

function toValidUrl(raw: string | undefined): string {
  const s = (raw ?? '').trim()
  if (s.startsWith('https://') || s.startsWith('http://')) return s
  if (s) return `https://${s}`
  return 'https://placeholder.supabase.co'
}

const supabaseUrl     = toValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim() || 'placeholder-anon-key'

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  { realtime: { params: { eventsPerSecond: 10 } } }
)

// 後方互換のための再エクスポート（実装は lib/date.ts）
export { getTodayStart } from '@/lib/date'
