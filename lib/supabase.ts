import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Strip any path suffix (e.g. /rest/v1/) — only the origin is needed
let supabaseUrl = rawUrl.trim()
try {
  supabaseUrl = new URL(supabaseUrl).origin
} catch {
  // non-URL value; fall through to placeholder
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
  console.error('[Supabase] createClient failed, using placeholder:', err)
  supabaseClient = createClient<Database>(FALLBACK_URL, FALLBACK_KEY)
}

export const supabase = supabaseClient

export function getTodayStart(): string {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  jst.setHours(0, 0, 0, 0)
  return jst.toISOString()
}

export const _diagnostics = {
  rawUrl,
  parsedUrl: supabaseUrl,
  keyLength: rawKey.length,
  keyPrefix: rawKey.slice(0, 20),
}
