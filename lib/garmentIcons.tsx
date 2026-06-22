import type { FC, SVGProps } from 'react'

// ============================================================
// お直し「服種」用のラインアイコン（制服シルエット）
//   絵文字に詰襟/ブレザー等が無いため、服種だけ自作SVGで表現する。
//   保存値(icon)がキーならSVG、そうでなければ絵文字/テキストとして描画。
// ============================================================
type IconProps = SVGProps<SVGSVGElement> & { className?: string }

const base = (children: React.ReactNode): FC<IconProps> => {
  const C: FC<IconProps> = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  )
  return C
}

const dot = (x: number, y: number) => <circle key={`${x}-${y}`} cx={x} cy={y} r={0.7} fill="currentColor" stroke="none" />

// 詰襟（学ラン上着）: 閉じた立ち襟 + 前立てボタン
const Gakuran = base(<>
  <path d="M8.5 3 L4 6 l2 3 2-1.2 V21 h7.5 V10.8 l2 1.2 2-3 -4.5-3" />
  <path d="M9 3 h6 v2.6 h-6 Z" />
  <path d="M12 5.6 V20" />
  {dot(12, 9)}{dot(12, 12)}{dot(12, 15)}
</>)

// ブレザー: 開いたV字ラペル + ボタン
const Blazer = base(<>
  <path d="M8.5 3 L4 6 l2 3 2-1.2 V21 h7.5 V10.8 l2 1.2 2-3 -4.5-3" />
  <path d="M8.7 3 L12 12.5 L15.3 3" />
  <path d="M12 12.5 V20" />
  {dot(13, 14)}{dot(13, 16.5)}
</>)

// ジャージ: 立ち襟 + センターファスナー（破線）
const Jersey = base(<>
  <path d="M8.5 3 L4 6 l2 3 2-1.2 V21 h7.5 V10.8 l2 1.2 2-3 -4.5-3" />
  <path d="M9 3 h6 v2.4 h-6 Z" />
  <path d="M12 5.4 V20.5" strokeDasharray="1.4 1.2" />
</>)

// ワイシャツ・ブラウス: 開襟 + ボタン
const Shirt = base(<>
  <path d="M8.5 3 L4 6 l2 3 2-1.2 V21 h7.5 V10.8 l2 1.2 2-3 -4.5-3" />
  <path d="M8.7 3 L12 6.4 L15.3 3" />
  <path d="M12 7 V20" />
  {dot(12, 10)}{dot(12, 13)}{dot(12, 16)}
</>)

// セーター・ベスト: Vネック + リブ裾
const Sweater = base(<>
  <path d="M8 3 L4 6 l2 2.6 2-1 V21 h8 V10.6 l2 1 2-2.6 -4-3" />
  <path d="M9 3 L12 8.5 L15 3" />
  <path d="M7 19 V21 M9.5 19 V21 M12 19 V21 M14.5 19 V21 M17 19 V21" />
</>)

// セーラー服: 四角いセーラー襟 + スカーフ
const Sailor = base(<>
  <path d="M8.5 3 L4 6 l2 3 2-1.2 V21 h7.5 V10.8 l2 1.2 2-3 -4.5-3" />
  <path d="M8.7 3 L7.4 11 H16.6 L15.3 3" />
  <path d="M8.7 3 L12 8.5 L15.3 3" />
  <path d="M12 8.5 l-1.2 3 h2.4 Z" />
</>)

// ズボン・スラックス: ウエストバンド + 2本脚
const Trousers = base(<>
  <path d="M6 3.5 H18 V6 H6 Z" />
  <path d="M6 6 L7 21 H10.7 L12 9 L13.3 21 H17 L18 6" />
</>)

// スカート: プリーツ台形
const Skirt = base(<>
  <path d="M6.5 4 H17.5 V6 H6.5 Z" />
  <path d="M6.5 6 L4 20 H20 L17.5 6" />
  <path d="M9 6.5 L8.2 20 M12 6.5 V20 M15 6.5 L15.8 20" />
</>)

export const GARMENT_ICON_REGISTRY: Record<string, FC<IconProps>> = {
  gakuran: Gakuran,
  blazer: Blazer,
  jersey: Jersey,
  shirt: Shirt,
  sweater: Sweater,
  sailor: Sailor,
  trousers: Trousers,
  skirt: Skirt,
}

// ピッカー表示用（順序＝表示順）
export const GARMENT_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'gakuran', label: '学ラン' },
  { key: 'blazer', label: 'ブレザー' },
  { key: 'shirt', label: 'シャツ' },
  { key: 'sailor', label: 'セーラー' },
  { key: 'sweater', label: 'セーター' },
  { key: 'jersey', label: 'ジャージ' },
  { key: 'trousers', label: 'ズボン' },
  { key: 'skirt', label: 'スカート' },
]

// 保存値 → 表示。キーならSVG、そうでなければ絵文字/テキスト（後方互換）
export function RepairIcon({ icon, className = 'w-[1.2em] h-[1.2em] inline-block align-[-0.18em]' }: {
  icon?: string | null
  className?: string
}) {
  const key = (icon ?? '').trim()
  const Svg = GARMENT_ICON_REGISTRY[key]
  if (Svg) return <Svg className={className} />
  return <span>{icon}</span>
}

// 服種名 → アイコンキーを推測（プリセット/OCR取込時の正規化に使用）
export function repairGarmentIcon(name: string): string | null {
  const n = (name ?? '').trim()
  if (!n) return null
  const rules: { kw: string[]; key: string }[] = [
    { kw: ['詰襟', '詰め襟', '学ラン', '学生服'], key: 'gakuran' },
    { kw: ['ブレザー', 'ジャケット', '上着', 'コート'], key: 'blazer' },
    { kw: ['ジャージ', 'トレーニング', '体操着', '体操服'], key: 'jersey' },
    { kw: ['セーラー'], key: 'sailor' },
    { kw: ['セーター', 'ベスト', 'ニット', 'カーディガン'], key: 'sweater' },
    { kw: ['ワイシャツ', 'カッター', 'ブラウス', 'シャツ'], key: 'shirt' },
    { kw: ['ズボン', 'スラックス', 'パンツ', 'ボトム'], key: 'trousers' },
    { kw: ['スカート'], key: 'skirt' },
  ]
  for (const r of rules) if (r.kw.some(k => n.includes(k))) return r.key
  return null
}

// 服種アイコン選択UI（SVGアイコン + 絵文字/その他フォールバック入力）
export function GarmentIconPicker({ value, onChange, inputClassName }: {
  value: string
  onChange: (v: string) => void
  inputClassName?: string
}) {
  const isCustom = !!value && !GARMENT_ICON_REGISTRY[value]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {GARMENT_ICON_OPTIONS.map(o => {
          const Svg = GARMENT_ICON_REGISTRY[o.key]
          const active = value === o.key
          return (
            <button key={o.key} type="button" onClick={() => onChange(o.key)}
              title={o.label}
              className={`flex flex-col items-center justify-center gap-0.5 w-[52px] h-[52px] rounded-xl border-2 ${active ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-600 hover:border-amber-300'}`}>
              <Svg className="w-5 h-5" />
              <span className="text-[9px] font-bold leading-none">{o.label}</span>
            </button>
          )
        })}
      </div>
      <input
        className={inputClassName ?? 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:border-amber-500 bg-white'}
        value={isCustom ? value : ''}
        onChange={e => onChange(e.target.value)}
        placeholder="絵文字で指定（例: 👔）" />
    </div>
  )
}
