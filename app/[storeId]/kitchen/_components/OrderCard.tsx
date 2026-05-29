'use client'

import { useState } from 'react'
import type { TakeoutOrder, TakeoutSettings, UrgencyLevel } from '@/types/takeout'
import { getActionLabel, getNextStatus, getUrgencyLevel } from '@/types/takeout'
import ElapsedTimer from './ElapsedTimer'

// ステータスバー・ボーダー・ボタンのスタイル定義
const STATUS_STYLES = {
  ready: {
    bar:    'bg-emerald-500',
    border: 'border-emerald-500',
    btn:    'bg-emerald-500 text-white',
    icon:   '🤲',
  },
  pending: {
    bar:    'bg-zinc-700',
    border: 'border-zinc-700',
    btn:    'bg-zinc-700 text-zinc-200',
    icon:   '▶',
  },
} as const

const URGENCY_STYLES: Record<UrgencyLevel, { bar: string; border: string; btn: string; badge: string }> = {
  normal:  { bar: 'bg-amber-600',   border: 'border-zinc-600',   btn: 'bg-amber-600 text-white',   badge: '' },
  warning: { bar: 'bg-amber-400',   border: 'border-amber-400',  btn: 'bg-amber-400 text-zinc-950', badge: 'もうすぐ' },
  urgent:  { bar: 'bg-red-500',     border: 'border-red-500',    btn: 'bg-red-500 text-white',      badge: '急いで！' },
}

function pickupLabel(pickupTime: string | null): { text: string; color: string } | null {
  if (!pickupTime) return null
  const diff = Math.round((new Date(pickupTime).getTime() - Date.now()) / 60000)
  const t    = new Date(pickupTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  if (diff > 30) return { text: `${t} 受取`,             color: 'text-zinc-600' }
  if (diff > 10) return { text: `${t}（あと${diff}分）`, color: 'text-zinc-400' }
  if (diff > 0)  return { text: `あと ${diff} 分`,       color: 'text-amber-400' }
  return           { text: `受取超過 ${Math.abs(diff)} 分`, color: 'text-red-400' }
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
  const itemSummary   = items.map(i => `${i.name}×${i.quantity}`).join('・')
  const pickup        = pickupLabel(order.pickup_time)

  const style =
    order.status === 'ready'   ? STATUS_STYLES.ready   :
    order.status === 'pending' ? STATUS_STYLES.pending  :
    URGENCY_STYLES[urgency]

  const urgencyBadge = 'badge' in style && style.badge
    ? <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
        urgency === 'urgent' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
      }`}>{style.badge}</span>
    : null

  const handleAdvance = async () => {
    setAdvancing(true)
    try { await onAdvance() } finally { setAdvancing(false) }
  }

  return (
    <div className={`flex items-stretch rounded-xl overflow-hidden border-2 ${style.border} bg-zinc-900`}>
      {/* 左：ステータスカラーバー */}
      <div className={`w-1.5 shrink-0 ${style.bar}`} />

      {/* 中：注文情報 */}
      <div className="flex-1 px-3 py-3 min-w-0">
        {/* 番号・名前・経過・緊急バッジ */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-black leading-none">{order.order_number}</span>
          {order.customer_name && (
            <span className="text-sm text-zinc-400">{order.customer_name}様</span>
          )}
          <div className="flex-1" />
          {order.status !== 'pending' && (
            <span className="text-xs text-zinc-600">⏱ <ElapsedTimer createdAt={order.created_at} /></span>
          )}
          {urgencyBadge}
        </div>

        {/* 品目サマリー */}
        <div className="text-sm text-zinc-400 mt-1 leading-snug line-clamp-2">
          {itemSummary || '（品目なし）'}
        </div>

        {/* 備考 */}
        {order.notes && (
          <div className="text-xs text-amber-400 mt-1">📝 {order.notes}</div>
        )}

        {/* 受取時間 */}
        {pickup && (
          <div className={`text-xs mt-1 ${pickup.color}`}>🕐 {pickup.text}</div>
        )}

        {/* 注文経路 */}
        {order.order_source && order.order_source !== 'line' && (
          <div className="text-xs text-zinc-700 mt-1">
            {order.order_source === 'phone' ? '📞 電話' : '🚶 店頭'}
          </div>
        )}

        {/* キャンセルボタン（小さく、誤タップしにくい位置） */}
        <div className="mt-2">
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="text-xs text-zinc-700 active:text-zinc-500"
            >
              キャンセル
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => { setConfirmCancel(false); await onCancel() }}
                className="text-xs text-red-400 font-semibold bg-red-950/40 px-2 py-1 rounded"
              >
                キャンセル確定
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="text-xs text-zinc-600"
              >
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
            ${style.btn} ${advancing ? 'opacity-50' : ''}
          `}
        >
          {'icon' in style
            ? <span className="text-2xl">{style.icon}</span>
            : <span className="text-lg">{urgency === 'urgent' ? '⚡' : '✓'}</span>
          }
          <span className="text-center leading-tight px-1">{actionLabel}</span>
        </button>
      ) : (
        <div className="w-20 md:w-24 shrink-0" />
      )}
    </div>
  )
}
