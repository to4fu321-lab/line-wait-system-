'use client'

// ──────────────────────────────────────────────────────────────
//  金種計算グリッド（釣銭準備金・レジ締めの現金計数に共用）
//  金種ごとの枚数を入力 → 合計金額をリアルタイム表示。
// ──────────────────────────────────────────────────────────────

import { Minus, Plus } from 'lucide-react'
import { DENOMINATIONS, sumDenominations, type DenominationCounts } from '@/types/register'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

export function DenominationGrid({
  value,
  onChange,
}: {
  value: DenominationCounts
  onChange: (next: DenominationCounts) => void
}) {
  const total = sumDenominations(value)

  const setCount = (d: number, count: number) => {
    const next = { ...value }
    const c = Math.max(0, Math.floor(count))
    if (c === 0) delete next[String(d)]
    else next[String(d)] = c
    onChange(next)
  }

  return (
    <div className="space-y-1.5">
      {DENOMINATIONS.map(d => {
        const count = Number(value[String(d)]) || 0
        const line = d * count
        return (
          <div key={d} className="flex items-center gap-2">
            <span className="w-16 text-right text-sm font-bold text-gray-700 shrink-0">{yen(d)}</span>
            <button
              type="button"
              onClick={() => setCount(d, count - 1)}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-95 shrink-0">
              <Minus size={13} />
            </button>
            <input
              type="number" inputMode="numeric" min={0}
              value={count === 0 ? '' : count}
              onChange={e => setCount(d, Number(e.target.value))}
              placeholder="0"
              className="w-14 text-center text-sm font-bold border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => setCount(d, count + 1)}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-95 shrink-0">
              <Plus size={13} />
            </button>
            <span className="flex-1 text-right text-sm text-gray-500 tabular-nums">{line > 0 ? yen(line) : '—'}</span>
          </div>
        )
      })}
      <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
        <span className="text-xs font-black text-gray-400 uppercase tracking-wider">合計</span>
        <span className="text-lg font-black text-gray-900">{yen(total)}</span>
      </div>
    </div>
  )
}
