export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'

/**
 * POST /api/reserve/create
 * Body: { storeId, accessToken?, childId?, reservedAt, serviceType?, purpose?, notes? }
 *
 * 予約を作成する。accessToken があれば LINE 本人確認して顧客を紐づける。
 * ステータスは常に 'confirmed'(クライアント指定不可)。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, accessToken, reservedAt } = body
    if (!storeId || !reservedAt) {
      return NextResponse.json({ error: 'storeId / reservedAt が必要です' }, { status: 400 })
    }
    const when = new Date(reservedAt)
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: '日時が不正です' }, { status: 400 })
    }

    const supabase = createAdminClient({ noStore: true })

    let customerId: string | null = null
    let lineUserId: string | null = null
    let childId: string | null = null
    const line = await verifyLineAccessToken(accessToken)
    if (line) {
      lineUserId = line.userId
      const { data: rows } = await supabase
        .from('customers').select('id, deleted_at')
        .eq('store_id', storeId).eq('line_user_id', line.userId)
        .order('created_at', { ascending: false }).limit(1)
      if (rows?.[0] && !rows[0].deleted_at) {
        customerId = rows[0].id
        if (body.childId) {
          const { data: c } = await supabase
            .from('children').select('id')
            .eq('id', body.childId).eq('customer_id', customerId).maybeSingle()
          if (c) childId = c.id
        }
      }
    }

    const { error } = await supabase.from('reservations').insert({
      store_id:     storeId,
      customer_id:  customerId,
      child_id:     childId,
      line_user_id: lineUserId,
      reserved_at:  when.toISOString(),
      service_type: typeof body.serviceType === 'string' ? body.serviceType : null,
      purpose:      typeof body.purpose === 'string' ? body.purpose : null,
      status:       'confirmed',
      notes:        (typeof body.notes === 'string' && body.notes.trim()) || null,
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reserve/create]', err)
    return NextResponse.json({ error: '予約の送信に失敗しました。もう一度お試しください。' }, { status: 500 })
  }
}
