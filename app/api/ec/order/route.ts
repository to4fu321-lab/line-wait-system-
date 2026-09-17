export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'
import { canCustomerOrder } from '@/lib/customerFeatures'

interface CartItem { variantId: string; qty: number }

/** 1注文あたりの明細点数の上限(異常なリクエストを弾く) */
const MAX_LINES = 50

/**
 * POST /api/ec/order
 * Body: { storeId, accessToken, childId?, items: [{variantId, qty}] }
 *
 * ECセルフ注文。LINE 本人確認した顧客の purchase_orders を作成する。
 * 商品名・価格は school_product_variants からサーバー側で再解決する。
 *
 * サーバー側で必ず検証すること(クライアントのUIは信用しない):
 *   1. 店舗のプランで EC セルフ注文が有効か
 *   2. 商品・サイズがその店舗のものか(他店舗の variantId を弾く)
 *   3. 商品がお子様(未登録なら顧客本人)の在籍校のものか
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, accessToken } = body
    const rawItems = (Array.isArray(body.items) ? body.items : []) as CartItem[]
    if (!storeId || rawItems.length === 0) {
      return NextResponse.json({ error: 'storeId / items が必要です' }, { status: 400 })
    }
    if (rawItems.length > MAX_LINES) {
      return NextResponse.json({ error: '注文点数が多すぎます' }, { status: 400 })
    }
    if (rawItems.some(i => !i.variantId || typeof i.variantId !== 'string'
      || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99)) {
      return NextResponse.json({ error: '注文内容が不正です' }, { status: 400 })
    }

    // 同一 variantId が複数行で届いても1行にまとめる(二重計上を防ぐ)
    const qtyByVariant = new Map<string, number>()
    for (const i of rawItems) {
      qtyByVariant.set(i.variantId, (qtyByVariant.get(i.variantId) ?? 0) + i.qty)
    }
    if (Array.from(qtyByVariant.values()).some(q => q > 99)) {
      return NextResponse.json({ error: '同じ商品の数量が上限を超えています' }, { status: 400 })
    }

    const line = await verifyLineAccessToken(accessToken)
    if (!line) return NextResponse.json({ error: 'LINE認証に失敗しました' }, { status: 401 })

    const supabase = createAdminClient({ noStore: true })

    // ── 1. プラン判定(UI側のゲートだけでは API 直叩きを防げない)──────
    const { data: storeRow } = await supabase
      .from('stores').select('features').eq('id', storeId).maybeSingle()
    if (!storeRow) return NextResponse.json({ error: '店舗が見つかりません' }, { status: 404 })
    const features = (storeRow.features ?? {}) as Record<string, unknown>
    if (!canCustomerOrder(features)) {
      return NextResponse.json({ error: 'この店舗ではネット注文をご利用いただけません' }, { status: 403 })
    }

    const { data: custRows } = await supabase
      .from('customers').select('id, deleted_at, school_id, school_name')
      .eq('store_id', storeId).eq('line_user_id', line.userId)
      .order('created_at', { ascending: false }).limit(1)
    const customer = custRows?.[0] && !custRows[0].deleted_at ? custRows[0] : null
    if (!customer) return NextResponse.json({ error: '会員登録が必要です' }, { status: 404 })

    // ── 2. 在籍校の解決 ───────────────────────────────────────────
    // お子様が指定されていればその子の学校、いなければ顧客本人の学校を使う。
    // school_id 未設定の古いレコード用に school_name からの解決もフォールバックで行う。
    let childId: string | null = null
    let schoolId: string | null = null
    let schoolName: string | null = null

    if (body.childId) {
      const { data: c } = await supabase
        .from('children').select('id, school_id, school_name')
        .eq('id', body.childId).eq('customer_id', customer.id).maybeSingle()
      if (!c) return NextResponse.json({ error: 'お子様情報が見つかりません' }, { status: 404 })
      childId    = c.id
      schoolId   = c.school_id
      schoolName = c.school_name
    } else {
      schoolId   = customer.school_id
      schoolName = customer.school_name
    }

    if (!schoolId && schoolName) {
      const { data: s } = await supabase
        .from('schools').select('id')
        .eq('store_id', storeId).eq('name', schoolName).limit(1).maybeSingle()
      schoolId = s?.id ?? null
    }
    if (!schoolId) {
      return NextResponse.json(
        { error: '学校が登録されていません。学校を登録してからご注文ください' }, { status: 400 })
    }

    // ── 3. 商品・価格をサーバー側で解決 ───────────────────────────
    // store_id で必ず絞る。絞らないと他店舗の variantId を注入できてしまう。
    const variantIds = Array.from(qtyByVariant.keys())
    const { data: variants, error: vErr } = await supabase
      .from('school_product_variants')
      .select('id, product_id, size_label, price')
      .eq('store_id', storeId).eq('active', true)
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
      .select('id, item_name, school_id')
      .eq('store_id', storeId).eq('active', true)
      .in('id', productIds)
    if (pErr) throw new Error(pErr.message)
    type ProductRow = { id: string; item_name: string; school_id: string }
    const productMap = new Map<string, ProductRow>(
      (products ?? []).map((p: ProductRow) => [p.id, p]))
    if (productIds.some(id => !productMap.has(id))) {
      return NextResponse.json({ error: '商品が見つかりません' }, { status: 400 })
    }

    // 在籍校以外の商品は注文させない(進学・転校は学校登録を変更してから)
    if (Array.from(productMap.values()).some(p => p.school_id !== schoolId)) {
      return NextResponse.json(
        { error: 'ご登録の学校以外の商品は注文できません。進学・転校の場合は学校を変更してください' },
        { status: 403 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const rows = Array.from(qtyByVariant.entries()).map(([variantId, qty]) => {
      const v = variantMap.get(variantId) as VariantRow
      const p = productMap.get(v.product_id) as ProductRow
      const itemName = `${p.item_name}${v.size_label ? ` ${v.size_label}` : ''}`
      return {
        store_id:     storeId,
        customer_id:  customer.id,
        child_id:     childId,
        item_name:    itemName,
        notes:        qty > 1 ? `${qty}点` : null,
        price:        v.price * qty,
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
