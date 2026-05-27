export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ffbixfbddxguhdhayqqy.supabase.co'
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYml4ZmJkZHhndWhkaGF5cXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzk3MjksImV4cCI6MjA5NDcxNTcyOX0.F2YjXfFE148wL6kh93WMzKF68SBf-pIYIxGImMMUnFk'
  return createClient(url, key)
}

function getTodayStart() {
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(Date.now() + jstOffset)
  const midnight = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
  )
  return midnight.toISOString()
}

export async function GET() {
  const supabase = getSupabase()

  const { data: stores, error } = await supabase
    .from('stores')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!stores || stores.length === 0) {
    return NextResponse.json({ stats: [] })
  }

  const todayStart = getTodayStart()

  const stats = await Promise.all(
    stores.map(async (store) => {
      const { data: queues } = await supabase
        .from('queues')
        .select('status')
        .eq('store_id', store.id)
        .gte('created_at', todayStart)

      const rows = queues ?? []
      return {
        store,
        waiting:   rows.filter(q => q.status === 'waiting').length,
        calling:   rows.filter(q => q.status === 'calling').length,
        completed: rows.filter(q => q.status === 'completed').length,
        total:     rows.length,
      }
    })
  )

  return NextResponse.json({ stats })
}
