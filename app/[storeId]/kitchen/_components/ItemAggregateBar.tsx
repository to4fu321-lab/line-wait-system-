'use client'

import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import { getUrgencyLevel } from '@/types/takeout'

type Level = 'urgent' | 'warning' | 'normal'

interface AggItem {
  name:  string
  qty:   number
  level: Level
}

interface Props {
  orders:   TakeoutOrder[]   // pending + preparing のみ渡す
  settings: TakeoutSettings
}

export default function ItemAggregateBar({ orders, settings }: Props) {
  const targetMinutes = settings.target_minutes ?? 15

  const map = new Map<string, AggItem>()

  for (const order of orders) {
    const urgency: Level =
      order.status === 'preparing'
        ? getUrgencyLevel(order.created_at, order.status, targetMinutes)
        : 'normal'

    for (const item of order.items ?? []) {
      const ex = map.get(item.name)
      if (ex) {
        ex.qty += item.quantity
        if (urgency === 'urgent') ex.level = 'urgent'
        else if (urgency === 'warning' && ex.level === 'normal') ex.level = 'warning'
      } else {
        map.set(item.name, { name: item.name, qty: item.quantity, level: urgency })
      }
    }
  }

  const items = Array.from(map.values()).sort((a, b) => b.qty - a.qty)
  if (items.length === 0) return null

  return (
    <div className="bg-zinc-950 border-b border-zinc-800 px-3 pt-2 pb-2.5 shrink-0">
      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-1.5">
        今から作る合計 — {orders.length}件分
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => {
          const isUrgent  = item.level === 'urgent'
          const isWarning = item.level === 'warning'
          return (
            <div key={item.name} className={`
              flex items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 border
              ${isUrgent  ? 'bg-red-950/50 border-red-500/50 text-red-200' :
                isWarning ? 'bg-amber-950/50 border-amber-500/40 text-amber-200' :
                'bg-zinc-800 border-zinc-700 text-zinc-200'}
            `}>
              <span className="text-sm font-bold leading-none max-w-[14ch] truncate">{item.name}</span>
              <span className={`text-2xl font-black tabular-nums leading-none ${
                isUrgent  ? 'text-red-300' :
                isWarning ? 'text-amber-300' :
                'text-white'
              }`}>×{item.qty}</span>
              {isUrgent  && <span className="text-[10px] font-black text-red-400">急</span>}
              {isWarning && <span className="text-[10px] font-black text-amber-400">急</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
