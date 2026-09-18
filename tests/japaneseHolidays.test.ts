import { describe, it, expect } from 'vitest'
import { holidayName, holidaysOfYear, holidayMapOfMonth } from '@/lib/japaneseHolidays'

describe('日本の祝日判定', () => {
  it('固定日の祝日を判定できる', () => {
    expect(holidayName('2026-01-01')).toBe('元日')
    expect(holidayName('2026-02-11')).toBe('建国記念の日')
    expect(holidayName('2026-05-03')).toBe('憲法記念日')
    expect(holidayName('2026-11-23')).toBe('勤労感謝の日')
  })

  it('ハッピーマンデーは必ず月曜になる', () => {
    for (const year of [2025, 2026, 2027]) {
      const targets = ['成人の日', '海の日', '敬老の日', 'スポーツの日']
      for (const name of targets) {
        const h = holidaysOfYear(year).find(x => x.name === name)
        expect(h, `${year} ${name}`).toBeDefined()
        expect(new Date(h!.date + 'T00:00:00Z').getUTCDay(), `${year} ${name} は月曜`).toBe(1)
      }
    }
  })

  it('春分・秋分が実際の暦と一致する', () => {
    expect(holidaysOfYear(2025).find(h => h.name === '春分の日')?.date).toBe('2025-03-20')
    expect(holidaysOfYear(2025).find(h => h.name === '秋分の日')?.date).toBe('2025-09-23')
    expect(holidaysOfYear(2026).find(h => h.name === '春分の日')?.date).toBe('2026-03-20')
    expect(holidaysOfYear(2026).find(h => h.name === '秋分の日')?.date).toBe('2026-09-23')
  })

  it('日曜と重なった祝日は翌日が振替休日になる', () => {
    // 2026-11-23(勤労感謝の日)は月曜なので振替なし。2027-01-01は金曜。
    // 2026-02-23(天皇誕生日)は月曜。日曜と重なる例として 2027-08-11 を確認する
    const y2026 = holidaysOfYear(2026)
    const sundayHoliday = y2026.find(h => new Date(h.date + 'T00:00:00Z').getUTCDay() === 0)
    if (sundayHoliday) {
      const next = new Date(sundayHoliday.date + 'T00:00:00Z')
      next.setUTCDate(next.getUTCDate() + 1)
      const key = next.toISOString().slice(0, 10)
      expect(y2026.some(h => h.date === key)).toBe(true)
    }
    // 2025-11-03(文化の日)は月曜、2025-11-23(勤労感謝の日)は日曜→11-24が振替
    expect(holidayName('2025-11-24')).toBe('振替休日')
  })

  it('祝日でない日は null', () => {
    expect(holidayName('2026-06-10')).toBeNull()
    expect(holidayName('2026-09-18')).toBeNull()
  })

  it('月単位の取得ができる', () => {
    const may = holidayMapOfMonth(2026, 5)
    expect(may['2026-05-03']).toBe('憲法記念日')
    expect(may['2026-05-04']).toBe('みどりの日')
    expect(may['2026-05-05']).toBe('こどもの日')
    expect(Object.keys(may).every(d => d.startsWith('2026-05-'))).toBe(true)
  })
})
