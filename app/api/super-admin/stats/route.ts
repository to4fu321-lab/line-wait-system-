export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, {
    global: { fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: 'no-store' }) },
  })
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
  try {
    const supabase = getSupabase()

    const [{ data: stores, error }, { data: groups }] = await Promise.all([
      supabase.from('stores').select('*').order('name', { ascending: true }),
      supabase.from('groups').select('*').order('name', { ascending: true }),
    ])

    if (error) {
      return NextResponse.json({ error: error.message || 'stores query failed' }, { status: 500 })
    }

    if (!stores || stores.length === 0) {
      return NextResponse.json({ stats: [], groups: [] })
    }

    const todayStart = getTodayStart()

    const stats = await Promise.all(
      stores.map(async (store) => {
        const isTakeout = (store as { business_type?: string }).business_type === 'takeout'

        const [{ data: queues }, { data: repairs }, { data: purchases }, { data: takeoutActive }, { data: takeoutDone }] = await Promise.all([
          supabase.from('queues').select('status').eq('store_id', store.id).gte('created_at', todayStart),
          supabase.from('repair_histories').select('status').eq('store_id', store.id).in('status', ['received', 'completed']),
          supabase.from('purchase_orders').select('status').eq('store_id', store.id).eq('status', 'arrived'),
          isTakeout
            ? supabase.from('takeout_orders').select('status').eq('store_id', store.id).in('status', ['pending', 'preparing', 'ready'])
            : Promise.resolve({ data: [] }),
          isTakeout
            ? supabase.from('takeout_orders').select('id').eq('store_id', store.id).eq('status', 'completed').gte('created_at', todayStart)
            : Promise.resolve({ data: [] }),
        ])

        const rows = queues ?? []
        const r    = repairs ?? []
        const p    = purchases ?? []
        const ta   = (takeoutActive ?? []) as { status: string }[]
        const td   = (takeoutDone   ?? []) as { id: string }[]

        return {
          store,
          waiting:               rows.filter(q => q.status === 'waiting').length,
          calling:               rows.filter(q => q.status === 'calling').length,
          completed:             rows.filter(q => q.status === 'completed').length,
          total:                 rows.length,
          repairPending:         r.filter(x => x.status === 'received').length,
          deliveryWaiting:       r.filter(x => x.status === 'completed').length + p.length,
          takeoutPending:        ta.filter(o => o.status === 'pending').length,
          takeoutPreparing:      ta.filter(o => o.status === 'preparing').length,
          takeoutReady:          ta.filter(o => o.status === 'ready').length,
          takeoutCompletedToday: td.length,
        }
      })
    )

    return NextResponse.json({ stats, groups: groups ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

