'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Plus, User, Phone,
  CheckCheck, Package, Loader2, X, MessageCircle,
  CalendarDays, Pencil, AlertCircle, ChevronDown, ChevronUp,
  RotateCcw, History, ShoppingBag, Bell,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Customer, PurchaseOrder, PurchaseStatus } from '@/types/crm'
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS } from '@/types/crm'

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl animate-fade-in max-w-xs text-center ${
      type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
    }`}>{msg}</div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-zinc-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

// ============================================================
// 顧客バッジ
// ============================================================
function CustomerBadge({ customer, selected, onClick }: {
  customer: Customer; selected: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
        selected
          ? 'bg-indigo-600/30 border-indigo-500/50 text-white'
          : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-300 hover:border-zinc-600'
      }`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-indigo-500/40' : 'bg-zinc-800'}`}>
          <User size={16} className={selected ? 'text-indigo-300' : 'text-zinc-500'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{customer.name}</p>
          <p className="text-xs text-zinc-500 truncate">
            {customer.kana ? `${customer.kana}` : ''}
            {customer.parent_name ? `　保護者: ${customer.parent_name}` : ''}
            {!customer.kana && !customer.parent_name ? (customer.tel ?? '情報未登録') : ''}
          </p>
        </div>
        {customer.line_user_id
          ? <MessageCircle size={13} className="text-emerald-400 shrink-0" />
          : <span className="text-[10px] text-zinc-600 shrink-0">LINE未</span>
        }
      </div>
    </button>
  )
}

// ============================================================
// 発注アイテム
// ============================================================
type PurchaseWithCustomer = PurchaseOrder & { customer: Pick<Customer, 'name' | 'tel'> | null }

function PurchaseItem({ order, showCustomer = false, onArrive, onDeliver, onRevert }: {
  order: PurchaseOrder | PurchaseWithCustomer
  showCustomer?: boolean
  onArrive:  (id: string) => Promise<void>
  onDeliver: (id: string) => Promise<void>
  onRevert:  (id: string) => Promise<void>
}) {
  const [loading,        setLoading]        = useState<string | null>(null)
  const [confirmArrive,  setConfirmArrive]  = useState(false)
  const [confirmRevert,  setConfirmRevert]  = useState(false)
  const customerName = showCustomer ? (order as PurchaseWithCustomer).customer?.name : null

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      order.status === 'delivered'
        ? 'bg-zinc-900/30 border-zinc-800/40'
        : order.status === 'arrived'
        ? 'bg-emerald-950/40 border-emerald-500/20'
        : 'bg-gradient-to-br from-blue-950/40 to-indigo-950/30 border-blue-500/20'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${
          order.status === 'delivered' ? 'bg-zinc-800'
          : order.status === 'arrived' ? 'bg-emerald-500/20'
          : 'bg-blue-500/20'
        }`}>
          {order.status === 'delivered' ? <Package size={14} className="text-zinc-500" />
          : order.status === 'arrived'  ? <CheckCheck size={14} className="text-emerald-400" />
          : <ShoppingBag size={14} className="text-blue-400" />}
        </div>

        <div className="flex-1 min-w-0">
          {customerName && (
            <p className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
              <User size={10} />{customerName}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PURCHASE_STATUS_COLORS[order.status]}`}>
              {PURCHASE_STATUS_LABELS[order.status]}
            </span>
            {order.notified && (
              <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                LINE通知済み
              </span>
            )}
          </div>
          <p className="font-bold text-white text-sm">{order.item_name}</p>
          {order.notes && <p className="text-zinc-400 text-xs mt-0.5">{order.notes}</p>}
          {order.price != null && <p className="text-zinc-500 text-xs mt-0.5">¥{order.price.toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-zinc-600 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />注文 {fmtDate(order.ordered_date)}</span>
            {order.arrived_date  && <span className="flex items-center gap-1"><Bell size={10} />入荷 {fmtDate(order.arrived_date)}</span>}
            {order.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(order.delivered_date)}</span>}
          </div>
        </div>
      </div>

      {/* 注文中 → 入荷済み（2ステップ確認 + LINE通知） */}
      {order.status === 'ordered' && (
        confirmArrive ? (
          <div className="mt-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-center text-emerald-300 font-bold">📦 入荷通知 · LINEで連絡しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmArrive(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-zinc-700 text-zinc-300 active:scale-95 transition-all">
                キャンセル
              </button>
              <button
                onClick={async () => { setLoading('arrive'); await onArrive(order.id); setLoading(null); setConfirmArrive(false) }}
                disabled={!!loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'arrive' ? <><Loader2 size={13} className="animate-spin" />送信中...</> : <><Bell size={13} />通知する</>}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmArrive(true)}
            className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 transition-all flex items-center justify-center gap-2">
            <Bell size={14} />入荷済み · LINE通知を送る
          </button>
        )
      )}

      {/* 入荷済み → お渡し or 注文中に戻す */}
      {order.status === 'arrived' && (
        <div className="mt-3 space-y-2">
          <button
            onClick={async () => { setLoading('deliver'); await onDeliver(order.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-200 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={14} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
          {confirmRevert ? (
            <div className="bg-blue-950/50 border border-blue-500/30 rounded-xl p-3 space-y-2">
              <p className="text-xs text-center text-blue-300 font-bold">注文中に戻しますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRevert(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-zinc-700 text-zinc-300 active:scale-95">キャンセル</button>
                <button
                  onClick={async () => { setLoading('revert'); await onRevert(order.id); setLoading(null); setConfirmRevert(false) }}
                  disabled={!!loading}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-blue-600 text-white active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />戻す</>}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmRevert(true)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-blue-500/20 text-blue-500/70 hover:text-blue-400 hover:border-blue-500/40 transition-all flex items-center justify-center gap-1.5">
              <RotateCcw size={12} />注文中に戻す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 新規発注フォーム
// ============================================================
function NewPurchaseForm({ customerId, storeId, onSaved, onCancel }: {
  customerId: string; storeId: string; onSaved: () => void; onCancel: () => void
}) {
  const [itemName, setItemName] = useState('')
  const [notes,    setNotes]    = useState('')
  const [price,    setPrice]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSave = async () => {
    if (!itemName.trim()) { setError('商品名を入力してください'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('purchase_orders').insert({
      store_id: storeId, customer_id: customerId,
      item_name: itemName.trim(),
      notes: notes.trim() || null,
      price: price ? parseInt(price) : null,
      status: 'ordered', ordered_date: new Date().toISOString().slice(0, 10),
    })
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    onSaved()
  }

  return (
    <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <ShoppingBag size={14} className="text-blue-400" />新規発注登録
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <Field label="商品名" required>
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="例：○○高校学ラン 165A" value={itemName} onChange={e => { setItemName(e.target.value); setError(null) }} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="金額（円）">
          <input type="number" inputMode="numeric" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="例：25000" value={price} onChange={e => setPrice(e.target.value)} />
        </Field>
        <Field label="メモ">
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="色・サイズなど" value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '注文中として登録する'}
      </button>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function PurchaseManagementPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()

  const [storeName,        setStoreName]        = useState('')
  const [customers,        setCustomers]        = useState<Customer[]>([])
  const [searchQuery,      setSearchQuery]      = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [orders,           setOrders]           = useState<PurchaseOrder[]>([])
  const [stats,            setStats]            = useState({ ordered: 0, arrived: 0 })

  const [showOrderedList,   setShowOrderedList]   = useState(false)
  const [orderedItems,      setOrderedItems]      = useState<PurchaseWithCustomer[]>([])
  const [orderedLoading,    setOrderedLoading]    = useState(false)

  const [showArrivedList,   setShowArrivedList]   = useState(false)
  const [arrivedItems,      setArrivedItems]      = useState<PurchaseWithCustomer[]>([])
  const [arrivedLoading,    setArrivedLoading]    = useState(false)

  const [showDeliveredList, setShowDeliveredList] = useState(false)
  const [deliveredItems,    setDeliveredItems]    = useState<PurchaseWithCustomer[]>([])
  const [deliveredLoading,  setDeliveredLoading]  = useState(false)
  const [searchDelivered,   setSearchDelivered]   = useState('')

  const [showNewOrder, setShowNewOrder] = useState(false)
  const [loading,      setLoading]      = useState(false)

  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ type, msg })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    if (!storeId) return
    supabase.from('stores').select('name').eq('id', storeId).single()
      .then(({ data }) => { if (data) setStoreName(data.name ?? '') })
  }, [storeId])

  const fetchStats = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase.from('purchase_orders').select('status')
      .eq('store_id', storeId).in('status', ['ordered', 'arrived'])
    if (!data) return
    setStats({ ordered: data.filter(r => r.status === 'ordered').length, arrived: data.filter(r => r.status === 'arrived').length })
  }, [storeId])

  const searchCustomers = useCallback(async (q: string) => {
    if (!storeId || !q.trim()) { setCustomers([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId)
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q.replace(/-/g, '')}%,parent_name.ilike.%${q}%,school_name.ilike.%${q}%`)
      .order('updated_at', { ascending: false }).limit(20)
    setCustomers(data ?? []); setLoading(false)
  }, [storeId])

  const fetchOrderedItems = useCallback(async () => {
    if (!storeId) return; setOrderedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'ordered')
      .order('ordered_date', { ascending: false })
    setOrderedItems((data ?? []) as PurchaseWithCustomer[]); setOrderedLoading(false)
  }, [storeId])

  const fetchArrivedItems = useCallback(async () => {
    if (!storeId) return; setArrivedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'arrived')
      .order('arrived_date', { ascending: false })
    setArrivedItems((data ?? []) as PurchaseWithCustomer[]); setArrivedLoading(false)
  }, [storeId])

  const fetchDeliveredItems = useCallback(async () => {
    if (!storeId) return; setDeliveredLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'delivered')
      .order('delivered_date', { ascending: false }).limit(100)
    setDeliveredItems((data ?? []) as PurchaseWithCustomer[]); setDeliveredLoading(false)
  }, [storeId])

  const fetchOrders = useCallback(async (customerId: string) => {
    const { data } = await supabase.from('purchase_orders').select('*')
      .eq('customer_id', customerId).order('ordered_date', { ascending: false })
    if (data) setOrders(data)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, searchCustomers])

  useEffect(() => {
    if (selectedCustomer) fetchOrders(selectedCustomer.id)
    else setOrders([])
  }, [selectedCustomer, fetchOrders])

  const handleToggleOrdered = () => {
    if (!showOrderedList) fetchOrderedItems()
    setShowOrderedList(v => !v); setShowArrivedList(false); setShowDeliveredList(false)
    setSelectedCustomer(null); setSearchQuery('')
  }
  const handleToggleArrived = () => {
    if (!showArrivedList) fetchArrivedItems()
    setShowArrivedList(v => !v); setShowOrderedList(false); setShowDeliveredList(false)
    setSelectedCustomer(null); setSearchQuery('')
  }
  const handleToggleDelivered = () => {
    if (!showDeliveredList) fetchDeliveredItems()
    setShowDeliveredList(v => !v); setShowOrderedList(false); setShowArrivedList(false)
    setSelectedCustomer(null); setSearchQuery('')
  }

  const handleArrive = async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `入荷処理失敗: ${error.message}`); return }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'arrived' as PurchaseStatus, arrived_date: today } : o))
    setOrderedItems(prev => prev.filter(o => o.id !== orderId))
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) {
        showToast('ok', '✅ 入荷済み + LINE通知を送信しました')
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, notified: true } : o))
      } else if (j.skipped) {
        showToast('ok', '✅ 入荷済みにしました（LINE未連携のため通知なし）')
      } else {
        showToast('err', `入荷済み・通知失敗: ${j.error ?? '不明'}`)
      }
    } catch { showToast('err', '入荷済み・通知APIエラー') }
    fetchStats()
    if (showArrivedList) fetchArrivedItems()
  }

  const handleDeliver = async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'delivered', delivered_date: today }).eq('id', orderId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' as PurchaseStatus, delivered_date: today } : o))
    setArrivedItems(prev => prev.filter(o => o.id !== orderId))
    showToast('ok', '📦 お渡し済みにしました')
    fetchStats()
    if (showDeliveredList) fetchDeliveredItems()
  }

  const handleRevert = async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'ordered', arrived_date: null, notified: false }).eq('id', orderId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'ordered' as PurchaseStatus, arrived_date: null, notified: false } : o))
    setArrivedItems(prev => prev.filter(o => o.id !== orderId))
    showToast('ok', '🔄 注文中に戻しました')
    fetchStats()
    if (showOrderedList) fetchOrderedItems()
  }

  const filteredDelivered = searchDelivered.trim()
    ? deliveredItems.filter(o =>
        (o.customer?.name ?? '').includes(searchDelivered) ||
        o.item_name.includes(searchDelivered)
      )
    : deliveredItems

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin`)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-90 transition-all">
            <ArrowLeft size={18} className="text-zinc-400" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <ShoppingBag size={16} className="text-blue-400" />追加購入管理
            </h1>
            {storeName && <p className="text-zinc-500 text-xs">{storeName}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* 統計バー */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleToggleOrdered}
            className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
              showOrderedList ? 'bg-blue-500/20 border-blue-400/40 ring-1 ring-blue-400/30' : 'bg-blue-950/40 border-blue-500/20'
            }`}>
            <p className="text-xs text-blue-400/70 font-bold flex items-center justify-center gap-1">
              注文中 {showOrderedList ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </p>
            <p className="text-3xl font-black text-blue-300 leading-none mt-0.5">{stats.ordered}</p>
            <p className="text-xs text-blue-500/50 mt-0.5">件 — タップで一覧</p>
          </button>
          <button onClick={handleToggleArrived}
            className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
              showArrivedList ? 'bg-emerald-500/20 border-emerald-400/40 ring-1 ring-emerald-400/30' : 'bg-emerald-950/40 border-emerald-500/20'
            }`}>
            <p className="text-xs text-emerald-400/70 font-bold flex items-center justify-center gap-1">
              入荷済み（通知済み） {showArrivedList ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </p>
            <p className="text-3xl font-black text-emerald-300 leading-none mt-0.5">{stats.arrived}</p>
            <p className="text-xs text-emerald-500/50 mt-0.5">件 — タップで一覧</p>
          </button>
        </div>

        {/* お渡し済み履歴 */}
        <button onClick={handleToggleDelivered}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
            showDeliveredList ? 'bg-zinc-700/60 border-zinc-500/50' : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-600'
          }`}>
          <History size={16} className="text-zinc-400 shrink-0" />
          <span className="text-zinc-300 text-sm font-bold flex-1 text-left">お渡し済み履歴</span>
          {showDeliveredList ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </button>

        {/* 注文中一覧 */}
        {showOrderedList && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs font-bold text-blue-400/70 uppercase tracking-wider px-1">注文中 — {orderedItems.length}件</p>
            {orderedLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
            ) : orderedItems.length === 0 ? (
              <div className="text-center py-8 text-zinc-600"><ShoppingBag size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">注文中の商品はありません</p></div>
            ) : orderedItems.map(o => (
              <PurchaseItem key={o.id} order={o} showCustomer onArrive={handleArrive} onDeliver={handleDeliver} onRevert={handleRevert} />
            ))}
            <div className="border-t border-white/5 pt-2" />
          </div>
        )}

        {/* 入荷済み一覧 */}
        {showArrivedList && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-wider px-1">入荷済み（通知済み） — {arrivedItems.length}件</p>
            {arrivedLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-emerald-400" /></div>
            ) : arrivedItems.length === 0 ? (
              <div className="text-center py-8 text-zinc-600"><Bell size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">入荷済みの商品はありません</p></div>
            ) : arrivedItems.map(o => (
              <PurchaseItem key={o.id} order={o} showCustomer onArrive={handleArrive} onDeliver={handleDeliver} onRevert={handleRevert} />
            ))}
            <div className="border-t border-white/5 pt-2" />
          </div>
        )}

        {/* お渡し済み一覧 + 検索 */}
        {showDeliveredList && (
          <div className="space-y-3 animate-fade-in">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={searchDelivered}
                onChange={e => setSearchDelivered(e.target.value)}
                placeholder="お客様名 / 商品名で絞り込み"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
              {searchDelivered && (
                <button onClick={() => setSearchDelivered('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X size={13} />
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
              お渡し済み — {filteredDelivered.length}件
              {searchDelivered && deliveredItems.length !== filteredDelivered.length && ` / 全${deliveredItems.length}件`}
            </p>
            {deliveredLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>
            ) : filteredDelivered.length === 0 ? (
              <div className="text-center py-8 text-zinc-600"><Package size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">{searchDelivered ? '該当する商品が見つかりません' : 'お渡し済みの商品はありません'}</p></div>
            ) : filteredDelivered.map(o => (
              <PurchaseItem key={o.id} order={o} showCustomer onArrive={handleArrive} onDeliver={handleDeliver} onRevert={handleRevert} />
            ))}
            <div className="border-t border-white/5 pt-2" />
          </div>
        )}

        {/* 顧客検索 */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowOrderedList(false); setShowArrivedList(false); setShowDeliveredList(false) }}
              placeholder="顧客を名前・フリガナ・電話番号で検索"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none transition-colors" />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setCustomers([]); setSelectedCustomer(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 顧客リスト */}
        {searchQuery.trim() && (
          loading ? (
            <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
          ) : customers.length === 0 ? (
            <div className="text-center py-6 text-zinc-600">
              <User size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">該当する顧客が見つかりません</p>
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in">
              {customers.map(c => (
                <CustomerBadge key={c.id} customer={c}
                  selected={selectedCustomer?.id === c.id}
                  onClick={() => { setSelectedCustomer(prev => prev?.id === c.id ? null : c); setShowNewOrder(false) }}
                />
              ))}
            </div>
          )
        )}

        {/* 選択中顧客の詳細 + 発注履歴 */}
        {selectedCustomer && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div className="bg-zinc-900/60 border border-white/8 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <User size={20} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-base">{selectedCustomer.name}</p>
                  {selectedCustomer.kana && <p className="text-zinc-500 text-xs">{selectedCustomer.kana}</p>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {selectedCustomer.tel && (
                      <span className="flex items-center gap-1 text-zinc-400 text-xs"><Phone size={11} />{selectedCustomer.tel}</span>
                    )}
                    {selectedCustomer.line_user_id
                      ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><MessageCircle size={11} />LINE連携済み</span>
                      : <span className="text-zinc-600 text-xs">LINE未連携</span>
                    }
                  </div>
                  {selectedCustomer.school_name && (
                    <p className="text-zinc-500 text-xs mt-1">{selectedCustomer.school_name}</p>
                  )}
                  {selectedCustomer.notes && (
                    <p className="text-zinc-500 text-xs mt-1 bg-zinc-800/50 rounded-lg px-2 py-1">📝 {selectedCustomer.notes}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">発注履歴 ({orders.length}件)</p>
              {orders.length === 0 ? (
                <div className="text-center py-6 text-zinc-700">
                  <ShoppingBag size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">発注履歴がありません</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map(o => (
                    <PurchaseItem key={o.id} order={o} onArrive={handleArrive} onDeliver={handleDeliver} onRevert={handleRevert} />
                  ))}
                </div>
              )}
            </div>

            {showNewOrder ? (
              <NewPurchaseForm storeId={storeId} customerId={selectedCustomer.id}
                onSaved={() => { setShowNewOrder(false); fetchOrders(selectedCustomer.id); fetchStats(); showToast('ok', '発注を登録しました') }}
                onCancel={() => setShowNewOrder(false)}
              />
            ) : (
              <button onClick={() => setShowNewOrder(true)}
                className="w-full py-3.5 rounded-2xl border border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                <Plus size={15} />このお客様の発注を登録する
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
