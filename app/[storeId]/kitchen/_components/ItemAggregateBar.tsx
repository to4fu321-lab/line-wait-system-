'use client'

import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import { getUrgencyLevel } from '@/types/takeout'

type Level = 'urgent' | 'warning' | 'normal'

interface AggItem { name: string; qty: number; level: Level }

interface Props {
  orders:   TakeoutOrder[]   // pending + preparing
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

  const items = Array.from(map.values()).sort((a, b) => {
    const s = (l: Level) => l === 'urgent' ? 0 : l === 'warning' ? 1 : 2
    return s(a.level) - s(b.level) || b.qty - a.qty
  })

  if (items.length === 0) return null

  const visible  = items.slice(0, 6)
  const overflow = items.length - visible.length
  const hasUrgent  = items.some(i => i.level === 'urgent')
  const hasWarning = !hasUrgent && items.some(i => i.level === 'warning')

  return (
    <div className={`shrink-0 border-b-2 ${
      hasUrgent  ? 'bg-red-950/20   border-red-800/70'   :
      hasWarning ? 'bg-amber-950/20 border-amber-800/50' :
      'bg-zinc-900 border-zinc-700'
    }`}>
      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="font-black text-base text-white">今から作るもの</span>
        {hasUrgent  && <span className="text-[11px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">⚡ 急いで！</span>}
        {hasWarning && <span className="text-[11px] font-black bg-amber-500 text-zinc-950 px-2 py-0.5 rounded-full">もうすぐ</span>}
        <span className="ml-auto text-xs text-zinc-600">{orders.length}件 · {items.length}品目</span>
      </div>

      {/* 品目グリッド */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {visible.map(item => (
          <div key={item.name} className={`rounded-2xl px-4 py-3 flex flex-col gap-0.5 ${
            item.level === 'urgent'  ? 'bg-red-900/60   border border-red-500/60'   :
            item.level === 'warning' ? 'bg-amber-900/50 border border-amber-500/40' :
            'bg-zinc-800 border border-zinc-700/60'
          }`}>
            {/* 品目名 */}
            <span className={`text-sm font-semibold leading-tight truncate ${
              item.level === 'urgent'  ? 'text-red-200'    :
              item.level === 'warning' ? 'text-amber-200'  :
              'text-zinc-300'
            }`}>{item.name}</span>
            {/* 個数（超大きく） */}
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-5xl font-black tabular-nums leading-none ${
                item.level === 'urgent'  ? 'text-red-300'    :
                item.level === 'warning' ? 'text-amber-300'  :
                'text-white'
              }`}>{item.qty}</span>
              <span className="text-lg font-bold text-zinc-500">個</span>
            </div>
          </div>
        ))}
        {overflow > 0 && (
          <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700/40 flex items-center justify-center">
            <span className="text-sm text-zinc-500 font-bold">+{overflow}品目</span>
          </div>
        )}
      </div>
    </div>
  )
}
