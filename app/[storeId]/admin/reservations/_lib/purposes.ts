// 来店目的の選択肢（受付トーク用カード）
// usesFitting=true のものだけ試着室(予約枠)を消費する。
export interface PurposeOption {
  key: string
  label: string
  emoji: string
  usesFitting: boolean   // 試着室(採寸)を使う＝予約枠を消費
  serviceType: string    // reservations.service_type に保存（容量判定に使用）
}

export const VISIT_PURPOSES: PurposeOption[] = [
  { key: 'shinnyu', label: '新入学採寸', emoji: '🎒', usesFitting: true,  serviceType: 'uniform' },
  { key: 'kaikae',  label: '買い替え採寸', emoji: '📏', usesFitting: true,  serviceType: 'uniform' },
  { key: 'naoshi',  label: 'お直し',     emoji: '✂️', usesFitting: false, serviceType: 'other' },
  { key: 'uketori', label: '商品受取',   emoji: '📦', usesFitting: false, serviceType: 'other' },
  { key: 'soudan',  label: 'ご相談',     emoji: '💬', usesFitting: false, serviceType: 'other' },
  { key: 'sonota',  label: 'その他',     emoji: '➕', usesFitting: false, serviceType: 'other' },
]
