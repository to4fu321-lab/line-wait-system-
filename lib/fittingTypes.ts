// ============================================================
// 「その予約は試着室(＝予約枠)を使うか」の判定
//
//  同じ判定が予約枠の計算・カレンダー・人員設計・AIシフトの
//  4か所に写経されていて、片方だけ直すとズレる状態だった。
//  採寸メニューを増やすとキーも増えるため、ここに集約する。
// ============================================================

/**
 * 試着室を使うメニューの service_type 接頭辞。
 * プリセットの uniform2 / jersey2 のような枝番も拾えるよう前方一致で見る。
 */
const FITTING_PREFIXES = ['uniform', 'jersey', 'fitting'] as const

export function isFittingServiceType(serviceType: string | null | undefined): boolean {
  const t = (serviceType ?? '').trim().toLowerCase()
  if (!t) return false
  return FITTING_PREFIXES.some(p => t.startsWith(p))
}

/** 予約の purpose / service_type から採寸（枠を消費する）かを判定する */
export function isFitting(
  purpose: string | null | undefined,
  serviceType: string | null | undefined,
): boolean {
  return (purpose ?? '').includes('採寸') || isFittingServiceType(serviceType)
}
