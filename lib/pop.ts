// 友だち登録POP 自動生成 — 型・定数・機能連動ロジック
// 画面（設定/エディタ/プレビュー）から共通で参照する。

import { getLiffId } from './line-config'

export type PaperSize = 'a4' | 'a5' | 'postcard' | 'square'
export type Orientation = 'portrait' | 'landscape'
export type PopTheme = 'green' | 'indigo' | 'rose' | 'amber' | 'mono'
export type QrSize = 'sm' | 'md' | 'lg'

export type PopMerit = { id: string; text: string; enabled: boolean }

export type PopSettings = {
  friendUrl: string
  headline: string
  subCopy: string
  merits: PopMerit[]
  paperSize: PaperSize
  orientation: Orientation
  fontScale: number // 全体文字倍率（0.9=小 / 1.0=中 / 1.15=大）
  theme: PopTheme
  showQr: boolean
  qrSize: QrSize
  showStoreName: boolean
  showHours: boolean
}

// 用紙サイズ（portrait基準の実寸mm）
export const PAPER: Record<PaperSize, { w: number; h: number; label: string }> = {
  a4:       { w: 210, h: 297, label: 'A4' },
  a5:       { w: 148, h: 210, label: 'A5' },
  postcard: { w: 100, h: 148, label: 'はがき' },
  square:   { w: 148, h: 148, label: 'SNS正方形' },
}

// テーマ配色
export const THEME_COLORS: Record<PopTheme, {
  label: string; bg: string; accent: string; accentSoft: string; text: string
}> = {
  green:  { label: 'LINEグリーン', bg: '#F2FBF6', accent: '#06C755', accentSoft: '#DCF5E7', text: '#0F2E1E' },
  indigo: { label: 'ネイビー',     bg: '#F4F5FF', accent: '#4F46E5', accentSoft: '#E5E6FB', text: '#1E1B4B' },
  rose:   { label: 'ローズ',       bg: '#FFF4F8', accent: '#E11D66', accentSoft: '#FBDCE9', text: '#4C0519' },
  amber:  { label: '琥珀',         bg: '#FFFBEB', accent: '#D97706', accentSoft: '#FCEFC7', text: '#451A03' },
  mono:   { label: 'モノトーン',   bg: '#FFFFFF', accent: '#111827', accentSoft: '#EEF0F3', text: '#111827' },
}

// QRのポスター幅に対する割合（cqw）
export const QR_CQW: Record<QrSize, number> = { sm: 22, md: 30, lg: 38 }

// 店舗で有効な機能フラグ
export type StoreFeatureFlags = {
  allowRemote: boolean
  hasReservation: boolean
  notificationFull: boolean
}

// 有効機能から「友だち登録のメリット」初期候補を生成する（すべて後から編集可）
export function generateMerits(f: StoreFeatureFlags): PopMerit[] {
  const m: PopMerit[] = []
  m.push({ id: 'call', text: '順番が来たらLINEでお知らせ。並んで待たなくてOK', enabled: true })
  if (f.allowRemote)       m.push({ id: 'remote',      text: 'お店に来る前に、スマホで順番取り',        enabled: true })
  if (f.hasReservation)    m.push({ id: 'reserve',     text: '制服・ジャージの採寸をスマホで予約',      enabled: true })
  if (f.notificationFull)  m.push({ id: 'notify_full', text: '受付・もうすぐ・呼び出しをLINEでお届け',  enabled: true })
  m.push({ id: 'repair',  text: 'お直しの仕上がりをLINEでご連絡',        enabled: true })
  m.push({ id: 'takeout', text: '商品の入荷・お渡し準備をLINEでお知らせ', enabled: true })
  return m
}

// 新規顧客登録QR（お客様受付QR）のURL。QrRegistrationModal等と同じLIFF URLを使う。
export function registrationQrUrl(storeId: string): string {
  const liffId = getLiffId('uniform')
  return liffId ? `https://liff.line.me/${liffId}/${storeId}` : ''
}

export function defaultPopSettings(flags: StoreFeatureFlags, storeId: string): PopSettings {
  return {
    friendUrl: registrationQrUrl(storeId),
    headline: 'LINEでもっと便利に！',
    subCopy: '友だち登録するだけ。あとがぐっとラクになります。',
    merits: generateMerits(flags),
    paperSize: 'a4',
    orientation: 'portrait',
    fontScale: 1,
    theme: 'green',
    showQr: true,
    qrSize: 'md',
    showStoreName: true,
    showHours: false,
  }
}

// 保存値と現行デフォルトをマージ（新フィールド追加時の後方互換）
// friendUrlは不正防止のため保存値を一切信用せず、常に新規顧客登録QRを強制使用する
export function mergePopSettings(saved: Partial<PopSettings> | null, flags: StoreFeatureFlags, storeId: string): PopSettings {
  const base = defaultPopSettings(flags, storeId)
  if (!saved) return base
  return {
    ...base,
    ...saved,
    friendUrl: base.friendUrl,
    merits: Array.isArray(saved.merits) && saved.merits.length > 0 ? saved.merits : base.merits,
  }
}

// ---- 営業時間の整形 ----

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type DayHours = { open: string; close: string; closed: boolean }
export type BusinessHours = { hours: Partial<Record<DayKey, DayHours>> }

const HOURS_ORDER: { k: DayKey; label: string }[] = [
  { k: 'mon', label: '月' }, { k: 'tue', label: '火' }, { k: 'wed', label: '水' },
  { k: 'thu', label: '木' }, { k: 'fri', label: '金' }, { k: 'sat', label: '土' }, { k: 'sun', label: '日' },
]

function hoursValue(h?: DayHours): string {
  if (!h || h.closed) return '定休'
  return `${h.open}–${h.close}`
}

// 連続する同一時間帯をまとめて "月〜金 10:00–19:00 ／ 土 10:00–18:00 ／ 日 定休" の形にする
export function formatBusinessHours(bh?: BusinessHours | null): string {
  if (!bh?.hours) return ''
  const segs: string[] = []
  let i = 0
  while (i < HOURS_ORDER.length) {
    const val = hoursValue(bh.hours[HOURS_ORDER[i].k])
    let j = i
    while (j + 1 < HOURS_ORDER.length && hoursValue(bh.hours[HOURS_ORDER[j + 1].k]) === val) j++
    const dayLabel = i === j
      ? HOURS_ORDER[i].label
      : `${HOURS_ORDER[i].label}〜${HOURS_ORDER[j].label}`
    segs.push(val === '定休' ? `${dayLabel} 定休` : `${dayLabel} ${val}`)
    i = j + 1
  }
  return segs.join(' ／ ')
}
