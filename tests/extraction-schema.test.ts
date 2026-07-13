import { describe, it, expect } from 'vitest'
import { buildProperties, buildRequired, type ExtractionField } from '@/lib/extraction-schema'

function field(over: Partial<ExtractionField>): ExtractionField {
  return {
    field_key: 'k',
    field_label: 'ラベル',
    field_type: 'text',
    description: null,
    sort_order: 0,
    is_required: false,
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
