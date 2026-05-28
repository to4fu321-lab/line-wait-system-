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
  { name: 'レッド', key: 'red', accent: '#7c3aed', accentRgb: '124 58 237',
    shades: [
      { n: 400, hex: '#f87171', rgb: '248 113 113', dark: '#ef4444', light: '#fee2e2' },
      { n: 500, hex: '#ef4444', rgb: '239 68 68',   dark: '#dc2626', light: '#fecaca' },
      { n: 600, hex: '#dc2626', rgb: '220 38 38',   dark: '#b91c1c', light: '#fca5a5' },
      { n: 700, hex: '#b91c1c', rgb: '185 28 28',   dark: '#991b1b', light: '#f87171' },
    ] },
  { name: 'スカイ', key: 'sky', accent: '#f59e0b', accentRgb: '245 158 11',
    shades: [
      { n: 400, hex: '#38bdf8', rgb: '56 189 248',  dark: '#0ea5e9', light: '#e0f2fe' },
      { n: 500, hex: '#0ea5e9', rgb: '14 165 233',  dark: '#0284c7', light: '#bae6fd' },
      { n: 600, hex: '#0284c7', rgb: '2 132 199',   dark: '#0369a1', light: '#7dd3fc' },
      { n: 700, hex: '#0369a1', rgb: '3 105 161',   dark: '#075985', light: '#38bdf8' },
    ] },
  { name: 'フクシア', key: 'fuchsia', accent: '#f59e0b', accentRgb: '245 158 11',
    shades: [
      { n: 400, hex: '#e879f9', rgb: '232 121 249', dark: '#d946ef', light: '#fae8ff' },
      { n: 500, hex: '#d946ef', rgb: '217 70 239',  dark: '#c026d3', light: '#f0abfc' },
      { n: 600, hex: '#c026d3', rgb: '192 38 211',  dark: '#a21caf', light: '#e879f9' },
      { n: 700, hex: '#a21caf', rgb: '162 28 175',  dark: '#86198f', light: '#d946ef' },
    ] },
  { name: 'ライム', key: 'lime', accent: '#7c3aed', accentRgb: '124 58 237',
    shades: [
      { n: 400, hex: '#a3e635', rgb: '163 230 53',  dark: '#84cc16', light: '#ecfccb' },
      { n: 500, hex: '#84cc16', rgb: '132 204 22',  dark: '#65a30d', light: '#d9f99d' },
      { n: 600, hex: '#65a30d', rgb: '101 163 13',  dark: '#4d7c0f', light: '#bef264' },
      { n: 700, hex: '#4d7c0f', rgb: '77 124 15',   dark: '#3f6212', light: '#a3e635' },
    ] },
  { name: 'イエロー', key: 'yellow', accent: '#7c3aed', accentRgb: '124 58 237',
    shades: [
      { n: 400, hex: '#facc15', rgb: '250 204 21',  dark: '#eab308', light: '#fef9c3' },
      { n: 500, hex: '#eab308', rgb: '234 179 8',   dark: '#ca8a04', light: '#fde047' },
      { n: 600, hex: '#ca8a04', rgb: '202 138 4',   dark: '#a16207', light: '#facc15' },
      { n: 700, hex: '#a16207', rgb: '161 98 7',    dark: '#854d0e', light: '#eab308' },
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

// カスタムHEXカラーからテーマカラーを生成
export function buildCustomThemeColors(hex: string): StoreTheme['colors'] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const adj = (ch: number, pct: number) => Math.min(255, Math.max(0, Math.round(ch + (pct > 0 ? (255 - ch) : ch) * Math.abs(pct))))
  const toHex = (rv: number, gv: number, bv: number) =>
    `#${rv.toString(16).padStart(2,'0')}${gv.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`
  return {
    primary:      hex,
    primaryDark:  toHex(adj(r,-0.25), adj(g,-0.25), adj(b,-0.25)),
    primaryLight: toHex(adj(r, 0.55), adj(g, 0.55), adj(b, 0.55)),
    primaryRgb:   `${r} ${g} ${b}`,
    accent:       '#6366f1',
    accentRgb:    '99 102 241',
  }
}

export function getColorPreset(key: string | null | undefined): StoreTheme['colors'] | null {
  if (!key) return null
  if (key.startsWith('custom:')) {
    const hex = key.slice(7)
    if (/^#[0-9a-f]{6}$/i.test(hex)) return buildCustomThemeColors(hex)
    return null
  }
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
