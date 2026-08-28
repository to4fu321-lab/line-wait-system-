// ============================================================================
//  お直し業種プロファイル（語彙レイヤー）
//
//  「服種 > 項目 > オプション」の3階層マスタは構造としては業種非依存だが、
//  画面の文言が制服固定だった。テーブルはリネームせず、表示ラベルだけを
//  店舗設定（stores.repair_settings）で差し替える。
//
//  設計: docs/repair-flexible-catalog-design.md §3 追加①
// ============================================================================

export type RepairProfileKey = 'uniform' | 'racket' | 'custom'

// 画面に出る語彙。テーブル名・カラム名は一切変えない。
export interface RepairLabels {
  domain:      string   // 「お直し」   → 「ガット張り」
  garment:     string   // 「服種」     → 「種目」
  item:        string   // 「項目」     → 「作業」
  option:      string   // 「オプション」
  measurement: string   // 「採寸」     → 「仕様」
  unit_count:  string   // 「点」       → 「本」
  vendor:      string   // 「外注先」   → 「外注ストリンガー」
}

export interface RepairSettings {
  profile?:               RepairProfileKey
  labels?:                Partial<RepairLabels>
  material_enabled?:      boolean   // 材料（商品）選択をUIに出すか（Phase 2）
  intake_photo_required?: boolean   // 受付時写真を必須にするか
}

// ── プロファイル既定 ────────────────────────────────────────
const UNIFORM_LABELS: RepairLabels = {
  domain:      'お直し',
  garment:     '服種',
  item:        '項目',
  option:      'オプション',
  measurement: '採寸',
  unit_count:  '点',
  vendor:      '外注先',
}

const RACKET_LABELS: RepairLabels = {
  domain:      'ガット張り',
  garment:     '種目',
  item:        '作業',
  option:      'オプション',
  measurement: '仕様',
  unit_count:  '本',
  vendor:      '外注ストリンガー',
}

export const PROFILE_DEFAULTS: Record<RepairProfileKey, {
  label:                 string
  labels:                RepairLabels
  material_enabled:      boolean
  intake_photo_required: boolean
}> = {
  uniform: { label: '制服・衣類のお直し', labels: UNIFORM_LABELS, material_enabled: false, intake_photo_required: false },
  racket:  { label: 'ラケットのガット張り', labels: RACKET_LABELS,  material_enabled: true,  intake_photo_required: true  },
  custom:  { label: 'その他（自由設定）',   labels: UNIFORM_LABELS, material_enabled: false, intake_photo_required: false },
}

export const PROFILE_ORDER: RepairProfileKey[] = ['uniform', 'racket', 'custom']

function isProfileKey(v: unknown): v is RepairProfileKey {
  return v === 'uniform' || v === 'racket' || v === 'custom'
}

// stores.repair_settings（jsonb）を安全に読む。null/壊れ値は uniform 既定へ。
export function parseRepairSettings(raw: unknown): Required<Omit<RepairSettings, 'labels'>> & { labels: RepairLabels } {
  const s = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as RepairSettings : {}
  const profile = isProfileKey(s.profile) ? s.profile : 'uniform'
  const base    = PROFILE_DEFAULTS[profile]
  return {
    profile,
    // 店舗が個別に上書きしたラベルだけを既定に重ねる
    labels: { ...base.labels, ...(s.labels ?? {}) },
    material_enabled:      s.material_enabled      ?? base.material_enabled,
    intake_photo_required: s.intake_photo_required ?? base.intake_photo_required,
  }
}

// 既定ラベル（設定を読む前の初期描画・DBなし時のフォールバック）
export const DEFAULT_LABELS = UNIFORM_LABELS
