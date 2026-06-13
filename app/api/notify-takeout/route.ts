import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLineToken, getLiffBaseUrl } from '@/lib/line-config'
import { pushCard, ogTicketUrl, resolveOrigin, type CardOptions, type CardKind } from '@/lib/line-flex'

// テイクアウト通知は takeout アカウントのトークンを使用
const LINE_TOKEN = getLineToken('takeout')
const LIFF_BASE  = getLiffBaseUrl('takeout')

const TAKEOUT_STEPS = [
  { label: '受付完了' },
  { label: '調理中' },
  { label: '完成' },
  { label: 'お渡し' },
]

export async function POST(req: NextRequest) {
  try {
    const { orderId, status } = await req.json()
    if (!orderId || !status) {
      return NextResponse.json({ ok: false, reason: 'invalid_params' }, { status: 400 })
    }

    const { data: order } = await supabase
      .from('takeout_orders')
      .select('*, store:stores(name, takeout_settings), items:takeout_order_items(name, quantity)')
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

    // status → ステップ位置・配色・文言
    const config: Record<string, { step: number; kind: CardKind; title: string; note: string }> = {
      confirmed: { step: 0, kind: 'order', title: 'ご注文を受け付けました', note: 'お支払いは受け取り時にお願いします。\n進捗は下のボタンから確認できます。' },
      preparing: { step: 1, kind: 'order', title: '調理を開始しました',     note: 'できあがりまでもうしばらくお待ちください。' },
      ready:     { step: 2, kind: 'ready', title: 'ご注文が完成しました',   note: 'お受け取りをお願いします。' },
    }
    const c = config[status as string] ?? config.confirmed

    const itemLines = (order.items as { name: string; quantity: number }[] ?? [])
      .map(i => `${i.name} ×${i.quantity}`)

    const origin = resolveOrigin(req.url)
    const imageUrl = ogTicketUrl(origin, {
      no: order.order_number,
      store: storeName,
      label: '注文番号',
      kind: c.kind,
    })
    const progressUrl = LIFF_BASE && order.store_id
      ? `${LIFF_BASE}/${order.store_id}/progress?order=${orderId}`
      : undefined

    const card: CardOptions = {
      kind: c.kind,
      title: c.title,
      storeName,
      numberLabel: '注文番号',
      number: order.order_number,
      imageUrl,
      bodyLines: itemLines.length ? itemLines : undefined,
      steps: TAKEOUT_STEPS,
      currentStep: c.step,
      note: c.note,
      buttonLabel: progressUrl ? '進捗を見る' : undefined,
      buttonUrl: progressUrl,
    }

    const altText = `${storeName} ご注文 ${order.order_number}：${c.title}`
    const result = await pushCard(LINE_TOKEN, order.line_user_id, altText, card)

    if (!result.ok) {
      console.error('LINE push failed:', result.error)
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
