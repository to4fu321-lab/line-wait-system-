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
  SchoolRequirement, Price, PriceBand, MeasurementRow, ProcessingOption,
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

// 店舗全体の価格設定カバレッジ(俯瞰ビュー用)。
//   学校ごとに「規定品何件中、価格設定済み何件か」を算出する。
export interface SchoolCoverage {
  school_id:   string
  total:       number
  priced:      number
  unset:       string[]   // 価格未設定の商品名
}
export async function getStoreCoverage(storeId: string): Promise<Record<string, SchoolCoverage>> {
  const [{ data: reqs }, { data: prices }] = await Promise.all([
    sb.from('school_requirements')
      .select('school_id, product_id, product:products(name)')
      .eq('store_id', storeId),
    sb.from('prices')
      .select('school_id, product_id').eq('store_id', storeId).eq('is_eo', false),
  ])
  const pricedKeys = new Set<string>((prices ?? []).map((p: any) => `${p.school_id}:${p.product_id}`))
  const map: Record<string, SchoolCoverage> = {}
  for (const r of (reqs ?? []) as any[]) {
    const cov = map[r.school_id] ?? (map[r.school_id] = { school_id: r.school_id, total: 0, priced: 0, unset: [] })
    cov.total++
    if (pricedKeys.has(`${r.school_id}:${r.product_id}`)) cov.priced++
    else cov.unset.push(r.product?.name ?? '(無名)')
  }
  return map
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

// ── 価格帯マスタ(編集の正) ────────────────────────────────────
export async function listPriceBands(schoolId: string, productId: string): Promise<PriceBand[]> {
  const { data } = await sb.from('price_bands')
    .select('*').eq('school_id', schoolId).eq('product_id', productId)
    .order('is_eo').order('sort_order')
  return data ?? []
}

// 価格帯 → サイズ別価格(prices)へ展開する。
//   - サイズ範囲バンド: from..to(sort_order昇順, 両端含む)の各サイズに価格を割当
//   - from_item_id=null: サイズセット無し商品の共通価格(size_label=null の1行)
//   - is_eo: 別寸価格(size_label='別寸')
//   後勝ち: sort_order の後のバンドが重なり範囲を上書きする(修正しやすさ優先)。
export function expandBandsToPrices(
  bands: PriceBand[], items: SizeSetItem[],
): Array<Partial<Price>> {
  const ordered = items.slice().sort((a, b) => a.sort_order - b.sort_order)
  const orderOf = new Map(ordered.map((it, i) => [it.id, i]))
  const sized = bands.filter((b) => !b.is_eo)
  const sorted = sized.slice().sort((a, b) => a.sort_order - b.sort_order)

  const rows: Array<Partial<Price>> = []

  if (ordered.length > 0) {
    // item_id -> {price, cost, taxout} を後勝ちで確定
    const byItem = new Map<string, { p: number; c: number | null; t: number | null }>()
    for (const b of sorted) {
      if (b.from_item_id == null) continue
      const fi = orderOf.get(b.from_item_id)
      const ti = b.to_item_id != null ? orderOf.get(b.to_item_id) : fi
      if (fi == null || ti == null) continue
      const [lo, hi] = fi <= ti ? [fi, ti] : [ti, fi]
      for (let i = lo; i <= hi; i++) {
        byItem.set(ordered[i].id, { p: b.price_tax_in, c: b.cost, t: b.price_tax_out })
      }
    }
    ordered.forEach((it) => {
      const v = byItem.get(it.id)
      if (v) rows.push({
        size_set_item_id: it.id, size_label: it.label,
        price_tax_in: v.p, price_tax_out: v.t, cost: v.c, is_eo: false,
      })
    })
  } else {
    // サイズセット無し: 最初の共通バンドを1行に
    const common = sorted[0]
    if (common) rows.push({
      size_label: null, price_tax_in: common.price_tax_in,
      price_tax_out: common.price_tax_out, cost: common.cost, is_eo: false,
    })
  }

  // 別寸(EO)
  const eo = bands.find((b) => b.is_eo)
  if (eo) rows.push({
    size_label: '別寸', price_tax_in: eo.price_tax_in,
    price_tax_out: eo.price_tax_out, cost: eo.cost, is_eo: true,
  })
  return rows
}

// 価格帯を一括置き換え → prices へ展開(マテリアライズ)。
export async function replacePriceBands(
  storeId: string, schoolId: string, productId: string,
  bands: Array<Partial<PriceBand>>, items: SizeSetItem[],
) {
  await sb.from('price_bands').delete()
    .eq('school_id', schoolId).eq('product_id', productId)
  if (bands.length > 0) {
    const payload = bands.map((b, i) => ({
      store_id: storeId, school_id: schoolId, product_id: productId,
      sort_order: i, ...b,
    }))
    const { error } = await sb.from('price_bands').insert(payload)
    if (error) throw error
  }
  // prices へ展開(採寸/EC/API が読む派生データ)
  const full = (bands as PriceBand[]).map((b, i) => ({ ...b, sort_order: i }))
  await replacePrices(storeId, schoolId, productId, expandBandsToPrices(full, items))
}

// 既存の prices(サイズ別)から価格帯を推定(初回/旧データの取り込み用)。
//   連続する同価格サイズを1バンドにまとめる。
export function deriveBandsFromPrices(
  prices: Price[], items: SizeSetItem[],
): Array<Partial<PriceBand>> {
  const ordered = items.slice().sort((a, b) => a.sort_order - b.sort_order)
  const priceOf = new Map(
    prices.filter((p) => !p.is_eo && p.size_set_item_id)
      .map((p) => [p.size_set_item_id as string, p]),
  )
  const bands: Array<Partial<PriceBand>> = []
  let run: { from: string; to: string; p: number; c: number | null; t: number | null } | null = null
  const flush = () => {
    if (run) bands.push({
      from_item_id: run.from, to_item_id: run.to,
      price_tax_in: run.p, price_tax_out: run.t, cost: run.c, is_eo: false,
    })
    run = null
  }
  for (const it of ordered) {
    const pr = priceOf.get(it.id)
    if (!pr) { flush(); continue }
    if (run && run.p === pr.price_tax_in && run.c === pr.cost && run.t === pr.price_tax_out) {
      run.to = it.id
    } else {
      flush()
      run = { from: it.id, to: it.id, p: pr.price_tax_in, c: pr.cost, t: pr.price_tax_out }
    }
  }
  flush()
  // サイズセット無しの共通価格
  if (ordered.length === 0) {
    const common = prices.find((p) => !p.is_eo && !p.size_set_item_id)
    if (common) bands.push({
      from_item_id: null, to_item_id: null,
      price_tax_in: common.price_tax_in, price_tax_out: common.price_tax_out,
      cost: common.cost, is_eo: false,
    })
  }
  return bands
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
