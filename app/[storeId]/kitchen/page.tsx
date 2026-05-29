'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { triggerSound } from '@/lib/kitchen-sounds'
import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import { getNextStatus, getUrgencyLevel, shouldNotify } from '@/types/takeout'
import ComboDisplay     from './_components/ComboDisplay'
import OrderCard        from './_components/OrderCard'
import ManualOrderModal from './_components/ManualOrderModal'
import BatchView        from './_components/BatchView'
import ItemCookView     from './_components/ItemCookView'

const WEEKDAYS       = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_COLORS = ['text-red-400', 'text-zinc-300', 'text-zinc-300', 'text-zinc-300', 'text-zinc-300', 'text-zinc-300', 'text-blue-400']

const TEST_NAMES = ['田中', '鈴木', '佐藤', '山田', '伊藤', '渡辺', '中村', '小林', '加藤', '吉田']
const TEST_MENUS = [
  { name: '焼き鳥 もも',     price: 180 },
  { name: '焼き鳥 ねぎま',   price: 180 },
  { name: '焼き鳥 つくね',   price: 200 },
  { name: '唐揚げ弁当',      price: 780 },
  { name: 'から揚げ（6個）', price: 380 },
  { name: '幕の内弁当',      price: 980 },
  { name: 'ビール（中）',    price: 450 },
  { name: 'お茶',            price: 100 },
  { name: 'チューハイ',      price: 380 },
  { name: 'おにぎり（鮭）',  price: 180 },
]

function DateDisplay() {
  const now = new Date()
  const w   = now.getDay()
  return (
    <span className="text-sm text-zinc-400">
      {now.getMonth() + 1}/{now.getDate()}（<span className={WEEKDAY_COLORS[w]}>{WEEKDAYS[w]}</span>）
    </span>
  )
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const upd = () => setTime(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))
    upd()
    const id = setInterval(upd, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-right">
      <div className="text-xs text-zinc-600">現在時刻</div>
      <div className="text-2xl font-bold">{time}</div>
    </div>
  )
}

// 表示優先順：完成待ち → 調理中（緊急→警告→通常）→ 受付中
function sortOrders(orders: TakeoutOrder[], targetMinutes: number): TakeoutOrder[] {
  const score = (o: TakeoutOrder): number => {
    if (o.status === 'ready')     return 0
    if (o.status === 'preparing') {
      const u = getUrgencyLevel(o.created_at, o.status, targetMinutes)
      return u === 'urgent' ? 1 : u === 'warning' ? 2 : 3
    }
    return 4 // pending
  }
  return [...orders].sort((a, b) => score(a) - score(b) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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
    if (data?.name)             setStoreName((data as { name: string }).name)
    if (data?.takeout_settings) setSettings((data as { takeout_settings: TakeoutSettings }).takeout_settings)
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
      .update({ status: nextStatus } as never)
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

  const insertTestOrder = async () => {
    const { data: orderNumber } = await supabase
      .rpc('get_next_order_number', { p_store_id: storeId })
    if (!orderNumber) return

    const name      = TEST_NAMES[Math.floor(Math.random() * TEST_NAMES.length)]
    const itemCount = Math.floor(Math.random() * 3) + 1
    const picked: typeof TEST_MENUS = []
    const used = new Set<number>()
    while (picked.length < itemCount) {
      const idx = Math.floor(Math.random() * TEST_MENUS.length)
      if (!used.has(idx)) { used.add(idx); picked.push(TEST_MENUS[idx]) }
    }
    const items = picked.map(m => ({ ...m, quantity: Math.floor(Math.random() * 3) + 1 }))

    const { data: order } = await supabase
      .from('takeout_orders')
      .insert({
        store_id:      storeId,
        order_number:  orderNumber as string,
        customer_name: `テスト_${name}`,
        status:        'pending',
        total_amount:  items.reduce((s, i) => s + i.price * i.quantity, 0),
        order_source:  'walkin',
      } as never)
      .select()
      .single()

    if (order) {
      await supabase.from('takeout_order_items').insert(
        items.map(i => ({
          order_id:   (order as { id: string }).id,
          name:       i.name,
          unit_price: i.price,
          quantity:   i.quantity,
        }))
      )
      await loadOrders()
    }
  }

  const cancelOrder = async (order: TakeoutOrder) => {
    const { error } = await supabase
      .from('takeout_orders')
      .update({ status: 'cancelled' } as never)
      .eq('id', order.id)
    if (!error) await loadOrders()
  }

  const sorted       = sortOrders(orders, targetMinutes)
  const readyOrders  = sorted.filter(o => o.status === 'ready')
  const cookOrders   = orders.filter(o => o.status === 'pending' || o.status === 'preparing')
  const readyCount   = readyOrders.length

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
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
          <span className="text-base font-bold">{storeName}</span>
          <DateDisplay />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
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
        <button onClick={() => setShowManual(true)}
          className="flex items-center gap-1 bg-white text-zinc-950 text-sm font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform">
          ＋ 注文追加
        </button>
        <button onClick={() => setShowBatch(true)}
          className="flex items-center gap-1 bg-zinc-800 text-zinc-300 text-sm px-3 py-2 rounded-lg active:scale-95 transition-transform">
          📋 バッチ
        </button>
        <button
          onClick={insertTestOrder}
          className="bg-zinc-800/80 text-zinc-600 text-xs px-2.5 py-2 rounded-lg active:scale-95 transition-transform border border-zinc-700/50"
          title="テスト注文を追加"
        >
          🧪
        </button>
        <div className="flex-1" />
        {/* 注文数サマリー */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          {orders.filter(o => o.status === 'pending').length > 0 && (
            <span className="bg-zinc-800 px-2 py-1 rounded">
              受付 {orders.filter(o => o.status === 'pending').length}
            </span>
          )}
          {orders.filter(o => o.status === 'preparing').length > 0 && (
            <span className="bg-amber-950/60 text-amber-400 px-2 py-1 rounded">
              調理中 {orders.filter(o => o.status === 'preparing').length}
            </span>
          )}
          {readyCount > 0 && (
            <span className="bg-emerald-900/60 text-emerald-400 px-2 py-1 rounded font-semibold animate-pulse">
              完成 {readyCount}
            </span>
          )}
        </div>
      </div>

      {/* ─── お渡し待ち（コンパクト） ─── */}
      {readyOrders.length > 0 && (
        <div className="shrink-0 border-b-2 border-emerald-700/60 bg-emerald-950/30">
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5">
            <span className="text-xs font-black text-emerald-400">🤲 お渡し待ち</span>
            <span className="text-xs font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">{readyCount}件</span>
          </div>
          <div className="px-3 pb-3 flex flex-col gap-2 max-w-2xl mx-auto">
            {readyOrders.map(order => (
              <OrderCard key={order.id} order={order} settings={settings}
                onAdvance={() => advanceStatus(order)} onCancel={() => cancelOrder(order)} />
            ))}
          </div>
        </div>
      )}

      {/* ─── 調理ビュー（品目ベース） ─── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ItemCookView
          orders={cookOrders}
          settings={settings}
          onRefresh={loadOrders}
        />
      </div>

      {/* ─── モーダル ─── */}
      {showManual && (
        <ManualOrderModal storeId={storeId} onClose={() => setShowManual(false)} onCreated={loadOrders} />
      )}
      {showBatch && (
        <BatchView orders={orders.filter(o => o.status !== 'ready')} onClose={() => setShowBatch(false)} />
      )}
    </div>
  )
}
