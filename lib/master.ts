// ============================================================
// マスタデータ アクセス層 (再設計スキーマ)
//   対象: schools / size_sets / size_set_items / products /
//         school_requirements / prices
//   設計: docs/master-data-redesign.md
//
//   方針: 画面側は「フラットな型」ではなく正規化型をそのまま扱う。
//         supabase の埋め込み select でリレーションを一括取得する。
// ============================================================
import { supabase } from '@/lib/supabase'
import type {
  SchoolMaster, SizeSet, SizeSetItem, ProductMaster,
  SchoolRequirement, Price, MeasurementRow, ProcessingOption,
} from '@/types/master'

const sb = supabase as any

// ── 学校マスタ ────────────────────────────────────────────────
export async function listSchools(storeId: string): Promise<SchoolMaster[]> {
  const { data } = await sb.from('schools')
    .select('*').eq('store_id', storeId).order('sort_order').order('name')
  return data ?? []
}

export async function upsertSchool(row: Partial<SchoolMaster>): Promise<SchoolMaster> {
  const { data, error } = row.id
    ? await sb.from('schools').update(row).eq('id', row.id).select().single()
    : await sb.from('schools').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteSchool(id: string) {
  const { error } = await sb.from('schools').delete().eq('id', id)
  if (error) throw error
}

// ── サイズセットマスタ ────────────────────────────────────────
export async function listSizeSets(storeId: string): Promise<SizeSet[]> {
  const { data } = await sb.from('size_sets')
    .select('*, items:size_set_items(*)')
    .eq('store_id', storeId).order('sort_order')
  // items を sort
  return (data ?? []).map((s: SizeSet) => ({
    ...s,
    items: (s.items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function upsertSizeSet(row: Partial<SizeSet>): Promise<SizeSet> {
  const { items, ...rest } = row as any
  const { data, error } = rest.id
    ? await sb.from('size_sets').update(rest).eq('id', rest.id).select().single()
    : await sb.from('size_sets').insert(rest).select().single()
  if (error) throw error
  return data
}

export async function deleteSizeSet(id: string) {
  const { error } = await sb.from('size_sets').delete().eq('id', id)
  if (error) throw error
}

// サイズ項目をまとめて置き換え(削除→再投入)
export async function replaceSizeSetItems(
  sizeSetId: string,
  labels: string[],
): Promise<SizeSetItem[]> {
  await sb.from('size_set_items').delete().eq('size_set_id', sizeSetId)
  const rows = labels
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label, i) => ({ size_set_id: sizeSetId, label, sort_order: i }))
  if (rows.length === 0) return []
  const { data, error } = await sb.from('size_set_items').insert(rows).select()
  if (error) throw error
  return data ?? []
}

// ── 商品マスタ(自由商品 / 学校別注品) ────────────────────────
// schoolId 指定時: その学校の別注品 + 自由商品(全校共通) を返す
export async function listProducts(
  storeId: string,
  opts: { schoolId?: string | null; freeOnly?: boolean } = {},
): Promise<ProductMaster[]> {
  let q = sb.from('products')
    .select('*, size_set:size_sets(id,name,category)')
    .eq('store_id', storeId)
  if (opts.freeOnly) {
    q = q.is('school_id', null)
  } else if (opts.schoolId) {
    // 自由商品(null) または 当該校の別注品
    q = q.or(`school_id.is.null,school_id.eq.${opts.schoolId}`)
  }
  const { data } = await q.order('sort_order').order('name')
  return data ?? []
}

export async function upsertProduct(row: Partial<ProductMaster>): Promise<ProductMaster> {
  const { size_set, school, ...rest } = row as any
  const { data, error } = rest.id
    ? await sb.from('products').update(rest).eq('id', rest.id).select().single()
    : await sb.from('products').insert(rest).select().single()
  if (error) throw error
  return data
}

export async function deleteProduct(id: string) {
  const { error } = await sb.from('products').delete().eq('id', id)
  if (error) throw error
}

// ── 学校別規程マスタ ──────────────────────────────────────────
// その学校の規程一覧(商品実体を埋め込み)
export async function listRequirements(schoolId: string): Promise<SchoolRequirement[]> {
  const { data } = await sb.from('school_requirements')
    .select('*, product:products(*, size_set:size_sets(id,name,category))')
    .eq('school_id', schoolId)
    .order('sort_order')
  return data ?? []
}

export async function upsertRequirement(row: Partial<SchoolRequirement>): Promise<SchoolRequirement> {
  const { product, ...rest } = row as any
  const { data, error } = rest.id
    ? await sb.from('school_requirements').update(rest).eq('id', rest.id).select().single()
    : await sb.from('school_requirements').insert(rest).select().single()
  if (error) throw error
  return data
}

export async function deleteRequirement(id: string) {
  const { error } = await sb.from('school_requirements').delete().eq('id', id)
  if (error) throw error
}

// 商品を学校に割り当て(規程を作成。既存ならスキップ)
export async function assignProductToSchool(
  storeId: string, schoolId: string, productId: string,
  attrs: Partial<SchoolRequirement> = {},
): Promise<SchoolRequirement> {
  return upsertRequirement({
    store_id: storeId, school_id: schoolId, product_id: productId,
    required: true, ...attrs,
  })
}

// ── 価格マスタ ────────────────────────────────────────────────
export async function listPrices(schoolId: string, productId: string): Promise<Price[]> {
  const { data } = await sb.from('prices')
    .select('*').eq('school_id', schoolId).eq('product_id', productId)
    .order('is_eo').order('sort_order')
  return data ?? []
}

export async function upsertPrice(row: Partial<Price>): Promise<Price> {
  const { data, error } = row.id
    ? await sb.from('prices').update(row).eq('id', row.id).select().single()
    : await sb.from('prices').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deletePrice(id: string) {
  const { error } = await sb.from('prices').delete().eq('id', id)
  if (error) throw error
}

// その学校・商品の価格を一括置き換え(サイズ別価格の保存に使用)
export async function replacePrices(
  storeId: string, schoolId: string, productId: string,
  rows: Array<Partial<Price>>,
) {
  await sb.from('prices').delete()
    .eq('school_id', schoolId).eq('product_id', productId)
  if (rows.length === 0) return
  const payload = rows.map((r, i) => ({
    store_id: storeId, school_id: schoolId, product_id: productId,
    sort_order: i, ...r,
  }))
  const { error } = await sb.from('prices').insert(payload)
  if (error) throw error
}

// ── 新品加工オプションマスタ ──────────────────────────────────
export async function listProcessingOptions(storeId: string): Promise<ProcessingOption[]> {
  const { data } = await sb.from('processing_options')
    .select('*').eq('store_id', storeId).order('sort_order').order('name')
  return data ?? []
}

export async function upsertProcessingOption(row: Partial<ProcessingOption>): Promise<ProcessingOption> {
  const { data, error } = row.id
    ? await sb.from('processing_options').update(row).eq('id', row.id).select().single()
    : await sb.from('processing_options').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteProcessingOption(id: string) {
  const { error } = await sb.from('processing_options').delete().eq('id', id)
  if (error) throw error
}

// カテゴリに連動する加工オプションを抽出(applies_to_category 空=全商品に適用)
export function processingOptionsForCategory(
  options: ProcessingOption[], category: string | null,
): ProcessingOption[] {
  return options.filter((o) =>
    o.is_active &&
    (o.applies_to_category.length === 0 ||
     (category != null && o.applies_to_category.includes(category))))
}

// ── 学年色マスタ ──────────────────────────────────────────────
// 標準学年(1〜n年 + 既定色)を自動生成。既存があればスキップ(DB関数が冪等)。
export async function seedDefaultGrades(schoolId: string, gradeCount = 3): Promise<void> {
  const { error } = await sb.rpc('seed_default_grades', {
    p_school_id: schoolId, p_grade_count: gradeCount,
  })
  if (error) throw error
}

// ============================================================
// 採寸接客: その学校の必須商品 + サイズセット + 価格 を一括取得
//   docs §3 のクエリ。required=false も含めたい場合は requiredOnly=false
// ============================================================
export async function getMeasurementSheet(
  schoolId: string,
  opts: { requiredOnly?: boolean } = {},
): Promise<MeasurementRow[]> {
  let q = sb.from('school_requirements')
    .select(`
      *,
      product:products(
        *,
        size_set:size_sets( id, name, category, items:size_set_items(id,label,sort_order) )
      )
    `)
    .eq('school_id', schoolId)
  if (opts.requiredOnly !== false) q = q.eq('required', true)
  const { data: reqs } = await q.order('sort_order')
  const requirements = (reqs ?? []) as SchoolRequirement[]
  if (requirements.length === 0) return []

  // この学校の価格をまとめて取得し product_id でマップ化
  const productIds = requirements.map((r) => r.product_id)
  const { data: priceRows } = await sb.from('prices')
    .select('*').eq('school_id', schoolId).in('product_id', productIds)
  const prices = (priceRows ?? []) as Price[]

  return requirements.map((req): MeasurementRow => {
    const product = (req.product ?? {}) as MeasurementRow['product']
    const setItems = (product.size_set?.items ?? [])
      .slice().sort((a, b) => a.sort_order - b.sort_order)
    const productPrices = prices.filter((p) => p.product_id === req.product_id && !p.is_eo)
    const eo = prices.find((p) => p.product_id === req.product_id && p.is_eo)

    // サイズ候補: サイズセット項目を基準に、価格があれば紐付け
    const sizes = setItems.length > 0
      ? setItems.map((it) => ({
          item_id: it.id,
          label: it.label,
          price_tax_in:
            productPrices.find((p) => p.size_set_item_id === it.id)?.price_tax_in ??
            product.base_price_tax_in ?? null,
        }))
      : productPrices.map((p) => ({
          item_id: p.size_set_item_id,
          label: p.size_label ?? '',
          price_tax_in: p.price_tax_in,
        }))

    return {
      ...req,
      product,
      sizes,
      eo_price_tax_in: eo?.price_tax_in ?? null,
    }
  })
}
