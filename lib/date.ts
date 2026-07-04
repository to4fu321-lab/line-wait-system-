// ============================================================
// JST（日本標準時）日付ユーティリティ（client/server 共用の純関数）
// サーバーのタイムゾーンに依存せず常に JST 基準で計算する。
// ============================================================

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 今日の日付を JST の 'YYYY-MM-DD' で返す */
export function todayJst(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** JST の今日 0:00 を UTC の ISO 文字列で返す（created_at の当日絞り込み用） */
export function getTodayStart(): string {
  const jstNow = new Date(Date.now() + JST_OFFSET_MS)
  const jstMidnightUTC = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - JST_OFFSET_MS
  )
  return jstMidnightUTC.toISOString()
}

/** ISO 文字列を JST の 'YYYY-MM-DD' に変換 */
export function toJstDateString(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** ISO 文字列を JST の 'HH:MM' に変換 */
export function toJstTimeString(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString().slice(11, 16)
}
