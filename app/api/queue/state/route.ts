export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getTodayStart } from '@/lib/date'

/**
 * GET /api/queue/state?storeId=...&ticketId=...
 *
 * 順番待ちの公開状態を返す(ポーリング用)。
 * - waitingCount: 本日 waiting/calling の組数
 * - ticket:       ticketId 指定時のみ、そのチケット(UUID を知っている
 *                 本人だけが取得できる=能力ベアラー)
 * - waitingAhead: 自分より前の組数
 */
export async function GET(req: NextRequest) {
  try {
    const storeId = req.nextUrl.searchParams.get('storeId')
    const ticketId = req.nextUrl.searchParams.get('ticketId')
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })

    const supabase = createAdminClient({ noStore: true })

    const [{ data: store }, { count: waitingCount }] = await Promise.all([
      supabase.from('stores').select('is_open, active_fittings').eq('id', storeId).single(),
      supabase.from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).in('status', ['waiting', 'calling'])
        .gte('created_at', getTodayStart()),
    ])

    let ticket = null
    let waitingAhead: number | null = null
    if (ticketId) {
      const { data: t } = await supabase
        .from('queues').select('*').eq('id', ticketId).eq('store_id', storeId).maybeSingle()
      if (t) {
        ticket = t
        const { count } = await supabase
          .from('queues')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).in('status', ['waiting', 'calling'])
          .lt('ticket_number', t.ticket_number)
          .gte('created_at', getTodayStart())
        waitingAhead = count ?? 0
      }
    }

    return NextResponse.json({
      isOpen: store?.is_open !== false,
      activeFittings: store?.active_fittings ?? null,
      waitingCount: waitingCount ?? 0,
      ticket,
      waitingAhead,
    })
  } catch (err) {
    console.error('[queue/state]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
