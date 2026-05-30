'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TakeoutOrder, Menu } from '@/types/takeout'
import { guessMenuIcon } from '@/lib/menu-icons'

interface Props {
  storeId:   string
  onClose:   () => void
  onRefresh: () => void
}

type Tab      = 'active' | 'completed'
type ModalKind = 'cancel' | 'return' | 'remake' | 'addItem' | 'time'
interface SubModal { kind: ModalKind; order: TakeoutOrder }

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending:   { text: '受付中',    cls: 'bg-blue-900/60 text-blue-300'       },
  preparing: { text: '調理中',    cls: 'bg-amber-900/60 text-amber-300'     },
  ready:     { text: '完成待ち',  cls: 'bg-emerald-900/60 text-emerald-300' },
  completed: { text: 'お渡し済み', cls: 'bg-zinc-800 text-zinc-400'         },
}

export default function CustomerSearchModal({ storeId, onClose, onRefresh }: Props) {
  const [tab,             setTab]             = useState<Tab>('active')
  const [activeOrders,    setActiveOrders]    = useState<TakeoutOrder[]>([])
  const [completedOrders, setCompletedOrders] = useState<TakeoutOrder[]>([])
  const [menus,           setMenus]           = useState<Menu[]>([])
  const [searchQuery,     setSearchQuery]     = useState('')
  const [loading,         setLoading]         = useState(true)
  const [subModal,        setSubModal]        = useState<SubModal | null>(null)
  const [selectedMenus,   setSelectedMenus]   = useState<{ menu: Menu; qty: number }[]>([])
  const [pickupTime,      setPickupTime]      = useState('')

  const loadData = useCallback(async () => {
    const jstOffset = 9 * 60 * 60 * 1000
    const now       = new Date(Date.now() + jstOffset)
    const todayJst  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - jstOffset)

    const [activeRes, completedRes, menusRes] = await Promise.all([
      supabase
        .from('takeout_orders')
        .select('*, items:takeout_order_items(*)')
        .eq('store_id', storeId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false }),
      supabase
        .from('takeout_orders')
        .select('*, items:takeout_order_items(*)')
        .eq('store_id', storeId)
        .eq('status', 'completed')
        .gte('created_at', todayJst.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('menus')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_available', true)
        .order('sort_order'),
    ])

    if (activeRes.data)    setActiveOrders(activeRes.data as TakeoutOrder[])
    if (completedRes.data) setCompletedOrders(completedRes.data as TakeoutOrder[])
    if (menusRes.data)     setMenus(menusRes.data as Menu[])
    setLoading(false)
  }, [storeId])

  useEffect(() => { loadData() }, [loadData])

  const q               = searchQuery.trim().toLowerCase()
  const filteredActive  = q ? activeOrders.filter(o =>
    (o.customer_name ?? '').toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q)
  ) : activeOrders
  const filteredCompleted = q ? completedOrders.filter(o =>
    (o.customer_name ?? '').toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q)
  ) : completedOrders
  const displayOrders = tab === 'active' ? filteredActive : filteredCompleted

  // ── アクション ──────────────────────────────────────────
  const cancelOrder = async (order: TakeoutOrder) => {
    await supabase.from('takeout_orders').update({ status: 'cancelled' } as never).eq('id', order.id)
    setSubModal(null)
    await loadData()
    onRefresh()
  }

  const remakeOrder = async (order: TakeoutOrder) => {
    await supabase.from('takeout_orders').update({ status: 'pending' } as never).eq('id', order.id)
    const itemIds = (order.items ?? []).map(i => i.id)
    if (itemIds.length > 0) {
      await supabase.from('takeout_order_items').update({ is_done: false } as never).in('id', itemIds)
    }
    setSubModal(null)
    await loadData()
    onRefresh()
  }

  const addItemsToOrder = async (order: TakeoutOrder) => {
    const items = selectedMenus.filter(s => s.qty > 0).map(s => ({
      order_id:   order.id,
      menu_id:    s.menu.id,
      name:       s.menu.name,
      unit_price: s.menu.price,
      quantity:   s.qty,
      is_done:    false,
    }))
    if (items.length === 0) return
    const addAmount = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
    await Promise.all([
      supabase.from('takeout_order_items').insert(items as never),
      supabase.from('takeout_orders')
        .update({ total_amount: (order.total_amount ?? 0) + addAmount } as never)
        .eq('id', order.id),
    ])
    setSubModal(null)
    setSelectedMenus([])
    await loadData()
    onRefresh()
  }

  const savePickupTime = async (order: TakeoutOrder) => {
    if (!pickupTime) return
    await supabase.from('takeout_orders').update({ pickup_time: pickupTime } as never).eq('id', order.id)
    setSubModal(null)
    setPickupTime('')
    await loadData()
  }

  // ── カード描画 ──────────────────────────────────────────
  const renderCard = (order: TakeoutOrder, isCompleted: boolean) => {
    const sl    = STATUS_LABEL[order.status]
    const items = order.items ?? []
    return (
      <div key={order.id} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">

        <div className="flex items-center gap-3 mb-2">
          <span className={`text-3xl font-black font-mono leading-none ${isCompleted ? 'text-zinc-500' : 'text-white'}`}>
            {order.order_number}
          </span>
          {order.customer_name && (
            <span className="text-sm text-zinc-400">{order.customer_name}様</span>
          )}
          {sl && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${sl.cls}`}>{sl.text}</span>
          )}
        </div>

        <div className="flex flex-col gap-1 mb-2">
          {items.length > 0 ? items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="text-base">{guessMenuIcon(item.name)}</span>
              <span className={`flex-1 ${isCompleted ? 'line-through text-zinc-600' : ''}`}>{item.name}</span>
              <span className="font-bold text-zinc-300">×{item.quantity}</span>
            </div>
          )) : (
            <span className="text-xs text-zinc-600">（品目なし）</span>
          )}
        </div>

        {order.pickup_time && (
          <div className="text-xs text-zinc-500 mb-1.5">
            🕐 受取時間: <span className="text-zinc-400 font-bold">{order.pickup_time.slice(0, 5)}</span>
          </div>
        )}
        {order.notes && (
          <div className="text-xs text-amber-300 bg-amber-950/30 rounded px-2 py-1 mb-1.5">
            📝 {order.notes}
          </div>
        )}
        <div className="text-xs text-zinc-600 mb-3">
          合計: ¥{order.total_amount.toLocaleString()}
        </div>

        {/* アクションボタン */}
        {isCompleted ? (
          <div className="flex gap-2">
            <button
              onClick={() => setSubModal({ kind: 'return', order })}
              className="flex-1 py-2.5 border border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl active:bg-zinc-800"
            >
              🔄 返品
            </button>
            <button
              onClick={() => setSubModal({ kind: 'remake', order })}
              className="flex-1 py-2.5 border border-amber-800/70 text-amber-400 text-xs font-bold rounded-xl active:bg-amber-950/40"
            >
              🍳 作り直し
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setSubModal({ kind: 'addItem', order }); setSelectedMenus([]) }}
              className="flex-1 py-2.5 border border-blue-800/70 text-blue-400 text-xs font-bold rounded-xl active:bg-blue-950/40"
            >
              ＋ 追加購入
            </button>
            <button
              onClick={() => { setSubModal({ kind: 'time', order }); setPickupTime(order.pickup_time?.slice(0, 5) ?? '') }}
              className="flex-1 py-2.5 border border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl active:bg-zinc-800"
            >
              🕐 時間編集
            </button>
            <button
              onClick={() => setSubModal({ kind: 'cancel', order })}
              className="flex-1 py-2.5 border border-red-800/70 text-red-400 text-xs font-bold rounded-xl active:bg-red-950/40"
            >
              🗑 キャンセル
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ─── メインモーダル ─────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">

        {/* 検索バー */}
        <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <span className="text-lg shrink-0">🔍</span>
          <input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="名前・注文番号で検索..."
            className="flex-1 bg-zinc-800 text-white text-base px-4 py-2.5 rounded-xl border border-zinc-700 outline-none placeholder:text-zinc-500"
          />
          <button onClick={onClose} className="text-zinc-400 text-xl px-2">✕</button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-zinc-800 shrink-0">
          {([
            { id: 'active',    label: '対応中',    count: activeOrders.length    },
            { id: 'completed', label: 'お渡し済み', count: completedOrders.length },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                tab === t.id ? 'text-white border-b-2 border-white' : 'text-zinc-500'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full tabular-nums">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-zinc-600 py-16">読み込み中...</div>
          ) : displayOrders.length === 0 ? (
            <div className="text-center text-zinc-600 py-16 text-sm">
              {q
                ? `「${searchQuery}」に一致する注文はありません`
                : tab === 'active'
                  ? '対応中の注文はありません'
                  : '本日お渡し済みの注文はありません'}
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-lg mx-auto">
              {displayOrders.map(o => renderCard(o, tab === 'completed'))}
            </div>
          )}
        </div>
      </div>

      {/* ── キャンセル確認 ── */}
      {subModal?.kind === 'cancel' && (
        <ConfirmModal
          icon="🗑" confirmCls="bg-red-600 active:bg-red-700"
          title={`${subModal.order.order_number} をキャンセルしますか？`}
          message={subModal.order.customer_name ? `${subModal.order.customer_name}様の注文` : undefined}
          confirmLabel="キャンセルする"
          onConfirm={() => cancelOrder(subModal.order)}
          onCancel={() => setSubModal(null)}
        />
      )}

      {/* ── 返品確認 ── */}
      {subModal?.kind === 'return' && (
        <ConfirmModal
          icon="🔄" confirmCls="bg-red-600 active:bg-red-700"
          title={`${subModal.order.order_number} を返品しますか？`}
          message={`${subModal.order.customer_name ? `${subModal.order.customer_name}様の注文を` : ''}キャンセル扱いにします`}
          confirmLabel="返品する"
          onConfirm={() => cancelOrder(subModal.order)}
          onCancel={() => setSubModal(null)}
        />
      )}

      {/* ── 作り直し確認 ── */}
      {subModal?.kind === 'remake' && (
        <ConfirmModal
          icon="🍳" confirmCls="bg-amber-500 text-zinc-950 active:bg-amber-400"
          title={`${subModal.order.order_number} を作り直しますか？`}
          message="受付中に戻し、調理完了フラグをリセットします"
          confirmLabel="作り直す"
          onConfirm={() => remakeOrder(subModal.order)}
          onCancel={() => setSubModal(null)}
        />
      )}

      {/* ── 受取時間編集 ── */}
      {subModal?.kind === 'time' && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSubModal(null)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-t-3xl p-6 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🕐</div>
              <h2 className="text-lg font-black text-white">受取時間を編集</h2>
              <p className="text-sm text-zinc-400 mt-1">注文 {subModal.order.order_number}</p>
            </div>
            <input
              type="time"
              value={pickupTime}
              onChange={e => setPickupTime(e.target.value)}
              className="w-full bg-zinc-800 text-white text-2xl text-center py-4 rounded-xl border border-zinc-700 outline-none mb-4"
            />
            <div className="flex flex-col gap-3">
              <button
                onClick={() => savePickupTime(subModal.order)}
                disabled={!pickupTime}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-lg active:bg-blue-700 disabled:opacity-40"
              >
                保存する
              </button>
              <button
                onClick={() => setSubModal(null)}
                className="w-full py-3 rounded-2xl bg-zinc-800 text-zinc-300 font-bold active:bg-zinc-700"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 追加購入 ── */}
      {subModal?.kind === 'addItem' && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
          <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
            <span className="font-bold text-white flex-1">
              ＋ 追加購入 — {subModal.order.order_number}
            </span>
            <button
              onClick={() => { setSubModal(null); setSelectedMenus([]) }}
              className="text-zinc-400 text-xl px-2"
            >✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-2 max-w-lg mx-auto">
              {menus.length === 0 ? (
                <div className="text-center text-zinc-600 py-8 text-sm">メニューがありません</div>
              ) : menus.map(menu => {
                const qty = selectedMenus.find(s => s.menu.id === menu.id)?.qty ?? 0
                return (
                  <div key={menu.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3">
                    <span className="text-xl shrink-0">{guessMenuIcon(menu.name)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-white truncate">{menu.name}</div>
                      <div className="text-xs text-zinc-500">¥{menu.price.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedMenus(prev => {
                          const cur = prev.find(s => s.menu.id === menu.id)?.qty ?? 0
                          const nxt = Math.max(0, cur - 1)
                          if (nxt === 0) return prev.filter(s => s.menu.id !== menu.id)
                          return prev.map(s => s.menu.id === menu.id ? { ...s, qty: nxt } : s)
                        })}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-lg ${
                          qty > 0 ? 'bg-zinc-700 text-white active:bg-zinc-600' : 'bg-zinc-800 text-zinc-600'
                        }`}
                      >−</button>
                      <span className={`w-6 text-center font-black tabular-nums ${qty > 0 ? 'text-white' : 'text-zinc-600'}`}>
                        {qty}
                      </span>
                      <button
                        onClick={() => setSelectedMenus(prev => {
                          const existing = prev.find(s => s.menu.id === menu.id)
                          if (existing) return prev.map(s => s.menu.id === menu.id ? { ...s, qty: s.qty + 1 } : s)
                          return [...prev, { menu, qty: 1 }]
                        })}
                        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-lg active:bg-blue-700"
                      >＋</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="shrink-0 bg-zinc-900 border-t border-zinc-800 px-4 py-4">
            {selectedMenus.length > 0 && (
              <div className="mb-3 text-sm text-zinc-400 leading-relaxed">
                {selectedMenus.map(s => `${s.menu.name}×${s.qty}`).join('、')}
                <span className="ml-2 text-white font-bold">
                  +¥{selectedMenus.reduce((sum, s) => sum + s.menu.price * s.qty, 0).toLocaleString()}
                </span>
              </div>
            )}
            <button
              onClick={() => addItemsToOrder(subModal.order)}
              disabled={selectedMenus.length === 0}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-lg active:bg-blue-700 disabled:opacity-40"
            >
              追加する
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── 汎用確認モーダル ─────────────────────────────────────────
function ConfirmModal({
  icon, title, message, confirmLabel, confirmCls, onConfirm, onCancel,
}: {
  icon:         string
  title:        string
  message?:     string
  confirmLabel: string
  confirmCls:   string
  onConfirm:    () => void
  onCancel:     () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-t-3xl p-6 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{icon}</div>
          <h2 className="text-xl font-black text-white leading-snug">{title}</h2>
          {message && <p className="text-sm text-zinc-400 mt-2">{message}</p>}
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className={`w-full py-4 rounded-2xl font-black text-lg transition-colors ${confirmCls}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-2xl bg-zinc-800 text-zinc-300 font-bold active:bg-zinc-700"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  )
}
