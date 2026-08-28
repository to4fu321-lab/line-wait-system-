import { describe, it, expect, vi } from 'vitest'
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
  // 実時間に依存させると負荷次第で結果が変わるため、時刻を固定して進める
  it('ウィンドウが過ぎたらリセットされる', () => {
    vi.useFakeTimers()
    try {
      const key = `test-window-reset-${Math.random()}`
      expect(rateLimit(key, 1, 60_000)).toBe(true)
      expect(rateLimit(key, 1, 60_000)).toBe(false)
      vi.advanceTimersByTime(60_001)
      expect(rateLimit(key, 1, 60_000)).toBe(true) // 期限切れ後は再度許可
    } finally {
      vi.useRealTimers()
    }
  })
})
