'use client'

import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import { DEFAULT_STATUS_LABELS, getActionLabel, getNextStatus } from '@/types/takeout'

interface Props {
  order:     TakeoutOrder
  settings:  TakeoutSettings
  onAdvance: () => void
}

export default function QueueItem({ order, settings, onAdvance }: Props) {
  const labels      = { ...DEFAULT_STATUS_LABELS, ...settings.status_labels }
  const nextStatus  = getNextStatus(order.status, settings)
  const actionLabel = getActionLabel(order.status, settings)
  const itemSummary = (order.items ?? [])
    .map(i => `${i.name}×${i.quantity}`)
    .join('・')

  return (
    <div className="flex items-center gap-3 bg-zinc-900 rounded-xl px-4 py-3 md:py-4 border border-zinc-800">
      <span className="text-xl md:text-2xl font-bold text-zinc-300 w-14 shrink-0">
        {order.order_number}
      </span>
      <div className="flex-1 min-w-0">
        {order.customer_name && (
          <div className="text-sm text-zinc-400">{order.customer_name}様</div>
        )}
        <div className="text-sm text-zinc-500 truncate">{itemSummary}</div>
      </div>
      <span className="text-xs text-zinc-600 shrink-0 hidden md:block">
        {labels[order.status]}
      </span>
      {nextStatus && (
        <button
          onClick={onAdvance}
          className="shrink-0 text-xs md:text-sm px-3 py-2 rounded-lg bg-zinc-700 text-zinc-200 active:scale-95 transition-transform whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
