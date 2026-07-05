export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

interface CartItem { menuId: string; quantity: number }

/**
 * POST /api/takeout/add-items
 * Body: { storeId, orderId, items: [{menuId, quantity}] }
 *
 * 既存注文(UUID=能力ベアラー)への追加注文。金額はサーバー側で再解決。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, orderId } = body
    const items = (Array.isArray(body.items) ? body.items : []) as CartItem[]
    if (!storeId || !orderId || items.length === 0) {
      return NextResponse.json({ error: 'storeId / orderId / items が必要です' }, { status: 400 })
    }
    if (items.some(i => !i.menuId || !Number.isFinite(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
      return NextResponse.json({ error: '注文内容が不正です' }, { status: 400 })
    }

    const supabase = createAdminClient({ noStore: true })

    const { data: order } = await supabase
      .from('takeout_orders').select('id, status, total_amount')
      .eq('id', orderId).eq('store_id', storeId).maybeSingle()
    if (!order) return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 })
    if (!['pending', 'preparing', 'ready'].includes(order.status)) {
      return NextResponse.json({ error: 'この注文には追加できません' }, { status: 409 })
    }

    const menuIds = Array.from(new Set(items.map(i => i.menuId)))
    const { data: menus } = await supabase
      .from('menus').select('id, name, price')
      .eq('store_id', storeId).in('id', menuIds)
    const menuMap = new Map<string, { id: string; name: string; price: number }>(
      (menus ?? []).map((m: { id: string; name: string; price: number }) => [m.id, m]))
    if (menuIds.some(id => !menuMap.has(id))) {
      return NextResponse.json({ error: 'メニューが見つかりません' }, { status: 400 })
    }

    const addTotal = items.reduce((s, i) => {
      const m = menuMap.get(i.menuId) as { price: number }
      return s + m.price * i.quantity
    }, 0)

    const { error: itemsErr } = await supabase.from('takeout_order_items').insert(
      items.map(i => {
        const m = menuMap.get(i.menuId) as { name: string; price: number }
        return {
          order_id:   orderId,
          menu_id:    i.menuId,
          name:       m.name,
          unit_price: m.price,
          quantity:   i.quantity,
          is_done:    false,
        }
      }),
    )
    if (itemsErr) throw new Error(itemsErr.message)

    await supabase.from('takeout_orders')
      .update({ total_amount: (order.total_amount ?? 0) + addTotal })
      .eq('id', orderId)

    const { data: full } = await supabase
      .from('takeout_orders')
      .select('*, items:takeout_order_items(*)')
      .eq('id', orderId)
      .single()

    return NextResponse.json({ order: full })
  } catch (err) {
    console.error('[takeout/add-items]', err)
    return NextResponse.json({ error: '追加購入に失敗しました。もう一度お試しください。' }, { status: 500 })
  }
}
