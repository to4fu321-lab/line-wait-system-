// ============================================================
// マルチテナント抽出スキーマ ユーティリティ
//   extraction_schemas（DB）の項目定義を Anthropic Tool Use の
//   input_schema.properties 形式へ変換する。
//   店舗(テナント)ごとに読み取り項目が異なるため、コードにハードコード
//   せずDB定義から動的にツールスキーマを組み立てる（Configuration as Data）。
// ============================================================

/** DB上の項目型（extraction_schemas.field_type） */
export type FieldType = 'text' | 'number' | 'date'

export const FIELD_TYPES: FieldType[] = ['text', 'number', 'date']

/** 見出し(伝票共通) か 明細行 か */
export type FieldScope = 'header' | 'item'

export const FIELD_SCOPES: FieldScope[] = ['header', 'item']

/** 汎用受付プロモータ用の意味役割（顧客解決・合計計算に使う。null=通常項目） */
export type FieldRole =
  | 'customer_name'
  | 'customer_tel'
  | 'date'
  | 'quantity'
  | 'unit_price'
  | 'line_name'
  | 'note'

export const FIELD_ROLES: FieldRole[] = [
  'customer_name', 'customer_tel', 'date', 'quantity', 'unit_price', 'line_name', 'note',
]

/** 紐付け先マスタ（Phase 2 で使用。null=非連動） */
export type MasterKind = 'repair_item' | 'repair_option' | 'product' | 'repair_vendor' | 'customer'

export const MASTER_KINDS: MasterKind[] = [
  'repair_item', 'repair_option', 'product', 'repair_vendor', 'customer',
]

/** extraction_schemas 1レコード（DB定義）に対応する型 */
export interface ExtractionField {
  field_key: string
  field_label: string
  field_type: FieldType
  description: string | null
  sort_order: number
  is_required: boolean
  scope: FieldScope
  role: FieldRole | null
  master_kind: MasterKind | null
}

/** 見出し項目だけ抽出 */
export function headerFields(fields: ExtractionField[]): ExtractionField[] {
  return fields.filter((f) => f.scope === 'header')
}

/** 明細項目だけ抽出 */
export function itemFields(fields: ExtractionField[]): ExtractionField[] {
  return fields.filter((f) => f.scope !== 'header')
}

/** テンプレートの保存先種別 */
export type TemplateTarget = 'reception' | 'repair' | 'order'

/** extraction_templates 1レコード（伝票種別）に対応する型 */
export interface ExtractionTemplate {
  id: string
  store_id: string
  key: string
  label: string
  description: string | null
  sort_order: number
  target: TemplateTarget
}

/** テンプレート + その項目一覧 */
export interface ExtractionTemplateWithFields extends ExtractionTemplate {
  fields: ExtractionField[]
}

/** Anthropic input_schema の1プロパティ定義 */
export interface JsonSchemaProperty {
  // 読み取れない場合の null を許可するため常に [型, "null"] のタプルにする
  type: [string, 'null']
  description: string
  format?: 'date'
}

/**
 * DB定義の配列を Anthropic Tool Use の input_schema.properties 形式へ変換する。
 *
 * 型変換:
 *   text   → string
 *   number → number
 *   date   → string（format: "date" / "YYYY-MM-DD"）
 *
 * - 各項目は type を [型, "null"] とし、読み取れない場合の null を許可する。
 * - description は DBの description を優先し、無ければ field_label を使う。
 */
export function buildProperties(
  fields: ExtractionField[],
): Record<string, JsonSchemaProperty> {
  const properties: Record<string, JsonSchemaProperty> = {}

  for (const f of fields) {
    const jsonType = f.field_type === 'number' ? 'number' : 'string'
    const hint = f.description && f.description.trim() ? f.description.trim() : f.field_label

    const prop: JsonSchemaProperty = {
      type: [jsonType, 'null'],
      description:
        f.field_type === 'date'
          ? `${hint}（YYYY-MM-DD形式。読み取れない場合はnull）`
          : `${hint}（読み取れない場合はnull）`,
    }
    if (f.field_type === 'date') prop.format = 'date'

    properties[f.field_key] = prop
  }

  return properties
}

/** is_required が true の field_key 配列を返す（Tool Use の required 用） */
export function buildRequired(fields: ExtractionField[]): string[] {
  return fields.filter((f) => f.is_required).map((f) => f.field_key)
}

// ============================================================
// サンプル伝票からの項目自動提案（AI出力のサニタイズ）
// ============================================================

/** AIが提案する1項目の生データ（型は信用しない） */
export interface RawSuggestedField {
  field_key?: unknown
  field_label?: unknown
  field_type?: unknown
  description?: unknown
  is_required?: unknown
  scope?: unknown
  role?: unknown
  master_kind?: unknown
}

/**
 * field_key を DB／JSONスキーマのプロパティ名として安全な形へ正規化する。
 *   - 英数と _ のみ、小文字、先頭は英字（数字始まりは f_ を付与）
 *   - 日本語などは除去され、空になった場合は空文字を返す（呼び出し側でフォールバック）
 */
export function slugifyFieldKey(raw: string): string {
  let s = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_') // 英数と_以外は_に
    .replace(/_+/g, '_')          // 連続_を1つに
    .replace(/^_+|_+$/g, '')      // 前後の_を除去
  if (s && /^[0-9]/.test(s)) s = `f_${s}` // 数字始まりを回避
  return s
}

/**
 * AIが提案した項目配列を、そのまま extraction_schemas に入れられる形へ正規化する。
 *   - field_type は text/number/date のみに丸める（不明は text）
 *   - field_key は slug 化し、空・重複はインデックスで補完して必ず一意にする
 *   - field_label は空なら field_key で補完
 *   - sort_order は配列順で採番
 * DBやAIの出力を信用せず、UI編集前の「たたき台」を安全に組み立てる目的。
 */
export function sanitizeSuggestedFields(raw: unknown): ExtractionField[] {
  const arr = Array.isArray(raw) ? raw : []
  const used = new Set<string>()
  const out: ExtractionField[] = []

  arr.forEach((item, i) => {
    const r = (item ?? {}) as RawSuggestedField
    const label = typeof r.field_label === 'string' ? r.field_label.trim() : ''

    let key = slugifyFieldKey(typeof r.field_key === 'string' ? r.field_key : '')
    if (!key) key = `field_${i + 1}`
    if (used.has(key)) {
      let n = 2
      while (used.has(`${key}_${n}`)) n++
      key = `${key}_${n}`
    }
    used.add(key)

    const t = typeof r.field_type === 'string' ? r.field_type.toLowerCase() : ''
    const field_type: FieldType = FIELD_TYPES.includes(t as FieldType) ? (t as FieldType) : 'text'

    const description = typeof r.description === 'string' && r.description.trim()
      ? r.description.trim()
      : null

    const scope: FieldScope =
      typeof r.scope === 'string' && FIELD_SCOPES.includes(r.scope as FieldScope)
        ? (r.scope as FieldScope) : 'item'
    const role: FieldRole | null =
      typeof r.role === 'string' && FIELD_ROLES.includes(r.role as FieldRole)
        ? (r.role as FieldRole) : null
    const master_kind: MasterKind | null =
      typeof r.master_kind === 'string' && MASTER_KINDS.includes(r.master_kind as MasterKind)
        ? (r.master_kind as MasterKind) : null

    out.push({
      field_key: key,
      field_label: label || key,
      field_type,
      description,
      sort_order: i + 1,
      is_required: r.is_required === true,
      scope,
      role,
      master_kind,
    })
  })

  return out
}
