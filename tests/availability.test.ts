import { describe, it, expect } from 'vitest'
import { defaultAvailability, dowKeyOf, isAvailableOn, availabilityRangeFor } from '@/lib/availability'

describe('dowKeyOf', () => {
  it('日付から曜日キーを返す（JST判定）', () => {
    expect(dowKeyOf('2026-07-04')).toBe('sat')
    expect(dowKeyOf('2026-07-05')).toBe('sun')
    expect(dowKeyOf('2026-07-06')).toBe('mon')
  })
})

describe('defaultAvailability', () => {
  it('日曜のみ off で他は 10:00-19:00', () => {
    const av = defaultAvailability()
    expect(av.sun?.on).toBe(false)
    expect(av.mon).toEqual({ on: true, start: '10:00', end: '19:00' })
  })
})

describe('isAvailableOn', () => {
  const av = defaultAvailability()
  it('勤務可能な曜日は true', () => {
    expect(isAvailableOn(av, '2026-07-06')).toBe(true) // 月
  })
  it('off の曜日は false', () => {
    expect(isAvailableOn(av, '2026-07-05')).toBe(false) // 日
  })
  it('availability 未設定は false', () => {
    expect(isAvailableOn(null, '2026-07-06')).toBe(false)
  })
})

describe('availabilityRangeFor', () => {
  const av = defaultAvailability()
  it('on の曜日は時間帯を返す', () => {
    expect(availabilityRangeFor(av, '2026-07-06')).toEqual({ on: true, start: '10:00', end: '19:00' })
  })
  it('off の曜日は null', () => {
    expect(availabilityRangeFor(av, '2026-07-05')).toBeNull()
  })
})
