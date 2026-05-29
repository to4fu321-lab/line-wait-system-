'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import { getUrgencyLevel } from '@/types/takeout'

type Urgency = 'urgent' | 'warning' | 'normal'

interface Row {
  itemId:       string
  orderId:      string
  orderNumber:  string
  customerName: string | null
  quantity:     number
  isDone:       boolean
  urgency:      Urgency
}

interface Group {
  name:       string
  totalQty:   number
  doneQty:    number
  maxUrgency: Urgency
  rows:       Row[]
}

function buildGroups(orders: TakeoutOrder[], targetMinutes: number, doneSet: Set<string>): Group[] {
  const map = new Map<string, Group>()

  for (const order of orders) {
    const urgency: Urgency =
      order.status === 'preparing'
        ? getUrgencyLevel(order.created_at, order.status, targetMinutes)
        : 'normal'

    for (const item of order.items ?? []) {
      const done = doneSet.has(item.id) || item.is_done
      const row: Row = {
        itemId: item.id, orderId: order.id,
        orderNumber: order.order_number, customerName: order.customer_name,
        quantity: item.quantity, isDone: done, urgency,
      }
      const g = map.get(item.name)
      if (g) {
        g.rows.push(row)
        g.totalQty += item.quantity
        if (done) g.doneQty += item.quantity
        if (urgency === 'urgent') g.maxUrgency = 'urgent'
        else if (urgency === 'warning' && g.maxUrgency === 'normal') g.maxUrgency = 'warning'
      } else {
        map.set(item.name, {
          name: item.name, totalQty: item.quantity, doneQty: done ? item.quantity : 0,
          maxUrgency: urgency, rows: [row],
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const s = (u: Urgency) => u === 'urgent' ? 0 : u === 'warning' ? 1 : 2
    return s(a.maxUrgency) - s(b.maxUrgency) || (b.totalQty - b.doneQty) - (a.totalQty - a.doneQty)
  })
}

interface Props {
  orders:    TakeoutOrder[]
  settings:  TakeoutSettings
  onRefresh: () => void
}

export default function ItemCookView({ orders, settings, onRefresh }: Props) {
  const [doneSet,  setDoneSet]  = useState<Set<string>>(new Set())
  const [inFlight, setInFlight] = useState<Set<string>>(new Set())

  const targetMinutes = settings.target_minutes ?? 15
  const groups        = buildGroups(orders, targetMinutes, doneSet)
  const totalQty      = groups.reduce((s, g) => s + g.totalQty, 0)
  const totalDone     = groups.reduce((s, g) => s + g.doneQty,  0)
  const remaining     = totalQty - totalDone

  const markDone = useCallback(async (row: Row) => {
    if (row.isDone || inFlight.has(row.itemId)) return

    // 楽観的更新
    setDoneSet(p  => new Set(p).add(row.itemId))
    setInFlight(p => new Set(p).add(row.itemId))

    try {
      await supabase
        .from('takeout_order_items')
        .update({ is_done: true } as never)
        .eq('id', row.itemId)

      // pending → preparing に自動昇格（計時開始）
      const order = orders.find(o => o.id === row.orderId)
      if (order?.status === 'pending') {
        await supabase
          .from('takeout_orders')
          .update({ status: 'preparing' } as never)
          .eq('id', row.orderId)
      }

      // 注文の全品目が完了したか確認
      const { data: remaining } = await supabase
        .from('takeout_order_items')
        .select('id, is_done')
        .eq('order_id', row.orderId)

      const allDone = (remaining ?? []).every(i => i.is_done || i.id === row.itemId)
      if (allDone) {
        await supabase
          .from('takeout_orders')
          .update({ status: 'ready' } as never)
          .eq('id', row.orderId)

        // LINE 通知
        fetch('/api/notify-takeout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: row.orderId, status: 'ready' }),
        }).catch(console.error)

        onRefresh()
      }
    } finally {
      setInFlight(p => { const n = new Set(p); n.delete(row.itemId); return n })
    }
  }, [orders, inFlight, onRefresh])

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center text-zinc-700">
          <div className="text-6xl mb-3">✓</div>
          <div className="text-lg font-medium">調理待ちなし</div>
          <div className="text-sm mt-1 text-zinc-600">新しい注文が入ると自動で表示されます</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 全体進捗 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
        <span className="text-zinc-500 text-xs shrink-0">残り</span>
        <span className="text-2xl font-black text-white tabular-nums">{remaining}</span>
        <span className="text-zinc-500 text-xs shrink-0">/ {totalQty}個</span>
        <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
            style={{ width: `${totalQty > 0 ? (totalDone / totalQty) * 100 : 0}%` }}
          />
        </div>
        {remaining === 0 && totalQty > 0 && (
          <span className="text-xs font-black text-emerald-400 animate-pulse shrink-0">全完了！</span>
        )}
      </div>

      {/* 品目グループ */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3 max-w-2xl mx-auto">
          {groups.map(group => {
            const rem      = group.totalQty - group.doneQty
            const allDone  = rem === 0
            const isUrgent  = group.maxUrgency === 'urgent'
            const isWarning = group.maxUrgency === 'warning'

            return (
              <div key={group.name} className={`rounded-2xl overflow-hidden border transition-opacity duration-300 ${
                allDone     ? 'opacity-40 border-zinc-800'
                : isUrgent  ? 'border-red-500/70'
                : isWarning ? 'border-amber-500/50'
                : 'border-zinc-700'
              }`}>
                {/* 品目ヘッダー */}
                <div className={`px-4 py-3 flex items-center gap-3 ${
                  allDone     ? 'bg-zinc-900'
                  : isUrgent  ? 'bg-red-950/60'
                  : isWarning ? 'bg-amber-950/40'
                  : 'bg-zinc-800/90'
                }`}>
                  <span className={`font-black text-xl flex-1 truncate ${
                    allDone ? 'text-zinc-600 line-through' : 'text-white'
                  }`}>{group.name}</span>

                  {allDone ? (
                    <span className="text-base font-black text-emerald-500">✓ 完了</span>
                  ) : (
                    <>
                      {isUrgent && (
                        <span className="text-xs font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse shrink-0">急いで</span>
                      )}
                      <span className={`text-5xl font-black tabular-nums leading-none shrink-0 ${
                        isUrgent  ? 'text-red-300'
                        : isWarning ? 'text-amber-300'
                        : 'text-white'
                      }`}>
                        {rem}
                        <span className="text-lg font-normal text-zinc-500 ml-1">個</span>
                      </span>
                    </>
                  )}
                </div>

                {/* 注文行 */}
                <div className="bg-zinc-950 divide-y divide-zinc-800/80">
                  {group.rows.map(row => (
                    <div key={row.itemId}
                      className={`flex items-center gap-3 px-4 py-3 transition-opacity duration-300 ${row.isDone ? 'opacity-30' : ''}`}>
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold font-mono ${
                          row.urgency === 'urgent'  ? 'text-red-400'   :
                          row.urgency === 'warning' ? 'text-amber-400' : 'text-zinc-400'
                        }`}>{row.orderNumber}</span>
                        {row.customerName && (
                          <span className="text-sm text-zinc-500">{row.customerName}様</span>
                        )}
                        <span className="font-black text-base text-zinc-400 tabular-nums ml-auto">×{row.quantity}</span>
                      </div>

                      <button
                        onClick={() => markDone(row)}
                        disabled={row.isDone || inFlight.has(row.itemId)}
                        className={`shrink-0 h-11 px-5 rounded-xl font-black text-sm transition-all active:scale-95 ${
                          row.isDone
                            ? 'bg-emerald-900/30 text-emerald-700 border border-emerald-800/40 cursor-default'
                            : inFlight.has(row.itemId)
                            ? 'bg-zinc-800 text-zinc-600'
                            : 'bg-white text-zinc-950 shadow-sm shadow-white/10'
                        }`}
                      >
                        {row.isDone ? '✓' : '作った'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
