'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { triggerSound } from '@/lib/kitchen-sounds'
import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import {
  getNextStatus,
  getUrgencyLevel,
  shouldNotify,
} from '@/types/takeout'
import ActiveOrderCard from './_components/ActiveOrderCard'
import ComboDisplay    from './_components/ComboDisplay'
import QueueItem       from './_components/QueueItem'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_COLORS = [
  'text-red-400',
  'text-zinc-300',
  'text-zinc-300',
  'text-zinc-300',
  'text-zinc-300',
  'text-zinc-300',
  'text-blue-400',
]

function DateDisplay() {
  const now = new Date()
  const m   = now.getMonth() + 1
  const d   = now.getDate()
  const w   = now.getDay()
  return (
    <span className="text-sm md:text-base text-zinc-400">
      {m}/{d}（<span className={WEEKDAY_COLORS[w]}>{WEEKDAYS[w]}</span>）
    </span>
  )
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-right">
      <div className="text-xs text-zinc-600">現在時刻</div>
      <div className="text-2xl md:text-3xl font-bold">{time}</div>
    </div>
  )
}

export default function KitchenPage({ params }: { params: { storeId: string } }) {
  const { storeId } = params

  const [orders,     setOrders]     = useState<TakeoutOrder[]>([])
  const [settings,   setSettings]   = useState<TakeoutSettings>({})
  const [storeName,  setStoreName]  = useState('')
  const [combo,      setCombo]      = useState(0)
  const [maxCombo,   setMaxCombo]   = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [loading,    setLoading]    = useState(true)

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const targetMinutes = settings.target_minutes        ?? 15
  const comboTimeout  = settings.combo_timeout_seconds ?? 300

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('takeout_orders')
      .select('*, items:takeout_order_items(*)')
      .eq('store_id', storeId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
    if (data) setOrders(data as TakeoutOrder[])
  }, [storeId])

  const loadTodayCount = useCallback(async () => {
    const jstOffset = 9 * 60 * 60 * 1000
    const now       = new Date(Date.now() + jstOffset)
    const todayJst  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - jstOffset)
    const { count } = await supabase
      .from('takeout_orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('status', 'completed')
      .gte('created_at', todayJst.toISOString())
    setTodayCount(count ?? 0)
  }, [storeId])

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('stores')
      .select('name, takeout_settings')
      .eq('id', storeId)
      .single()
    if (data?.name)             setStoreName(data.name)
    if (data?.takeout_settings) setSettings(data.takeout_settings as TakeoutSettings)
  }, [storeId])

  useEffect(() => {
    Promise.all([loadOrders(), loadTodayCount(), loadSettings()]).finally(() =>
      setLoading(false)
    )
    const channel = supabase
      .channel(`kitchen-${storeId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'takeout_orders',
        filter: `store_id=eq.${storeId}`,
      }, (payload) => {
        loadOrders()
        loadTodayCount()
        if (payload.eventType === 'INSERT') triggerSound('pending')
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [storeId, loadOrders, loadTodayCount, loadSettings])

  const advanceStatus = async (order: TakeoutOrder) => {
    const nextStatus = getNextStatus(order.status, settings)
    if (!nextStatus) return

    await supabase
      .from('takeout_orders')
      .update({ status: nextStatus })
      .eq('id', order.id)

    triggerSound(nextStatus)

    if (nextStatus === 'completed') {
      const urgency = getUrgencyLevel(order.created_at, 'preparing', targetMinutes)
      if (urgency !== 'urgent') {
        setCombo(prev => {
          const next = prev + 1
          setMaxCombo(max => Math.max(max, next))
          return next
        })
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
        comboTimerRef.current = setTimeout(() => setCombo(0), comboTimeout * 1000)
      } else {
        setCombo(0)
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      }
    }

    if (shouldNotify(nextStatus, settings) && order.line_user_id) {
      // TODO: /api/notify-takeout を呼び出す
    }
  }

  const activeOrder =
    orders.find(o => o.status === 'preparing') ??
    orders.find(o => o.status === 'pending')   ??
    orders.find(o => o.status === 'ready')     ??
    null

  const queueOrders = orders.filter(o => o.id !== activeOrder?.id)

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 text-lg">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">

      {/* ヘッダー */}
      <div className="bg-zinc-900 border-b border-zinc-800 shrink-0">
        {/* 店舗名・日付 */}
        <div className="flex items-center justify-between px-4 md:px-6 py-2 border-b border-zinc-800/60">
          <span className="text-base md:text-lg font-bold text-white">{storeName}</span>
          <DateDisplay />
        </div>
        {/* コンボ・件数・時刻 */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <ComboDisplay combo={combo} maxCombo={maxCombo} />
          <div className="text-center">
            <div className="text-xs text-zinc-500">本日完了</div>
            <div className="text-2xl md:text-3xl font-bold">
              {todayCount}
              <span className="text-sm text-zinc-400 ml-1">件</span>
            </div>
          </div>
          <Clock />
        </div>
      </div>

      {/* メインエリア
          モバイル: 縦積み
          タブレット(md+): 左=アクティブ注文 / 右=キュー の2カラム
      */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* 左カラム：アクティブ注文 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeOrder ? (
            <ActiveOrderCard
              order={activeOrder}
              settings={settings}
              onAdvance={() => advanceStatus(activeOrder)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-zinc-700">
                <div className="text-7xl md:text-8xl mb-4">✓</div>
                <div className="text-xl md:text-2xl font-medium">注文待ち</div>
                <div className="text-sm md:text-base mt-1 text-zinc-600">
                  新しい注文が入ると自動で表示されます
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右カラム：キュー（タブレットのみ常時表示） */}
        <div className={`
          md:w-80 lg:w-96 md:border-l md:border-zinc-800
          md:flex md:flex-col md:overflow-hidden
          ${queueOrders.length === 0 ? 'hidden md:flex' : ''}
        `}>
          {/* キューヘッダー */}
          <div className="px-4 md:px-5 py-3 border-b border-zinc-800 shrink-0">
            <span className="text-xs text-zinc-500 font-medium">
              次の注文
              {queueOrders.length > 0 && (
                <span className="ml-2 bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">
                  {queueOrders.length}
                </span>
              )}
            </span>
          </div>

          {/* キューリスト */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-2">
            {queueOrders.length > 0 ? (
              queueOrders.map(order => (
                <QueueItem
                  key={order.id}
                  order={order}
                  settings={settings}
                  onAdvance={() => advanceStatus(order)}
                />
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm">
                待機中の注文なし
              </div>
            )}
          </div>
        </div>

        {/* モバイル時のキュー（下部に表示） */}
        {queueOrders.length > 0 && (
          <div className="md:hidden shrink-0 border-t border-zinc-800 max-h-48 overflow-y-auto">
            <div className="px-4 py-2 text-xs text-zinc-500">
              次の注文（{queueOrders.length}件）
            </div>
            <div className="px-4 pb-3 flex flex-col gap-2">
              {queueOrders.map(order => (
                <QueueItem
                  key={order.id}
                  order={order}
                  settings={settings}
                  onAdvance={() => advanceStatus(order)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
