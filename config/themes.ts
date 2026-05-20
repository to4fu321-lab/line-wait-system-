/**
 * 店舗ごとのテーマ設定（マスターデータ）
 *
 * Phase 1: TypeScript ファイルで管理。
 * Phase X: 将来的に stores テーブルへ移行可能（getStoreTheme を差し替えるだけ）。
 */

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
