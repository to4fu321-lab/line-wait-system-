import { describe, it, expect } from 'vitest'
import { calcTotalsWithDiscount, calcTax, lineTotal } from '@/types/sales'

describe('calcTotalsWithDiscount（レジ値引き）', () => {
  it('値引きなしは calcTax と同じ', () => {
    expect(calcTotalsWithDiscount(10000, 0, 10, true)).toEqual({ ...calcTax(10000, 10, true), discount: 0 })
  })

  it('内税: 値引き後の税込合計から税を逆算する', () => {
    const r = calcTotalsWithDiscount(10000, 500, 10, true)
    expect(r.discount).toBe(500)
    expect(r.total).toBe(9500)
    expect(r.subtotal + r.tax).toBe(9500)
    expect(r.tax).toBe(9500 - Math.round(9500 / 1.1))
  })

  it('外税: 値引き後の税抜額に課税する', () => {
    const r = calcTotalsWithDiscount(10000, 1000, 10, false)
    expect(r.subtotal).toBe(9000)
    expect(r.tax).toBe(900)
    expect(r.total).toBe(9900)
  })

  it('値引きが合計を超える場合は合計までに丸める（マイナス会計を防ぐ）', () => {
    const r = calcTotalsWithDiscount(3000, 99999, 10, true)
    expect(r.discount).toBe(3000)
    expect(r.total).toBe(0)
    expect(r.subtotal).toBe(0)
    expect(r.tax).toBe(0)
  })

  it('マイナス値引き・NaN は 0 として扱う', () => {
    expect(calcTotalsWithDiscount(5000, -100, 10, true).discount).toBe(0)
    expect(calcTotalsWithDiscount(5000, Number('abc'), 10, true).discount).toBe(0)
  })

  it('小数の値引きは四捨五入する', () => {
    expect(calcTotalsWithDiscount(5000, 99.6, 10, true).discount).toBe(100)
  })
})

describe('lineTotal', () => {
  it('単価×数量。マイナスは0に丸める', () => {
    expect(lineTotal({ unit_price: 1200, qty: 3 })).toBe(3600)
    expect(lineTotal({ unit_price: -500, qty: 2 })).toBe(0)
  })
})
