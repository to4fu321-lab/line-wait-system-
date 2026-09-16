export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { assertStorePin } from '@/lib/auth/storeAuth'

/**
 * POST /api/master/crud
 * Body: { storeId, storePin, resource, action, ...payload }
 *
 * 商品マスタ(schools / size_sets / products / school_requirements / prices /
 * processing_options)の読み書き。店舗PINをサーバー側で照合してから
 * service role で実行し、必ず store_id で絞る。
 *
 * これを経由する理由:
 *   以前はブラウザから anon キーで直接これらのテーブルを読み書きできた。
 *   anon キーは JS バンドルに載る公開キーなので、他店の商品・価格を
 *   書き換え・削除することも可能な状態だった。マスタの変更は必ずここを通す。
 *
 * 店舗の越境を防ぐための決まりごと:
 *   - 受け取った payload から store_id は必ず捨て、認証した storeId を入れ直す
 *   - update / delete は id だけでなく store_id でも必ず絞る
 *   - store_id を持たない子テーブル(size_set_items)は、親が自店のものか確認する
 */

/** 書き込みを許可する列(ここに無いキーは捨てる) */
const FIELDS = {
  schools: ['name', 'kana', 'short_name', 'address', 'tel', 'notes', 'extra_info',
    'measurement_start', 'measurement_end', 'order_deadline', 'pickup_deadline',
    'schedule_notes', 'special_notes', 'wearing_regulations', 'active', 'sort_order'],
  size_sets: ['supplier_id', 'name', 'category', 'notes', 'active', 'sort_order'],
  products: ['school_id', 'name', 'group_name', 'category', 'gender', 'supplier_id', 'maker',
    'maker_code', 'color_code', 'barcode', 'washable', 'size_set_id', 'base_price_tax_in',
    'base_price_tax_out', 'stock', 'body_types', 'notes', 'active', 'sort_order'],
  school_requirements: ['school_id', 'product_id', 'required', 'avg_qty', 'uses_grade_color',
    'grade_color_note', 'item_notes', 'sort_order'],
  prices: ['school_id', 'product_id', 'size_set_item_id', 'size_label', 'price_tax_in',
    'price_tax_out', 'cost', 'is_eo', 'valid_from', 'active', 'sort_order'],
  processing_options: ['name', 'input_type', 'unit', 'default_price', 'required',
    'applies_to_category', 'choices', 'notes', 'sort_order', 'is_active'],
} as const

type Resource = keyof typeof FIELDS

function pick(src: unknown, resource: Resource): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!src || typeof src !== 'object') return out
  const row = src as Record<string, unknown>
  for (const key of FIELDS[resource]) if (key in row) out[key] = row[key]
  return out
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const storeId  = typeof body.storeId === 'string' ? body.storeId : ''
    const resource = body.resource as Resource
    const action   = String(body.action ?? '')
    if (!storeId) return bad('storeId が必要です')
    if (!(resource in FIELDS)) return bad('resource が不正です')

    const denied = await assertStorePin(req, body)
    if (denied) return denied

    const supabase = createAdminClient({ noStore: true })
    /** 自店のレコードだけを対象にするクエリの起点 */
    const scoped = () => supabase.from(resource).select('*').eq('store_id', storeId)

    // ── 読み取り ────────────────────────────────────────────
    if (action === 'list') {
      if (resource === 'schools') {
        const { data, error } = await scoped().order('sort_order').order('name')
        if (error) throw new Error(error.message)
        return NextResponse.json({ rows: data ?? [] })
      }
      if (resource === 'size_sets') {
        const { data, error } = await supabase.from('size_sets')
          .select('*, items:size_set_items(*)')
          .eq('store_id', storeId).order('sort_order')
        if (error) throw new Error(error.message)
        return NextResponse.json({ rows: data ?? [] })
      }
      if (resource === 'products') {
        // 部材マスタ・レジ・レポートは size_set の埋め込みが不要なので切り替える
        const select = body.plain ? '*' : '*, size_set:size_sets(id,name,category)'
        let q = supabase.from('products').select(select).eq('store_id', storeId)
        if (body.freeOnly) q = q.is('school_id', null)
        else if (body.schoolId) q = q.or(`school_id.is.null,school_id.eq.${body.schoolId}`)
        if (typeof body.category === 'string') q = q.eq('category', body.category)
        if (Array.isArray(body.categories))   q = q.in('category', body.categories)
        if (body.activeOnly)                  q = q.eq('active', true)
        const q2 = body.orderByGroup
          ? q.order('group_name').order('sort_order')
          : body.orderByCategory
            ? q.order('category').order('name')
            : q.order('sort_order').order('name')
        const { data, error } = await q2
        if (error) throw new Error(error.message)
        return NextResponse.json({ rows: data ?? [] })
      }
      if (resource === 'school_requirements') {
        if (!body.schoolId) return bad('schoolId が必要です')
        let q = supabase.from('school_requirements')
          .select('*, product:products(*, size_set:size_sets(id,name,category,items:size_set_items(id,label,sort_order)))')
          .eq('store_id', storeId).eq('school_id', body.schoolId)
        if (body.requiredOnly) q = q.eq('required', true)
        const { data, error } = await q.order('sort_order')
        if (error) throw new Error(error.message)
        return NextResponse.json({ rows: data ?? [] })
      }
      if (resource === 'prices') {
        let q = supabase.from('prices').select('*').eq('store_id', storeId)
        if (body.schoolId)  q = q.eq('school_id', body.schoolId)
        if (body.productId) q = q.eq('product_id', body.productId)
        if (Array.isArray(body.productIds)) q = q.in('product_id', body.productIds)
        const { data, error } = await q.order('is_eo').order('sort_order')
        if (error) throw new Error(error.message)
        return NextResponse.json({ rows: data ?? [] })
      }
      if (resource === 'processing_options') {
        const { data, error } = await scoped().order('sort_order').order('name')
        if (error) throw new Error(error.message)
        return NextResponse.json({ rows: data ?? [] })
      }
    }

    // ── 追加・更新 ──────────────────────────────────────────
    if (action === 'upsert') {
      const patch = pick(body.row, resource)
      const id = typeof body.row?.id === 'string' ? body.row.id : null
      if (id) {
        const { data, error } = await supabase.from(resource)
          .update(patch).eq('id', id).eq('store_id', storeId)
          .select().maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) return bad('対象が見つかりません', 404)
        return NextResponse.json({ row: data })
      }
      const { data, error } = await supabase.from(resource)
        .insert({ ...patch, store_id: storeId }).select().single()
      if (error) throw new Error(error.message)
      return NextResponse.json({ row: data })
    }

    // ── 削除 ────────────────────────────────────────────────
    if (action === 'delete') {
      if (typeof body.id !== 'string') return bad('id が必要です')
      const { error } = await supabase.from(resource)
        .delete().eq('id', body.id).eq('store_id', storeId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    // ── 標準学年の自動生成(冪等なDB関数)────────────────────
    if (action === 'seedGrades' && resource === 'schools') {
      const schoolId = typeof body.schoolId === 'string' ? body.schoolId : ''
      if (!schoolId) return bad('schoolId が必要です')
      const { data: owner } = await supabase.from('schools')
        .select('id').eq('id', schoolId).eq('store_id', storeId).maybeSingle()
      if (!owner) return bad('対象が見つかりません', 404)
      const gradeCount = Number(body.gradeCount)
      const { error } = await supabase.rpc('seed_default_grades', {
        p_school_id: schoolId,
        p_grade_count: Number.isInteger(gradeCount) && gradeCount > 0 ? gradeCount : 3,
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    // ── サイズ項目の一括置き換え(size_set_items は store_id を持たない)──
    if (action === 'replaceItems' && resource === 'size_sets') {
      const sizeSetId = typeof body.sizeSetId === 'string' ? body.sizeSetId : ''
      if (!sizeSetId) return bad('sizeSetId が必要です')
      const { data: owner } = await supabase.from('size_sets')
        .select('id').eq('id', sizeSetId).eq('store_id', storeId).maybeSingle()
      if (!owner) return bad('対象が見つかりません', 404)

      await supabase.from('size_set_items').delete().eq('size_set_id', sizeSetId)
      const labels = Array.isArray(body.labels) ? body.labels : []
      const rows = labels
        .map((l: unknown) => String(l ?? '').trim()).filter(Boolean)
        .map((label: string, i: number) => ({ size_set_id: sizeSetId, label, sort_order: i }))
      if (rows.length === 0) return NextResponse.json({ rows: [] })
      const { data, error } = await supabase.from('size_set_items').insert(rows).select()
      if (error) throw new Error(error.message)
      return NextResponse.json({ rows: data ?? [] })
    }

    // ── 価格の一括置き換え(学校×商品のサイズ別価格)──────────
    if (action === 'replace' && resource === 'prices') {
      const { schoolId, productId } = body
      if (typeof schoolId !== 'string' || typeof productId !== 'string') {
        return bad('schoolId / productId が必要です')
      }
      // 対象商品が自店のものであることを確認してから消す
      const { data: owner } = await supabase.from('products')
        .select('id').eq('id', productId).eq('store_id', storeId).maybeSingle()
      if (!owner) return bad('対象が見つかりません', 404)

      await supabase.from('prices').delete()
        .eq('store_id', storeId).eq('school_id', schoolId).eq('product_id', productId)
      const list = Array.isArray(body.rows) ? body.rows : []
      if (list.length === 0) return NextResponse.json({ ok: true })
      // sort_order は渡されていればそちらを優先(元の replacePrices と同じ挙動)。
      // store/school/product は必ず認証済みの値で上書きする。
      const payload = list.map((r: unknown, i: number) => ({
        sort_order: i,
        ...pick(r, 'prices'),
        store_id: storeId, school_id: schoolId, product_id: productId,
      }))
      const { error } = await supabase.from('prices').insert(payload)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return bad('action が不正です')
  } catch (err) {
    console.error('[master/crud]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'サーバーエラー' }, { status: 500 })
  }
}
