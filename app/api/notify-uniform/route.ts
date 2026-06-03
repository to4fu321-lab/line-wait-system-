export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'

const TOKEN    = getLineToken('uniform')
const LIFF_URL = getLiffBaseUrl('uniform')

export async function POST(req: NextRequest) {
  let uniformOrderId: string | undefined

  try {
    const body = await req.json()
    uniformOrderId = body.uniformOrderId
  } catch (e) {
    return NextResponse.json({ ok: false, error: `body parse error: ${String(e)}` }, { status: 400 })
  }

  if (!uniformOrderId) {
    return NextResponse.json({ ok: false, error: 'uniformOrderId is required' }, { status: 400 })
  }

  const { data: order, error: orderErr } = await (supabase as any)
    .from('uniform_orders')
    .select(`
      id, total_amount, notes,
      customer:customers ( name, line_user_id ),
      store:stores ( id, name ),
      items:uniform_order_items ( item_name, quantity )
    `)
    .eq('id', uniformOrderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ ok: false, error: `order not found: ${orderErr?.message}` }, { status: 404 })
  }

  const customer = order.customer as { name: string; line_user_id: string | null } | null
  const store    = order.store    as { id: string; name: string } | null

  if (!customer?.line_user_id) {
    console.log(`[notify-uniform] LINE未連携 → skip (order: ${uniformOrderId})`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no line_user_id' })
  }

  const storeName  = store?.name ?? ''
  const storeLabel = storeName ? `【${storeName}】` : ''
  const itemLines  = (order.items as { item_name: string; quantity: number }[] ?? [])
    .map(i => `・${i.item_name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
    .join('\n')
  const priceText  = order.total_amount != null ? `\n合計：¥${order.total_amount.toLocaleString()}` : ''
  const notesText  = order.notes ? `\n備考：${order.notes}` : ''
  const storeUrl   = store?.id ? `\n\n▼ 店舗ページ\n${LIFF_URL}/${store.id}` : ''

  const messageText =
    `📋 制服のご注文を受け付けました！\n\n${storeLabel}\n${customer.name} 様\n\n` +
    `${itemLines}${priceText}${notesText}\n\n` +
    `商品の準備ができましたらご連絡いたします。\n` +
    `しばらくお待ちください。${storeUrl}`

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
      console.error('[notify-uniform] LINE API Error:', err)
      return NextResponse.json({ ok: false, error: `LINE API ${res.status}: ${err}` }, { status: 500 })
    }

    console.log(`[notify-uniform] 通知送信 order=${uniformOrderId} customer=${customer.name}`)
    return NextResponse.json({ ok: true, notified: true })
  } catch (e) {
    console.error('[notify-uniform] LINE fetch error:', e)
    return NextResponse.json({ ok: false, error: `LINE fetch error: ${String(e)}` }, { status: 500 })
  }
}
