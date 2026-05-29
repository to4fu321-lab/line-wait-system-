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
  'text-red-400',    // 日
  'text-zinc-300',   // 月
  'text-zinc-300',   // 火
  'text-zinc-300',   // 水
  'text-zinc-300',   // 木
  'text-zinc-300',   // 金
  'text-blue-400',   // 土
]

function DateDisplay() {
  const now = new Date()
  const m   = now.getMonth() + 1
  const d   = now.getDate()
  const w   = now.getDay()
  return (
    <span className="text-sm text-zinc-400">
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
      <div className="text-2xl font-bold">{time}</div>
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

  const targetMinutes  = settings.target_minutes        ?? 15
  const comboTimeout   = settings.combo_timeout_seconds ?? 300

  // アクティブな注文を取得（pending・preparing・ready）
  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('takeout_orders')
      .select('*, items:takeout_order_items(*)')
      .eq('store_id', storeId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
    if (data) setOrders(data as TakeoutOrder[])
  }, [storeId])

  // 本日の完了件数
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

  // 店舗情報を取得
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

    // Realtimeで注文変更を監視
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
        // 新規注文受付音
        if (payload.eventType === 'INSERT') triggerSound('pending')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId, loadOrders, loadTodayCount, loadSettings])

  // ステータスを次に進める
  const advanceStatus = async (order: TakeoutOrder) => {
    const nextStatus = getNextStatus(order.status, settings)
    if (!nextStatus) return

    await supabase
      .from('takeout_orders')
      .update({ status: nextStatus })
      .eq('id', order.id)

    triggerSound(nextStatus)

    // コンボ処理（お渡し完了時）
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

    // LINE通知（将来実装：shouldNotify が true のときAPIを叩く）
    if (shouldNotify(nextStatus, settings) && order.line_user_id) {
      // TODO: /api/notify-takeout を呼び出す
    }
  }

  // メイン表示対象：preparing優先、なければpending、なければready
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
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ヘッダー */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        {/* 店舗名・日付バー */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
          <span className="text-base font-bold text-white">{storeName}</span>
          <DateDisplay />
        </div>
        {/* コンボ・件数・時刻バー */}
        <div className="flex items-center justify-between px-4 py-3">
          <ComboDisplay combo={combo} maxCombo={maxCombo} />
          <div className="text-center">
            <div className="text-xs text-zinc-500">本日完了</div>
            <div className="text-2xl font-bold">
              {todayCount}
              <span className="text-sm text-zinc-400 ml-1">件</span>
            </div>
          </div>
          <Clock />
        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">

        {/* アクティブオーダー */}
        {activeOrder ? (
          <ActiveOrderCard
            order={activeOrder}
            settings={settings}
            onAdvance={() => advanceStatus(activeOrder)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center text-zinc-700">
              <div className="text-7xl mb-4">✓</div>
              <div className="text-xl font-medium">注文待ち</div>
              <div className="text-sm mt-1">新しい注文が入ると自動で表示されます</div>
            </div>
          </div>
        )}

        {/* キュー（次の注文一覧） */}
        {queueOrders.length > 0 && (
          <div>
            <div className="text-xs text-zinc-500 mb-2 px-1">
              次の注文（{queueOrders.length}件）
            </div>
            <div className="flex flex-col gap-2">
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
