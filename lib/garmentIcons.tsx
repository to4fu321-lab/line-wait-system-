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

// 上着共通：長袖の前身頃アウトライン（襟以外）。各服は末尾に襟を足して閉じる。
const TOP = 'M10 4 L7.5 4.6 L4 6.2 L4 17.8 L7.2 17.8 L7.5 10 L7.5 20.5 H16.5 V10 L16.8 17.8 L20 17.8 L20 6.2 L16.5 4.6 L14 4'

// ワイシャツ・ブラウス: 台襟 + 前立て + ボタン
const Shirt = base(<>
  <path d={TOP + ' L12 5.6 L10 4 Z'} />
  <path d="M10 4 L11.4 6.6" /><path d="M14 4 L12.6 6.6" />
  <path d="M12 6.6 V19" />
  {dot(12, 9)}{dot(12, 12)}{dot(12, 15)}
</>)

// 詰襟（学ラン上着）: 立ち襟バンド + 中央ボタン列
const Gakuran = base(<>
  <path d={TOP + ' L10 4 Z'} />
  <path d="M9.5 4 H14.5 V5.8 H9.5 Z" />
  <path d="M12 5.8 V19" />
  {dot(12, 8)}{dot(12, 10.3)}{dot(12, 12.6)}{dot(12, 14.9)}{dot(12, 17.2)}
</>)

// ブレザー: ノッチドラペル + 胸ポケット + ボタン
const Blazer = base(<>
  <path d={TOP + ' L12 12 L10 4 Z'} />
  <path d="M10 4 L11.6 7.2" /><path d="M14 4 L12.4 7.2" />
  <path d="M12 12 V20" />
  <path d="M9 11.5 h2" />
  {dot(12.9, 14.2)}{dot(12.9, 16.6)}
</>)

// セーラー服: 四角いセーラー襟 + リボン
const Sailor = base(<>
  <path d={TOP + ' L12 8 L10 4 Z'} />
  <path d="M8.7 4 L8 11 H16 L15.3 4" />
  <path d="M12 8 l-1.4 1.6 1.4 1.4 1.4-1.4 Z" />
</>)

// セーター・ベスト: Vネック + リブ裾
const Sweater = base(<>
  <path d={TOP + ' L12 8.5 L10 4 Z'} />
  <path d="M10 4 L12 7 L14 4" />
  <path d="M7.5 18.5 H16.5" />
  <path d="M9 18.5 V20.5 M11 18.5 V20.5 M13 18.5 V20.5 M15 18.5 V20.5" />
</>)

// ジャージ: 立ち襟 + センターファスナー + 袖サイドライン
const Jersey = base(<>
  <path d={TOP + ' L10 4 Z'} />
  <path d="M9.5 4 H14.5 V5.8 H9.5 Z" />
  <path d="M12 5.8 V20.5" strokeDasharray="1.4 1.2" />
  <path d="M5.2 6.8 V17" /><path d="M18.8 6.8 V17" />
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
