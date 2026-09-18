import { describe, it, expect } from 'vitest'
import { capacityOf, type CapacityInputs } from '@/lib/reservationCapacity'

// 2026-09-21(月) / 2026-09-20(日)
const MON = '2026-09-21'
const SUN = '2026-09-20'

const baseInput = (over: Partial<CapacityInputs> = {}): CapacityInputs => ({
  businessHours: {
    hours: {
      mon: { open: '10:00', close: '19:00', closed: false },
      sun: { open: '10:00', close: '17:00', closed: true },
    },
  },
  activeFittings: 3,
  perPersonRooms: 1.5,
  overrides: {},
  staffByDate: {},
  ...over,
})

describe('予約枠の自動算出', () => {
  it('受付時間帯は営業時間から決まる', () => {
    const c = capacityOf(MON, baseInput())
    expect(c.startTime).toBe('10:00')
    expect(c.endTime).toBe('19:00')
  })

  it('定休曜日は受付しない', () => {
    const c = capacityOf(SUN, baseInput())
    expect(c.open).toBe(false)
    expect(c.reason).toBe('closed_weekday')
  })

  it('シフト未登録の日は試着室数がそのまま枠数になる', () => {
    const c = capacityOf(MON, baseInput())
    expect(c.open).toBe(true)
    expect(c.maxSlots).toBe(3)
    expect(c.reason).toBe('rooms')
    expect(c.staffOnDuty).toBeNull()
  })

  it('出勤人数が少ない日は枠が絞られる', () => {
    // 1人 × 1.5室 = 1枠（試着室3室より少ないので人数が上限になる）
    const c = capacityOf(MON, baseInput({ staffByDate: { [MON]: 1 } }))
    expect(c.maxSlots).toBe(1)
    expect(c.reason).toBe('staff_limited')
    expect(c.staffOnDuty).toBe(1)
  })

  it('出勤が多くても試着室数を超えない', () => {
    const c = capacityOf(MON, baseInput({ staffByDate: { [MON]: 10 } }))
    expect(c.maxSlots).toBe(3)
    expect(c.reason).toBe('rooms')
  })

  it('出勤0人の日は受付しない', () => {
    const c = capacityOf(MON, baseInput({ staffByDate: { [MON]: 0 } }))
    expect(c.open).toBe(false)
  })

  it('日付指定の上書きは定休日より優先される（臨時営業）', () => {
    const c = capacityOf(SUN, baseInput({ overrides: { [SUN]: 2 } }))
    expect(c.open).toBe(true)
    expect(c.maxSlots).toBe(2)
    expect(c.reason).toBe('date_override')
  })

  it('上書き0は臨時休業として扱う', () => {
    const c = capacityOf(MON, baseInput({ overrides: { [MON]: 0 } }))
    expect(c.open).toBe(false)
    expect(c.reason).toBe('date_closed')
  })

  it('営業時間が未設定でも既定の時間帯で動く', () => {
    const c = capacityOf(MON, baseInput({ businessHours: null }))
    expect(c.startTime).toBe('10:00')
    expect(c.endTime).toBe('17:00')
    expect(c.open).toBe(true)
  })
})
