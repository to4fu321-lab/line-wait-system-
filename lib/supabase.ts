import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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

export function getTodayStart(): string {
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(Date.now() + jstOffset)
  const jstMidnightUTC = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
  )
  return jstMidnightUTC.toISOString()
}
