'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { initLiff, getLineProfile, type LiffProfile } from '@/lib/liff'
import { guessMenuIcon } from '@/lib/menu-icons'
import type { Menu, MenuCategory, TakeoutOrder } from '@/types/takeout'

// ──────────────────────────────────────────────
// Types / constants
// ──────────────────────────────────────────────
type View = 'loading' | 'menu' | 'confirm' | 'ordered'

interface CartItem { menu: Menu; quantity: number }

const STATUS_CONFIG: Record<string, { emoji: string; label: string; bg: string; border: string; color: string }> = {
  pending:   { emoji: '📋', label: '受付完了 — まもなく調理を開始します',           bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
  preparing: { emoji: '🍳', label: 'ただいま調理中です。もうしばらくお待ちください', bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' },
  ready:     { emoji: '✅', label: 'ご準備ができました！お受け取りください',         bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46' },
  completed: { emoji: '🙌', label: 'お受け取りありがとうございました！',            bg: '#F9FAFB', border: '#E5E7EB', color: '#6B7280' },
  cancelled: { emoji: '❌', label: 'キャンセルされました',                          bg: '#FEF2F2', border: '#FECACA', color: '#991B1B' },
}

// 15 分刻みのスロット（今から最大 7 枠）
function buildPickupSlots() {
  const now      = new Date()
  const startMin = Math.ceil((now.getMinutes() + 10) / 15) * 15
  const base     = new Date(now)
  base.setSeconds(0, 0)
  base.setMinutes(startMin)
  const slots: { label: string; value: string | null }[] = [{ label: '今すぐ', value: null }]
  for (let i = 0; i < 7; i++) {
    const t  = new Date(base.getTime() + i * 15 * 60_000)
    const hh = t.getHours().toString().padStart(2, '0')
    const mm = t.getMinutes().toString().padStart(2, '0')
    slots.push({ label: `${hh}:${mm}`, value: `${hh}:${mm}` })
  }
  return slots
}

// ──────────────────────────────────────────────
// Page component
// ──────────────────────────────────────────────
export default function OrderPage() {
  const { storeId } = useParams<{ storeId: string }>()

  // ── Meta ──────────────────────────────────
  const [view,        setView]        = useState<View>('loading')
  const [storeName,   setStoreName]   = useState('')
  const [lineProfile, setLineProfile] = useState<LiffProfile | null>(null)

  // ── Menu data ──────────────────────────────
  const [menus,      setMenus]      = useState<Menu[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [activeTab,  setActiveTab]  = useState<string>('all')

  // ── Cart ───────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])

  // ── Order form ─────────────────────────────
  const [pickupSlot,   setPickupSlot]   = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  // ── Active order tracking ──────────────────
  const [currentOrder, setCurrentOrder] = useState<TakeoutOrder | null>(null)
  const [orderStatus,  setOrderStatus]  = useState('')

  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const slotsRef    = useRef(buildPickupSlots())

  // ── Load menus & categories ────────────────
  const loadMenus = useCallback(async () => {
    try {
      const [menuRes, catRes] = await Promise.all([
        supabase.from('menus').select('*').eq('store_id', storeId).eq('is_available', true).order('sort_order'),
        supabase.from('menu_categories').select('*').eq('store_id', storeId).eq('is_active', true).order('sort_order'),
      ])
      if (menuRes.data) setMenus(menuRes.data as Menu[])
      if (catRes.data)  setCategories(catRes.data as MenuCategory[])
    } catch { /* categories table might not exist — show flat list */ }
  }, [storeId])

  // ── Subscribe to order status ──────────────
  const subscribeOrder = useCallback((orderId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel(`order-status-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'takeout_orders', filter: `id=eq.${orderId}`,
      }, payload => {
        const o = payload.new as TakeoutOrder
        setOrderStatus(o.status)
        setCurrentOrder(prev => prev ? { ...prev, ...o } : o)
      })
      .subscribe()
  }, [])

  useEffect(() => () => { channelRef.current && supabase.removeChannel(channelRef.current) }, [])

  // ── Initialise: LIFF → existing order check → menu ──
  useEffect(() => {
    ;(async () => {
      try {
        const { data: store } = await supabase.from('stores').select('name').eq('id', storeId).single()
        if ((store as unknown as { name?: string })?.name)
          setStoreName((store as unknown as { name: string }).name)

        await initLiff('takeout')
        const profile = await getLineProfile('takeout')
        if (profile) {
          setLineProfile(profile)
          setCustomerName(profile.displayName ?? '')

          // Already have an active order for this LINE user?
          const { data: existing } = await supabase
            .from('takeout_orders')
            .select('*, items:takeout_order_items(*)')
            .eq('store_id', storeId)
            .eq('line_user_id', profile.userId)
            .in('status', ['pending', 'preparing', 'ready'])
            .order('created_at', { ascending: false })
            .limit(1)

          if (existing?.[0]) {
            const order = existing[0] as TakeoutOrder
            setCurrentOrder(order)
            setOrderStatus(order.status)
            subscribeOrder(order.id)
            await loadMenus()
            setView('ordered')
            return
          }
        }
      } catch (e) { console.error('[OrderPage init]', e) }

      await loadMenus()
      setView('menu')
    })()
  }, [storeId, loadMenus, subscribeOrder])

  // ── Cart helpers ───────────────────────────
  const addToCart = (menu: Menu) =>
    setCart(prev => {
      const ex = prev.find(i => i.menu.id === menu.id)
      return ex
        ? prev.map(i => i.menu.id === menu.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { menu, quantity: 1 }]
    })

  const setQty = (menuId: string, qty: number) =>
    qty <= 0
      ? setCart(prev => prev.filter(i => i.menu.id !== menuId))
      : setCart(prev => prev.map(i => i.menu.id === menuId ? { ...i, quantity: qty } : i))

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.menu.price * i.quantity, 0)

  // ── Place new order ────────────────────────
  const handleSubmit = async () => {
    if (cart.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const { data: orderNumber, error: numErr } = await supabase
        .rpc('get_next_order_number', { p_store_id: storeId } as never)
      if (numErr || !orderNumber) throw numErr ?? new Error('No order number')

      const { data: order, error: orderErr } = await supabase
        .from('takeout_orders')
        .insert({
          store_id:      storeId,
          order_number:  orderNumber as string,
          customer_name: customerName.trim() || lineProfile?.displayName || null,
          line_user_id:  lineProfile?.userId ?? null,
          status:        'pending',
          total_amount:  cartTotal,
          pickup_time:   pickupSlot,
          order_source:  'line',
          notes:         notes.trim() || null,
        } as never)
        .select()
        .single()
      if (orderErr || !order) throw orderErr

      const orderId = (order as { id: string }).id
      await supabase.from('takeout_order_items').insert(
        cart.map(i => ({
          order_id:   orderId,
          menu_id:    i.menu.id,
          name:       i.menu.name,
          unit_price: i.menu.price,
          quantity:   i.quantity,
          is_done:    false,
        })) as never
      )

      // Populate items locally so the UI renders immediately without a refetch
      const fullOrder: TakeoutOrder = {
        ...(order as TakeoutOrder),
        items: cart.map(i => ({
          id: '', order_id: orderId, menu_id: i.menu.id, name: i.menu.name,
          unit_price: i.menu.price, quantity: i.quantity, notes: null, is_done: false, created_at: '',
        })),
      }
      setCurrentOrder(fullOrder)
      setOrderStatus('pending')
      subscribeOrder(orderId)
      setCart([])
      setView('ordered')

      // 受付通知（fire-and-forget）
      if (lineProfile?.userId) {
        fetch('/api/notify-takeout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status: 'confirmed' }),
        }).catch(() => {/* 通知失敗は無視 */})
      }
    } catch (e) {
      console.error('[handleSubmit]', e)
      alert('注文の送信に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Add items to existing order ────────────
  const handleAddItems = async () => {
    if (!currentOrder || cart.length === 0 || submitting) return
    setSubmitting(true)
    try {
      await Promise.all([
        supabase.from('takeout_order_items').insert(
          cart.map(i => ({
            order_id:   currentOrder.id,
            menu_id:    i.menu.id,
            name:       i.menu.name,
            unit_price: i.menu.price,
            quantity:   i.quantity,
            is_done:    false,
          })) as never
        ),
        supabase.from('takeout_orders')
          .update({ total_amount: (currentOrder.total_amount ?? 0) + cartTotal } as never)
          .eq('id', currentOrder.id),
      ])
      // Refresh order items for display
      const { data: refreshed } = await supabase
        .from('takeout_orders')
        .select('*, items:takeout_order_items(*)')
        .eq('id', currentOrder.id)
        .single()
      if (refreshed) setCurrentOrder(refreshed as TakeoutOrder)
      setCart([])
      setView('ordered')
    } catch (e) {
      console.error('[handleAddItems]', e)
      alert('追加購入に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  // ════════════════════════════════════════════
  // VIEWS
  // ════════════════════════════════════════════

  // ── Loading ────────────────────────────────
  if (view === 'loading') return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-orange-400 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-400">読み込み中...</p>
      </div>
    </div>
  )

  // ── Menu ───────────────────────────────────
  if (view === 'menu') {
    const showCategoryTabs = categories.length > 0
    const displayMenus     = activeTab === 'all'
      ? menus
      : menus.filter(m => m.category_id === activeTab)

    return (
      <div className="min-h-screen bg-zinc-50 pb-32">

        {/* ─ Header ─ */}
        <div className="bg-white border-b border-zinc-100 sticky top-0 z-20">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-xs text-zinc-400 font-medium">{storeName}</div>
                <h1 className="font-black text-xl text-zinc-900 leading-tight">テイクアウト注文</h1>
              </div>
              {currentOrder && (
                <button
                  onClick={() => setView('ordered')}
                  className="text-sm font-bold text-orange-500 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                >
                  進行中の注文 →
                </button>
              )}
            </div>

            {/* Category tabs */}
            {showCategoryTabs && (
              <div className="flex overflow-x-auto gap-2 px-4 pb-3 scrollbar-hide">
                <TabBtn active={activeTab === 'all'} onClick={() => setActiveTab('all')}>すべて</TabBtn>
                {categories.map(cat => (
                  <TabBtn key={cat.id} active={activeTab === cat.id} onClick={() => setActiveTab(cat.id)}>
                    {cat.name}
                  </TabBtn>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─ Menu list ─ */}
        <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
          {displayMenus.length === 0 ? (
            <div className="text-center py-20 text-zinc-400 text-sm">メニューがありません</div>
          ) : displayMenus.map(menu => {
            const qty = cart.find(i => i.menu.id === menu.id)?.quantity ?? 0
            return (
              <div key={menu.id}
                className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
                <span className="text-3xl shrink-0 w-10 text-center leading-none">{guessMenuIcon(menu.name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-zinc-900 text-base leading-tight">{menu.name}</div>
                  {menu.description && (
                    <div className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{menu.description}</div>
                  )}
                  <div className="font-black text-orange-500 text-base mt-0.5">
                    ¥{menu.price.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {qty > 0 && (
                    <>
                      <button onClick={() => setQty(menu.id, qty - 1)}
                        className="w-9 h-9 rounded-full border-2 border-orange-300 text-orange-500 font-black text-xl flex items-center justify-center active:bg-orange-50">
                        −
                      </button>
                      <span className="w-6 text-center font-black text-lg tabular-nums text-zinc-900">{qty}</span>
                    </>
                  )}
                  <button onClick={() => addToCart(menu)}
                    className="w-9 h-9 rounded-full bg-orange-500 text-white font-black text-xl flex items-center justify-center active:bg-orange-600 transition-colors">
                    ＋
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ─ Sticky cart CTA ─ */}
        {cartCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-zinc-50 to-transparent">
            <div className="max-w-lg mx-auto">
              <button onClick={() => setView('confirm')}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-base active:scale-95 transition-transform shadow-xl shadow-orange-200 flex items-center justify-between px-5">
                <span className="bg-orange-600 rounded-lg px-2.5 py-1 text-sm">{cartCount}品</span>
                <span>カートを確認する</span>
                <span>¥{cartTotal.toLocaleString()}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Confirm ────────────────────────────────
  if (view === 'confirm') {
    const isAdding = currentOrder !== null

    return (
      <div className="min-h-screen bg-zinc-50 pb-32">

        {/* ─ Header ─ */}
        <div className="bg-white border-b border-zinc-100 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
            <button onClick={() => setView(isAdding ? 'ordered' : 'menu')}
              className="text-zinc-500 font-bold text-sm active:opacity-60">
              ← 戻る
            </button>
            <h1 className="font-black text-lg text-zinc-900">
              {isAdding ? '追加購入の確認' : '注文内容の確認'}
            </h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">

          {/* ─ Cart items ─ */}
          <Section title={isAdding ? `追加する品目（注文 ${currentOrder!.order_number}）` : '注文内容'}>
            <div className="divide-y divide-zinc-50">
              {cart.map(item => (
                <div key={item.menu.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl shrink-0">{guessMenuIcon(item.menu.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-900 text-sm leading-tight">{item.menu.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      ¥{item.menu.price.toLocaleString()} × {item.quantity} ＝ ¥{(item.menu.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setQty(item.menu.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full border border-zinc-200 text-zinc-600 flex items-center justify-center font-bold active:bg-zinc-100">
                      −
                    </button>
                    <span className="w-5 text-center font-black tabular-nums text-sm">{item.quantity}</span>
                    <button onClick={() => setQty(item.menu.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold active:bg-orange-600">
                      ＋
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between">
              <span className="font-bold text-zinc-500 text-sm">{isAdding ? '追加小計' : '合計'}</span>
              <span className="font-black text-orange-500 text-xl">¥{cartTotal.toLocaleString()}</span>
            </div>
          </Section>

          {/* ─ Pickup time (new order only) ─ */}
          {!isAdding && (
            <Section title="🕐 受取時間を選んでください">
              <div className="p-3 grid grid-cols-4 gap-2">
                {slotsRef.current.map(slot => (
                  <button key={slot.label} onClick={() => setPickupSlot(slot.value)}
                    className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                      pickupSlot === slot.value ? 'bg-orange-500 text-white' : 'bg-zinc-50 text-zinc-700 border border-zinc-100'
                    }`}>
                    {slot.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* ─ Name + Notes (new order only) ─ */}
          {!isAdding && (
            <>
              <Section title="お名前（任意）">
                <input
                  type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder={lineProfile?.displayName ?? 'お名前を入力'}
                  className="w-full px-4 py-3 text-zinc-900 text-sm outline-none"
                />
              </Section>
              <Section title="備考・アレルギーなど（任意）">
                <input
                  type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="例：ネギ抜きでお願いします"
                  className="w-full px-4 py-3 text-zinc-900 text-sm outline-none"
                />
              </Section>
            </>
          )}
        </div>

        {/* ─ Submit ─ */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-zinc-50 to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              onClick={isAdding ? handleAddItems : handleSubmit}
              disabled={submitting || cart.length === 0}
              className="w-full py-4 rounded-2xl font-black text-lg bg-orange-500 text-white disabled:opacity-50 active:scale-95 transition-transform shadow-xl shadow-orange-200"
            >
              {submitting
                ? '送信中...'
                : isAdding
                  ? `追加する（¥${cartTotal.toLocaleString()}）`
                  : `注文を確定する — ¥${cartTotal.toLocaleString()}`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Ordered (status tracking) ──────────────
  if (view === 'ordered' && currentOrder) {
    const st      = STATUS_CONFIG[orderStatus] ?? STATUS_CONFIG['pending']
    const isDone  = orderStatus === 'completed' || orderStatus === 'cancelled'
    const isReady = orderStatus === 'ready'

    const handleNewOrder = async () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
      setCurrentOrder(null)
      setOrderStatus('')
      setCart([])
      setView('menu')
    }

    return (
      <div className="min-h-screen bg-zinc-50">

        {/* ─ Header ─ */}
        <div className="bg-white border-b border-zinc-100">
          <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
            <div className="text-sm font-medium text-zinc-500">{storeName}</div>
            {!isDone && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                リアルタイム更新中
              </div>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 flex flex-col items-center gap-6">

          {/* ─ Status card ─ */}
          <div className="w-full rounded-2xl border px-5 py-4 text-center"
            style={{ backgroundColor: st.bg, borderColor: st.border, color: st.color }}>
            <div className="text-4xl mb-1.5">{st.emoji}</div>
            <div className="font-bold text-sm leading-snug">{st.label}</div>
          </div>

          {/* ─ Order number — HUGE ─ */}
          <div className="text-center w-full">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">注文番号</div>
            <div
              className="font-black leading-none tracking-tight transition-colors duration-500"
              style={{
                fontSize: 'clamp(80px, 28vw, 140px)',
                color: isReady ? '#059669' : '#111827',
              }}
            >
              {currentOrder.order_number}
            </div>
            {currentOrder.customer_name && (
              <div className="text-zinc-600 font-bold text-base mt-2">{currentOrder.customer_name} 様</div>
            )}
            {currentOrder.pickup_time && (
              <div className="text-sm text-zinc-400 mt-1">
                🕐 受取希望: <span className="font-bold text-zinc-600">{currentOrder.pickup_time.slice(0, 5)}</span>
              </div>
            )}
          </div>

          {/* ─ Order items ─ */}
          {currentOrder.items && currentOrder.items.length > 0 && (
            <div className="w-full bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 text-sm font-bold text-zinc-500">注文内容</div>
              <div className="divide-y divide-zinc-50">
                {currentOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xl shrink-0">{guessMenuIcon(item.name)}</span>
                    <span className="flex-1 text-sm text-zinc-800 font-medium">{item.name}</span>
                    <span className="font-black text-zinc-900 tabular-nums">×{item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-zinc-100 text-right text-sm text-zinc-400">
                合計 <span className="font-black text-orange-500 text-base ml-1">
                  ¥{currentOrder.total_amount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* ─ LINE notification notice ─ */}
          {currentOrder.line_user_id && !isDone && (
            <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 text-center font-medium">
              📱 調理開始・完成時にLINEでお知らせします
            </div>
          )}

          {/* ─ リピート誘導バナー ─ */}
          {currentOrder.line_user_id && (
            <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">💡</span>
              <p className="text-xs text-zinc-600 leading-relaxed">
                <span className="font-bold text-zinc-800">次回からはLINEのメニューで再注文できます。</span><br />
                このLINEアカウントを友達追加したままにしておくと、家からでもかんたんに注文できます。
              </p>
            </div>
          )}

          {/* ─ Actions ─ */}
          {isDone ? (
            <button
              onClick={handleNewOrder}
              className="w-full py-4 rounded-2xl font-black text-base bg-orange-500 text-white active:scale-95 transition-transform shadow-lg shadow-orange-100"
            >
              新しく注文する
            </button>
          ) : (
            <button
              onClick={() => setView('menu')}
              className="w-full py-4 rounded-2xl font-black text-base border-2 border-orange-400 text-orange-500 bg-white active:scale-95 transition-transform"
            >
              ＋ 追加購入する
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ──────────────────────────────────────────────
// Small UI helpers
// ──────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
        active ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-zinc-100 text-sm font-bold text-zinc-600">{title}</div>
      {children}
    </div>
  )
}
