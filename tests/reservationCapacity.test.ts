import { describe, it, expect } from 'vitest'
import { capacityOf, generateSlotTimes, slotKey, type CapacityInputs } from '@/lib/reservationCapacity'

// 2026-09-21(月) / 2026-09-20(日)
const MON = '2026-09-21'
const SUN = '2026-09-20'

const baseInput = (over: Partial<CapacityInputs> = {}): CapacityInputs => ({
  businessHours: {
    hours: {
      mon: { open: '10:00', close: '13:00', closed: false },
      sun: { open: '10:00', close: '17:00', closed: true },
    },
  },
  slotMin: 60,
  defaultCapacity: 30,
  dateOverrides: {},
  slotOverrides: {},
  staffByDate: {},
  ...over,
})

describe('枠の時間割', () => {
  it('枠の長さで刻む', () => {
    expect(generateSlotTimes('10:00', '13:00', 60)).toEqual(['10:00', '11:00', '12:00'])
    expect(generateSlotTimes('10:00', '11:30', 30)).toEqual(['10:00', '10:30', '11:00'])
  })

  it('終了時刻をはみ出す枠は作らない', () => {
    expect(generateSlotTimes('10:00', '11:00', 90)).toEqual(['10:00'])
  })
})

describe('予約枠の算出', () => {
  it('営業時間を枠の長さで割って枠を作る', () => {
    const c = capacityOf(MON, baseInput())
    expect(c.open).toBe(true)
    expect(c.slots.map(s => s.time)).toEqual(['10:00', '11:00', '12:00'])
  })

  it('各枠には既定の枠数が入る', () => {
    const c = capacityOf(MON, baseInput())
    expect(c.slots.every(s => s.capacity === 30)).toBe(true)
    expect(c.slots.every(s => s.overridden === false)).toBe(true)
  })

  it('枠の長さを変えると枠数が変わる', () => {
    const c = capacityOf(MON, baseInput({ slotMin: 30 }))
    expect(c.slots).toHaveLength(6)
  })

  it('定休曜日は受付しない', () => {
    const c = capacityOf(SUN, baseInput())
    expect(c.open).toBe(false)
    expect(c.reason).toBe('closed_weekday')
    expect(c.slots).toHaveLength(0)
  })

  it('日付指定の0は臨時休業になる', () => {
    const c = capacityOf(MON, baseInput({ dateOverrides: { [MON]: 0 } }))
    expect(c.open).toBe(false)
    expect(c.reason).toBe('date_closed')
  })

  it('定休日でも日付指定があれば臨時営業できる', () => {
    const c = capacityOf(SUN, baseInput({ dateOverrides: { [SUN]: 5 } }))
    expect(c.open).toBe(true)
    expect(c.slots.every(s => s.capacity === 5)).toBe(true)
  })

  it('日付ごとの枠数が既定値より優先される', () => {
    const c = capacityOf(MON, baseInput({ dateOverrides: { [MON]: 10 } }))
    expect(c.slots.every(s => s.capacity === 10)).toBe(true)
  })

  it('時間ごとの枠数が最優先される', () => {
    const c = capacityOf(MON, baseInput({
      dateOverrides: { [MON]: 10 },
      slotOverrides: { [slotKey(MON, '11:00')]: 2 },
    }))
    expect(c.slots.find(s => s.time === '10:00')?.capacity).toBe(10)
    expect(c.slots.find(s => s.time === '11:00')?.capacity).toBe(2)
    expect(c.slots.find(s => s.time === '11:00')?.overridden).toBe(true)
  })

  it('時間ごとに0を入れればその枠だけ締め切れる', () => {
    const c = capacityOf(MON, baseInput({ slotOverrides: { [slotKey(MON, '12:00')]: 0 } }))
    expect(c.open).toBe(true)
    expect(c.slots.find(s => s.time === '12:00')?.capacity).toBe(0)
  })

  it('出勤人数は枠を自動で減らさない（参考表示のみ）', () => {
    const c = capacityOf(MON, baseInput({ staffByDate: { [MON]: 1 } }))
    expect(c.staffOnDuty).toBe(1)
    expect(c.slots.every(s => s.capacity === 30)).toBe(true)
  })

  it('営業時間が未設定でも既定の時間帯で動く', () => {
    const c = capacityOf(MON, baseInput({ businessHours: null }))
    expect(c.startTime).toBe('10:00')
    expect(c.endTime).toBe('17:00')
    expect(c.open).toBe(true)
  })
})
