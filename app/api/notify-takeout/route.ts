import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''

export async function POST(req: NextRequest) {
  try {
    const { orderId, status } = await req.json()
    if (!orderId || !status) {
      return NextResponse.json({ ok: false, reason: 'invalid_params' }, { status: 400 })
    }

    const { data: order } = await supabase
      .from('takeout_orders')
      .select('*, store:stores(name, takeout_settings)')
      .eq('id', orderId)
      .single()

    if (!order)              return NextResponse.json({ ok: false, reason: 'not_found' })
    if (!order.line_user_id) return NextResponse.json({ ok: false, reason: 'no_line_user' })
    if (!LINE_TOKEN)         return NextResponse.json({ ok: false, reason: 'no_token' }, { status: 500 })

    const settings  = (order.store?.takeout_settings ?? {}) as { notify_on_confirmed?: boolean; notify_on_preparing?: boolean; notify_on_ready?: boolean }
    const storeName = order.store?.name ?? '店舗'

    if (status === 'confirmed' && settings.notify_on_confirmed === false) {
      return NextResponse.json({ ok: false, reason: 'disabled' })
    }
    if (status === 'preparing' && settings.notify_on_preparing === false) {
      return NextResponse.json({ ok: false, reason: 'disabled' })
    }
    if (status === 'ready' && settings.notify_on_ready === false) {
      return NextResponse.json({ ok: false, reason: 'disabled' })
    }

    const message = status === 'confirmed'
      ? `【${storeName}】\nご注文 ${order.order_number} を受け付けました！\nお支払いは受け取り時にお願いします。`
      : status === 'preparing'
      ? `【${storeName}】\n${order.order_number} の調理を開始しました。\nしばらくお待ちください。`
      : `【${storeName}】\n${order.order_number} のご注文が完成しました！\nお受け取りをお願いします。`

    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_TOKEN}` },
      body:    JSON.stringify({ to: order.line_user_id, messages: [{ type: 'text', text: message }] }),
    })

    if (!lineRes.ok) {
      console.error('LINE push failed:', await lineRes.text())
      return NextResponse.json({ ok: false, reason: 'line_error' }, { status: 500 })
    }

    const field = status === 'confirmed' ? 'notified_confirmed' : status === 'preparing' ? 'notified_preparing' : 'notified_ready'
    await supabase.from('takeout_orders').update({ [field]: true }).eq('id', orderId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('notify-takeout:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
