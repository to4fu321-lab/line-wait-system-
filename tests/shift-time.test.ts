import { describe, it, expect } from 'vitest'
import { toMinutes, fmtHM, workedMinutes, fmtDurationH, wageOf } from '@/app/[storeId]/admin/shifts/_lib/time'
import type { Staff } from '@/types/master'

describe('toMinutes', () => {
  it('HH:MM を分に変換する', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('23:59')).toBe(1439)
  })
  it('HH:MM:SS も受け付ける（秒は無視）', () => {
    expect(toMinutes('09:30:45')).toBe(570)
  })
})

describe('fmtHM', () => {
  it('HH:MM:SS を HH:MM に丸める', () => {
    expect(fmtHM('09:30:00')).toBe('09:30')
    expect(fmtHM('09:30')).toBe('09:30')
  })
})

describe('workedMinutes', () => {
  it('実働 = 終了 - 開始 - 休憩', () => {
    expect(workedMinutes('09:00', '18:00', 60)).toBe(480)
  })
  it('休憩0でも計算できる', () => {
    expect(workedMinutes('10:00', '15:00', 0)).toBe(300)
  })
  it('日跨ぎシフト（22:00→06:00）は終了に+24hして計算する', () => {
    expect(workedMinutes('22:00', '06:00', 0)).toBe(480)
  })
  it('休憩が実働を超える場合は0に丸める', () => {
    expect(workedMinutes('09:00', '10:00', 120)).toBe(0)
  })
})

describe('fmtDurationH', () => {
  it('分を h/m 表記にする', () => {
    expect(fmtDurationH(480)).toBe('8h')
    expect(fmtDurationH(510)).toBe('8h30m')
    expect(fmtDurationH(45)).toBe('0h45m')
  })
})

describe('wageOf', () => {
  const staff = { id: 's1', hourly_wage: 1200 } as unknown as Staff
  it('シフト個別の時給が優先される', () => {
    expect(wageOf({ hourly_wage: 1500, staff_id: 's1' }, { s1: staff })).toBe(1500)
  })
  it('シフト時給がなければスタッフ既定時給', () => {
    expect(wageOf({ hourly_wage: null, staff_id: 's1' }, { s1: staff })).toBe(1200)
  })
  it('どちらもなければ0', () => {
    expect(wageOf({ hourly_wage: null, staff_id: 'unknown' }, {})).toBe(0)
  })
})
