/**
 * 店舗ごとのテーマ設定（マスターデータ）
 *
 * Phase 1: TypeScript ファイルで管理。
 * Phase X: 将来的に stores テーブルへ移行可能（getStoreTheme を差し替えるだけ）。
 */

// ── カラープリセット ───────────────────────────────────────────
// stores.theme_color に保存するキー（例: 'indigo-600'）と対応する色セット
export interface ColorPreset {
  key:    string   // DB保存値
  family: string   // 表示グループ名
  shade:  number   // 濃淡 (400=薄 〜 700=濃)
  hex:    string   // スウォッチ表示色
  colors: StoreTheme['colors']
}

const FAMILIES = [
  { name: 'インディゴ', key: 'indigo', accent: '#ec4899', accentRgb: '236 72 153',
    shades: [
      { n: 400, hex: '#818cf8', rgb: '129 140 248', dark: '#6366f1', light: '#e0e7ff' },
      { n: 500, hex: '#6366f1', rgb: '99 102 241',  dark: '#4f46e5', light: '#c7d2fe' },
      { n: 600, hex: '#4f46e5', rgb: '79 70 229',   dark: '#3730a3', light: '#a5b4fc' },
      { n: 700, hex: '#4338ca', rgb: '67 56 202',   dark: '#312e81', light: '#818cf8' },
    ] },
  { name: 'バイオレット', key: 'violet', accent: '#f59e0b', accentRgb: '245 158 11',
    shades: [
      { n: 400, hex: '#a78bfa', rgb: '167 139 250', dark: '#8b5cf6', light: '#ede9fe' },
      { n: 500, hex: '#8b5cf6', rgb: '139 92 246',  dark: '#7c3aed', light: '#ddd6fe' },
      { n: 600, hex: '#7c3aed', rgb: '124 58 237',  dark: '#6d28d9', light: '#c4b5fd' },
      { n: 700, hex: '#6d28d9', rgb: '109 40 217',  dark: '#4c1d95', light: '#a78bfa' },
    ] },
  { name: 'ブルー', key: 'blue', accent: '#f97316', accentRgb: '249 115 22',
    shades: [
      { n: 400, hex: '#60a5fa', rgb: '96 165 250',  dark: '#3b82f6', light: '#dbeafe' },
      { n: 500, hex: '#3b82f6', rgb: '59 130 246',  dark: '#2563eb', light: '#bfdbfe' },
      { n: 600, hex: '#2563eb', rgb: '37 99 235',   dark: '#1d4ed8', light: '#93c5fd' },
      { n: 700, hex: '#1d4ed8', rgb: '29 78 216',   dark: '#1e3a8a', light: '#60a5fa' },
    ] },
  { name: 'ティール', key: 'teal', accent: '#8b5cf6', accentRgb: '139 92 246',
    shades: [
      { n: 400, hex: '#2dd4bf', rgb: '45 212 191',  dark: '#14b8a6', light: '#ccfbf1' },
      { n: 500, hex: '#14b8a6', rgb: '20 184 166',  dark: '#0d9488', light: '#99f6e4' },
      { n: 600, hex: '#0d9488', rgb: '13 148 136',  dark: '#0f766e', light: '#5eead4' },
      { n: 700, hex: '#0f766e', rgb: '15 118 110',  dark: '#134e4a', light: '#2dd4bf' },
    ] },
  { name: 'エメラルド', key: 'emerald', accent: '#f59e0b', accentRgb: '245 158 11',
    shades: [
      { n: 400, hex: '#34d399', rgb: '52 211 153',  dark: '#10b981', light: '#d1fae5' },
      { n: 500, hex: '#10b981', rgb: '16 185 129',  dark: '#059669', light: '#a7f3d0' },
      { n: 600, hex: '#059669', rgb: '5 150 105',   dark: '#047857', light: '#6ee7b7' },
      { n: 700, hex: '#047857', rgb: '4 120 87',    dark: '#065f46', light: '#34d399' },
    ] },
  { name: 'ローズ', key: 'rose', accent: '#7c3aed', accentRgb: '124 58 237',
    shades: [
      { n: 400, hex: '#fb7185', rgb: '251 113 133', dark: '#f43f5e', light: '#ffe4e6' },
      { n: 500, hex: '#f43f5e', rgb: '244 63 94',   dark: '#e11d48', light: '#fecdd3' },
      { n: 600, hex: '#e11d48', rgb: '225 29 72',   dark: '#be123c', light: '#fda4af' },
      { n: 700, hex: '#be123c', rgb: '190 18 60',   dark: '#9f1239', light: '#fb7185' },
    ] },
  { name: 'オレンジ', key: 'orange', accent: '#7c3aed', accentRgb: '124 58 237',
    shades: [
      { n: 400, hex: '#fb923c', rgb: '251 146 60',  dark: '#f97316', light: '#fed7aa' },
      { n: 500, hex: '#f97316', rgb: '249 115 22',  dark: '#ea580c', light: '#fdba74' },
      { n: 600, hex: '#ea580c', rgb: '234 88 12',   dark: '#c2410c', light: '#fb923c' },
      { n: 700, hex: '#c2410c', rgb: '194 65 12',   dark: '#9a3412', light: '#f97316' },
    ] },
  { name: 'グレー', key: 'slate', accent: '#3b82f6', accentRgb: '59 130 246',
    shades: [
      { n: 400, hex: '#94a3b8', rgb: '148 163 184', dark: '#64748b', light: '#e2e8f0' },
      { n: 500, hex: '#64748b', rgb: '100 116 139', dark: '#475569', light: '#cbd5e1' },
      { n: 600, hex: '#475569', rgb: '71 85 105',   dark: '#334155', light: '#94a3b8' },
      { n: 700, hex: '#334155', rgb: '51 65 85',    dark: '#1e293b', light: '#64748b' },
    ] },
] as const

export const COLOR_PRESETS: ColorPreset[] = FAMILIES.flatMap(f =>
  f.shades.map(s => ({
    key:    `${f.key}-${s.n}`,
    family: f.name,
    shade:  s.n,
    hex:    s.hex,
    colors: {
      primary:      s.hex,
      primaryDark:  s.dark,
      primaryLight: s.light,
      primaryRgb:   s.rgb,
      accent:       f.accent,
      accentRgb:    f.accentRgb,
    },
  }))
)

export function getColorPreset(key: string | null | undefined): StoreTheme['colors'] | null {
  if (!key) return null
  return COLOR_PRESETS.find(p => p.key === key)?.colors ?? null
}

export interface StoreTheme {
  storeId:   string
  storeName: string
  tagline:   string
  /** ロゴ代わりの絵文字。logoUrl があればそちらを優先 */
  logoEmoji: string
  logoUrl?:  string
  colors: {
    /** メインカラー (#RRGGBB) */
    primary:      string
    primaryDark:  string
    primaryLight: string
    /** "R G B" 形式（rgb(var(--theme-primary-rgb) / 0.5) 用） */
    primaryRgb:   string
    accent:       string
    accentRgb:    string
  }
}

const themes: StoreTheme[] = [
  {
    storeId:   '00000000-0000-0000-0000-000000000010',
    storeName: '学生服のたかや',
    tagline:   '学生服販売・お直し',
    logoEmoji: '🎓',
    colors: {
      primary:      '#4f46e5', // indigo-600
      primaryDark:  '#3730a3',
      primaryLight: '#a5b4fc',
      primaryRgb:   '79 70 229',
      accent:       '#ec4899', // pink-500
      accentRgb:    '236 72 153',
    },
  },
  {
    storeId:   '00000000-0000-0000-0000-000000000020',
    storeName: 'Bクリーニング',
    tagline:   'クリーニング・お直し',
    logoEmoji: '👕',
    colors: {
      primary:      '#059669', // emerald-600
      primaryDark:  '#047857',
      primaryLight: '#6ee7b7',
      primaryRgb:   '5 150 105',
      accent:       '#f59e0b', // amber-500
      accentRgb:    '245 158 11',
    },
  },
  {
    storeId:   '00000000-0000-0000-0000-000000000030',
    storeName: 'Cブティック',
    tagline:   'ファッション・補正',
    logoEmoji: '👗',
    colors: {
      primary:      '#db2777', // pink-600
      primaryDark:  '#9d174d',
      primaryLight: '#f9a8d4',
      primaryRgb:   '219 39 119',
      accent:       '#7c3aed', // violet-600
      accentRgb:    '124 58 237',
    },
  },
]

const DEFAULT_THEME: StoreTheme = {
  storeId:   '',
  storeName: 'Store',
  tagline:   '受付システム',
  logoEmoji: '🏪',
  colors: {
    primary:      '#0f172a', // slate-900
    primaryDark:  '#020617',
    primaryLight: '#94a3b8',
    primaryRgb:   '15 23 42',
    accent:       '#3b82f6', // blue-500
    accentRgb:    '59 130 246',
  },
}

/** storeId から店舗テーマを取得。未登録なら DEFAULT_THEME に storeId だけ差し込んで返す */
export function getStoreTheme(storeId: string | null | undefined): StoreTheme {
  if (!storeId) return DEFAULT_THEME
  return themes.find(t => t.storeId === storeId) ?? { ...DEFAULT_THEME, storeId }
}

export function listStoreThemes(): StoreTheme[] {
  return themes
}

/**
 * テーマカラーを CSS 変数として返す。
 * サーバーコンポーネントの style prop に渡すことで
 * 子コンポーネントから var(--theme-primary) 等で参照可能。
 */
export function themeCssVars(theme: StoreTheme): Record<string, string> {
  return {
    '--theme-primary':       theme.colors.primary,
    '--theme-primary-dark':  theme.colors.primaryDark,
    '--theme-primary-light': theme.colors.primaryLight,
    '--theme-primary-rgb':   theme.colors.primaryRgb,
    '--theme-accent':        theme.colors.accent,
    '--theme-accent-rgb':    theme.colors.accentRgb,
  }
}
