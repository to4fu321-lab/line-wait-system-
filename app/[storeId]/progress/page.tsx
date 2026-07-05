'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchQueueState, fetchTakeoutState } from '@/lib/customerApi'

// ──────────────────────────────────────────────
// EC風 進捗トラッキングページ
//   /[storeId]/progress?order=<takeoutOrderId>   … テイクアウト注文
//   /[storeId]/progress?queue=<queueId>          … 整理券（呼び出し）
// LINE通知の「進捗を見る」ボタンから開く。ポーリングで自動更新。
// ──────────────────────────────────────────────

type StepState = 'done' | 'current' | 'todo'

interface StepDef {
  key: string
  label: string
  emoji: string
}

// テイクアウト注文のステップ定義
const TAKEOUT_STEPS: StepDef[] = [
  { key: 'pending',   label: '受付完了', emoji: '📋' },
  { key: 'preparing', label: '調理中',   emoji: '🍳' },
  { key: 'ready',     label: '完成',     emoji: '✅' },
  { key: 'completed', label: 'お渡し済', emoji: '🙌' },
]

// 整理券のステップ定義
const QUEUE_STEPS: StepDef[] = [
  { key: 'waiting',   label: '受付',     emoji: '📝' },
  { key: 'calling',   label: 'お呼出し', emoji: '🔔' },
  { key: 'completed', label: '完了',     emoji: '🙌' },
]

const STATUS_MESSAGE: Record<string, string> = {
  pending:   'ご注文を受け付けました。まもなく調理を開始します。',
  preparing: 'ただいま調理中です。もうしばらくお待ちください。',
  ready:     'ご準備ができました！お受け取りください。',
  completed: 'お受け取りありがとうございました。',
  cancelled: 'このご注文はキャンセルされました。',
  waiting:   '順番をお待ちください。お近くでお待ちいただけます。',
  calling:   'お呼び出し中です！カウンターへお越しください。',
}

function ProgressContent() {
  const { storeId } = useParams<{ storeId: string }>()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order')
  const queueId = searchParams.get('queue')

  const [storeName, setStoreName]   = useState('')
  const [status, setStatus]         = useState<string>('')
  const [orderNumber, setOrderNum]  = useState<string>('')
  const [customerName, setCustomer] = useState<string>('')
  const [items, setItems]           = useState<{ name: string; quantity: number }[]>([])
  const [position, setPosition]     = useState<number | null>(null) // 整理券: あと何組
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)

  const isTakeout = !!orderId
  const steps = isTakeout ? TAKEOUT_STEPS : QUEUE_STEPS

  // 初期ロード + ポーリング更新
  // (queues / takeout_orders は RLS でクライアント直読み不可のため API 経由)
  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    try {
      if (initial) {
        const { data: store } = await supabase.from('stores').select('name').eq('id', storeId).single()
        setStoreName((store as { name?: string } | null)?.name ?? '')
      }

      if (orderId) {
        const { order } = await fetchTakeoutState(storeId, orderId)
        if (!order) { setNotFound(true); return }
        setStatus(order.status)
        setOrderNum(order.order_number ?? '')
        setCustomer(order.customer_name ?? '')
        setItems((order.items ?? []).map((i: any) => ({ name: i.name, quantity: i.quantity })))
      } else if (queueId) {
        const { ticket, waitingAhead } = await fetchQueueState(storeId, queueId)
        if (!ticket) { setNotFound(true); return }
        setStatus(ticket.status)
        setOrderNum(String(ticket.ticket_number).padStart(3, '0'))
        setCustomer(ticket.customer_name ?? '')
        setPosition(ticket.status === 'waiting' ? (waitingAhead ?? 0) : null)
      } else {
        setNotFound(true)
      }
    } catch {
      if (initial) setNotFound(true)
    } finally {
      if (initial) setLoading(false)
    }
  }, [storeId, orderId, queueId])

  // ポーリング更新(Realtime は anon から購読不可)
  useEffect(() => {
    load(true)
    if (!(orderId || queueId)) return
    const pollId = setInterval(() => load(false), 10000)
    return () => clearInterval(pollId)
  }, [load, orderId, queueId])

  const currentIdx = steps.findIndex(s => s.key === status)
  const cancelled = status === 'cancelled'

  const stepState = (i: number): StepState => {
    if (currentIdx < 0) return 'todo'
    if (i < currentIdx) return 'done'
    if (i === currentIdx) return 'current'
    return 'todo'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center text-zinc-500">
          <div className="text-5xl mb-3">🔍</div>
          <p className="font-bold">該当する情報が見つかりません</p>
          <p className="text-sm mt-1">URLをご確認ください。</p>
        </div>
      </div>
    )
  }

  const accent = cancelled ? '#9CA3AF' : isTakeout ? '#1E88E5' : '#E53935'

  return (
    <div className="min-h-screen bg-zinc-50 px-5 py-8">
      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          {storeName && <p className="text-sm text-zinc-400 font-bold">{storeName}</p>}
          <p className="text-xs text-zinc-400 mt-3">{isTakeout ? '注文番号' : '整理番号'}</p>
          <p className="text-6xl font-black tracking-tight" style={{ color: accent }}>{orderNumber}</p>
          {customerName && <p className="text-zinc-700 font-bold mt-1">{customerName} 様</p>}
        </div>

        {/* 現在の状況メッセージ */}
        <div
          className="rounded-2xl p-4 text-center font-bold mb-6"
          style={{ backgroundColor: cancelled ? '#F3F4F6' : `${accent}15`, color: accent }}
        >
          {STATUS_MESSAGE[status] ?? '状況を確認しています…'}
          {!isTakeout && status === 'waiting' && position !== null && (
            <p className="text-sm font-normal text-zinc-500 mt-1">
              あなたの前に <span className="font-bold" style={{ color: accent }}>{position}</span> 組
            </p>
          )}
        </div>

        {/* 横型ステップバー */}
        {!cancelled && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
            <div className="flex items-start justify-between relative">
              {steps.map((s, i) => {
                const st = stepState(i)
                const on = st === 'done' || st === 'current'
                return (
                  <div key={s.key} className="flex-1 flex flex-col items-center relative z-10">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-lg transition-colors"
                      style={{
                        backgroundColor: on ? accent : '#E5E7EB',
                        boxShadow: st === 'current' ? `0 0 0 4px ${accent}30` : 'none',
                      }}
                    >
                      {st === 'done' ? <span className="text-white font-bold">✓</span> : <span>{s.emoji}</span>}
                    </div>
                    <p
                      className="text-xs mt-2 text-center font-bold"
                      style={{ color: on ? accent : '#9CA3AF' }}
                    >
                      {s.label}
                    </p>
                  </div>
                )
              })}
              {/* 接続ライン */}
              <div className="absolute top-[22px] left-[12%] right-[12%] h-0.5 bg-zinc-200 z-0" />
            </div>
          </div>
        )}

        {/* 注文明細 */}
        {isTakeout && items.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-zinc-400 font-bold mb-3">ご注文内容</p>
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between text-sm text-zinc-700">
                  <span>{it.name}</span>
                  <span className="text-zinc-400">×{it.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-zinc-300 mt-8">この画面は自動で更新されます</p>
      </div>
    </div>
  )
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ProgressContent />
    </Suspense>
  )
}
