export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SchoolManualItem } from '@/lib/ocr/schemas/school-manual'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

const CATEGORY_LIST = [
  '制服（上着）', 'スラックス・スカート', 'シャツ・ブラウス', 'セーター・ベスト',
  'ネクタイ・リボン', '体操着', '上靴', 'カバン・バッグ', 'その他',
]
const GENDER_LIST = ['男子用', '女子用', '男女共通']

interface ImportBody {
  storeId: string
  school: { mode: 'existing' | 'new'; id?: string; name?: string; kana?: string; short_name?: string }
  apply_regulations?: boolean
  regulations?: { wearing_regulations?: string | null; special_notes?: string | null; schedule_notes?: string | null; extra_info?: string | null }
  items: SchoolManualItem[]
}

// POST /api/ocr/import/[id] — プレビュー確定内容を DB へ保存
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  try {
    const body = (await req.json()) as ImportBody
    const { storeId, school, items } = body
    if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })
    if (!school) return NextResponse.json({ error: 'school required' }, { status: 400 })

    // ── 学校解決 ──────────────────────────────────────────────
    let schoolId: string
    let schoolCreated = false
    if (school.mode === 'new') {
      const name = (school.name ?? '').trim()
      if (!name) return NextResponse.json({ error: '学校名が必要です' }, { status: 400 })
      const { count } = await supabase
        .from('schools').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
      const { data: created, error: scErr } = await supabase
        .from('schools')
        .insert({
          store_id: storeId, name, kana: (school.kana ?? '').trim(),
          short_name: (school.short_name ?? '').trim(), sort_order: count ?? 0, active: true,
        })
        .select('id').single()
      if (scErr) throw new Error(`学校作成に失敗: ${scErr.message}`)
      schoolId = created.id
      schoolCreated = true
    } else {
      if (!school.id) return NextResponse.json({ error: '既存校IDが必要です' }, { status: 400 })
      schoolId = school.id
    }

    // ── 学校単位の自由テキスト更新 ───────────────────────────
    if (body.apply_regulations && body.regulations) {
      const r = body.regulations
      const patch: Record<string, string | null> = {}
      if (r.wearing_regulations != null) patch.wearing_regulations = r.wearing_regulations
      if (r.special_notes != null) patch.special_notes = r.special_notes
      if (r.schedule_notes != null) patch.schedule_notes = r.schedule_notes
      if (r.extra_info != null) patch.extra_info = r.extra_info
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString()
        await supabase.from('schools').update(patch).eq('id', schoolId)
      }
    }

    // ── 既存 sort_order の起点を取得 ─────────────────────────
    const [{ count: prodCount }, { count: reqCount }] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('school_id', schoolId),
      supabase.from('school_requirements').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    ])
    let prodOrder = prodCount ?? 0
    let reqOrder = reqCount ?? 0

    let productsCreated = 0, requirementsCreated = 0, pricesCreated = 0
    const skipped: { item_name: string; reason: string }[] = []

    for (const item of items ?? []) {
      const name = (item.item_name ?? '').trim()
      if (!name) { skipped.push({ item_name: '(空)', reason: '商品名が空' }); continue }

      const category = item.category && CATEGORY_LIST.includes(item.category) ? item.category : null
      const gender = item.gender && GENDER_LIST.includes(item.gender) ? item.gender : null

      // 商品登録（学校別注品）
      const { data: product, error: pErr } = await supabase
        .from('products')
        .insert({
          store_id: storeId, school_id: schoolId, name,
          category, gender, maker: item.maker ?? null, maker_code: item.maker_code ?? null,
          notes: item.notes ?? null, body_types: [], active: true, sort_order: prodOrder++,
        })
        .select('id').single()
      if (pErr) { skipped.push({ item_name: name, reason: `商品作成失敗: ${pErr.message}` }); continue }
      productsCreated++

      // 規程登録
      const { error: rErr } = await supabase
        .from('school_requirements')
        .insert({
          store_id: storeId, school_id: schoolId, product_id: product.id,
          required: item.required !== false, avg_qty: item.avg_qty ?? null,
          uses_grade_color: false, grade_color_note: '', item_notes: item.notes ?? '',
          sort_order: reqOrder++,
        })
      if (!rErr) requirementsCreated++

      // 価格登録（サイズ別 + EO）
      const priceRows: Record<string, unknown>[] = []
      let order = 0
      for (const s of item.sizes ?? []) {
        if (s.price_tax_in == null) continue
        priceRows.push({
          store_id: storeId, school_id: schoolId, product_id: product.id,
          size_set_item_id: null, size_label: s.label || null,
          price_tax_in: s.price_tax_in, is_eo: false, active: true, sort_order: order++,
        })
      }
      if (item.eo_price_tax_in != null) {
        priceRows.push({
          store_id: storeId, school_id: schoolId, product_id: product.id,
          size_set_item_id: null, size_label: '別寸',
          price_tax_in: item.eo_price_tax_in, is_eo: true, active: true, sort_order: order++,
        })
      }
      if (priceRows.length > 0) {
        const { error: prErr } = await supabase.from('prices').insert(priceRows)
        if (!prErr) pricesCreated += priceRows.length
      }
    }

    // ジョブを done(import済) として更新
    await supabase.from('ocr_jobs')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({
      school_id: schoolId,
      school_created: schoolCreated,
      products_created: productsCreated,
      requirements_created: requirementsCreated,
      prices_created: pricesCreated,
      skipped,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
