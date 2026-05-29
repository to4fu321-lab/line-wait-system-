'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { triggerSound } from '@/lib/kitchen-sounds'
import type { TakeoutOrder, TakeoutOrderStatus, TakeoutSettings } from '@/types/takeout'
import { getNextStatus, getUrgencyLevel, shouldNotify } from '@/types/takeout'
import ComboDisplay      from './_components/ComboDisplay'
import KanbanColumn      from './_components/KanbanColumn'
import ManualOrderModal  from './_components/ManualOrderModal'
import BatchView         from './_components/BatchView'

const WEEKDAYS       = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_COLORS = ['text-red-400', 'text-zinc-300', 'text-zinc-300', 'text-zinc-300', 'text-zinc-300', 'text-zinc-300', 'text-blue-400']

function DateDisplay() {
  const now = new Date()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const w = now.getDay()
  return (
    <span className="text-sm text-zinc-400">
      {m}/{d}（<span className={WEEKDAY_COLORS[w]}>{WEEKDAYS[w]}</span>）
    </span>
  )
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))
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

type Tab = 'pending' | 'preparing' | 'ready'

const COLUMNS: { tab: Tab; title: string; headerClass: string; emptyMessage: string }[] = [
  { tab: 'pending',   title: '受付中',      headerClass: 'bg-zinc-800/40',    emptyMessage: '受付待ちの注文なし' },
  { tab: 'preparing', title: '調理中',      headerClass: 'bg-amber-950/50',   emptyMessage: '調理中の注文なし' },
  { tab: 'ready',     title: '完成・受渡待ち', headerClass: 'bg-emerald-950/50', emptyMessage: '受渡し待ちの注文なし' },
]

export default function KitchenPage({ params }: { params: { storeId: string } }) {
  const { storeId } = params

  const [orders,     setOrders]     = useState<TakeoutOrder[]>([])
  const [settings,   setSettings]   = useState<TakeoutSettings>({})
  const [storeName,  setStoreName]  = useState('')
  const [combo,      setCombo]      = useState(0)
  const [maxCombo,   setMaxCombo]   = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<Tab>('preparing')
  const [showManual, setShowManual] = useState(false)
  const [showBatch,  setShowBatch]  = useState(false)

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
    Promise.all([loadOrders(), loadTodayCount(), loadSettings()]).finally(() => setLoading(false))
    const channel = supabase
      .channel(`kitchen-${storeId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'takeout_orders',
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

    const { error } = await supabase
      .from('takeout_orders')
      .update({ status: nextStatus })
      .eq('id', order.id)
    if (error) return

    await loadOrders()
    if (nextStatus === 'completed') await loadTodayCount()
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
      fetch('/api/notify-takeout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId: order.id, status: nextStatus }),
      }).catch(console.error)
    }
  }

  const cancelOrder = async (order: TakeoutOrder) => {
    const { error } = await supabase
      .from('takeout_orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
    if (!error) await loadOrders()
  }

  const markItemDone = async (_orderId: string, itemId: string, done: boolean) => {
    await supabase
      .from('takeout_order_items')
      .update({ is_done: done })
      .eq('id', itemId)
    await loadOrders()
  }

  const pendingOrders   = orders.filter(o => o.status === 'pending')
  const preparingOrders = orders.filter(o => o.status === 'preparing')
  const readyOrders     = orders.filter(o => o.status === 'ready')

  const countByTab: Record<Tab, number> = {
    pending:   pendingOrders.length,
    preparing: preparingOrders.length,
    ready:     readyOrders.length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 text-lg">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">

      {/* ─── ヘッダー ─── */}
      <div className="bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-2 border-b border-zinc-800/60">
          <span className="text-base font-bold">{storeName}</span>
          <DateDisplay />
        </div>
        <div className="flex items-center justify-between px-4 md:px-6 py-2.5">
          <ComboDisplay combo={combo} maxCombo={maxCombo} />
          <div className="text-center">
            <div className="text-xs text-zinc-500">本日完了</div>
            <div className="text-2xl font-bold">
              {todayCount}<span className="text-sm text-zinc-400 ml-1">件</span>
            </div>
          </div>
          <Clock />
        </div>
      </div>

      {/* ─── アクションバー ─── */}
      <div className="bg-zinc-900/60 border-b border-zinc-800 px-3 py-2 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1 bg-white text-zinc-950 text-sm font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform"
        >
          ＋ 注文追加
        </button>
        <button
          onClick={() => setShowBatch(true)}
          className="flex items-center gap-1 bg-zinc-800 text-zinc-300 text-sm px-3 py-2 rounded-lg active:scale-95 transition-transform"
        >
          📋 バッチ
        </button>
        <div className="flex-1" />
        {readyOrders.length > 0 && (
          <button
            onClick={() => setActiveTab('ready')}
            className="flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-sm px-3 py-2 rounded-lg animate-pulse"
          >
            受渡し待ち
            <span className="bg-emerald-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {readyOrders.length}
            </span>
          </button>
        )}
      </div>

      {/* ─── モバイルタブ ─── */}
      <div className="md:hidden flex border-b border-zinc-800 shrink-0 bg-zinc-950">
        {COLUMNS.map(({ tab, title }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5
              border-b-2 transition-colors
              ${activeTab === tab ? 'border-white text-white' : 'border-transparent text-zinc-600'}
            `}
          >
            {title}
            {countByTab[tab] > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab ? 'bg-white text-zinc-950' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {countByTab[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── カンバンエリア ─── */}
      <div className="flex-1 flex overflow-hidden">
        {COLUMNS.map(({ tab, title, headerClass, emptyMessage }) => {
          const colOrders =
            tab === 'pending'   ? pendingOrders   :
            tab === 'preparing' ? preparingOrders : readyOrders

          return (
            <KanbanColumn
              key={tab}
              title={title}
              headerClass={headerClass}
              orders={colOrders}
              settings={settings}
              isActiveTab={activeTab === tab}
              emptyMessage={emptyMessage}
              onAdvance={advanceStatus}
              onCancel={cancelOrder}
              onItemDone={markItemDone}
            />
          )
        })}
      </div>

      {/* ─── モーダル ─── */}
      {showManual && (
        <ManualOrderModal
          storeId={storeId}
          onClose={() => setShowManual(false)}
          onCreated={loadOrders}
        />
      )}
      {showBatch && (
        <BatchView
          orders={[...pendingOrders, ...preparingOrders]}
          onClose={() => setShowBatch(false)}
        />
      )}
    </div>
  )
}
