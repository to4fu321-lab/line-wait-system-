export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getLineToken, storeBizType } from '@/lib/line-config'
import { pushCard, type CardOptions } from '@/lib/line-flex'
import { rateLimit, RATE_LIMITED_BODY } from '@/lib/rateLimit'

/**
 * POST /api/notify-reservation
 * Body: { storeId, reservationId, type: 'called' }
 *
 * 予約(reservations)の呼び出しをLINEに通知する。
 * 通常の順番待ち(queues)は /api/notify が呼び出し通知を送るが、
 * 予約管理画面の「呼出す」はこのAPIを一度も呼んでおらず、
 * ステータスを 'called' に更新するだけでLINE通知が送られていなかった。
 *
 * reservationId から line_user_id・氏名・店舗名をサーバー側で引き直す
 * （クライアントの値をそのまま信用しない。なりすまし対策も兼ねる）。
 */
export async function POST(req: NextRequest) {
  try {
    const { storeId, reservationId } = await req.json()
    if (!storeId || !reservationId) {
      return NextResponse.json({ ok: false, error: 'storeId / reservationId が必要です' }, { status: 400 })
    }

    if (!rateLimit(`notify-reservation:${storeId}`, 60, 60_000)) {
      return NextResponse.json(RATE_LIMITED_BODY, { status: 429 })
    }

    const supabase = createAdminClient()

    const { data: res } = await supabase
      .from('reservations')
      .select('line_user_id, customer_name, store_id, customer_id, child_id')
      .eq('id', reservationId).eq('store_id', storeId).single()

    if (!res) {
      return NextResponse.json({ ok: false, error: '予約が見つかりません' }, { status: 404 })
    }
    const lineUserId = (res as { line_user_id: string | null }).line_user_id
    if (!lineUserId) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_line_user_id' })
    }

    let customerName = (res as { customer_name: string | null }).customer_name ?? ''
    const childId = (res as { child_id: string | null }).child_id
    if (childId) {
      const { data: child } = await supabase.from('children').select('name').eq('id', childId).maybeSingle()
      if (child?.name) customerName = child.name
    } else {
      const customerId = (res as { customer_id: string | null }).customer_id
      if (customerId) {
        const { data: customer } = await supabase.from('customers').select('name').eq('id', customerId).maybeSingle()
        if (customer?.name) customerName = customer.name
      }
    }

    const { data: store } = await supabase
      .from('stores').select('name, is_test_mode, business_type').eq('id', storeId).single()
    if (store?.is_test_mode) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'test_mode' })
    }

    const token = getLineToken(storeBizType(store?.business_type))
    if (process.env.LINE_NOTIFY_DISABLED === 'true') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'disabled' })
    }

    const card: CardOptions = {
      kind: 'call',
      title: 'お呼び出し中です',
      storeName: store?.name ?? '',
      customerName,
      note: 'カウンターへお越しください。\nこの画面をスタッフにお見せください。',
    }
    const altText = `お呼び出し ${customerName ?? ''} 様`

    const result = await pushCard(token, lineUserId, altText, card)
    if (!result.ok) {
      console.error('[notify-reservation] LINE API Error', result.status, result.error)
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify-reservation]', err)
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 })
  }
}
