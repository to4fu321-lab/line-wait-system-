'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Scissors, ShoppingBag, Loader2, ChevronDown, ChevronUp,
  Phone, User, Check, Truck, RotateCcw, Package, ChevronRight,
  ShoppingCart,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
} from '@/types/crm'
import type { RepairStatus, PurchaseStatus } from '@/types/crm'
import {
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
} from '@/types/orders'
import type { OrderStatus, PaymentStatus } from '@/types/orders'
import { BottomNav } from '../_components/BottomNav'

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

// ── Types ─────────────────────────────────────────────────────
interface RepairRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  slip_number: string | null; item_name: string; content: string
  status: RepairStatus; received_date: string; completed_date: string | null
  delivered_date: string | null; price: number | null; notes: string | null
  notified: boolean; created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string } | null
}

interface PurchaseRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  item_name: string; notes: string | null; status: PurchaseStatus
  price: number | null; ordered_date: string; arrived_date: string | null
  delivered_date: string | null; notified: boolean; created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string } | null
}

interface OrderRow {
  id: string; store_id: string; customer_id: string | null; child_id: string | null
  order_number: string | null; status: OrderStatus; payment_status: PaymentStatus
  total_amount: number | null; notes: string | null; created_at: string; updated_at: string
  customer?: { id: string; name: string } | null
  child?: { name: string } | null
  items?: { id: string; item_name: string; size_label: string | null; quantity: number; unit_price: number | null; status: string }[]
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium border ${
      type === 'ok'
        ? 'bg-emerald-900/90 text-emerald-300 border-emerald-700/50'
        : 'bg-red-900/90 text-red-300 border-red-700/50'
    }`}>
      {msg}
    </div>
  )
}

// ── Repair Card ───────────────────────────────────────────────
function RepairCard({ item, storeId, onRefresh, onToast }: {
  item: RepairRow; storeId: string; onRefresh: () => void; onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function update(patch: Record<string, unknown>) {
    setLoading(true)
    const { error } = await (supabase as any).from('repair_histories').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onToast('ok', '更新しました'); onRefresh()
  }

  return (
    <div className={`bg-zinc-900/60 border rounded-2xl overflow-hidden ${item.status === 'delivered' ? 'border-zinc-800/40 opacity-60' : 'border-zinc-700/50'}`}>
      <button className="w-full text-left p-4 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${REPAIR_STATUS_COLORS[item.status]}`}>
              {REPAIR_STATUS_LABELS[item.status]}
            </span>
            {item.slip_number && <span className="text-xs font-mono text-zinc-500">#{item.slip_number}</span>}
          </div>
          <p className="text-sm font-semibold text-zinc-100 mt-1.5 truncate">
            {item.customer?.name ?? '（顧客不明）'}
            {item.child && <span className="text-zinc-500 font-normal"> / {item.child.name}</span>}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{item.item_name} — {item.content}</p>
          <p className="text-xs text-zinc-600 mt-0.5">受取: {fmtDate(item.received_date)}</p>
        </div>
        {open ? <ChevronUp size={15} className="text-zinc-500 mt-1 shrink-0" /> : <ChevronDown size={15} className="text-zinc-500 mt-1 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60">
          {item.notes && <p className="text-xs text-zinc-400 pt-3">{item.notes}</p>}
          {item.price != null && <p className="text-xs text-zinc-400">料金: ¥{item.price.toLocaleString()}</p>}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-400">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
            <User size={11} />顧客詳細
          </a>
          <div className="flex flex-wrap gap-2 pt-1">
            {item.status === 'received' && (
              <button onClick={() => update({ status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true })}
                disabled={loading} className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5">
                <Check size={13} />お直し完了・連絡済み
              </button>
            )}
            {item.status === 'completed' && (
              <button onClick={() => update({ status: 'delivered', delivered_date: new Date().toISOString().slice(0, 10) })}
                disabled={loading} className="flex-1 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5">
                <Truck size={13} />お渡し済み
              </button>
            )}
            {item.status !== 'received' && (
              <button onClick={() => update({ status: 'received', completed_date: null, delivered_date: null, notified: false })}
                disabled={loading} className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-xl transition-colors flex items-center gap-1">
                <RotateCcw size={11} />戻す
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Purchase Card ─────────────────────────────────────────────
const PURCHASE_STATUS_FLOW: Partial<Record<PurchaseStatus, { next: PurchaseStatus; label: string; color: string }>> = {
  received:  { next: 'on_order',  label: 'メーカー発注済みにする', color: 'bg-orange-700 hover:bg-orange-600' },
  ordered:   { next: 'on_order',  label: 'メーカー発注済みにする', color: 'bg-orange-700 hover:bg-orange-600' },
  on_order:  { next: 'arrived',   label: '入荷・連絡済みにする',   color: 'bg-emerald-700 hover:bg-emerald-600' },
  arrived:   { next: 'delivered', label: 'お渡し済みにする',       color: 'bg-indigo-700 hover:bg-indigo-600' },
  stocked:   { next: 'arrived',   label: '入荷・連絡済みにする',   color: 'bg-emerald-700 hover:bg-emerald-600' },
}

function PurchaseCard({ item, storeId, onRefresh, onToast }: {
  item: PurchaseRow; storeId: string; onRefresh: () => void; onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const nextStep = PURCHASE_STATUS_FLOW[item.status]

  async function update(patch: Record<string, unknown>) {
    setLoading(true)
    const { error } = await (supabase as any).from('purchase_orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onToast('ok', '更新しました'); onRefresh()
  }

  return (
    <div className={`bg-zinc-900/60 border rounded-2xl overflow-hidden ${item.status === 'delivered' ? 'border-zinc-800/40 opacity-60' : 'border-zinc-700/50'}`}>
      <button className="w-full text-left p-4 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PURCHASE_STATUS_COLORS[item.status]}`}>
              {PURCHASE_STATUS_LABELS[item.status]}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-100 mt-1.5 truncate">
            {item.customer?.name ?? '（顧客不明）'}
            {item.child && <span className="text-zinc-500 font-normal"> / {item.child.name}</span>}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{item.item_name}</p>
          <p className="text-xs text-zinc-600 mt-0.5">依頼: {fmtDate(item.ordered_date)}</p>
        </div>
        {open ? <ChevronUp size={15} className="text-zinc-500 mt-1 shrink-0" /> : <ChevronDown size={15} className="text-zinc-500 mt-1 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60">
          {item.notes && <p className="text-xs text-zinc-400 pt-3">{item.notes}</p>}
          {item.price != null && <p className="text-xs text-zinc-400">金額: ¥{item.price.toLocaleString()}</p>}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-400">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
            <User size={11} />顧客詳細
          </a>
          {nextStep && (
            <button onClick={() => {
              const patch: Record<string, unknown> = { status: nextStep.next }
              if (nextStep.next === 'arrived') { patch.arrived_date = new Date().toISOString().slice(0, 10); patch.notified = true }
              if (nextStep.next === 'delivered') patch.delivered_date = new Date().toISOString().slice(0, 10)
              update(patch)
            }} disabled={loading} className={`w-full py-2.5 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 ${nextStep.color}`}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
              {nextStep.label}
            </button>
          )}
          {item.status !== 'received' && item.status !== 'ordered' && (
            <button onClick={() => update({ status: 'received', arrived_date: null, delivered_date: null, notified: false })}
              disabled={loading} className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-xl transition-colors flex items-center justify-center gap-1">
              <RotateCcw size={11} />依頼受付に戻す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────
function OrderCard({ item, storeId, onRefresh, onToast }: {
  item: OrderRow; storeId: string; onRefresh: () => void; onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: OrderStatus) {
    setLoading(true)
    const { error } = await (supabase as any).from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onToast('ok', '更新しました'); onRefresh()
  }

  const totalItems = item.items?.length ?? 0
  const amount = item.total_amount ?? item.items?.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0) ?? 0

  return (
    <div className={`bg-zinc-900/60 border rounded-2xl overflow-hidden ${
      item.status === 'delivered' || item.status === 'cancelled' ? 'border-zinc-800/40 opacity-60' : 'border-zinc-700/50'
    }`}>
      <button className="w-full text-left p-4 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORDER_STATUS_COLORS[item.status]}`}>
              {ORDER_STATUS_LABELS[item.status]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_STATUS_COLORS[item.payment_status]}`}>
              {PAYMENT_STATUS_LABELS[item.payment_status]}
            </span>
            {item.order_number && <span className="text-xs font-mono text-zinc-500">#{item.order_number}</span>}
          </div>
          <p className="text-sm font-semibold text-zinc-100 mt-1.5 truncate">
            {item.customer?.name ?? '（顧客不明）'}
            {item.child && <span className="text-zinc-500 font-normal"> / {item.child.name}</span>}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{totalItems}点 {amount > 0 ? `/ ¥${amount.toLocaleString()}` : ''}</p>
          <p className="text-xs text-zinc-600 mt-0.5">{fmtDate(item.created_at)}</p>
        </div>
        {open ? <ChevronUp size={15} className="text-zinc-500 mt-1 shrink-0" /> : <ChevronDown size={15} className="text-zinc-500 mt-1 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60">
          {item.items && item.items.length > 0 && (
            <div className="space-y-1 pt-3">
              {item.items.map(i => (
                <div key={i.id} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="flex-1 truncate">{i.item_name}{i.size_label ? ` (${i.size_label})` : ''}</span>
                  <span>×{i.quantity}</span>
                  {i.unit_price && <span>¥{(i.unit_price * i.quantity).toLocaleString()}</span>}
                </div>
              ))}
            </div>
          )}
          {item.notes && <p className="text-xs text-zinc-400">{item.notes}</p>}
          {item.customer?.id && (
            <a href={`/${storeId}/admin/crm?customerId=${item.customer.id}`} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
              <User size={11} />顧客詳細
            </a>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {item.status === 'confirmed' && (
              <button onClick={() => updateStatus('processing')} disabled={loading}
                className="flex-1 py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1">
                <Package size={12} />手配中にする
              </button>
            )}
            {item.status === 'processing' && (
              <button onClick={() => updateStatus('ready')} disabled={loading}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1">
                <Check size={12} />準備完了にする
              </button>
            )}
            {item.status === 'ready' && (
              <button onClick={() => updateStatus('delivered')} disabled={loading}
                className="flex-1 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-1">
                <Truck size={12} />お渡し済みにする
              </button>
            )}
            {(item.status === 'processing' || item.status === 'ready') && (
              <button onClick={() => updateStatus('confirmed')} disabled={loading}
                className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-xl flex items-center gap-1">
                <RotateCcw size={11} />戻す
              </button>
            )}
          </div>
          <a href={`/${storeId}/admin/orders`}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-1">
            <ChevronRight size={11} />注文詳細を開く
          </a>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
type ActiveTab = 'repair' | 'purchase' | 'order'

export default function RepairsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [tab,       setTab]       = useState<ActiveTab>('repair')
  const [repairs,   setRepairs]   = useState<RepairRow[]>([])
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [orders,    setOrders]    = useState<OrderRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [toast,     setToast]     = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ type, msg })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchAll = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    setFetchError(null)
    const [
      { data: repairData, error: repairErr },
      { data: purchaseData, error: purchaseErr },
      { data: orderData },
    ] = await Promise.all([
      (supabase as any).from('repair_histories')
        .select('*, customer:customers(id,name,tel), child:children(name)')
        .eq('store_id', storeId).neq('status', 'delivered')
        .order('received_date', { ascending: true }),
      (supabase as any).from('purchase_orders')
        .select('*, customer:customers(id,name,tel), child:children(name)')
        .eq('store_id', storeId).neq('status', 'delivered')
        .order('ordered_date', { ascending: true }),
      (supabase as any).from('orders')
        .select('*, customer:customers(id,name), child:children(name), items:order_items(*)')
        .eq('store_id', storeId).not('status', 'in', '("delivered","cancelled")')
        .order('created_at', { ascending: false }),
    ])
    if (repairErr) setFetchError(repairErr.message)
    else if (purchaseErr) setFetchError(purchaseErr.message)
    setRepairs(repairData ?? [])
    setPurchases(purchaseData ?? [])
    setOrders(orderData ?? [])
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const repairCounts = {
    received:  repairs.filter(r => r.status === 'received').length,
    completed: repairs.filter(r => r.status === 'completed').length,
  }
  const purchaseCounts = {
    pending:  purchases.filter(p => ['received', 'ordered'].includes(p.status)).length,
    on_order: purchases.filter(p => p.status === 'on_order').length,
    arrived:  purchases.filter(p => p.status === 'arrived').length,
  }
  const orderCounts = {
    active:  orders.filter(o => ['confirmed', 'processing'].includes(o.status)).length,
    ready:   orders.filter(o => o.status === 'ready').length,
    unpaid:  orders.filter(o => o.payment_status === 'unpaid').length,
  }

  const totalBadge = (repairCounts.received + repairCounts.completed)
    + (purchaseCounts.pending + purchaseCounts.on_order + purchaseCounts.arrived)
    + orders.length

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Scissors size={17} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-zinc-100">お直し・注文管理</h1>
            </div>
            {totalBadge > 0 && (
              <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-black px-2 py-0.5 rounded-full">
                計{totalBadge}件
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-1">
            <button onClick={() => setTab('repair')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${tab === 'repair' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`}>
              <Scissors size={12} />お直し
              {(repairCounts.received + repairCounts.completed) > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'repair' ? 'bg-amber-500/30 text-amber-300' : 'bg-zinc-800 text-zinc-600'}`}>
                  {repairCounts.received + repairCounts.completed}
                </span>
              )}
            </button>
            <button onClick={() => setTab('purchase')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${tab === 'purchase' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`}>
              <ShoppingBag size={12} />追加購入
              {(purchaseCounts.pending + purchaseCounts.on_order + purchaseCounts.arrived) > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'purchase' ? 'bg-blue-500/30 text-blue-300' : 'bg-zinc-800 text-zinc-600'}`}>
                  {purchaseCounts.pending + purchaseCounts.on_order + purchaseCounts.arrived}
                </span>
              )}
            </button>
            <button onClick={() => setTab('order')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${tab === 'order' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`}>
              <ShoppingCart size={12} />注文管理
              {orders.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'order' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-zinc-800 text-zinc-600'}`}>
                  {orders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Error */}
        {fetchError && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 text-xs text-red-400">
            DBエラー: {fetchError}
          </div>
        )}

        {/* Stats */}
        {tab === 'repair' && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '預かり中', value: repairCounts.received, color: 'text-amber-400' },
              { label: '連絡済み', value: repairCounts.completed, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'purchase' && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '依頼中', value: purchaseCounts.pending, color: 'text-blue-400' },
              { label: '発注済み', value: purchaseCounts.on_order, color: 'text-orange-400' },
              { label: '入荷済み', value: purchaseCounts.arrived, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'order' && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '手配中', value: orderCounts.active, color: 'text-amber-400' },
              { label: '準備完了', value: orderCounts.ready, color: 'text-emerald-400' },
              { label: '未入金', value: orderCounts.unpaid, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-600">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : tab === 'repair' ? (
          repairs.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <Scissors size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">対応中のお直しはありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {repairs.map(r => (
                <RepairCard key={r.id} item={r} storeId={storeId} onRefresh={fetchAll} onToast={showToast} />
              ))}
            </div>
          )
        ) : tab === 'purchase' ? (
          purchases.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">対応中の追加購入はありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchases.map(p => (
                <PurchaseCard key={p.id} item={p} storeId={storeId} onRefresh={fetchAll} onToast={showToast} />
              ))}
            </div>
          )
        ) : (
          orders.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">対応中の注文はありません</p>
              <a href={`/${storeId}/admin/orders`}
                className="inline-flex items-center gap-1 mt-3 text-xs text-indigo-400 hover:text-indigo-300">
                注文一覧・新規注文を開く <ChevronRight size={12} />
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(o => (
                <OrderCard key={o.id} item={o} storeId={storeId} onRefresh={fetchAll} onToast={showToast} />
              ))}
              <a href={`/${storeId}/admin/orders`}
                className="flex items-center justify-center gap-1 py-3 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800/60 rounded-xl">
                注文一覧・新規注文を開く <ChevronRight size={12} />
              </a>
            </div>
          )
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <BottomNav />
    </div>
  )
}
