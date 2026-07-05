export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'

interface CartItem { variantId: string; qty: number }

/**
 * POST /api/ec/order
 * Body: { storeId, accessToken, childId?, items: [{variantId, qty}] }
 *
 * ECセルフ注文。LINE 本人確認した顧客の purchase_orders を作成する。
 * 商品名・価格は school_product_variants からサーバー側で再解決する。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, accessToken } = body
    const items = (Array.isArray(body.items) ? body.items : []) as CartItem[]
    if (!storeId || items.length === 0) {
      return NextResponse.json({ error: 'storeId / items が必要です' }, { status: 400 })
    }
    if (items.some(i => !i.variantId || !Number.isFinite(i.qty) || i.qty < 1 || i.qty > 99)) {
      return NextResponse.json({ error: '注文内容が不正です' }, { status: 400 })
    }

    const line = await verifyLineAccessToken(accessToken)
    if (!line) return NextResponse.json({ error: 'LINE認証に失敗しました' }, { status: 401 })

    const supabase = createAdminClient({ noStore: true })

    const { data: custRows } = await supabase
      .from('customers').select('id, deleted_at')
      .eq('store_id', storeId).eq('line_user_id', line.userId)
      .order('created_at', { ascending: false }).limit(1)
    const customer = custRows?.[0] && !custRows[0].deleted_at ? custRows[0] : null
    if (!customer) return NextResponse.json({ error: '会員登録が必要です' }, { status: 404 })

    let childId: string | null = null
    if (body.childId) {
      const { data: c } = await supabase
        .from('children').select('id')
        .eq('id', body.childId).eq('customer_id', customer.id).maybeSingle()
      if (c) childId = c.id
    }

    // 商品・価格をサーバー側で解決(school_product_variants は products 系ビュー)
    const variantIds = Array.from(new Set(items.map(i => i.variantId)))
    const { data: variants, error: vErr } = await supabase
      .from('school_product_variants')
      .select('id, product_id, size_label, price')
      .in('id', variantIds)
    if (vErr) throw new Error(vErr.message)
    type VariantRow = { id: string; product_id: string; size_label: string | null; price: number }
    const variantMap = new Map<string, VariantRow>(
      (variants ?? []).map((v: VariantRow) => [v.id, v]))
    if (variantIds.some(id => !variantMap.has(id))) {
      return NextResponse.json({ error: '商品が見つかりません' }, { status: 400 })
    }
    const productIds = Array.from(new Set((variants ?? []).map((v: { product_id: string }) => v.product_id)))
    const { data: products, error: pErr } = await supabase
      .from('school_products')
      .select('id, item_name')
      .in('id', productIds)
    if (pErr) throw new Error(pErr.message)
    const productMap = new Map<string, { id: string; item_name: string }>(
      (products ?? []).map((p: { id: string; item_name: string }) => [p.id, p]))

    const today = new Date().toISOString().slice(0, 10)
    const rows = items.map(i => {
      const v = variantMap.get(i.variantId) as { product_id: string; size_label: string | null; price: number }
      const p = productMap.get(v.product_id) as { item_name: string } | undefined
      const itemName = `${p?.item_name ?? '商品'}${v.size_label ? ` ${v.size_label}` : ''}`
      return {
        store_id:     storeId,
        customer_id:  customer.id,
        child_id:     childId,
        item_name:    itemName,
        notes:        i.qty > 1 ? `${i.qty}点` : null,
        price:        v.price * i.qty,
        status:       'ordered',
        ordered_date: today,
      }
    })

    const { error } = await supabase.from('purchase_orders').insert(rows)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ec/order]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'サーバーエラー' }, { status: 500 })
  }
}
