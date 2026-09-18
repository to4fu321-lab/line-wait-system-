'use client'

// 枠数はスマホで手打ちすると大変なので、−／＋のタップでも増減できるようにする。
// 設定画面と予約受付画面の両方から使う。
import { Minus, Plus } from 'lucide-react'

export const MAX_CAPACITY = 99

export function CapacityStepper({ value, onChange, disabled }: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const BTN = 'w-11 h-11 shrink-0 grid place-items-center rounded-xl bg-gray-100 text-gray-700 active:scale-95 transition-all disabled:opacity-40'
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="1件減らす" disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))} className={BTN}>
        <Minus size={18} />
      </button>
      <input type="text" inputMode="numeric" value={String(value)} disabled={disabled}
        onChange={e => onChange(Math.min(MAX_CAPACITY, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))}
        className="w-14 border border-gray-300 rounded-xl px-2 py-2 text-sm text-center font-black bg-white tabular-nums" />
      <button type="button" aria-label="1件増やす" disabled={disabled || value >= MAX_CAPACITY}
        onClick={() => onChange(Math.min(MAX_CAPACITY, value + 1))} className={BTN}>
        <Plus size={18} />
      </button>
    </div>
  )
}
