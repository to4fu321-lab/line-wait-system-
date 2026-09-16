export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/master/catalog?storeId=...
 *
 * 店舗カタログの読み取り口。顧客画面(LINE)と、原価を必要としない管理画面が使う。
 *
 * このAPIの存在理由:
 *   商品マスタ(products / prices / school_requirements / size_sets)と互換ビューは
 *   以前 anon キーに開放されていて、店舗を指定せずに全店分を読めてしまっていた。
 *   マスタは必ずこの API を通し、storeId で 1 店舗に固定して返す。
 *
 * 必ず守ること:
 *   - すべてのクエリに store_id フィルタを付ける(呼び出し側の指定は信用しない)
 *   - prices.cost(仕入原価)は絶対に返さない。原価は PIN 認証の /api/master/crud 側。
 *   - schools は公開列(id/name/short_name/sort_order)のみ。
 *     店内メモ・採寸日程・締切などの内部情報は /api/master/crud で返す。
 *
 * モード(storeId に加えて1つ指定):
 *   schools=1              学校一覧
 *   schoolId=<uuid>        その学校の商品一覧
 *   productIds=<id,id,...> サイズ・価格(商品IDは同店舗のものに限る)
 *   productNames=<id,...>  商品名だけ(履歴表示用)
 *   barcode=<code>         バーコード一致の商品1件(サイズ・価格つき)
 */

const MAX_IDS = 200

function idList(raw: string | null): string[] {
  if (!raw) return []
  return Array.from(new Set(raw.split(',').map(s => s.trim()).filter(Boolean))).slice(0, MAX_IDS)
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const storeId = url.searchParams.get('storeId')
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })

    const supabase = createAdminClient({ noStore: true })

    // ── 学校一覧(公開列のみ)────────────────────────────────
    if (url.searchParams.get('schools')) {
      const { data, error } = await supabase
        .from('schools').select('id, name, short_name, sort_order')
        .eq('store_id', storeId).eq('active', true)
        .order('sort_order').order('name')
      if (error) throw new Error(error.message)
      return NextResponse.json({ schools: data ?? [] })
    }

    // ── その学校の商品一覧 ─────────────────────────────────
    const schoolId = url.searchParams.get('schoolId')
    if (schoolId) {
      const { data, error } = await supabase
        .from('school_products')
        .select('id, item_name, category, gender, maker, maker_code, notes, required, sort_order, school_id')
        .eq('store_id', storeId).eq('school_id', schoolId).eq('active', true)
        .order('sort_order').order('item_name')
      if (error) throw new Error(error.message)
      return NextResponse.json({ products: data ?? [] })
    }

    // ── サイズ・価格(cost は返さない)───────────────────────
    const productIds = idList(url.searchParams.get('productIds'))
    if (productIds.length > 0) {
      const { data, error } = await supabase
        .from('school_product_variants')
        .select('id, product_id, size_label, price, sort_order')
        .eq('store_id', storeId).eq('active', true)
        .in('product_id', productIds)
        .order('sort_order')
      if (error) throw new Error(error.message)
      return NextResponse.json({ variants: data ?? [] })
    }

    // ── 商品名だけ(購入履歴などの表示用)────────────────────
    const nameIds = idList(url.searchParams.get('productNames'))
    if (nameIds.length > 0) {
      const { data, error } = await supabase
        .from('school_products').select('id, item_name')
        .eq('store_id', storeId).in('id', nameIds)
      if (error) throw new Error(error.message)
      return NextResponse.json({ products: data ?? [] })
    }

    // ── バーコード検索(レジ・受付の読み取り用)──────────────
    const barcode = url.searchParams.get('barcode')
    if (barcode) {
      const { data: prods, error } = await supabase
        .from('school_products')
        .select('id, item_name, category, gender, maker_code, school_id')
        .eq('store_id', storeId).eq('barcode', barcode).eq('active', true).limit(1)
      if (error) throw new Error(error.message)
      const product = prods?.[0] ?? null
      if (!product) return NextResponse.json({ product: null, variants: [] })
      const { data: vars } = await supabase
        .from('school_product_variants')
        .select('id, product_id, size_label, price, sort_order')
        .eq('store_id', storeId).eq('product_id', product.id).eq('active', true)
        .order('sort_order')
      return NextResponse.json({ product, variants: vars ?? [] })
    }

    return NextResponse.json({ error: '取得対象を指定してください' }, { status: 400 })
  } catch (err) {
    console.error('[master/catalog]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
