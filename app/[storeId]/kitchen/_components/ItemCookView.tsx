'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import { getUrgencyLevel } from '@/types/takeout'
import { guessMenuIcon } from '@/lib/menu-icons'

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
  isActive:     boolean  // order.status === 'preparing'
}

interface Group {
  name:          string
  totalQty:      number
  doneQty:       number
  maxUrgency:    Urgency
  rows:          Row[]
  isActive:      boolean  // 調理中の注文が含まれる
  blockingCount: number   // これを作ればN件がすぐ完成
  pendingRows:   number   // 未完了の行数
}

// 優先スコア（低い方が上位）
function priorityScore(g: Group): number {
  if (g.isActive)           return 0  // 調理中を最優先
  if (g.blockingCount > 0)  return 1  // これで完成する注文がある
  const u = g.maxUrgency === 'urgent' ? 2 : g.maxUrgency === 'warning' ? 3 : 4
  return u
}

function buildGroups(orders: TakeoutOrder[], targetMinutes: number, doneSet: Set<string>): Group[] {
  // Pass 1: 各注文の未完了品目数を計算（blockingCount 算出のため）
  const orderUndoneCounts = new Map<string, number>()
  for (const order of orders) {
    const undone = (order.items ?? []).filter(i => !doneSet.has(i.id) && !i.is_done).length
    orderUndoneCounts.set(order.id, undone)
  }

  // Pass 2: グループ構築
  const map = new Map<string, Group>()

  for (const order of orders) {
    const urgency: Urgency =
      order.status === 'preparing'
        ? getUrgencyLevel(order.created_at, order.status, targetMinutes)
        : 'normal'
    const isActive = order.status === 'preparing'

    for (const item of order.items ?? []) {
      const done = doneSet.has(item.id) || item.is_done
      const row: Row = {
        itemId: item.id, orderId: order.id,
        orderNumber: order.order_number, customerName: order.customer_name,
        quantity: item.quantity, isDone: done, urgency,
        createdAt: order.created_at, isActive,
      }
      const g = map.get(item.name)
      if (g) {
        g.rows.push(row)
        g.totalQty += item.quantity
        if (done) g.doneQty += item.quantity
        if (!done) g.pendingRows++
        if (isActive && !done) g.isActive = true
        if (urgency === 'urgent') g.maxUrgency = 'urgent'
        else if (urgency === 'warning' && g.maxUrgency === 'normal') g.maxUrgency = 'warning'
      } else {
        map.set(item.name, {
          name: item.name, totalQty: item.quantity,
          doneQty: done ? item.quantity : 0,
          pendingRows: done ? 0 : 1,
          maxUrgency: urgency, rows: [row],
          isActive: isActive && !done,
          blockingCount: 0,
        })
      }
    }
  }

  // Pass 3: blockingCount — この品目を作るとすぐ完成する注文数
  for (const order of orders) {
    const undone = orderUndoneCounts.get(order.id) ?? 0
    if (undone !== 1) continue
    // 未完了品目が1つだけ → その品目グループに +1
    for (const item of order.items ?? []) {
      if (!doneSet.has(item.id) && !item.is_done) {
        const g = map.get(item.name)
        if (g) g.blockingCount++
      }
    }
  }

  const groups = Array.from(map.values())

  // 行を調理中優先 → 緊急度 → 注文時刻 でソート
  for (const g of groups) {
    g.rows.sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      const us = (u: Urgency) => u === 'urgent' ? 0 : u === 'warning' ? 1 : 2
      if (us(a.urgency) !== us(b.urgency)) return us(a.urgency) - us(b.urgency)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  // グループをスマートソート
  return groups.sort((a, b) => {
    const ps = priorityScore(a) - priorityScore(b)
    if (ps !== 0) return ps
    // 同スコアならblocking多い順 → pendingRows多い順
    if (a.blockingCount !== b.blockingCount) return b.blockingCount - a.blockingCount
    return b.pendingRows - a.pendingRows
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
  const [groupCutoffs, setGroupCutoffs] = useState<Map<string, string>>(new Map())

  const targetMinutes = settings.target_minutes ?? 15
  const groups        = buildGroups(orders, targetMinutes, doneSet)
  const totalQty      = groups.reduce((s, g) => s + g.totalQty, 0)
  const totalDone     = groups.reduce((s, g) => s + g.doneQty,  0)
  const remaining     = totalQty - totalDone

  // 1位推薦（未完了グループの先頭）
  const topGroup = groups.find(g => g.totalQty > g.doneQty)

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

      const allDone = ((remaining ?? []) as { id: string; is_done: boolean }[])
        .every(i => i.is_done || i.id === row.itemId)
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

      {/* 今すぐ作るべき推薦バナー */}
      {topGroup && (
        <div className={`shrink-0 px-4 py-2.5 flex items-center gap-3 border-b ${
          topGroup.isActive
            ? 'bg-orange-950/50 border-orange-700/50'
            : topGroup.blockingCount > 0
            ? 'bg-sky-950/40 border-sky-700/40'
            : 'bg-zinc-900 border-zinc-800'
        }`}>
          <span className="text-lg shrink-0">
            {topGroup.isActive ? '🔥' : topGroup.blockingCount > 0 ? '🔑' : '▶'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-zinc-500 leading-none mb-0.5">今すぐ作るべき</div>
            <div className="font-black text-white text-base leading-tight truncate">{topGroup.name}</div>
          </div>
          <div className="text-right shrink-0">
            {topGroup.blockingCount > 0 && (
              <div className={`text-xs font-black ${topGroup.isActive ? 'text-orange-300' : 'text-sky-300'}`}>
                {topGroup.blockingCount}件が完成待ち
              </div>
            )}
            <div className="text-2xl font-black tabular-nums text-white leading-none">
              {topGroup.totalQty - topGroup.doneQty}
              <span className="text-sm font-normal text-zinc-500 ml-0.5">個</span>
            </div>
          </div>
        </div>
      )}

      {/* 品目グループリスト */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3 max-w-2xl mx-auto">
          {groups.map((group, groupIndex) => {
            const rem      = group.totalQty - group.doneQty
            const allDone  = rem === 0
            const isTop    = groupIndex === 0 && !allDone

            const cutoffItemId = groupCutoffs.get(group.name)
            const cutoffIndex  = cutoffItemId
              ? group.rows.findIndex(r => r.itemId === cutoffItemId)
              : -1
            const selectedRows = cutoffIndex >= 0
              ? group.rows.slice(0, cutoffIndex + 1).filter(r => !r.isDone)
              : []
            const selectedQty  = selectedRows.reduce((s, r) => s + r.quantity, 0)
            const hasSelection = selectedRows.length > 0

            // ヘッダー配色
            const headerBg =
              allDone          ? 'bg-zinc-900'
              : group.isActive ? 'bg-orange-950/70'
              : group.maxUrgency === 'urgent'  ? 'bg-red-950/60'
              : group.maxUrgency === 'warning' ? 'bg-amber-950/40'
              : 'bg-zinc-800/90'

            const borderColor =
              allDone          ? 'border-zinc-800'
              : group.isActive ? 'border-orange-500/70'
              : group.maxUrgency === 'urgent'  ? 'border-red-500/70'
              : group.maxUrgency === 'warning' ? 'border-amber-500/50'
              : isTop          ? 'border-zinc-500'
              : 'border-zinc-700'

            return (
              <div key={group.name} className={`rounded-2xl overflow-hidden border transition-opacity duration-300 ${borderColor} ${allDone ? 'opacity-40' : ''}`}>

                {/* 品目ヘッダー */}
                <div className={`px-4 py-3 flex items-center gap-2 ${headerBg}`}>
                  {/* 優先バッジ */}
                  {!allDone && (
                    <span className="text-base shrink-0">
                      {group.isActive ? '🔥' : group.blockingCount > 0 ? '🔑' : ''}
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl leading-none shrink-0">{guessMenuIcon(group.name)}</span>
                      <span className={`font-black text-xl leading-tight truncate ${
                        allDone ? 'text-zinc-600 line-through' : 'text-white'
                      }`}>{group.name}</span>
                    </div>
                    {/* サブラベル */}
                    {!allDone && (
                      <span className={`text-[11px] font-bold leading-none ${
                        group.isActive            ? 'text-orange-400'
                        : group.blockingCount > 0 ? 'text-sky-400'
                        : 'text-zinc-600'
                      }`}>
                        {group.isActive && group.blockingCount > 0
                          ? `調理中 · あと${group.blockingCount}件完成`
                          : group.isActive
                          ? '調理中を先に完成させて'
                          : group.blockingCount > 0
                          ? `作ると${group.blockingCount}件がすぐ完成`
                          : `${group.pendingRows}注文待ち`
                        }
                      </span>
                    )}
                  </div>

                  {allDone ? (
                    <span className="text-base font-black text-emerald-500 shrink-0">✓ 完了</span>
                  ) : hasSelection ? (
                    <button
                      onClick={() => markBatchDone(selectedRows, group.name)}
                      className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-sm active:scale-95 transition-all shrink-0 shadow-lg shadow-emerald-900/50"
                    >
                      <span className="text-xl tabular-nums leading-none">{selectedQty}</span>
                      <span>個 作った！</span>
                    </button>
                  ) : (
                    <span className={`text-5xl font-black tabular-nums leading-none shrink-0 ${
                      group.isActive           ? 'text-orange-300'
                      : group.maxUrgency === 'urgent'  ? 'text-red-300'
                      : group.maxUrgency === 'warning' ? 'text-amber-300'
                      : 'text-white'
                    }`}>
                      {rem}
                      <span className="text-lg font-normal text-zinc-500 ml-1">個</span>
                    </span>
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
                            : row.isActive ? 'bg-orange-950/20 cursor-pointer active:bg-orange-900/30'
                            : 'cursor-pointer active:bg-zinc-900/80'
                          }`}
                        >
                          {/* 選択サークル */}
                          <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-2 transition-all ${
                            row.isDone   ? 'border-emerald-800 bg-emerald-950'
                            : isSelected ? 'border-emerald-400 bg-emerald-500'
                            : row.isActive ? 'border-orange-500/70 bg-orange-950/50'
                            : 'border-zinc-700 bg-zinc-900'
                          }`}>
                            {(row.isDone || isSelected) && (
                              <span className="text-[11px] text-white font-black leading-none">✓</span>
                            )}
                            {!row.isDone && !isSelected && row.isActive && (
                              <span className="text-[9px] text-orange-400 font-black leading-none">▶</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-bold font-mono ${
                                row.urgency === 'urgent'  ? 'text-red-400'
                                : row.urgency === 'warning' ? 'text-amber-400'
                                : isSelected ? 'text-emerald-300'
                                : row.isActive ? 'text-orange-300'
                                : 'text-zinc-400'
                              }`}>{row.orderNumber}</span>
                              {row.customerName && (
                                <span className={`text-sm ${
                                  isSelected ? 'text-emerald-200'
                                  : row.isActive ? 'text-orange-200/70'
                                  : 'text-zinc-500'
                                }`}>
                                  {row.customerName}様
                                </span>
                              )}
                            </div>
                          </div>

                          <span className={`font-black text-xl tabular-nums shrink-0 ${
                            row.isDone   ? 'text-zinc-700'
                            : isSelected ? 'text-emerald-300'
                            : row.isActive ? 'text-orange-300'
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
