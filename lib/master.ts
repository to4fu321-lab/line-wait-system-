// ============================================================
// マスタデータ アクセス層 (再設計スキーマ)
//   対象: schools / size_sets / size_set_items / products /
//         school_requirements / prices / processing_options
//   設計: docs/master-data-redesign.md
//
//   方針: 画面側は「フラットな型」ではなく正規化型をそのまま扱う。
//
//   通信は必ず /api/master/crud 経由（店舗PIN認証 + サーバー側で store_id 固定）。
//   supabase クライアントを直接使わないのは、anon キーが公開キーであり、
//   テーブルを直接開放すると他店の商品・価格を読み書きできてしまうため。
//   （リレーションの埋め込み取得はサーバー側の同じクエリで行っている）
// ============================================================
import { masterCrud } from '@/lib/masterApi'
import type {
  SchoolMaster, SizeSet, SizeSetItem, ProductMaster,
  SchoolRequirement, Price, MeasurementRow, ProcessingOption,
} from '@/types/master'

/** 一覧取得の共通形 */
async function list<T>(
  storeId: string, resource: Parameters<typeof masterCrud>[1],
  payload: Record<string, unknown> = {},
): Promise<T[]> {
  const { rows } = await masterCrud<{ rows: T[] }>(storeId, resource, 'list', payload)
  return rows ?? []
}

/** 追加・更新の共通形 */
async function upsert<T>(
  storeId: string, resource: Parameters<typeof masterCrud>[1], row: Record<string, unknown>,
): Promise<T> {
  const { row: saved } = await masterCrud<{ row: T }>(storeId, resource, 'upsert', { row })
  return saved
}

function remove(storeId: string, resource: Parameters<typeof masterCrud>[1], id: string) {
  return masterCrud<{ ok: true }>(storeId, resource, 'delete', { id })
}

// ── 学校マスタ ────────────────────────────────────────────────
export function listSchools(storeId: string): Promise<SchoolMaster[]> {
  return list<SchoolMaster>(storeId, 'schools')
}

export function upsertSchool(storeId: string, row: Partial<SchoolMaster>): Promise<SchoolMaster> {
  return upsert<SchoolMaster>(storeId, 'schools', row as Record<string, unknown>)
}

export function deleteSchool(storeId: string, id: string) {
  return remove(storeId, 'schools', id)
}

// ── サイズセットマスタ ────────────────────────────────────────
export async function listSizeSets(storeId: string): Promise<SizeSet[]> {
  const rows = await list<SizeSet>(storeId, 'size_sets')
  return rows.map((s) => ({
    ...s,
    items: (s.items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export function upsertSizeSet(storeId: string, row: Partial<SizeSet>): Promise<SizeSet> {
  const { items, ...rest } = row as Partial<SizeSet> & { items?: SizeSetItem[] }
  return upsert<SizeSet>(storeId, 'size_sets', rest as Record<string, unknown>)
}

export function deleteSizeSet(storeId: string, id: string) {
  return remove(storeId, 'size_sets', id)
}

// サイズ項目をまとめて置き換え(削除→再投入)
export async function replaceSizeSetItems(
  storeId: string, sizeSetId: string, labels: string[],
): Promise<SizeSetItem[]> {
  const { rows } = await masterCrud<{ rows: SizeSetItem[] }>(
    storeId, 'size_sets', 'replaceItems', { sizeSetId, labels })
  return rows ?? []
}

// ── 商品マスタ(自由商品 / 学校別注品) ────────────────────────
// schoolId 指定時: その学校の別注品 + 自由商品(全校共通) を返す
export function listProducts(
  storeId: string,
  opts: { schoolId?: string | null; freeOnly?: boolean } = {},
): Promise<ProductMaster[]> {
  return list<ProductMaster>(storeId, 'products', {
    schoolId: opts.schoolId ?? undefined, freeOnly: !!opts.freeOnly,
  })
}

export function upsertProduct(storeId: string, row: Partial<ProductMaster>): Promise<ProductMaster> {
  const { size_set, school, ...rest } = row as Partial<ProductMaster> & {
    size_set?: unknown; school?: unknown
  }
  return upsert<ProductMaster>(storeId, 'products', rest as Record<string, unknown>)
}

export function deleteProduct(storeId: string, id: string) {
  return remove(storeId, 'products', id)
}

// ── 学校別規程マスタ ──────────────────────────────────────────
// その学校の規程一覧(商品実体を埋め込み)
export function listRequirements(storeId: string, schoolId: string): Promise<SchoolRequirement[]> {
  return list<SchoolRequirement>(storeId, 'school_requirements', { schoolId })
}

export function upsertRequirement(
  storeId: string, row: Partial<SchoolRequirement>,
): Promise<SchoolRequirement> {
  const { product, ...rest } = row as Partial<SchoolRequirement> & { product?: unknown }
  return upsert<SchoolRequirement>(storeId, 'school_requirements', rest as Record<string, unknown>)
}

export function deleteRequirement(storeId: string, id: string) {
  return remove(storeId, 'school_requirements', id)
}

// 商品を学校に割り当て(規程を作成。既存ならスキップ)
export function assignProductToSchool(
  storeId: string, schoolId: string, productId: string,
  attrs: Partial<SchoolRequirement> = {},
): Promise<SchoolRequirement> {
  return upsertRequirement(storeId, {
    school_id: schoolId, product_id: productId, required: true, ...attrs,
  })
}

// ── 価格マスタ ────────────────────────────────────────────────
export function listPrices(storeId: string, schoolId: string, productId: string): Promise<Price[]> {
  return list<Price>(storeId, 'prices', { schoolId, productId })
}

export function upsertPrice(storeId: string, row: Partial<Price>): Promise<Price> {
  return upsert<Price>(storeId, 'prices', row as Record<string, unknown>)
}

export function deletePrice(storeId: string, id: string) {
  return remove(storeId, 'prices', id)
}

// その学校・商品の価格を一括置き換え(サイズ別価格の保存に使用)
export async function replacePrices(
  storeId: string, schoolId: string, productId: string,
  rows: Array<Partial<Price>>,
) {
  await masterCrud(storeId, 'prices', 'replace', { schoolId, productId, rows })
}

// ── 新品加工オプションマスタ ──────────────────────────────────
export function listProcessingOptions(storeId: string): Promise<ProcessingOption[]> {
  return list<ProcessingOption>(storeId, 'processing_options')
}

export function upsertProcessingOption(
  storeId: string, row: Partial<ProcessingOption>,
): Promise<ProcessingOption> {
  return upsert<ProcessingOption>(storeId, 'processing_options', row as Record<string, unknown>)
}

export function deleteProcessingOption(storeId: string, id: string) {
  return remove(storeId, 'processing_options', id)
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
export async function seedDefaultGrades(
  storeId: string, schoolId: string, gradeCount = 3,
): Promise<void> {
  await masterCrud(storeId, 'schools', 'seedGrades', { schoolId, gradeCount })
}

// ============================================================
// 採寸接客: その学校の必須商品 + サイズセット + 価格 を一括取得
//   docs §3 のクエリ。required=false も含めたい場合は requiredOnly=false
// ============================================================
export async function getMeasurementSheet(
  storeId: string, schoolId: string,
  opts: { requiredOnly?: boolean } = {},
): Promise<MeasurementRow[]> {
  const requirements = await list<SchoolRequirement>(storeId, 'school_requirements', {
    schoolId, requiredOnly: opts.requiredOnly !== false,
  })
  if (requirements.length === 0) return []

  // この学校の価格をまとめて取得し product_id でマップ化
  const productIds = requirements.map((r) => r.product_id)
  const prices = await list<Price>(storeId, 'prices', { schoolId, productIds })

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
