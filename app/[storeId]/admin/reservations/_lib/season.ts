// ============================================================
// 予約シーズン（予約を受け付ける時期）
//
//  制服の採寸は入学期に集中するので、それ以外の時期は予約を受け付けず
//  「直接ご来店かお問い合わせください」と案内したい。
//  ここはその期間判定と案内文だけを扱う。
//  枠そのものの計算は lib/reservationCapacity。
//
//  期間は月日で持つ（例: 1月10日〜4月20日）。
//  「3月いっぱい」のように月単位で区切ることもあるが、
//  実際の採寸期間は「2月1日から3月15日まで」のように日で決まるため。
//  年は持たない。毎年おなじ時期が来る前提で、月日だけで判定する。
// ============================================================
import { supabase } from '@/lib/supabase'

const sb = supabase as any

export interface SeasonSettings {
  enabled: boolean
  /** 受付開始月 1-12 */
  fromMonth: number
  /** 受付開始日 1-31 */
  fromDay: number
  /** 受付終了月 1-12 */
  toMonth: number
  /** 受付終了日 1-31。この日まで受け付ける（当日を含む） */
  toDay: number
  /** シーズン外に出す案内文 */
  message: string
}

export const DEFAULT_SEASON: SeasonSettings = {
  enabled: false,
  fromMonth: 1,
  fromDay: 1,
  toMonth: 4,
  toDay: 30,
  message: '',
}

/** その月の日数。2月は閏年も選べるよう29日まで許す */
export function daysInMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31
}

/** 月日を比べられる数値にする（3月15日 → 315） */
function md(month: number, day: number): number {
  return month * 100 + day
}

const fmtMd = (month: number, day: number) => `${month}月${day}日`

/** 案内文が未入力のときに出す文面 */
export function defaultOffSeasonMessage(s: SeasonSettings): string {
  return `${fmtMd(s.fromMonth, s.fromDay)}〜${fmtMd(s.toMonth, s.toDay)}以外の時期は予約不要です。`
    + '直接ご来店いただくか、お問い合わせください。'
}

/** 設定から、お客様に見せる案内文を決める */
export function offSeasonMessageOf(s: SeasonSettings): string {
  return s.message.trim() || defaultOffSeasonMessage(s)
}

/** 設定画面などで期間を短く出したいとき（例: 1月10日〜4月20日） */
export function seasonRangeLabel(s: SeasonSettings): string {
  return `${fmtMd(s.fromMonth, s.fromDay)}〜${fmtMd(s.toMonth, s.toDay)}`
}

/** 年をまたぐ期間か（例: 11月20日〜3月10日） */
export function isWrappingSeason(s: SeasonSettings): boolean {
  return md(s.fromMonth, s.fromDay) > md(s.toMonth, s.toDay)
}

/** month/day がシーズン内か。開始が終了より後なら年をまたぐ期間として見る */
export function isMonthDayInSeason(
  month: number, day: number,
  fromMonth: number, fromDay: number, toMonth: number, toDay: number,
): boolean {
  const v = md(month, day)
  const from = md(fromMonth, fromDay)
  const to   = md(toMonth, toDay)
  if (from <= to) return v >= from && v <= to
  return v >= from || v <= to
}

/** 'YYYY-MM-DD' がシーズン内か。シーズン機能がオフなら常に true */
export function isDateInSeason(date: string, s: SeasonSettings): boolean {
  if (!s.enabled) return true
  const month = Number(date.slice(5, 7))
  const day   = Number(date.slice(8, 10))
  // 日付が読めないときに受付を止めてしまうと、原因が分からないまま予約できなくなる
  if (!Number.isFinite(month) || month < 1 || month > 12) return true
  if (!Number.isFinite(day) || day < 1 || day > 31) return true
  return isMonthDayInSeason(month, day, s.fromMonth, s.fromDay, s.toMonth, s.toDay)
}

/** 月の値を 1-12 に収める（設定画面の入力と、DBの古い値の両方に効かせる） */
function clampMonth(v: unknown, fallback: number): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : fallback
}

/** 日の値をその月の範囲に収める。月を変えて日がはみ出したときにも使う */
export function clampDay(v: unknown, month: number, fallback: number): number {
  const n = Math.trunc(Number(v))
  const max = daysInMonth(month)
  if (!Number.isFinite(n) || n < 1) return Math.min(fallback, max)
  return Math.min(n, max)
}

/** stores の行から設定を組み立てる */
export function seasonFromRow(row: Record<string, unknown> | null | undefined): SeasonSettings {
  if (!row) return DEFAULT_SEASON
  const fromMonth = clampMonth(row.reservation_season_from_month, DEFAULT_SEASON.fromMonth)
  const toMonth   = clampMonth(row.reservation_season_to_month,   DEFAULT_SEASON.toMonth)
  return {
    enabled: row.reservation_season_enabled === true,
    fromMonth,
    // 日が未設定の古い行は「その月まるごと」として読む（月だけで設定していた頃の意図に合わせる）
    fromDay: row.reservation_season_from_day == null
      ? 1
      : clampDay(row.reservation_season_from_day, fromMonth, 1),
    toMonth,
    toDay: row.reservation_season_to_day == null
      ? daysInMonth(toMonth)
      : clampDay(row.reservation_season_to_day, toMonth, daysInMonth(toMonth)),
    message: typeof row.reservation_offseason_message === 'string' ? row.reservation_offseason_message : '',
  }
}

export async function loadSeasonSettings(storeId: string): Promise<SeasonSettings> {
  const { data } = await sb.from('stores')
    .select([
      'reservation_season_enabled',
      'reservation_season_from_month', 'reservation_season_from_day',
      'reservation_season_to_month', 'reservation_season_to_day',
      'reservation_offseason_message',
    ].join(', '))
    .eq('id', storeId).maybeSingle()
  return seasonFromRow(data)
}
