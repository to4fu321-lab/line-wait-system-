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
  createdAt:    string
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
        createdAt: order.created_at,
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

  const groups = Array.from(map.values())

  // 各グループ内を注文時刻順（古い順）に並べる
  for (const g of groups) {
    g.rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  return groups.sort((a, b) => {
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
  const [doneSet,      setDoneSet]      = useState<Set<string>>(new Set())
  const [inFlight,     setInFlight]     = useState<Set<string>>(new Set())
  // key: グループ名, value: カットラインとなる行の itemId
  const [groupCutoffs, setGroupCutoffs] = useState<Map<string, string>>(new Map())

  const targetMinutes = settings.target_minutes ?? 15
  const groups        = buildGroups(orders, targetMinutes, doneSet)
  const totalQty      = groups.reduce((s, g) => s + g.totalQty, 0)
  const totalDone     = groups.reduce((s, g) => s + g.doneQty,  0)
  const remaining     = totalQty - totalDone

  const markDone = useCallback(async (row: Row) => {
    if (row.isDone || inFlight.has(row.itemId)) return

    setDoneSet(p  => new Set(p).add(row.itemId))
    setInFlight(p => new Set(p).add(row.itemId))

    try {
      await supabase
        .from('takeout_order_items')
        .update({ is_done: true } as never)
        .eq('id', row.itemId)

      const order = orders.find(o => o.id === row.orderId)
      if (order?.status === 'pending') {
        await supabase
          .from('takeout_orders')
          .update({ status: 'preparing' } as never)
          .eq('id', row.orderId)
      }

      const { data: remaining } = await supabase
        .from('takeout_order_items')
        .select('id, is_done')
        .eq('order_id', row.orderId)

      const allDone = ((remaining ?? []) as { id: string; is_done: boolean }[]).every(i => i.is_done || i.id === row.itemId)
      if (allDone) {
        await supabase
          .from('takeout_orders')
          .update({ status: 'ready' } as never)
          .eq('id', row.orderId)

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

  // カットライン以上の行をまとめて完了
  const markBatchDone = useCallback(async (rows: Row[], groupName: string) => {
    const targets = rows.filter(r => !r.isDone && !inFlight.has(r.itemId))
    if (targets.length === 0) return
    setGroupCutoffs(p => { const n = new Map(p); n.delete(groupName); return n })
    for (const row of targets) {
      await markDone(row)
    }
  }, [markDone, inFlight])

  const toggleCutoff = useCallback((groupName: string, itemId: string) => {
    setGroupCutoffs(p => {
      const n = new Map(p)
      n.get(groupName) === itemId ? n.delete(groupName) : n.set(groupName, itemId)
      return n
    })
  }, [])

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

            const cutoffItemId = groupCutoffs.get(group.name)
            const cutoffIndex  = cutoffItemId
              ? group.rows.findIndex(r => r.itemId === cutoffItemId)
              : -1
            const selectedRows = cutoffIndex >= 0
              ? group.rows.slice(0, cutoffIndex + 1).filter(r => !r.isDone)
              : []
            const selectedQty  = selectedRows.reduce((s, r) => s + r.quantity, 0)
            const hasSelection = selectedRows.length > 0

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
                  ) : hasSelection ? (
                    <button
                      onClick={() => markBatchDone(selectedRows, group.name)}
                      className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-sm active:scale-95 transition-all shrink-0 shadow-lg shadow-emerald-900/50"
                    >
                      <span className="text-xl tabular-nums leading-none">{selectedQty}</span>
                      <span>個 作った！</span>
                    </button>
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
                  {group.rows.map((row, rowIndex) => {
                    const isSelected = !row.isDone && cutoffIndex >= 0 && rowIndex <= cutoffIndex
                    const isCutoff   = !row.isDone && row.itemId === cutoffItemId

                    return (
                      <div key={row.itemId}>
                        <div
                          onClick={() => { if (!row.isDone) toggleCutoff(group.name, row.itemId) }}
                          className={`flex items-center gap-3 px-4 py-3.5 transition-all duration-150 ${
                            row.isDone   ? 'opacity-30 cursor-default'
                            : isSelected ? 'bg-emerald-950/50 active:bg-emerald-900/50 cursor-pointer'
                            : 'cursor-pointer active:bg-zinc-900/80'
                          }`}
                        >
                          {/* 選択サークル */}
                          <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-2 transition-all ${
                            row.isDone   ? 'border-emerald-800 bg-emerald-950'
                            : isSelected ? 'border-emerald-400 bg-emerald-500'
                            : 'border-zinc-700 bg-zinc-900'
                          }`}>
                            {(row.isDone || isSelected) && (
                              <span className="text-[11px] text-white font-black leading-none">✓</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-bold font-mono ${
                                row.urgency === 'urgent'  ? 'text-red-400'
                                : row.urgency === 'warning' ? 'text-amber-400'
                                : isSelected ? 'text-emerald-300' : 'text-zinc-400'
                              }`}>{row.orderNumber}</span>
                              {row.customerName && (
                                <span className={`text-sm ${isSelected ? 'text-emerald-200' : 'text-zinc-500'}`}>
                                  {row.customerName}様
                                </span>
                              )}
                            </div>
                          </div>

                          <span className={`font-black text-xl tabular-nums shrink-0 ${
                            row.isDone   ? 'text-zinc-700'
                            : isSelected ? 'text-emerald-300'
                            : 'text-zinc-300'
                          }`}>×{row.quantity}</span>
                        </div>

                        {/* カットライン */}
                        {isCutoff && (
                          <div className="flex items-center gap-2 px-4 py-1 bg-emerald-950/30">
                            <div className="flex-1 h-px bg-emerald-600/50" />
                            <span className="text-[11px] font-black text-emerald-500 shrink-0">↑ ここまで {selectedQty}個</span>
                            <div className="flex-1 h-px bg-emerald-600/50" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
