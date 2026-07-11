import { describe, it, expect } from 'vitest'
import { rateLimit } from '@/lib/rateLimit'

describe('rateLimit', () => {
  it('limit回までは許可、超えたら拒否', () => {
    const key = `test-${Date.now()}-a`
    expect(rateLimit(key, 3, 60_000)).toBe(true)
    expect(rateLimit(key, 3, 60_000)).toBe(true)
    expect(rateLimit(key, 3, 60_000)).toBe(true)
    expect(rateLimit(key, 3, 60_000)).toBe(false)
  })
  it('キーが違えば独立してカウント', () => {
    const a = `test-${Date.now()}-b1`
    const b = `test-${Date.now()}-b2`
    expect(rateLimit(a, 1, 60_000)).toBe(true)
    expect(rateLimit(a, 1, 60_000)).toBe(false)
    expect(rateLimit(b, 1, 60_000)).toBe(true)
  })
  it('ウィンドウが過ぎたらリセットされる', () => {
    const key = `test-${Date.now()}-c`
    expect(rateLimit(key, 1, 1)).toBe(true)   // windowMs=1ms
    expect(rateLimit(key, 1, 1)).toBe(false)
    return new Promise<void>(resolve => setTimeout(() => {
      expect(rateLimit(key, 1, 1)).toBe(true) // 期限切れ後は再度許可
      resolve()
    }, 10))
  })
})
