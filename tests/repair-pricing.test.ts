import { describe, it, expect } from 'vitest'
import {
  unitFactor, charCount, optionsTotal, calcLinePrice, needsQuote, addBusinessDays,
} from '@/lib/repairPricing'

describe('unitFactor', () => {
  it('per_item は qty をそのまま返す', () => {
    expect(unitFactor('per_item', {}, 3)).toBe(3)
  })
  it('qty=0 は 1 に補正される', () => {
    expect(unitFactor('per_item', {}, 0)).toBe(1)
  })
  it('per_cm は length_cm を数値化する', () => {
    expect(unitFactor('per_cm', { length_cm: '5' }, 1)).toBe(5)
  })
  it('per_cm は "10cm" のような単位付き入力も許容する', () => {
    expect(unitFactor('per_cm', { length_cm: '10cm' }, 1)).toBe(10)
  })
  it('per_cm で数値化できない入力は 0（NaNを伝播させない）', () => {
    expect(unitFactor('per_cm', { length_cm: 'abc' }, 1)).toBe(0)
    expect(unitFactor('per_cm', {}, 1)).toBe(0)
  })
  it('per_name は文字数を返す', () => {
    expect(unitFactor('per_name', { text: '山田太郎' }, 1)).toBe(4)
  })
})

describe('charCount', () => {
  it('空白を除いた文字数（全角・半角とも1文字）', () => {
    expect(charCount('山田 太郎')).toBe(4)
    expect(charCount('Yamada Taro')).toBe(10)
    expect(charCount('')).toBe(0)
  })
  it('文字列以外は 0', () => {
    expect(charCount(null)).toBe(0)
    expect(charCount(123)).toBe(0)
  })
})

describe('optionsTotal', () => {
  it('項目と同じ単位のオプションは従量課金', () => {
    // per_cm 項目 + per_cm オプション(+100/cm) × 5cm = 500
    expect(optionsTotal('per_cm', [{ price_delta: 100, price_unit: 'per_cm' }], { length_cm: '5' }, 1)).toBe(500)
  })
  it('項目と異なる単位のオプションは固定加算', () => {
    // per_name 項目に per_item オプション(+100) → ×1 固定
    expect(optionsTotal('per_name', [{ price_delta: 100, price_unit: 'per_item' }], { text: 'あいう' }, 1)).toBe(100)
  })
})

describe('calcLinePrice', () => {
  it('基本料金 × 数量 + オプション', () => {
    const price = calcLinePrice({
      item: { base_price: 1000, price_unit: 'per_item' },
      options: [{ price_delta: 300, price_unit: 'per_item' }],
      inputs: {},
      qty: 2,
    })
    // 1000×2 + 300×2 = 2600
    expect(price).toBe(2600)
  })
  it('刺繍: 文字数課金 + 固定オプション', () => {
    const price = calcLinePrice({
      item: { base_price: 200, price_unit: 'per_name' },
      options: [{ price_delta: 100, price_unit: 'per_item' }], // 金色 +100/式
      inputs: { text: '山田太郎' },
      qty: 1,
    })
    // 200×4文字 + 100 = 900
    expect(price).toBe(900)
  })
  it('マイナスにはならない（0未満は0に丸め）', () => {
    const price = calcLinePrice({
      item: { base_price: 100, price_unit: 'per_item' },
      options: [{ price_delta: -500, price_unit: 'per_item' }],
      inputs: {},
      qty: 1,
    })
    expect(price).toBe(0)
  })
})

describe('needsQuote', () => {
  it('項目自体が要見積もりなら true', () => {
    expect(needsQuote({ requires_quote: true }, [])).toBe(true)
  })
  it('オプションに要見積もりが1つでもあれば true', () => {
    expect(needsQuote({ requires_quote: false }, [{ requires_quote: false }, { requires_quote: true }])).toBe(true)
  })
  it('どちらも不要なら false', () => {
    expect(needsQuote({ requires_quote: false }, [{ requires_quote: false }])).toBe(false)
  })
})

describe('addBusinessDays', () => {
  it('平日のみカウントして土日を飛ばす', () => {
    // 2026-07-10(金) + 1営業日 = 7/13(月)
    const result = addBusinessDays(new Date('2026-07-10T00:00:00'), 1)
    expect(result.getDay()).toBe(1) // 月曜
    expect(result.getDate()).toBe(13)
  })
  it('0日なら同日', () => {
    const from = new Date('2026-07-10T00:00:00')
    expect(addBusinessDays(from, 0).getTime()).toBe(from.getTime())
  })
})
