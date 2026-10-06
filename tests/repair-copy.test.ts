import { describe, it, expect, vi } from 'vitest'

// 価格調整は純関数だけをテストする（Supabase には繋がない）
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { adjustBase, adjustDelta } from '@/lib/repairCopy'

describe('お直しマスタのコピー: 価格の一括調整', () => {
  it('そのまま', () => {
    expect(adjustBase(1500, { mode: 'none' })).toBe(1500)
    expect(adjustDelta(-200, { mode: 'none' })).toBe(-200)
  })
  it('+円 は基本料金だけに掛け、0円未満にしない', () => {
    expect(adjustBase(1500, { mode: 'add', yen: 500 })).toBe(2000)
    expect(adjustBase(300, { mode: 'add', yen: -500 })).toBe(0)
    expect(adjustDelta(300, { mode: 'add', yen: 500 })).toBe(300)
  })
  it('×% は四捨五入。オプションは指定時のみ・符号維持', () => {
    expect(adjustBase(1500, { mode: 'pct', pct: 110, options: false })).toBe(1650)
    expect(adjustBase(999, { mode: 'pct', pct: 110, options: false })).toBe(1099)
    expect(adjustDelta(300, { mode: 'pct', pct: 120, options: false })).toBe(300)
    expect(adjustDelta(300, { mode: 'pct', pct: 120, options: true })).toBe(360)
    expect(adjustDelta(-200, { mode: 'pct', pct: 150, options: true })).toBe(-300)
    expect(adjustDelta(0, { mode: 'pct', pct: 150, options: true })).toBe(0)
  })
})
