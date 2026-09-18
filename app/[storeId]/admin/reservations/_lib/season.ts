// ============================================================
// 予約シーズン（予約を受け付ける時期）
//
//  制服の採寸は入学期に集中するので、それ以外の時期は予約を受け付けず
//  「直接ご来店かお問い合わせください」と案内したい。
//  ここはその期間判定と案内文だけを扱う。
//  枠そのものの計算は lib/reservationCapacity。
// ============================================================
import { supabase } from '@/lib/supabase'

const sb = supabase as any

export interface SeasonSettings {
  enabled: boolean
  /** 受付開始月 1-12 */
  fromMonth: number
  /** 受付終了月 1-12。fromMonth より小さい場合は年をまたぐ（例: 11〜3月） */
  toMonth: number
  /** シーズン外に出す案内文 */
  message: string
}

export const DEFAULT_SEASON: SeasonSettings = {
  enabled: false,
  fromMonth: 1,
  toMonth: 4,
  message: '',
}

/** 案内文が未入力のときに出す文面 */
export function defaultOffSeasonMessage(from: number, to: number): string {
  return `${from}月〜${to}月以外の時期は予約不要です。直接ご来店いただくか、お問い合わせください。`
}

/** 設定から、お客様に見せる案内文を決める */
export function offSeasonMessageOf(s: SeasonSettings): string {
  return s.message.trim() || defaultOffSeasonMessage(s.fromMonth, s.toMonth)
}

/** month(1-12) がシーズン内か。fromMonth > toMonth のときは年をまたぐ期間として見る */
export function isMonthInSeason(month: number, from: number, to: number): boolean {
  if (from <= to) return month >= from && month <= to
  return month >= from || month <= to
}

/** 'YYYY-MM-DD' がシーズン内か。シーズン機能がオフなら常に true */
export function isDateInSeason(date: string, s: SeasonSettings): boolean {
  if (!s.enabled) return true
  const month = Number(date.slice(5, 7))
  if (!Number.isFinite(month) || month < 1 || month > 12) return true
  return isMonthInSeason(month, s.fromMonth, s.toMonth)
}

/** 月の値を 1-12 に収める（設定画面の入力と、DBの古い値の両方に効かせる） */
function clampMonth(v: unknown, fallback: number): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : fallback
}

/** stores の行から設定を組み立てる */
export function seasonFromRow(row: Record<string, unknown> | null | undefined): SeasonSettings {
  if (!row) return DEFAULT_SEASON
  return {
    enabled:   row.reservation_season_enabled === true,
    fromMonth: clampMonth(row.reservation_season_from_month, DEFAULT_SEASON.fromMonth),
    toMonth:   clampMonth(row.reservation_season_to_month,   DEFAULT_SEASON.toMonth),
    message:   typeof row.reservation_offseason_message === 'string' ? row.reservation_offseason_message : '',
  }
}

export async function loadSeasonSettings(storeId: string): Promise<SeasonSettings> {
  const { data } = await sb.from('stores')
    .select('reservation_season_enabled, reservation_season_from_month, reservation_season_to_month, reservation_offseason_message')
    .eq('id', storeId).maybeSingle()
  return seasonFromRow(data)
}
