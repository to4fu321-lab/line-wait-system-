// 来店理由。
//   予約はどの理由でも1枠を使う（枠の長さは店舗設定で固定）。
//   問合せ・ご相談・商品受取は待たせずに対応できるため予約不要とし、
//   予約の選択肢からは外す（お客様には「そのままご来店ください」と案内する）。
export interface VisitPurpose {
  key: string
  label: string
  emoji: string
  /** reservations.service_type に入れる値 */
  serviceType: string
}

/** 予約が必要な用件 */
export const RESERVABLE_PURPOSES: VisitPurpose[] = [
  { key: 'saisun', label: '採寸',   emoji: '📏', serviceType: 'visit_saisun' },
  { key: 'naoshi', label: 'お直し', emoji: '✂️', serviceType: 'visit_naoshi' },
  { key: 'sonota', label: 'その他', emoji: '➕', serviceType: 'visit_sonota' },
]

/** 予約不要でそのまま来店してよい用件（案内にだけ出す） */
export const WALK_IN_PURPOSES: VisitPurpose[] = [
  { key: 'uketori', label: '商品受取',       emoji: '📦', serviceType: 'walkin_uketori' },
  { key: 'soudan',  label: '問合せ・ご相談', emoji: '💬', serviceType: 'walkin_soudan' },
]

export const ALL_PURPOSES = [...RESERVABLE_PURPOSES, ...WALK_IN_PURPOSES]
