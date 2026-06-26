// 「情報のみ」の来店用件（試着室＝予約枠を消費しない）。
// 採寸（試着室を使う）メニューは reservation_settings から動的取得する（slots.ts: loadServices）。
export interface InfoPurpose {
  key: string
  label: string
  emoji: string
}

export const INFO_PURPOSES: InfoPurpose[] = [
  { key: 'naoshi',  label: 'お直し',   emoji: '✂️' },
  { key: 'uketori', label: '商品受取', emoji: '📦' },
  { key: 'soudan',  label: 'ご相談',   emoji: '💬' },
  { key: 'sonota',  label: 'その他',   emoji: '➕' },
]
