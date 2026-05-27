import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

// ビルド時に env var が未評価でも createClient がクラッシュしないようダミーURLを使う
// 実際のリクエスト時は必ず本物の値が入るため、ダミーが使われることはない
export const supabase = createClient<Database>(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { realtime: { params: { eventsPerSecond: 10 } } }
)

export function getTodayStart(): string {
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(Date.now() + jstOffset)
  const jstMidnightUTC = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
  )
  return jstMidnightUTC.toISOString()
}
