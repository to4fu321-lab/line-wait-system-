import { describe, it, expect } from 'vitest'
import { toNum, roleKey, computeTotal, extractCustomer } from '@/lib/slip-records'
import type { ExtractionField } from '@/lib/extraction-schema'

function f(over: Partial<ExtractionField>): ExtractionField {
  return {
    field_key: 'k', field_label: 'ラベル', field_type: 'text',
    description: null, sort_order: 0, is_required: false,
    scope: 'item', role: null, master_kind: null, ...over,
  }
}

describe('toNum', () => {
  it('数値・数字文字列・単位付きを数値化', () => {
    expect(toNum(1200)).toBe(1200)
    expect(toNum('¥1,200')).toBe(1200)
    expect(toNum('3本')).toBe(3)
  })
  it('空・非数値は null', () => {
    expect(toNum('')).toBeNull()
    expect(toNum(null)).toBeNull()
    expect(toNum('あ')).toBeNull()
  })
})

describe('roleKey', () => {
  it('指定roleを持つfieldのkeyを返す', () => {
    const fields = [f({ field_key: 'name', role: 'customer_name' }), f({ field_key: 'p', role: 'unit_price' })]
    expect(roleKey(fields, 'unit_price')).toBe('p')
    expect(roleKey(fields, 'quantity')).toBeNull()
  })
})

describe('computeTotal', () => {
  const fields = [
    f({ field_key: 'price', field_type: 'number', role: 'unit_price', scope: 'item' }),
    f({ field_key: 'qty', field_type: 'number', role: 'quantity', scope: 'item' }),
  ]
  it('単価×数量を合算する', () => {
    const items = [{ price: 1000, qty: 2 }, { price: '500', qty: '3' }]
    expect(computeTotal(fields, items)).toBe(3500)
  })
  it('数量が無ければ1として単価を合算', () => {
    const noQty = [f({ field_key: 'price', field_type: 'number', role: 'unit_price', scope: 'item' })]
    expect(computeTotal(noQty, [{ price: 800 }, { price: 200 }])).toBe(1000)
  })
  it('unit_price role が無ければ null（合計非対応）', () => {
    const plain = [f({ field_key: 'x', scope: 'item' })]
    expect(computeTotal(plain, [{ x: 'a' }])).toBeNull()
  })
  it('価格が読めない行はスキップ', () => {
    expect(computeTotal(fields, [{ price: null, qty: 2 }, { price: 500, qty: 1 }])).toBe(500)
  })
})

describe('extractCustomer', () => {
  const fields = [
    f({ field_key: 'nm', role: 'customer_name', scope: 'header' }),
    f({ field_key: 'tl', role: 'customer_tel', scope: 'header' }),
  ]
  it('header から顧客名・電話を取り出す', () => {
    expect(extractCustomer(fields, { nm: '山田', tl: '090-1234-5678' })).toEqual({ name: '山田', tel: '090-1234-5678' })
  })
  it('空はnull', () => {
    expect(extractCustomer(fields, { nm: '', tl: null })).toEqual({ name: null, tel: null })
  })
  it('roleが無ければ両方null', () => {
    expect(extractCustomer([f({ field_key: 'x' })], { x: 'a' })).toEqual({ name: null, tel: null })
  })
})
