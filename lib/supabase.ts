import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

let supabaseUrl = rawUrl.trim()
try {
  supabaseUrl = new URL(supabaseUrl).origin
} catch {
  // invalid URL; fall through to fallback
}

const supabaseAnonKey = rawKey.trim()

const FALLBACK_URL = 'https://ffbixfbddxguhdhayqqy.supabase.co'
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYml4ZmJkZHhndWhkaGF5cXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzk3MjksImV4cCI6MjA5NDcxNTcyOX0.F2YjXfFE148wL6kh93WMzKF68SBf-pIYIxGImMMUnFk'

let supabaseClient: ReturnType<typeof createClient<Database>>
try {
  supabaseClient = createClient<Database>(
    supabaseUrl || FALLBACK_URL,
    supabaseAnonKey || FALLBACK_KEY,
    { realtime: { params: { eventsPerSecond: 10 } } }
  )
} catch (err) {
  console.error('[Supabase] createClient failed, using fallback:', err)
  supabaseClient = createClient<Database>(FALLBACK_URL, FALLBACK_KEY)
}

export const supabase = supabaseClient

export function getTodayStart(): string {
  const jstOffset = 9 * 60 * 60 * 1000 // UTC+9
  const jstNow = new Date(Date.now() + jstOffset)
  const jstMidnightUTC = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
  )
  return jstMidnightUTC.toISOString()
}
