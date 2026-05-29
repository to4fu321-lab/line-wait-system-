'use client'

import { useEffect, useRef, useState } from 'react'
import type { TakeoutOrder, TakeoutSettings, UrgencyLevel } from '@/types/takeout'
import { getActionLabel, getNextStatus, getUrgencyLevel } from '@/types/takeout'

const URGENCY: Record<UrgencyLevel, { bar: string; border: string; btn: string; timer: string; badge: string }> = {
  normal:  { bar: 'bg-amber-600',  border: 'border-zinc-700',  btn: 'bg-amber-600 text-white',    timer: 'text-zinc-300',   badge: '' },
  warning: { bar: 'bg-amber-400',  border: 'border-amber-400', btn: 'bg-amber-400 text-zinc-950', timer: 'text-amber-300',  badge: 'もうすぐ' },
  urgent:  { bar: 'bg-red-500',    border: 'border-red-500',   btn: 'bg-red-500 text-white',      timer: 'text-red-400',    badge: '急いで！' },
}

function useElapsedParts(createdAt: string) {
  const [parts, setParts] = useState({ m: '00', s: '00', total: 0 })
  useEffect(() => {
    const tick = () => {
      const total = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
      setParts({
        m:     Math.floor(total / 60).toString().padStart(2, '0'),
        s:     (total % 60).toString().padStart(2, '0'),
        total,
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [createdAt])
  return parts
}

function pickupLabel(pickupTime: string | null): { text: string; color: string } | null {
  if (!pickupTime) return null
  const diff = Math.round((new Date(pickupTime).getTime() - Date.now()) / 60000)
  const t    = new Date(pickupTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  if (diff > 30) return { text: `受取 ${t}`,              color: 'text-zinc-600' }
  if (diff > 10) return { text: `受取 ${t}（あと${diff}分）`, color: 'text-zinc-400' }
  if (diff > 0)  return { text: `⏰ あと ${diff} 分で受取`, color: 'text-amber-400' }
  return           { text: `⚠️ 受取超過 ${Math.abs(diff)} 分`, color: 'text-red-400' }
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
  const pickup        = pickupLabel(order.pickup_time)
  const elapsed       = useElapsedParts(order.created_at)

  const isReady   = order.status === 'ready'
  const isPending = order.status === 'pending'

  const barColor    = isReady ? 'bg-emerald-500'  : isPending ? 'bg-zinc-700'  : URGENCY[urgency].bar
  const borderColor = isReady ? 'border-emerald-500' : isPending ? 'border-zinc-700' : URGENCY[urgency].border
  const btnColor    = isReady ? 'bg-emerald-500 text-white' : isPending ? 'bg-zinc-700 text-zinc-200' : URGENCY[urgency].btn
  const timerColor  = isReady ? 'text-emerald-400' : isPending ? 'text-zinc-500' : URGENCY[urgency].timer
  const badge       = (!isReady && !isPending && URGENCY[urgency].badge) || ''

  const handleAdvance = async () => {
    setAdvancing(true)
    try { await onAdvance() } finally { setAdvancing(false) }
  }

  return (
    <div className={`flex items-stretch rounded-xl overflow-hidden border-2 ${borderColor} bg-zinc-900`}>
      {/* 左：カラーバー */}
      <div className={`w-1.5 shrink-0 ${barColor}`} />

      {/* 中：情報エリア */}
      <div className="flex-1 px-3 py-2.5 min-w-0">

        {/* ── 行1: 経過時間（最重要・大きく） ── */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-mono font-black tabular-nums text-3xl leading-none ${timerColor}`}>
            {elapsed.m}<span className="opacity-60 text-2xl">:</span>{elapsed.s}
          </span>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              urgency === 'urgent' ? 'bg-red-500/25 text-red-300' : 'bg-amber-500/20 text-amber-300'
            }`}>{badge}</span>
          )}
          {isReady && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300">
              お渡し待ち
            </span>
          )}
          {isPending && (
            <span className="text-xs text-zinc-600 font-medium">→ 調理開始をタップ</span>
          )}
          {pickup && (
            <span className={`text-xs ml-auto ${pickup.color}`}>{pickup.text}</span>
          )}
        </div>

        {/* ── 行2: 品目リスト（最重要・大きく） ── */}
        <div className="flex flex-col gap-1 mb-2.5">
          {items.length > 0 ? items.map((item, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className={`font-bold text-lg leading-tight ${isReady ? 'text-zinc-400' : 'text-white'}`}>
                {item.name}
              </span>
              <span className={`shrink-0 font-black text-xl tabular-nums ${
                isReady ? 'text-zinc-500' : 'text-white'
              }`}>
                ×{item.quantity}
              </span>
            </div>
          )) : (
            <span className="text-zinc-600 text-sm">（品目なし）</span>
          )}
        </div>

        {/* 備考（目立たせる） */}
        {order.notes && (
          <div className="text-sm text-amber-300 bg-amber-950/40 rounded-lg px-2.5 py-1.5 mb-2">
            📝 {order.notes}
          </div>
        )}

        {/* ── 行3: 注文番号・名前・経路（小さく下に） ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-zinc-500 font-mono">{order.order_number}</span>
          {order.customer_name && (
            <span className="text-sm text-zinc-500">{order.customer_name}様</span>
          )}
          {order.order_source && order.order_source !== 'line' && (
            <span className="text-xs text-zinc-700">
              {order.order_source === 'phone' ? '📞' : '🚶'}
            </span>
          )}
          <div className="flex-1" />
          {/* キャンセル */}
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)}
              className="text-xs text-zinc-700 active:text-zinc-500">
              キャンセル
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => { setConfirmCancel(false); await onCancel() }}
                className="text-xs text-red-400 font-semibold bg-red-950/40 px-2 py-1 rounded">
                確定
              </button>
              <button onClick={() => setConfirmCancel(false)} className="text-xs text-zinc-600">
                やめる
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 右：アクションボタン（フル高さ） */}
      {nextStatus ? (
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className={`
            shrink-0 w-20 md:w-24 flex flex-col items-center justify-center gap-1
            font-bold text-sm active:opacity-70 transition-opacity select-none
            ${btnColor} ${advancing ? 'opacity-50' : ''}
          `}
        >
          <span className="text-2xl">
            {isReady ? '🤲' : isPending ? '▶' : urgency === 'urgent' ? '⚡' : '✓'}
          </span>
          <span className="text-center leading-tight px-1 text-xs">{actionLabel}</span>
        </button>
      ) : (
        <div className="w-20 md:w-24 shrink-0" />
      )}
    </div>
  )
}
