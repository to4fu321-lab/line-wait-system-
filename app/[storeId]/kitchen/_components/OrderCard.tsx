'use client'

import { useState } from 'react'
import type { TakeoutOrder, TakeoutSettings, UrgencyLevel } from '@/types/takeout'
import { getActionLabel, getNextStatus, getUrgencyLevel } from '@/types/takeout'
import ElapsedTimer from './ElapsedTimer'

const URGENCY_BORDER: Record<UrgencyLevel, string> = {
  normal:  'border-zinc-700',
  warning: 'border-amber-400',
  urgent:  'border-red-500',
}

const URGENCY_BADGE: Record<UrgencyLevel, { style: string; label: string }> = {
  normal:  { style: '',                              label: '' },
  warning: { style: 'bg-amber-500/20 text-amber-300', label: 'もうすぐ' },
  urgent:  { style: 'bg-red-500/20 text-red-300',     label: '急いで！' },
}

interface Props {
  order:      TakeoutOrder
  settings:   TakeoutSettings
  onAdvance:  () => Promise<void>
  onCancel:   () => Promise<void>
  onItemDone: (itemId: string, done: boolean) => Promise<void>
}

function pickupDisplay(pickupTime: string | null): { label: string; color: string } | null {
  if (!pickupTime) return null
  const diffMin = Math.round((new Date(pickupTime).getTime() - Date.now()) / 60000)
  const timeStr = new Date(pickupTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  if (diffMin > 30)  return { label: `${timeStr} 受取`,                      color: 'text-zinc-500' }
  if (diffMin > 10)  return { label: `${timeStr}（あと ${diffMin} 分）`,      color: 'text-zinc-300' }
  if (diffMin > 0)   return { label: `⚠ あと ${diffMin} 分`,                 color: 'text-amber-400' }
  if (diffMin === 0) return { label: '受取時刻！',                             color: 'text-red-400' }
  return              { label: `受取 ${Math.abs(diffMin)} 分超過`,            color: 'text-red-400' }
}

export default function OrderCard({ order, settings, onAdvance, onCancel, onItemDone }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [advancing,     setAdvancing]     = useState(false)

  const targetMinutes = settings.target_minutes ?? 15
  const urgency       = order.status === 'pending'
    ? 'normal'
    : getUrgencyLevel(order.created_at, order.status, targetMinutes)
  const badge      = URGENCY_BADGE[urgency]
  const nextStatus = getNextStatus(order.status, settings)
  const actionLabel = getActionLabel(order.status, settings)
  const items       = order.items ?? []
  const allDone     = order.status === 'preparing' && items.length > 0 && items.every(i => i.is_done)
  const pickup      = pickupDisplay(order.pickup_time)

  const handleAdvance = async () => {
    setAdvancing(true)
    try { await onAdvance() } finally { setAdvancing(false) }
  }

  const handleCancel = async () => {
    setConfirmCancel(false)
    await onCancel()
  }

  return (
    <div className={`rounded-xl border-2 ${URGENCY_BORDER[urgency]} bg-zinc-900 flex flex-col gap-3 p-4 relative`}>
      {/* 緊急インジケーター */}
      {urgency === 'urgent' && (
        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
      )}

      {/* ヘッダー：番号・名前・経過時間 */}
      <div className="flex items-start justify-between gap-2 pr-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-black leading-none">{order.order_number}</span>
          {order.customer_name && (
            <span className="text-base text-zinc-300">{order.customer_name}様</span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {badge.label && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge.style}`}>
              {badge.label}
            </span>
          )}
          {order.status !== 'pending' && (
            <span className="text-xs text-zinc-500">⏱ <ElapsedTimer createdAt={order.created_at} /></span>
          )}
        </div>
      </div>

      {/* 受取時間 */}
      {pickup && (
        <div className={`text-sm font-medium ${pickup.color}`}>🕐 {pickup.label}</div>
      )}

      {/* 注文経路バッジ */}
      {order.order_source && order.order_source !== 'line' && (
        <div className="text-xs text-zinc-600">
          {order.order_source === 'phone' ? '📞 電話注文' : '🚶 店頭注文'}
        </div>
      )}

      {/* アイテム一覧 */}
      <div className="flex flex-col gap-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2.5">
            {order.status === 'preparing' && (
              <button
                onClick={() => onItemDone(item.id, !item.is_done)}
                className={`
                  w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors
                  ${item.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'}
                `}
              >
                {item.is_done && <span className="text-white text-xs font-bold">✓</span>}
              </button>
            )}
            <span className={`flex-1 text-sm ${item.is_done ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>
              {item.name}
            </span>
            <span className="text-lg font-bold text-zinc-300 shrink-0">×{item.quantity}</span>
          </div>
        ))}
      </div>

      {/* 備考 */}
      {order.notes && (
        <div className="text-sm text-amber-300 bg-amber-950/30 rounded-lg px-3 py-2">
          📝 {order.notes}
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2">
        {nextStatus && (
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className={`
              flex-1 py-3.5 rounded-lg font-bold text-base transition-all active:scale-95 select-none
              ${allDone
                ? 'bg-emerald-500 text-white'
                : 'bg-zinc-100 text-zinc-950'
              }
              ${advancing ? 'opacity-50' : ''}
            `}
          >
            {advancing ? '...' : actionLabel}
          </button>
        )}

        {!confirmCancel ? (
          <button
            onClick={() => setConfirmCancel(true)}
            className="shrink-0 px-3.5 py-3.5 rounded-lg bg-zinc-800 text-red-400 text-sm active:scale-95"
            title="キャンセル"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="shrink-0 px-3 py-3.5 rounded-lg bg-red-600 text-white font-bold text-sm active:scale-95"
          >
            キャンセル確定
          </button>
        )}
      </div>

      {/* キャンセル確認中：タップで解除 */}
      {confirmCancel && (
        <button
          onClick={() => setConfirmCancel(false)}
          className="text-xs text-zinc-600 text-center"
        >
          やめる
        </button>
      )}
    </div>
  )
}
