// ============================================================
// 「その予約は枠を使うか」の判定
//
//  同じ判定が予約枠の計算・カレンダー・人員設計・AIシフトの
//  4か所に写経されていて、片方だけ直すとズレる状態だった。
//
//  枠の長さを店舗でひとつに固定したので、いまは
//  「予約が入っている＝1枠使う」が基本。
//  予約不要の用件（商品受取・問合せ）だけが枠を使わない。
// ============================================================

/** 予約不要の用件に付ける service_type の接頭辞 */
const WALK_IN_PREFIX = 'walkin'

/** 予約の purpose / service_type から、枠を1つ使う予約かを判定する */
export function isFitting(
  purpose: string | null | undefined,
  serviceType: string | null | undefined,
): boolean {
  const t = (serviceType ?? '').trim().toLowerCase()
  if (t.startsWith(WALK_IN_PREFIX)) return false
  return true
}

/** service_type 単体で見たいとき */
export function isFittingServiceType(serviceType: string | null | undefined): boolean {
  return isFitting(null, serviceType)
}
