import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SEASON, isMonthDayInSeason, isDateInSeason, offSeasonMessageOf,
  seasonFromRow, seasonRangeLabel, isWrappingSeason, clampDay, daysInMonth,
} from '@/app/[storeId]/admin/reservations/_lib/season'

const season = (patch: Partial<typeof DEFAULT_SEASON>) => ({ ...DEFAULT_SEASON, enabled: true, ...patch })

describe('予約シーズンの判定（月日）', () => {
  it('年をまたがない期間（1月10日〜4月20日）', () => {
    const inSeason = (m: number, d: number) => isMonthDayInSeason(m, d, 1, 10, 4, 20)
    expect(inSeason(1, 10)).toBe(true)   // 開始日はシーズン内
    expect(inSeason(4, 20)).toBe(true)   // 終了日もシーズン内
    expect(inSeason(1, 9)).toBe(false)   // 開始の前日
    expect(inSeason(4, 21)).toBe(false)  // 終了の翌日
    expect(inSeason(3, 1)).toBe(true)
    expect(inSeason(8, 15)).toBe(false)
  })

  it('同じ月のなかで区切れる（3月1日〜3月15日）', () => {
    // 月単位のままだと3月まるごと予約を受けてしまう。日で切れることが今回の肝
    const inSeason = (m: number, d: number) => isMonthDayInSeason(m, d, 3, 1, 3, 15)
    expect(inSeason(3, 15)).toBe(true)
    expect(inSeason(3, 16)).toBe(false)
    expect(inSeason(2, 28)).toBe(false)
  })

  it('年をまたぐ期間（11月20日〜3月10日）は前後の年に分かれる', () => {
    const inSeason = (m: number, d: number) => isMonthDayInSeason(m, d, 11, 20, 3, 10)
    expect(inSeason(11, 20)).toBe(true)
    expect(inSeason(11, 19)).toBe(false)
    expect(inSeason(12, 31)).toBe(true)
    expect(inSeason(1, 5)).toBe(true)
    expect(inSeason(3, 10)).toBe(true)
    expect(inSeason(3, 11)).toBe(false)
    expect(inSeason(7, 1)).toBe(false)
  })

  it('開始日と終了日が同じなら、その1日だけ', () => {
    expect(isMonthDayInSeason(3, 3, 3, 3, 3, 3)).toBe(true)
    expect(isMonthDayInSeason(3, 4, 3, 3, 3, 3)).toBe(false)
  })

  it('シーズン機能がオフなら、いつでも予約できる', () => {
    expect(isDateInSeason('2026-08-15', { ...DEFAULT_SEASON, enabled: false })).toBe(true)
  })

  it('日付文字列の月日で判定する', () => {
    const s = season({ fromMonth: 2, fromDay: 1, toMonth: 3, toDay: 15 })
    expect(isDateInSeason('2026-01-31', s)).toBe(false)
    expect(isDateInSeason('2026-02-01', s)).toBe(true)
    expect(isDateInSeason('2026-03-15', s)).toBe(true)
    expect(isDateInSeason('2026-03-16', s)).toBe(false)
  })

  it('年をまたぐ期間かを判定できる', () => {
    expect(isWrappingSeason(season({ fromMonth: 11, fromDay: 20, toMonth: 3, toDay: 10 }))).toBe(true)
    expect(isWrappingSeason(season({ fromMonth: 1, fromDay: 10, toMonth: 4, toDay: 20 }))).toBe(false)
    // 同じ月のなかで開始が後ろなら、それも年またぎ（3月20日〜3月10日）
    expect(isWrappingSeason(season({ fromMonth: 3, fromDay: 20, toMonth: 3, toDay: 10 }))).toBe(true)
  })
})

describe('シーズン外の案内文', () => {
  it('未入力なら月日を入れた既定文を出す', () => {
    expect(offSeasonMessageOf(season({ fromMonth: 1, fromDay: 10, toMonth: 4, toDay: 20, message: '   ' })))
      .toBe('1月10日〜4月20日以外の時期は予約不要です。直接ご来店いただくか、お問い合わせください。')
  })

  it('入力があればそれをそのまま出す', () => {
    expect(offSeasonMessageOf(season({ message: 'お電話ください' }))).toBe('お電話ください')
  })

  it('期間だけを短く出せる', () => {
    expect(seasonRangeLabel(season({ fromMonth: 2, fromDay: 1, toMonth: 3, toDay: 15 })))
      .toBe('2月1日〜3月15日')
  })
})

describe('日の値の丸め', () => {
  it('月を変えて日がはみ出したら、その月の末日に寄せる', () => {
    // 3月31日のまま4月にすると存在しない日になる
    expect(clampDay(31, 4, 30)).toBe(30)
    expect(clampDay(31, 3, 31)).toBe(31)
  })

  it('2月は閏年も選べるよう29日まで許す', () => {
    expect(daysInMonth(2)).toBe(29)
    expect(clampDay(30, 2, 29)).toBe(29)
  })
})

describe('stores の行から設定を組み立てる', () => {
  it('壊れた値は既定に寄せる（判定がおかしくなるより安全）', () => {
    const s = seasonFromRow({
      reservation_season_enabled: true,
      reservation_season_from_month: 0,
      reservation_season_from_day: 0,
      reservation_season_to_month: 99,
      reservation_season_to_day: 99,
      reservation_offseason_message: null,
    })
    expect(s).toEqual({ enabled: true, fromMonth: 1, fromDay: 1, toMonth: 4, toDay: 30, message: '' })
  })

  it('日が未設定の古い行は「その月まるごと」として読む', () => {
    // 月だけで設定していた頃の意図（3月なら3月いっぱい）を変えないため
    const s = seasonFromRow({
      reservation_season_enabled: true,
      reservation_season_from_month: 2,
      reservation_season_to_month: 3,
    })
    expect(s.fromDay).toBe(1)
    expect(s.toDay).toBe(31)
    expect(isDateInSeason('2026-03-31', s)).toBe(true)
    expect(isDateInSeason('2026-04-01', s)).toBe(false)
  })

  it('行が無ければシーズン機能はオフ', () => {
    expect(seasonFromRow(null).enabled).toBe(false)
  })
})
