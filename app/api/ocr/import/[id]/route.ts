export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type { SchoolManualItem } from '@/lib/ocr/schemas/school-manual'
import { createAdminClient } from '@/lib/supabaseAdmin'

const CATEGORY_LIST = [
  '制服（上着）', 'スラックス・スカート', 'シャツ・ブラウス', 'セーター・ベスト',
  'ネクタイ・リボン', '体操着', '上靴', 'カバン・バッグ', 'その他',
]
const GENDER_LIST = ['男子用', '女子用', '男女共通']

// ── サイズセット照合ユーティリティ（B方式: 既存再利用 or 自動生成）──
function normalizeLabel(raw: string): string {
  return (raw ?? '').normalize('NFKC').replace(/\s+/g, '').trim()
}
// 商品カテゴリ → サイズセット区分(tops/bottoms/shoes/general)
const SIZESET_CAT: Record<string, string> = {
  '制服（上着）': 'tops', 'シャツ・ブラウス': 'tops', 'セーター・ベスト': 'tops',
  'スラックス・スカート': 'bottoms', '上靴': 'shoes',
}
const SIZESET_CAT_LABEL: Record<string, string> = { tops: '上衣', bottoms: '下衣', shoes: '靴', general: '汎用' }
function sizeSetCategoryFor(cat: string | null): string {
  return (cat && SIZESET_CAT[cat]) || 'general'
}
// 照合キー = 区分 + ラベル集合(順不同)
function setKey(cat: string, normLabels: string[]): string {
  return cat + '|' + [...normLabels].sort().join('')
}

interface ImportBody {
  storeId: string
  school: { mode: 'existing' | 'new'; id?: string; name?: string; kana?: string; short_name?: string }
  apply_regulations?: boolean
  regulations?: { wearing_regulations?: string | null; special_notes?: string | null; schedule_notes?: string | null; extra_info?: string | null }
  items: SchoolManualItem[]
}

// POST /api/ocr/import/[id] — プレビュー確定内容を DB へ保存
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
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

    // ── サイズセットのプリロード（同一店舗・全件）──────────────
    type SetEntry = { id: string; itemByLabel: Map<string, string> }
    const { data: existingSets } = await supabase
      .from('size_sets')
      .select('id, category, items:size_set_items(id, label)')
      .eq('store_id', storeId)
    const setCache = new Map<string, SetEntry>()
    let setOrder = existingSets?.length ?? 0
    for (const ss of existingSets ?? []) {
      const items2 = (ss.items ?? []) as { id: string; label: string }[]
      const norm = items2.map((i) => normalizeLabel(i.label)).filter(Boolean)
      const key = setKey(ss.category ?? 'general', norm)
      if (setCache.has(key)) continue
      const itemByLabel = new Map<string, string>()
      for (const it of items2) itemByLabel.set(normalizeLabel(it.label), it.id)
      setCache.set(key, { id: ss.id, itemByLabel })
    }

    let sizeSetsCreated = 0
    // ラベル群に対応するサイズセットを取得（無ければ自動生成）
    const resolveSizeSet = async (cat: string, orderedLabels: string[]): Promise<SetEntry | null> => {
      const norm = orderedLabels.map(normalizeLabel).filter(Boolean)
      if (norm.length === 0) return null
      const key = setKey(cat, norm)
      const hit = setCache.get(key)
      if (hit) return hit
      const name = `${SIZESET_CAT_LABEL[cat]}: ${norm.join('・')}`.slice(0, 60)
      const { data: created, error: ssErr } = await supabase
        .from('size_sets')
        .insert({ store_id: storeId, name, category: cat, active: true, sort_order: setOrder++ })
        .select('id').single()
      if (ssErr || !created) return null
      // ラベルを OCR 出現順で登録（重複は先勝ち）
      const seen = new Set<string>()
      const rows: { size_set_id: string; label: string; sort_order: number }[] = []
      let so = 0
      for (const raw of orderedLabels) {
        const nl = normalizeLabel(raw)
        if (!nl || seen.has(nl)) continue
        seen.add(nl)
        rows.push({ size_set_id: created.id, label: raw.trim(), sort_order: so++ })
      }
      const { data: createdItems } = await supabase
        .from('size_set_items').insert(rows).select('id, label')
      const itemByLabel = new Map<string, string>()
      for (const it of (createdItems ?? []) as { id: string; label: string }[]) {
        itemByLabel.set(normalizeLabel(it.label), it.id)
      }
      const entry: SetEntry = { id: created.id, itemByLabel }
      setCache.set(key, entry)
      sizeSetsCreated++
      return entry
    }

    let productsCreated = 0, requirementsCreated = 0, pricesCreated = 0
    const skipped: { item_name: string; reason: string }[] = []

    for (const item of items ?? []) {
      const name = (item.item_name ?? '').trim()
      if (!name) { skipped.push({ item_name: '(空)', reason: '商品名が空' }); continue }

      const category = item.category && CATEGORY_LIST.includes(item.category) ? item.category : null
      const gender = item.gender && GENDER_LIST.includes(item.gender) ? item.gender : null

      // サイズセット解決（既存再利用 or 自動生成）
      const orderedLabels = (item.sizes ?? []).map((s) => s.label).filter(Boolean)
      const sizeSet = await resolveSizeSet(sizeSetCategoryFor(category), orderedLabels)

      // 商品登録（学校別注品・サイズセット割り当て）
      const { data: product, error: pErr } = await supabase
        .from('products')
        .insert({
          store_id: storeId, school_id: schoolId, name,
          category, gender, maker: item.maker ?? null, maker_code: item.maker_code ?? null,
          notes: item.notes ?? null, body_types: [], size_set_id: sizeSet?.id ?? null,
          active: true, sort_order: prodOrder++,
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
        const sizeSetItemId = s.label ? (sizeSet?.itemByLabel.get(normalizeLabel(s.label)) ?? null) : null
        priceRows.push({
          store_id: storeId, school_id: schoolId, product_id: product.id,
          size_set_item_id: sizeSetItemId, size_label: s.label || null,
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
      size_sets_created: sizeSetsCreated,
      skipped,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
