export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'
import { pushCard } from '@/lib/line-flex'

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
  const supabase = createAdminClient()

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
  const bodyLines  = (order.items as { item_name: string; quantity: number }[] ?? [])
    .map(i => `${i.item_name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
  if (order.total_amount != null) bodyLines.push(`合計：¥${order.total_amount.toLocaleString()}`)
  if (order.notes) bodyLines.push(`備考：${order.notes}`)
  const storeUrl = store?.id ? `${LIFF_URL}/${store.id}` : undefined

  const result = await pushCard(TOKEN, customer.line_user_id, `制服ご注文受付 ${customer.name} 様`, {
    kind: 'order',
    title: '制服のご注文を受け付けました',
    storeName: storeName || undefined,
    customerName: customer.name,
    bodyLines: bodyLines.length ? bodyLines : undefined,
    steps: [{ label: 'ご注文受付' }, { label: '商品準備中' }, { label: '入荷・準備完了' }, { label: 'お渡し' }],
    currentStep: 0,
    note: '商品の準備ができましたらご連絡いたします。\nしばらくお待ちください。',
    buttonLabel: storeUrl ? '店舗ページを開く' : undefined,
    buttonUrl: storeUrl,
  })

  if (!result.ok) {
    console.error('[notify-uniform] LINE API Error:', result.error)
    return NextResponse.json({ ok: false, error: `LINE API ${result.status ?? ''}: ${result.error}` }, { status: 500 })
  }

  console.log(`[notify-uniform] 通知送信 order=${uniformOrderId} customer=${customer.name}`)
  return NextResponse.json({ ok: true, notified: true })
}
