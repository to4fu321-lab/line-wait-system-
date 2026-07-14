import { describe, it, expect } from 'vitest'
import {
  buildProperties,
  buildRequired,
  slugifyFieldKey,
  sanitizeSuggestedFields,
  type ExtractionField,
} from '@/lib/extraction-schema'

function field(over: Partial<ExtractionField>): ExtractionField {
  return {
    field_key: 'k',
    field_label: 'ラベル',
    field_type: 'text',
    description: null,
    sort_order: 0,
    is_required: false,
    scope: 'item',
    role: null,
    master_kind: null,
    ...over,
  }
}

describe('buildProperties', () => {
  it('text は string 型（[型, "null"]）に変換する', () => {
    const props = buildProperties([field({ field_key: 'product', field_type: 'text' })])
    expect(props.product.type).toEqual(['string', 'null'])
    expect(props.product.format).toBeUndefined()
  })

  it('number は number 型に変換する', () => {
    const props = buildProperties([field({ field_key: 'price', field_type: 'number' })])
    expect(props.price.type).toEqual(['number', 'null'])
  })

  it('date は string 型 + format:"date" に変換する', () => {
    const props = buildProperties([field({ field_key: 'due', field_type: 'date' })])
    expect(props.due.type).toEqual(['string', 'null'])
    expect(props.due.format).toBe('date')
    expect(props.due.description).toContain('YYYY-MM-DD')
  })

  it('description があればそれを優先し、無ければ field_label を使う', () => {
    const withDesc = buildProperties([
      field({ field_key: 'tension', field_label: 'ガットテンション', description: '単位はポンド' }),
    ])
    expect(withDesc.tension.description).toContain('単位はポンド')
    expect(withDesc.tension.description).not.toContain('ガットテンション')

    const noDesc = buildProperties([
      field({ field_key: 'tension', field_label: 'ガットテンション', description: null }),
    ])
    expect(noDesc.tension.description).toContain('ガットテンション')
  })

  it('空白のみの description は無視して field_label を使う', () => {
    const props = buildProperties([
      field({ field_key: 'size', field_label: 'サイズ', description: '   ' }),
    ])
    expect(props.size.description).toContain('サイズ')
  })

  it('複数項目を field_key をキーにまとめる', () => {
    const props = buildProperties([
      field({ field_key: 'product' }),
      field({ field_key: 'price', field_type: 'number' }),
    ])
    expect(Object.keys(props)).toEqual(['product', 'price'])
  })
})

describe('buildRequired', () => {
  it('is_required が true の field_key のみ返す', () => {
    const req = buildRequired([
      field({ field_key: 'product', is_required: true }),
      field({ field_key: 'size', is_required: false }),
      field({ field_key: 'price', is_required: true }),
    ])
    expect(req).toEqual(['product', 'price'])
  })

  it('必須項目が無ければ空配列', () => {
    expect(buildRequired([field({ is_required: false })])).toEqual([])
  })
})

describe('slugifyFieldKey', () => {
  it('英字はそのまま小文字化', () => {
    expect(slugifyFieldKey('Tension')).toBe('tension')
  })
  it('記号・空白は _ に、連続・前後は畳む', () => {
    expect(slugifyFieldKey('  unit price ($)  ')).toBe('unit_price')
  })
  it('数字始まりは f_ を付ける', () => {
    expect(slugifyFieldKey('1st_item')).toBe('f_1st_item')
  })
  it('日本語のみは空文字（呼び出し側でフォールバック）', () => {
    expect(slugifyFieldKey('ガットテンション')).toBe('')
  })
})

describe('sanitizeSuggestedFields', () => {
  it('field_type を text/number/date に丸める（不明は text）', () => {
    const out = sanitizeSuggestedFields([
      { field_key: 'a', field_type: 'number' },
      { field_key: 'b', field_type: 'date' },
      { field_key: 'c', field_type: 'currency' }, // 不明 → text
    ])
    expect(out.map((f) => f.field_type)).toEqual(['number', 'date', 'text'])
  })

  it('空・重複・日本語の field_key を必ず一意に補完する', () => {
    const out = sanitizeSuggestedFields([
      { field_key: 'size' },
      { field_key: 'size' },        // 重複 → size_2
      { field_key: 'ガット', field_label: 'ガット' }, // slug空 → field_3
    ])
    expect(out.map((f) => f.field_key)).toEqual(['size', 'size_2', 'field_3'])
    expect(new Set(out.map((f) => f.field_key)).size).toBe(3)
  })

  it('field_label が空なら field_key で補完し、sort_order を採番', () => {
    const out = sanitizeSuggestedFields([{ field_key: 'price', field_label: '' }])
    expect(out[0].field_label).toBe('price')
    expect(out[0].sort_order).toBe(1)
  })

  it('is_required は真偽値 true のみ true', () => {
    const out = sanitizeSuggestedFields([
      { field_key: 'a', is_required: true },
      { field_key: 'b', is_required: 'yes' }, // 文字列は false 扱い
    ])
    expect(out.map((f) => f.is_required)).toEqual([true, false])
  })

  it('配列以外・空は空配列', () => {
    expect(sanitizeSuggestedFields(null)).toEqual([])
    expect(sanitizeSuggestedFields({})).toEqual([])
  })

  it('scope/role を丸める（不正値は既定）', () => {
    const out = sanitizeSuggestedFields([
      { field_key: 'name', scope: 'header', role: 'customer_name' },
      { field_key: 'price', scope: 'item', role: 'unit_price' },
      { field_key: 'bad', scope: 'xxx', role: 'nope' }, // 不正 → item / null
    ])
    expect(out.map((f) => f.scope)).toEqual(['header', 'item', 'item'])
    expect(out.map((f) => f.role)).toEqual(['customer_name', 'unit_price', null])
  })
})
