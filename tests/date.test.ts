import { describe, it, expect, vi, afterEach } from 'vitest'
import { todayJst, getTodayStart, toJstDateString, toJstTimeString } from '@/lib/date'

afterEach(() => vi.useRealTimers())

describe('todayJst', () => {
  it('UTC 15:00 を過ぎたら JST では翌日になる', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T15:30:00Z')) // JST 2026-07-05 00:30
    expect(todayJst()).toBe('2026-07-05')
  })

  it('UTC 14:59 までは JST 同日', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T14:59:00Z')) // JST 2026-07-04 23:59
    expect(todayJst()).toBe('2026-07-04')
  })
})

describe('getTodayStart', () => {
  it('JST 0:00 を UTC (前日15:00) で返す', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T10:00:00Z')) // JST 2026-07-04 19:00
    expect(getTodayStart()).toBe('2026-07-03T15:00:00.000Z')
  })

  it('JST 日付が変わった直後も正しい', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T15:00:00Z')) // JST 2026-07-05 00:00
    expect(getTodayStart()).toBe('2026-07-04T15:00:00.000Z')
  })
})

describe('toJstDateString / toJstTimeString', () => {
  it('UTC の ISO 文字列を JST に変換する', () => {
    expect(toJstDateString('2026-07-04T20:30:00Z')).toBe('2026-07-05')
    expect(toJstTimeString('2026-07-04T20:30:00Z')).toBe('05:30')
  })

  it('タイムゾーン付き ISO 文字列も正しく変換する', () => {
    expect(toJstDateString('2026-07-05T09:15:00+09:00')).toBe('2026-07-05')
    expect(toJstTimeString('2026-07-05T09:15:00+09:00')).toBe('09:15')
  })
})
