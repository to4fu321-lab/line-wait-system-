// ============================================================
// マルチテナント抽出スキーマ ユーティリティ
//   extraction_schemas（DB）の項目定義を Anthropic Tool Use の
//   input_schema.properties 形式へ変換する。
//   店舗(テナント)ごとに読み取り項目が異なるため、コードにハードコード
//   せずDB定義から動的にツールスキーマを組み立てる（Configuration as Data）。
// ============================================================

/** extraction_schemas 1レコード（DB定義）に対応する型 */
export interface ExtractionField {
  field_key: string
  field_label: string
  field_type: 'text' | 'number' | 'date'
  description: string | null
  sort_order: number
  is_required: boolean
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
