import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SEASON, isMonthInSeason, isDateInSeason, offSeasonMessageOf, seasonFromRow,
} from '@/app/[storeId]/admin/reservations/_lib/season'

const season = (patch: Partial<typeof DEFAULT_SEASON>) => ({ ...DEFAULT_SEASON, enabled: true, ...patch })

describe('予約シーズンの判定', () => {
  it('年をまたがない期間（1月〜4月）', () => {
    for (const m of [1, 2, 3, 4]) expect(isMonthInSeason(m, 1, 4), `${m}月`).toBe(true)
    for (const m of [5, 9, 12]) expect(isMonthInSeason(m, 1, 4), `${m}月`).toBe(false)
  })

  it('年をまたぐ期間（11月〜3月）は前後の年に分かれる', () => {
    // 制服の採寸は年末から入学期まで続くので、ここを取り違えると
    // シーズン中なのに予約を受け付けなくなる
    for (const m of [11, 12, 1, 2, 3]) expect(isMonthInSeason(m, 11, 3), `${m}月`).toBe(true)
    for (const m of [4, 7, 10]) expect(isMonthInSeason(m, 11, 3), `${m}月`).toBe(false)
  })

  it('開始月と終了月が同じなら、その月だけ', () => {
    expect(isMonthInSeason(3, 3, 3)).toBe(true)
    expect(isMonthInSeason(4, 3, 3)).toBe(false)
  })

  it('シーズン機能がオフなら、いつでも予約できる', () => {
    expect(isDateInSeason('2026-08-15', { ...DEFAULT_SEASON, enabled: false })).toBe(true)
  })

  it('日付文字列の月で判定する', () => {
    const s = season({ fromMonth: 1, toMonth: 4 })
    expect(isDateInSeason('2026-03-31', s)).toBe(true)
    expect(isDateInSeason('2026-04-30', s)).toBe(true)  // 終了月は末日まで受け付ける
    expect(isDateInSeason('2026-05-01', s)).toBe(false)
  })
})

describe('シーズン外の案内文', () => {
  it('未入力なら期間を入れた既定文を出す', () => {
    expect(offSeasonMessageOf(season({ fromMonth: 1, toMonth: 4, message: '   ' })))
      .toBe('1月〜4月以外の時期は予約不要です。直接ご来店いただくか、お問い合わせください。')
  })

  it('入力があればそれをそのまま出す', () => {
    expect(offSeasonMessageOf(season({ message: 'お電話ください' }))).toBe('お電話ください')
  })
})

describe('stores の行から設定を組み立てる', () => {
  it('壊れた月の値は既定に寄せる（判定がおかしくなるより安全）', () => {
    const s = seasonFromRow({
      reservation_season_enabled: true,
      reservation_season_from_month: 0,
      reservation_season_to_month: 99,
      reservation_offseason_message: null,
    })
    expect(s).toEqual({ enabled: true, fromMonth: 1, toMonth: 4, message: '' })
  })

  it('行が無ければシーズン機能はオフ', () => {
    expect(seasonFromRow(null).enabled).toBe(false)
  })
})
