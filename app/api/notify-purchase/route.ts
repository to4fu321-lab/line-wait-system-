export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'

// 発注通知は制服販売店専用 → uniform アカウントで通知
const TOKEN    = getLineToken('uniform')
const LIFF_URL = getLiffBaseUrl('uniform')

export async function POST(req: NextRequest) {
  let purchaseOrderId: string | undefined

  try {
    const body = await req.json()
    purchaseOrderId = body.purchaseOrderId
  } catch (e) {
    return NextResponse.json({ ok: false, error: `body parse error: ${String(e)}` }, { status: 400 })
  }

  if (!purchaseOrderId) {
    return NextResponse.json({ ok: false, error: 'purchaseOrderId is required' }, { status: 400 })
  }

  const { data: order, error: orderErr } = await supabase
    .from('purchase_orders')
    .select(`
      id, item_name, notes, price,
      customer:customers ( name, line_user_id ),
      store:stores ( id, name )
    `)
    .eq('id', purchaseOrderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ ok: false, error: `order not found: ${orderErr?.message}` }, { status: 404 })
  }

  const customer = order.customer as { name: string; line_user_id: string | null } | null
  const store    = order.store    as { id: string; name: string } | null

  if (!customer?.line_user_id) {
    console.log(`[notify-purchase] LINE未連携 → skip (order: ${purchaseOrderId})`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no line_user_id' })
  }

  const storeName  = store?.name ?? ''
  const storeLabel = storeName ? `【${storeName}】` : ''
  const priceText  = order.price != null ? `\n金額：¥${order.price.toLocaleString()}` : ''
  const notesText  = order.notes ? `\n${order.notes}` : ''
  const storeUrl   = store?.id ? `\n\n▼ 店舗ページ\n${LIFF_URL}/${store.id}` : ''

  const messageText =
    `📦 ご注文の商品が入荷しました！\n\n${storeLabel}\n${customer.name} 様\n\n` +
    `${order.item_name}${priceText}${notesText}\n\n` +
    `お手数ですが、ご来店の上お受け取りをお願いいたします。\n` +
    `スタッフがお待ちしております。${storeUrl}`

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        to:       customer.line_user_id,
        messages: [{ type: 'text', text: messageText }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[notify-purchase] LINE API Error:', err)
      return NextResponse.json({ ok: false, error: `LINE API ${res.status}: ${err}` }, { status: 500 })
    }

    await supabase
      .from('purchase_orders')
      .update({ notified: true })
      .eq('id', purchaseOrderId)

    console.log(`[notify-purchase] 通知送信 order=${purchaseOrderId} customer=${customer.name}`)
    return NextResponse.json({ ok: true, notified: true })
  } catch (e) {
    console.error('[notify-purchase] LINE fetch error:', e)
    return NextResponse.json({ ok: false, error: `LINE fetch error: ${String(e)}` }, { status: 500 })
  }
}
