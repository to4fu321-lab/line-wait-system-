'use client'

import { useEffect, useRef, useState } from 'react'
import type { TakeoutOrder, TakeoutSettings, UrgencyLevel } from '@/types/takeout'
import { getActionLabel, getNextStatus, getUrgencyLevel } from '@/types/takeout'

const URGENCY: Record<UrgencyLevel, { bar: string; border: string; btn: string; timer: string }> = {
  normal:  { bar: 'bg-amber-600',  border: 'border-zinc-700',  btn: 'bg-amber-600 text-white',    timer: 'text-zinc-400'  },
  warning: { bar: 'bg-amber-400',  border: 'border-amber-400', btn: 'bg-amber-400 text-zinc-950', timer: 'text-amber-300' },
  urgent:  { bar: 'bg-red-500',    border: 'border-red-500',   btn: 'bg-red-500 text-white',      timer: 'text-red-400'   },
}

function useElapsed(createdAt: string) {
  const [text, setText] = useState('')
  useEffect(() => {
    const tick = () => {
      const s = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
      setText(`${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [createdAt])
  return text
}

function guessIcon(name: string): string {
  if (/ビール|生ビ/.test(name))               return '🍺'
  if (/チューハイ|ハイボール|酎ハイ/.test(name)) return '🥂'
  if (/日本酒|梅酒/.test(name))               return '🍶'
  if (/コーラ|ジュース|ソフト/.test(name))     return '🥤'
  if (/お茶|ウーロン/.test(name))             return '🍵'
  if (/焼き鳥|やきとり/.test(name))           return '🍢'
  if (/から揚げ|唐揚げ|竜田|手羽/.test(name))  return '🍗'
  if (/弁当/.test(name))                      return '🍱'
  if (/丼/.test(name))                        return '🍚'
  if (/ポテト|フライ/.test(name))             return '🍟'
  if (/おにぎり/.test(name))                 return '🍙'
  if (/枝豆/.test(name))                      return '🫛'
  if (/キムチ/.test(name))                   return '🌶'
  if (/コロッケ/.test(name))                 return '🥔'
  if (/もつ煮/.test(name))                   return '🍲'
  if (/サラダ/.test(name))                   return '🥗'
  if (/玉子|たまご/.test(name))              return '🥚'
  if (/焼きそば/.test(name))                 return '🍜'
  return '🍽'
}

interface Props {
  order:     TakeoutOrder
  settings:  TakeoutSettings
  onAdvance: () => Promise<void>
  onCancel:  () => Promise<void>
}

const SWIPE_OPEN      = -100
const SWIPE_THRESHOLD = 50

export default function OrderCard({ order, settings, onAdvance, onCancel }: Props) {
  const [advancing,       setAdvancing]       = useState(false)
  const [swipeX,          setSwipeX]          = useState(0)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const touchStartX    = useRef(0)
  const touchStartY    = useRef(0)
  const isHorizSwipe   = useRef(false)

  const targetMinutes = settings.target_minutes ?? 15
  const urgency       = getUrgencyLevel(order.created_at, order.status, targetMinutes)
  const nextStatus    = getNextStatus(order.status, settings)
  const actionLabel   = getActionLabel(order.status, settings)
  const items         = order.items ?? []
  const elapsed       = useElapsed(order.created_at)
  const isReady       = order.status === 'ready'
  const isPending     = order.status === 'pending'

  const barColor    = isReady ? 'bg-emerald-500'     : isPending ? 'bg-zinc-700'     : URGENCY[urgency].bar
  const borderColor = isReady ? 'border-emerald-500' : isPending ? 'border-zinc-800' : URGENCY[urgency].border
  const btnColor    = isReady ? 'bg-emerald-500 text-white' : isPending ? 'bg-zinc-700 text-zinc-200' : URGENCY[urgency].btn
  const timerColor  = isReady ? 'text-emerald-400'   : isPending ? 'text-zinc-600'   : URGENCY[urgency].timer

  const handleAdvance = async () => {
    setAdvancing(true); try { await onAdvance() } finally { setAdvancing(false) }
  }

  // ── スワイプジェスチャー ─────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current    = e.touches[0].clientX
    touchStartY.current    = e.touches[0].clientY
    isHorizSwipe.current   = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!isHorizSwipe.current) {
      if (Math.abs(dx) < Math.abs(dy)) return
      isHorizSwipe.current = true
    }
    const base    = swipeX === SWIPE_OPEN ? SWIPE_OPEN : 0
    const clamped = Math.max(SWIPE_OPEN - 10, Math.min(0, dx + base))
    setSwipeX(clamped)
  }

  const onTouchEnd = () => {
    if (!isHorizSwipe.current) return
    setSwipeX(swipeX < -SWIPE_THRESHOLD ? SWIPE_OPEN : 0)
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">

        {/* 裏のキャンセルボタン */}
        <div className="absolute inset-y-0 right-0 w-[100px] flex items-stretch">
          <button
            onClick={() => { setSwipeX(0); setShowCancelModal(true) }}
            className="w-full bg-red-600 text-white font-black flex flex-col items-center justify-center gap-1 active:bg-red-700"
          >
            <span className="text-2xl">🗑</span>
            <span className="text-xs">キャンセル</span>
          </button>
        </div>

        {/* カード本体 */}
        <div
          className={`flex items-stretch border ${borderColor} bg-zinc-900/80 rounded-xl`}
          style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 || swipeX === SWIPE_OPEN ? 'transform 0.2s ease' : 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className={`w-1 shrink-0 rounded-l-xl ${barColor}`} />

          <div className="flex-1 px-3 py-2.5 min-w-0">
            {/* 注文番号・名前 */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-mono font-bold text-zinc-500">{order.order_number}</span>
              {order.customer_name && (
                <span className="text-xs text-zinc-400">{order.customer_name}様</span>
              )}
              {order.order_source && order.order_source !== 'line' && (
                <span className="text-xs text-zinc-600">{order.order_source === 'phone' ? '📞' : '🚶'}</span>
              )}
              <div className="flex-1" />
              <span className={`text-sm font-mono font-bold tabular-nums ${timerColor}`}>{elapsed}</span>
            </div>

            {/* 品目リスト: アイコン＋名前＋大きな数量 */}
            <div className="flex flex-col gap-2">
              {items.length > 0 ? items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-2xl w-8 text-center leading-none shrink-0">{guessIcon(item.name)}</span>
                  <span className={`flex-1 font-bold text-sm leading-tight ${isReady ? 'text-zinc-500 line-through' : 'text-white'}`}>
                    {item.name}
                  </span>
                  <span className={`font-black text-3xl tabular-nums leading-none shrink-0 ${isReady ? 'text-zinc-600' : 'text-white'}`}>
                    {item.quantity}
                  </span>
                </div>
              )) : <span className="text-zinc-600 text-sm">（品目なし）</span>}
            </div>

            {order.notes && (
              <div className="text-xs text-amber-300 bg-amber-950/40 rounded px-2 py-1 mt-2">
                📝 {order.notes}
              </div>
            )}
          </div>

          {nextStatus ? (
            <button onClick={handleAdvance} disabled={advancing}
              className={`shrink-0 w-16 md:w-20 flex flex-col items-center justify-center gap-0.5
                font-bold text-xs active:opacity-70 transition-opacity select-none rounded-r-xl
                ${btnColor} ${advancing ? 'opacity-50' : ''}`}>
              <span className="text-xl">
                {isReady ? '🤲' : isPending ? '▶' : urgency === 'urgent' ? '⚡' : '✓'}
              </span>
              <span className="leading-tight text-center px-1">{actionLabel}</span>
            </button>
          ) : (
            <div className="w-16 md:w-20 shrink-0" />
          )}
        </div>
      </div>

      {/* ── キャンセル確認モーダル ── */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-t-3xl p-6 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🗑</div>
              <h2 className="text-xl font-black text-white leading-snug">
                {order.order_number} をキャンセルしますか？
              </h2>
              {order.customer_name && (
                <p className="text-sm text-zinc-400 mt-1">{order.customer_name}様の注文</p>
              )}
              <div className="mt-4 flex flex-col gap-1.5 bg-zinc-800 rounded-xl p-3">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                    <span>{guessIcon(item.name)}</span>
                    <span className="flex-1 text-left">{item.name}</span>
                    <span className="font-bold">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => { setShowCancelModal(false); await onCancel() }}
                className="w-full py-4 rounded-2xl bg-red-600 text-white font-black text-lg active:bg-red-700 transition-colors"
              >
                キャンセルする
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-full py-3 rounded-2xl bg-zinc-800 text-zinc-300 font-bold text-base active:bg-zinc-700 transition-colors"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
