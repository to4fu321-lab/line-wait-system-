'use client'

import { useEffect, useState } from 'react'
import type { TakeoutOrder, TakeoutSettings, UrgencyLevel } from '@/types/takeout'
import {
  DEFAULT_STATUS_LABELS,
  getActionLabel,
  getNextStatus,
  getUrgencyLevel,
} from '@/types/takeout'

const URGENCY_CARD: Record<UrgencyLevel, string> = {
  normal:  'border-emerald-500/40 bg-emerald-950/20',
  warning: 'border-amber-400/70 bg-amber-950/20',
  urgent:  'border-red-500/90 bg-red-950/30 animate-pulse',
}

const URGENCY_BADGE: Record<UrgencyLevel, { style: string; label: string }> = {
  normal:  { style: 'bg-emerald-500/20 text-emerald-300', label: '余裕あり' },
  warning: { style: 'bg-amber-500/20 text-amber-300',     label: 'もうすぐ' },
  urgent:  { style: 'bg-red-500/30 text-red-300',         label: '急いで！' },
}

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    const update = () => {
      const sec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
      const m   = Math.floor(sec / 60).toString().padStart(2, '0')
      const s   = (sec % 60).toString().padStart(2, '0')
      setElapsed(`${m}:${s}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [createdAt])
  return <span className="font-mono">{elapsed}</span>
}

interface Props {
  order:     TakeoutOrder
  settings:  TakeoutSettings
  onAdvance: () => void
}

export default function ActiveOrderCard({ order, settings, onAdvance }: Props) {
  const targetMinutes = settings.target_minutes ?? 15
  const urgency       = getUrgencyLevel(order.created_at, order.status, targetMinutes)
  const badge         = URGENCY_BADGE[urgency]
  const labels        = { ...DEFAULT_STATUS_LABELS, ...settings.status_labels }
  const nextStatus    = getNextStatus(order.status, settings)
  const actionLabel   = getActionLabel(order.status, settings)

  return (
    <div className={`rounded-2xl border-2 p-5 md:p-7 flex flex-col gap-4 md:gap-6 h-full transition-colors ${URGENCY_CARD[urgency]}`}>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-5xl md:text-7xl font-black tracking-tight leading-none">
            {order.order_number}
          </span>
          {order.customer_name && (
            <span className="text-xl md:text-2xl text-zinc-300">{order.customer_name}様</span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs md:text-sm px-2 py-1 rounded-full font-semibold ${badge.style}`}>
            {badge.label}
          </span>
          <span className="text-sm md:text-base text-zinc-400">
            ⏱ <ElapsedTimer createdAt={order.created_at} />
          </span>
        </div>
      </div>

      {/* 注文内容 */}
      <div className="flex flex-col gap-2 md:gap-3 flex-1">
        {(order.items ?? []).map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-4 md:px-6 py-3 md:py-4"
          >
            <span className="text-lg md:text-2xl font-medium">{item.name}</span>
            <span className="text-3xl md:text-4xl font-black">×{item.quantity}</span>
          </div>
        ))}
        {order.notes && (
          <div className="text-sm md:text-base text-amber-300 bg-amber-950/30 rounded-xl px-3 py-2">
            📝 {order.notes}
          </div>
        )}
      </div>

      {/* 現在ステータス */}
      <div className="text-sm md:text-base text-zinc-500">
        現在：<span className="text-zinc-300 font-medium">{labels[order.status]}</span>
      </div>

      {/* アクションボタン */}
      {nextStatus && (
        <button
          onClick={onAdvance}
          className="w-full py-5 md:py-7 rounded-xl text-2xl md:text-3xl font-black bg-white text-zinc-950 active:scale-95 transition-transform select-none"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
