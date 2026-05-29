'use client'

import { useEffect, useState } from 'react'
import type { TakeoutOrder, TakeoutSettings, UrgencyLevel } from '@/types/takeout'
import { getActionLabel, getNextStatus, getUrgencyLevel } from '@/types/takeout'

const URGENCY: Record<UrgencyLevel, { bar: string; border: string; btn: string; timer: string }> = {
  normal:  { bar: 'bg-amber-600',  border: 'border-zinc-700',  btn: 'bg-amber-600 text-white',    timer: 'text-zinc-400'  },
  warning: { bar: 'bg-amber-400',  border: 'border-amber-400', btn: 'bg-amber-400 text-zinc-950', timer: 'text-amber-300' },
  urgent:  { bar: 'bg-red-500',    border: 'border-red-500',   btn: 'bg-red-500 text-white',      timer: 'text-red-400'   },
}

function useElapsed(createdAt: string) {
  const [text, setText] = useState('')
  useEffect(() => {
    const tick = () => {
      const s = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
      setText(`${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [createdAt])
  return text
}

interface Props {
  order:     TakeoutOrder
  settings:  TakeoutSettings
  onAdvance: () => Promise<void>
  onCancel:  () => Promise<void>
}

export default function OrderCard({ order, settings, onAdvance, onCancel }: Props) {
  const [advancing,     setAdvancing]     = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const targetMinutes = settings.target_minutes ?? 15
  const urgency       = getUrgencyLevel(order.created_at, order.status, targetMinutes)
  const nextStatus    = getNextStatus(order.status, settings)
  const actionLabel   = getActionLabel(order.status, settings)
  const items         = order.items ?? []
  const elapsed       = useElapsed(order.created_at)
  const isReady       = order.status === 'ready'
  const isPending     = order.status === 'pending'

  const barColor    = isReady ? 'bg-emerald-500'     : isPending ? 'bg-zinc-700' : URGENCY[urgency].bar
  const borderColor = isReady ? 'border-emerald-500' : isPending ? 'border-zinc-800' : URGENCY[urgency].border
  const btnColor    = isReady ? 'bg-emerald-500 text-white' : isPending ? 'bg-zinc-700 text-zinc-200' : URGENCY[urgency].btn
  const timerColor  = isReady ? 'text-emerald-400'   : isPending ? 'text-zinc-600' : URGENCY[urgency].timer

  const handleAdvance = async () => {
    setAdvancing(true); try { await onAdvance() } finally { setAdvancing(false) }
  }

  return (
    <div className={`flex items-stretch rounded-xl overflow-hidden border ${borderColor} bg-zinc-900/80`}>
      <div className={`w-1 shrink-0 ${barColor}`} />

      <div className="flex-1 px-3 py-2 min-w-0">
        {/* 品目リスト（メイン情報） */}
        <div className="flex flex-col gap-0.5 mb-1.5">
          {items.length > 0 ? items.map((item, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <span className={`font-bold text-base leading-tight ${isReady ? 'text-zinc-500 line-through' : 'text-white'}`}>
                {item.name}
              </span>
              <span className={`font-black text-lg tabular-nums ${isReady ? 'text-zinc-600' : 'text-white'}`}>
                ×{item.quantity}
              </span>
            </div>
          )) : <span className="text-zinc-600 text-sm">（品目なし）</span>}
        </div>

        {/* 備考 */}
        {order.notes && (
          <div className="text-xs text-amber-300 bg-amber-950/40 rounded px-2 py-1 mb-1.5">
            📝 {order.notes}
          </div>
        )}

        {/* 下段：番号・名前・経過時間 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono text-zinc-600">{order.order_number}</span>
          {order.customer_name && <span className="text-xs text-zinc-600">{order.customer_name}様</span>}
          {order.order_source && order.order_source !== 'line' && (
            <span className="text-xs text-zinc-700">{order.order_source === 'phone' ? '📞' : '🚶'}</span>
          )}
          <div className="flex-1" />
          <span className={`text-sm font-mono font-bold tabular-nums ${timerColor}`}>{elapsed}</span>
          {/* キャンセル */}
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)} className="text-[11px] text-zinc-700 active:text-zinc-500">
              ×
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={async () => { setConfirmCancel(false); await onCancel() }}
                className="text-[11px] text-red-400 font-bold bg-red-950/40 px-2 py-0.5 rounded">確定</button>
              <button onClick={() => setConfirmCancel(false)} className="text-[11px] text-zinc-600">戻る</button>
            </div>
          )}
        </div>
      </div>

      {/* アクションボタン */}
      {nextStatus ? (
        <button onClick={handleAdvance} disabled={advancing}
          className={`shrink-0 w-16 md:w-20 flex flex-col items-center justify-center gap-0.5
            font-bold text-xs active:opacity-70 transition-opacity select-none
            ${btnColor} ${advancing ? 'opacity-50' : ''}`}>
          <span className="text-xl">
            {isReady ? '🤲' : isPending ? '▶' : urgency === 'urgent' ? '⚡' : '✓'}
          </span>
          <span className="leading-tight text-center px-1">{actionLabel}</span>
        </button>
      ) : (
        <div className="w-16 md:w-20 shrink-0" />
      )}
    </div>
  )
}
