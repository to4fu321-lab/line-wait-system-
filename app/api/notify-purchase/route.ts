export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'
import { pushCard } from '@/lib/line-flex'

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
      id, item_name, notes, price, request_no,
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
  const reqNo      = (order as any).request_no != null
    ? `P-${String((order as any).request_no).padStart(4, '0')}`
    : null
  const bodyLines = [
    order.item_name,
    order.price != null ? `金額：¥${order.price.toLocaleString()}` : null,
    order.notes ? order.notes : null,
    reqNo ? `依頼番号：${reqNo}` : null,
  ].filter(Boolean) as string[]
  const storeUrl   = store?.id ? `${LIFF_URL}/${store.id}` : undefined

  const result = await pushCard(TOKEN, customer.line_user_id, `入荷のお知らせ ${customer.name} 様`, {
    kind: 'ready',
    title: 'ご注文の商品が入荷しました',
    storeName: storeName || undefined,
    customerName: customer.name,
    bodyLines: bodyLines.length ? bodyLines : undefined,
    note: '依頼番号をお伝えの上、ご来店でお受け取りをお願いいたします。\nスタッフがお待ちしております。',
    buttonLabel: storeUrl ? '店舗ページを開く' : undefined,
    buttonUrl: storeUrl,
  })

  if (!result.ok) {
    console.error('[notify-purchase] LINE API Error:', result.error)
    return NextResponse.json({ ok: false, error: `LINE API ${result.status ?? ''}: ${result.error}` }, { status: 500 })
  }

  await supabase
    .from('purchase_orders')
    .update({ notified: true })
    .eq('id', purchaseOrderId)

  console.log(`[notify-purchase] 通知送信 order=${purchaseOrderId} customer=${customer.name}`)
  return NextResponse.json({ ok: true, notified: true })
}
