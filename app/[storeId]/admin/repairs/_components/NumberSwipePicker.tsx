'use client'

// ============================================================================
//  数値のスワイプ選択
//   ±ボタンで1ずつ進むのは、股下70cm のような値を入れるのに遅すぎる。
//   横スクロール＋スナップの目盛りにして、指で一気に送れるようにする。
//   中央に来た値が選択値。タップでも選べる。
//   範囲外の値（規格外の採寸）は「自由入力」に切り替えて入れられる。
// ============================================================================

import { useRef, useEffect, useState, useCallback } from 'react'
import { Pencil, ListEnd } from 'lucide-react'

const ITEM_W = 64   // 目盛り1つの幅(px)。padding計算と index 算出で共用する

export function NumberSwipePicker({
  value, onChange, min, max, step = 1, unit = '', fallbackDefault,
}: {
  value:    string
  onChange: (v: string) => void
  min:      number
  max:      number
  step?:    number
  unit?:    string
  /** 未入力のときにスクロール位置を合わせる値 */
  fallbackDefault?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [freeInput, setFreeInput] = useState(false)
  // スクロール由来の onChange で自分の scrollTo が再発火しないようにする
  const scrollingRef = useRef(false)

  const values: number[] = []
  for (let v = min; v <= max + 1e-9; v += step) values.push(Math.round(v * 100) / 100)

  const num = value === '' ? null : Number(value)
  const outOfRange = num != null && Number.isFinite(num) && (num < min || num > max)

  const indexOf = useCallback((n: number) => {
    const i = Math.round((n - min) / step)
    return Math.min(values.length - 1, Math.max(0, i))
  }, [min, step, values.length])

  // 選択値の位置へスクロールを合わせる（初期表示・外部からの変更時）
  useEffect(() => {
    if (freeInput || outOfRange) return
    const el = ref.current
    if (!el) return
    // 既定値が無い項目は範囲の中央から始める（最小値からだとスワイプが遠い）
    const n = num ?? fallbackDefault ?? values[Math.floor(values.length / 2)] ?? min
    if (scrollingRef.current) return
    el.scrollTo({ left: indexOf(n) * ITEM_W, behavior: 'auto' })
  }, [num, fallbackDefault, min, indexOf, freeInput, outOfRange])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    scrollingRef.current = true
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollLeft / ITEM_W)))
    const next = String(values[i])
    if (next !== value) onChange(next)
    window.clearTimeout((el as unknown as { _t?: number })._t)
    ;(el as unknown as { _t?: number })._t = window.setTimeout(() => { scrollingRef.current = false }, 120)
  }

  if (freeInput || outOfRange) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-lg font-black focus:outline-none focus:border-indigo-500 bg-white"
            inputMode="decimal" value={value} placeholder={`${min}〜${max}${unit}`}
            onChange={e => onChange(e.target.value)} />
          {unit && <span className="text-sm font-bold text-gray-500">{unit}</span>}
          <button type="button" onClick={() => setFreeInput(false)}
            className="shrink-0 flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-600">
            <ListEnd size={14} />目盛り
          </button>
        </div>
        {outOfRange && (
          <p className="text-[11px] text-amber-600 mt-1">目盛りの範囲（{min}〜{max}{unit}）外の値です。</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        {/* 中央の選択枠 */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 z-10"
          style={{ width: ITEM_W }}>
          <div className={`h-full rounded-xl border-2 ${
            num == null ? 'border-dashed border-gray-300' : 'border-indigo-400 bg-indigo-50/40'
          }`} />
        </div>
        <div
          ref={ref}
          onScroll={onScroll}
          className="relative flex overflow-x-auto snap-x snap-mandatory scrollbar-none py-2"
          style={{
            paddingLeft:  `calc(50% - ${ITEM_W / 2}px)`,
            paddingRight: `calc(50% - ${ITEM_W / 2}px)`,
            scrollbarWidth: 'none',
          }}>
          {values.map(v => {
            const on = num === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(String(v))}
                className={`snap-center shrink-0 flex items-center justify-center font-black transition-colors ${
                  on ? 'text-indigo-700 text-2xl' : 'text-gray-400 text-base'
                }`}
                style={{ width: ITEM_W, height: 48 }}>
                {v}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-gray-400">スワイプで選択{unit && `（${unit}）`}</span>
        <button type="button" onClick={() => setFreeInput(true)}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600">
          <Pencil size={12} />自由入力
        </button>
      </div>
    </div>
  )
}
