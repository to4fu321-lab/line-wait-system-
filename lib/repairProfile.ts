// ============================================================================
//  受付マスタの語彙と標準セット
//
//  以前は業種プロファイル（制服/ラケット/…）で画面の呼び名を切り替え、
//  さらに店ごとに自由編集させていたが、どちらも筋が悪かった:
//    - 業種は決め打ちできない（靴修理・時計修理…と際限がない）
//    - 呼び名を店に設定させるのは手間なだけで、得るものが無い
//  そこで「どの業種でも意味が通る中立語彙」を1つだけ持つ。設定は無い。
//
//    種類 = 大分類   バドミントン / スラックス / 革靴
//    作業 = 中分類   ガット張り / 裾上げ / ソール交換
//    仕様 = 受付で聞く内容  ポンド数 / 仕上がり丈 / ヒール高さ
//    点   = 数え方（本・足・枚のどれにも寄らない汎用の助数詞）
// ============================================================================

export interface RepairLabels {
  /** 大分類（旧: 服種） */
  garment:     string
  /** 中分類（旧: 項目） */
  item:        string
  option:      string
  /** 受付で聞く入力（旧: 採寸） */
  measurement: string
  /** 助数詞 */
  unit_count:  string
  vendor:      string
}

export const REPAIR_LABELS: RepairLabels = {
  garment:     '種類',
  item:        '作業',
  option:      'オプション',
  measurement: '仕様',
  unit_count:  '点',
  vendor:      '外注先',
}

// ── 標準セット ──────────────────────────────────────────────
//  取り込みは追記式・冪等なので、どの店でも好きなものを好きな順に入れられる。
//  業種で絞らない（制服とラケットを両方やる店が実在する）。
export type PresetKey = 'uniform' | 'racket'

export const PRESET_KEYS: PresetKey[] = ['uniform', 'racket']

export const PRESET_SET_LABELS: Record<PresetKey, string> = {
  uniform: '制服お直し一式',
  racket:  'ガット張り一式',
}
