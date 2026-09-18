// ============================================================
// 採寸メニューのプリセット
//   店舗が毎回ゼロから入力しなくて済むように、制服販売店で
//   実際によくあるメニューと所要時間の目安を持っておく。
//   選んだあとで名前も時間も変えられるので、あくまで初期値。
// ============================================================

export interface MenuPreset {
  /** reservation_settings.service_type に入る内部キー */
  key: string
  label: string
  durationMin: number
  emoji: string
}

// service_type が 'uniform' / 'jersey' / 'fitting' のものは
// lib/slots.ts の isFitting が採寸として扱う（＝試着室の枠を消費する）。
// 新しいキーを足すときは isFitting 側も併せて確認すること。
export const MENU_PRESETS: MenuPreset[] = [
  { key: 'uniform',  label: '制服採寸',       durationMin: 60, emoji: '👔' },
  { key: 'jersey',   label: 'ジャージ採寸',   durationMin: 30, emoji: '🏃' },
  { key: 'fitting',  label: '体操着採寸',     durationMin: 30, emoji: '👕' },
  { key: 'uniform2', label: '制服採寸（兄弟・複数名）', durationMin: 90, emoji: '👨‍👩‍👧' },
  { key: 'jersey2',  label: '夏服・冬服まとめて', durationMin: 45, emoji: '🧥' },
  { key: 'fitting2', label: '試着・サイズ確認のみ', durationMin: 20, emoji: '📏' },
]

/** 所要時間のプルダウン候補（分） */
export const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120]
