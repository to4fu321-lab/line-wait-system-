export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'

interface CartItem { menuId: string; quantity: number }

/**
 * POST /api/takeout/place
 * Body: { storeId, accessToken?, customerName?, notes?, pickupTime?, items: [{menuId, quantity}] }
 *
 * テイクアウト注文を作成する。金額・商品名は menus テーブルから
 * サーバー側で再解決する(クライアント申告の価格は信用しない)。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, accessToken } = body
    const items = (Array.isArray(body.items) ? body.items : []) as CartItem[]
    if (!storeId || items.length === 0) {
      return NextResponse.json({ error: 'storeId / items が必要です' }, { status: 400 })
    }
    if (items.some(i => !i.menuId || !Number.isFinite(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
      return NextResponse.json({ error: '注文内容が不正です' }, { status: 400 })
    }

    const line = await verifyLineAccessToken(accessToken)

    const supabase = createAdminClient({ noStore: true })

    // メニューをサーバー側で解決
    const menuIds = Array.from(new Set(items.map(i => i.menuId)))
    const { data: menus } = await supabase
      .from('menus').select('id, name, price, is_available')
      .eq('store_id', storeId).in('id', menuIds)
    const menuMap = new Map<string, { id: string; name: string; price: number }>(
      (menus ?? []).map((m: { id: string; name: string; price: number }) => [m.id, m]))
    if (menuIds.some(id => !menuMap.has(id))) {
      return NextResponse.json({ error: 'メニューが見つかりません' }, { status: 400 })
    }

    const total = items.reduce((s, i) => {
      const m = menuMap.get(i.menuId) as { price: number }
      return s + m.price * i.quantity
    }, 0)

    const { data: orderNumber, error: numErr } = await supabase
      .rpc('get_next_order_number', { p_store_id: storeId })
    if (numErr || !orderNumber) throw numErr ?? new Error('採番に失敗しました')

    const { data: order, error: orderErr } = await supabase
      .from('takeout_orders')
      .insert({
        store_id:      storeId,
        order_number:  orderNumber as string,
        customer_name: (typeof body.customerName === 'string' && body.customerName.trim()) || line?.displayName || null,
        line_user_id:  line?.userId ?? null,
        status:        'pending',
        total_amount:  total,
        pickup_time:   body.pickupTime ?? null,
        order_source:  'line',
        notes:         (typeof body.notes === 'string' && body.notes.trim()) || null,
      })
      .select()
      .single()
    if (orderErr || !order) throw orderErr ?? new Error('注文の作成に失敗しました')

    const { error: itemsErr } = await supabase.from('takeout_order_items').insert(
      items.map(i => {
        const m = menuMap.get(i.menuId) as { name: string; price: number }
        return {
          order_id:   order.id,
          menu_id:    i.menuId,
          name:       m.name,
          unit_price: m.price,
          quantity:   i.quantity,
          is_done:    false,
        }
      }),
    )
    if (itemsErr) throw new Error(itemsErr.message)

    const { data: full } = await supabase
      .from('takeout_orders')
      .select('*, items:takeout_order_items(*)')
      .eq('id', order.id)
      .single()

    return NextResponse.json({ order: full ?? order })
  } catch (err) {
    console.error('[takeout/place]', err)
    return NextResponse.json({ error: '注文の送信に失敗しました。もう一度お試しください。' }, { status: 500 })
  }
}
