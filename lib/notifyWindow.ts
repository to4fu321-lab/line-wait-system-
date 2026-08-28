// ============================================================================
//  通知の送信タイミング判定（営業時間ガード）
//
//  紙伝票の「張り上がり予定日 PM4時」を完了通知に置き換えると、時刻の約束は
//  不要になる代わりに「閉店直前に送っても取りに来られない」という問題が残る。
//  完了通知は営業中のみ送り、閉店後・定休日は次の開店時刻まで待たせる。
//
//  設計: docs/repair-flexible-catalog-design.md §4-5
// ============================================================================

import type { BusinessHours, DayKey } from './pop'

// getDay(): 0=日..6=土
const DOW_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// "18:30" → 1110（分）。壊れ値は null
function toMinutes(hhmm: string | undefined): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export interface NotifyWindowResult {
  /** いま送ってよいか */
  canSendNow: boolean
  /** canSendNow=false のとき、次に送れる日時。判定できなければ null */
  nextOpenAt: Date | null
  reason: 'open' | 'before_open' | 'after_close' | 'closed_day' | 'unknown'
}

/**
 * 完了通知を今送ってよいかを判定する。
 *
 * - business_hours が未設定/壊れている店舗は「常に送ってよい」（従来挙動を壊さない）
 * - 閉店 closeBufferMin 分前を過ぎたら翌営業日へ回す（駆け込みで来店させない）
 */
export function canNotifyNow(
  bh: BusinessHours | null | undefined,
  now: Date = new Date(),
  closeBufferMin = 30,
): NotifyWindowResult {
  const hours = bh?.hours
  if (!hours || Object.keys(hours).length === 0) {
    // 営業時間を登録していない店舗を黙って止めない
    return { canSendNow: true, nextOpenAt: null, reason: 'unknown' }
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const today  = hours[DOW_KEYS[now.getDay()]]
  const open   = toMinutes(today?.open)
  const close  = toMinutes(today?.close)

  if (today && !today.closed && open != null && close != null) {
    if (nowMin < open) {
      return { canSendNow: false, nextOpenAt: atMinutes(now, 0, open), reason: 'before_open' }
    }
    if (nowMin <= close - closeBufferMin) {
      return { canSendNow: true, nextOpenAt: null, reason: 'open' }
    }
    // 閉店間際 → 翌営業日へ
  }

  const reason: NotifyWindowResult['reason'] =
    !today || today.closed ? 'closed_day' : 'after_close'
  return { canSendNow: false, nextOpenAt: findNextOpen(hours, now), reason }
}

// now の日付から offsetDays 日後の、指定「分」の Date を作る
function atMinutes(now: Date, offsetDays: number, minutes: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + offsetDays)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return d
}

// 翌日から1週間ぶん見て、最初に開いている日の開店時刻を返す
function findNextOpen(hours: BusinessHours['hours'], now: Date): Date | null {
  for (let i = 1; i <= 7; i++) {
    const dow = (now.getDay() + i) % 7
    const h   = hours[DOW_KEYS[dow]]
    const open = toMinutes(h?.open)
    if (h && !h.closed && open != null) return atMinutes(now, i, open)
  }
  return null // 全曜日が定休（設定ミス）。呼び出し側で送信扱いにする
}
