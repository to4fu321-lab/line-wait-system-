'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../_components/BottomNav'
import {
  ShoppingBag, Plus, ChevronDown, ChevronUp, Trash2,
  User, Package, CreditCard, Ruler, Weight, FileText, X
} from 'lucide-react'
import {
  Order, OrderItem, OrderStatus, PaymentStatus, OrderItemStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  ORDER_ITEM_STATUS_LABELS,
} from '@/types/orders'
import type { Customer, Child } from '@/types/crm'

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderFull extends Order {
  customer?: Customer
  child?: Child
  items?: OrderItem[]
}

type FilterTab = 'all' | 'active' | 'unpaid'

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type = 'ok', onUndo, onClose }: {
  msg: string; type?: 'ok' | 'err'; onUndo?: () => Promise<void>; onClose: () => void
}) {
  const [undoing, setUndoing] = useState(false)
  useEffect(() => {
    const t = setTimeout(onClose, onUndo ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [onClose, onUndo])
  const handleUndo = async () => {
    if (!onUndo || undoing) return
    setUndoing(true)
    await onUndo()
    onClose()
  }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl max-w-xs ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-200 border border-gray-300'
    }`}>
      <span className="flex-1">{msg}</span>
      {onUndo && (
        <button onClick={handleUndo} disabled={undoing}
          className="shrink-0 px-3 py-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-xs font-black active:scale-95 transition-all disabled:opacity-50">
          {undoing ? '…' : '取消し'}
        </button>
      )}
    </div>
  )
}

// ── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({
  orderId,
  onAdded,
  onCancel,
}: {
  orderId: string
  onAdded: () => void
  onCancel: () => void
}) {
  const [itemName, setItemName] = useState('')
  const [sizeLabel, setSizeLabel] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!itemName.trim()) return
    setSaving(true)
    await (supabase.from('order_items') as any).insert({
      order_id: orderId,
      item_name: itemName.trim(),
      size_label: sizeLabel.trim() || null,
      quantity,
      unit_price: unitPrice ? parseInt(unitPrice) : null,
      status: 'ordered',
    })
    setSaving(false)
    onAdded()
  }

  return (
    <div className="bg-gray-200/60 border border-gray-300/50 rounded-xl p-4 mt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">商品を追加</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <input
            type="text"
            placeholder="商品名 *"
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            className="w-full bg-white/80 border border-gray-300/50 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <input
          type="text"
          placeholder="サイズ"
          value={sizeLabel}
          onChange={e => setSizeLabel(e.target.value)}
          className="bg-white/80 border border-gray-300/50 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
        />
        <input
          type="number"
          placeholder="数量"
          min={1}
          value={quantity}
          onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="bg-white/80 border border-gray-300/50 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
        />
        <input
          type="number"
          placeholder="単価（円）"
          value={unitPrice}
          onChange={e => setUnitPrice(e.target.value)}
          className="bg-white/80 border border-gray-300/50 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={handleAdd}
          disabled={saving || !itemName.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saving ? '追加中…' : '追加'}
        </button>
      </div>
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────

const ORDER_STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  draft:      'confirmed',
  confirmed:  'processing',
  processing: 'ready',
  ready:      'delivered',
}

const PAYMENT_STATUS_NEXT: Partial<Record<PaymentStatus, PaymentStatus>> = {
  unpaid:  'partial',
  partial: 'paid',
}

const ITEM_STATUS_NEXT: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  ordered:   'on_order',
  on_order:  'stocked',
  stocked:   'ready',
  ready:     'delivered',
}

function OrderCard({
  order,
  onRefresh,
  onToast,
}: {
  order: OrderFull
  onRefresh: () => void
  onToast: (msg: string, undo?: () => Promise<void>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)

  const items = order.items ?? []
  const computedTotal = items.reduce(
    (sum, it) => sum + (it.unit_price ?? 0) * it.quantity,
    0
  )

  async function advanceStatus() {
    const next = ORDER_STATUS_NEXT[order.status]
    if (!next) return
    const prev = order.status
    await (supabase.from('orders') as any)
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    onRefresh()
    onToast(`${ORDER_STATUS_LABELS[next]}にしました`, async () => {
      await (supabase.from('orders') as any)
        .update({ status: prev, updated_at: new Date().toISOString() }).eq('id', order.id)
      onRefresh()
    })
  }

  async function advancePayment() {
    const next = PAYMENT_STATUS_NEXT[order.payment_status]
    if (!next) return
    const prev = order.payment_status
    await (supabase.from('orders') as any)
      .update({ payment_status: next, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    setConfirmPay(false)
    onRefresh()
    onToast(`支払いを「${PAYMENT_STATUS_LABELS[next]}」にしました`, async () => {
      await (supabase.from('orders') as any)
        .update({ payment_status: prev, updated_at: new Date().toISOString() }).eq('id', order.id)
      onRefresh()
    })
  }

  async function cancelOrder() {
    await (supabase.from('orders') as any)
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', order.id)
    setConfirmCancel(false)
    onToast('注文をキャンセルしました')
    onRefresh()
  }

  async function advanceItemStatus(item: OrderItem) {
    const next = ITEM_STATUS_NEXT[item.status]
    if (!next) return
    await (supabase.from('order_items') as any)
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    onToast(`${item.item_name} を「${ORDER_ITEM_STATUS_LABELS[next]}」に更新しました`)
    onRefresh()
  }

  async function deleteItem(item: OrderItem) {
    await (supabase.from('order_items') as any).delete().eq('id', item.id)
    onToast(`${item.item_name} を削除しました`)
    onRefresh()
  }

  const createdDate = new Date(order.created_at)
  const dateLabel = `${createdDate.getMonth() + 1}/${createdDate.getDate()} ${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`

  const isDone = order.status === 'delivered' || order.status === 'cancelled'

  return (
    <div className={`bg-white/80 border rounded-2xl overflow-hidden transition-all ${isDone ? 'border-gray-200/60 opacity-70' : 'border-gray-300/50'}`}>
      {/* Header */}
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {order.order_number && (
              <span className="text-xs font-mono text-gray-500">#{order.order_number}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
              {PAYMENT_STATUS_LABELS[order.payment_status]}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <User size={13} className="text-gray-500 shrink-0" />
            <span className="text-sm font-medium text-gray-900 truncate">
              {order.customer?.name ?? '（顧客未設定）'}
            </span>
            {order.child && (
              <span className="text-xs text-gray-500 truncate">/ {order.child.name}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>{dateLabel}</span>
            {items.length > 0 && (
              <span>{items.length}点</span>
            )}
            {computedTotal > 0 && (
              <span className="text-gray-700 font-medium">
                ¥{computedTotal.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-gray-500 mt-1 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-gray-500 mt-1 shrink-0" />
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200/60">
          {/* Meta */}
          {(order.height || order.weight || order.notes) && (
            <div className="pt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
              {order.height && (
                <div className="flex items-center gap-1.5">
                  <Ruler size={12} />
                  <span>身長: {order.height}cm</span>
                </div>
              )}
              {order.weight && (
                <div className="flex items-center gap-1.5">
                  <Weight size={12} />
                  <span>体重: {order.weight}kg</span>
                </div>
              )}
              {order.notes && (
                <div className="col-span-2 flex items-start gap-1.5">
                  <FileText size={12} className="mt-0.5 shrink-0" />
                  <span>{order.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div className="pt-2 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Package size={12} />
              注文明細
            </p>
            {items.length === 0 && (
              <p className="text-xs text-gray-500 italic">明細なし</p>
            )}
            {items.map(item => (
              <div
                key={item.id}
                className="bg-gray-200/40 border border-gray-300/40 rounded-xl p-3 flex items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-900">{item.item_name}</span>
                    {item.size_label && (
                      <span className="text-xs text-gray-500">{item.size_label}</span>
                    )}
                    <span className="text-xs text-gray-500">×{item.quantity}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ORDER_STATUS_COLORS[item.status === 'on_order' ? 'processing' : item.status === 'stocked' ? 'confirmed' : item.status === 'ready' ? 'ready' : item.status === 'delivered' ? 'delivered' : item.status === 'cancelled' ? 'cancelled' : 'draft']}`}>
                      {ORDER_ITEM_STATUS_LABELS[item.status]}
                    </span>
                    {item.unit_price != null && (
                      <span className="text-xs text-gray-500">¥{item.unit_price.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {ITEM_STATUS_NEXT[item.status] && !isDone && (
                    <button
                      onClick={() => advanceItemStatus(item)}
                      className="text-xs px-2 py-1 bg-gray-300/60 hover:bg-gray-400/60 text-gray-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {ORDER_ITEM_STATUS_LABELS[ITEM_STATUS_NEXT[item.status]!]}
                    </button>
                  )}
                  {!isDone && (
                    <button
                      onClick={() => deleteItem(item)}
                      className="text-xs px-2 py-1 text-red-500/70 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!isDone && !showAddItem && (
              <button
                onClick={() => setShowAddItem(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-gray-300/50 hover:border-indigo-500/40 rounded-xl text-xs text-gray-500 hover:text-indigo-400 transition-colors"
              >
                <Plus size={13} />
                商品を追加
              </button>
            )}

            {showAddItem && (
              <AddItemForm
                orderId={order.id}
                onAdded={() => { setShowAddItem(false); onRefresh() }}
                onCancel={() => setShowAddItem(false)}
              />
            )}
          </div>

          {/* Actions */}
          {!isDone && (
            <div className="pt-1 flex flex-wrap gap-2">
              {ORDER_STATUS_NEXT[order.status] && (
                <button
                  onClick={advanceStatus}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors"
                >
                  {ORDER_STATUS_LABELS[ORDER_STATUS_NEXT[order.status]!]} →
                </button>
              )}
              {PAYMENT_STATUS_NEXT[order.payment_status] && (
                PAYMENT_STATUS_NEXT[order.payment_status] === 'paid' ? (
                  confirmPay ? (
                    <div className="w-full flex items-center gap-2 bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3">
                      <span className="text-xs text-emerald-200 flex-1">支払い完了にしますか？</span>
                      <button onClick={() => setConfirmPay(false)} className="text-xs text-gray-500 px-2 py-1">戻る</button>
                      <button onClick={advancePayment} className="text-xs text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg flex items-center gap-1">
                        <CreditCard size={11} />支払い完了
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmPay(true)}
                      className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5">
                      <CreditCard size={13} />支払い完了にする
                    </button>
                  )
                ) : (
                  <button onClick={advancePayment}
                    className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5">
                    <CreditCard size={13} />
                    {PAYMENT_STATUS_LABELS[PAYMENT_STATUS_NEXT[order.payment_status]!]}
                  </button>
                )
              )}
              {!confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="py-2 px-3 bg-gray-200 hover:bg-red-900/40 text-gray-500 hover:text-red-400 text-xs rounded-xl transition-colors"
                >
                  キャンセル
                </button>
              ) : (
                <div className="w-full flex items-center gap-2 bg-red-900/20 border border-red-700/30 rounded-xl p-3">
                  <span className="text-xs text-red-300 flex-1">キャンセルしますか？</span>
                  <button onClick={() => setConfirmCancel(false)} className="text-xs text-gray-500 px-2 py-1">戻る</button>
                  <button onClick={cancelOrder} className="text-xs text-white bg-red-600 hover:bg-red-500 px-3 py-1 rounded-lg transition-colors">確定</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── New Order Form ────────────────────────────────────────────────────────────

function NewOrderForm({
  storeId,
  onCreated,
  onCancel,
}: {
  storeId: string
  onCreated: (orderId: string) => void
  onCancel: () => void
}) {
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!customerSearch.trim() || selectedCustomer) {
      setCustomers([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)
        .or(`name.ilike.%${customerSearch}%,kana.ilike.%${customerSearch}%`)
        .limit(8)
      setCustomers(data ?? [])
    }, 300)
  }, [customerSearch, selectedCustomer, storeId])

  useEffect(() => {
    if (!selectedCustomer) { setChildren([]); setSelectedChildId(''); return }
    supabase.from('children').select('*').eq('customer_id', selectedCustomer.id)
      .then(({ data }) => setChildren(data ?? []))
  }, [selectedCustomer])

  async function handleCreate() {
    setSaving(true)
    const { data, error } = await (supabase.from('orders') as any).insert({
      store_id: storeId,
      customer_id: selectedCustomer?.id ?? null,
      child_id: selectedChildId || null,
      height: height ? parseInt(height) : null,
      weight: weight ? parseInt(weight) : null,
      notes: notes.trim() || null,
      status: 'draft',
      payment_status: 'unpaid',
    }).select().single()
    setSaving(false)
    if (!error && data) onCreated(data.id)
  }

  return (
    <div className="bg-white/95 border border-gray-300/50 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">新規注文</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Customer search */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500">顧客</label>
        {selectedCustomer ? (
          <div className="flex items-center gap-2 bg-gray-200/60 border border-gray-300/50 rounded-xl px-3 py-2">
            <User size={13} className="text-indigo-400" />
            <span className="text-sm text-gray-900 flex-1">{selectedCustomer.name}</span>
            <button
              onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="名前・かな で検索"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              className="w-full bg-gray-200/60 border border-gray-300/50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
            />
            {customers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-200 border border-gray-300/50 rounded-xl overflow-hidden z-10 shadow-xl">
                {customers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomers([]) }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-300/60 transition-colors"
                  >
                    <div className="text-sm text-gray-900">{c.name}</div>
                    {c.kana && <div className="text-xs text-gray-500">{c.kana}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Child select */}
      {children.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500">お子様</label>
          <select
            value={selectedChildId}
            onChange={e => setSelectedChildId(e.target.value)}
            className="w-full bg-gray-200/60 border border-gray-300/50 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">選択しない</option>
            {children.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Height / Weight */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500 flex items-center gap-1"><Ruler size={11} />身長 (cm)</label>
          <input
            type="number"
            placeholder="例: 155"
            value={height}
            onChange={e => setHeight(e.target.value)}
            className="w-full bg-gray-200/60 border border-gray-300/50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500 flex items-center gap-1"><Weight size={11} />体重 (kg)</label>
          <input
            type="number"
            placeholder="例: 45"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full bg-gray-200/60 border border-gray-300/50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs text-gray-500 flex items-center gap-1"><FileText size={11} />メモ</label>
        <textarea
          placeholder="備考・ご要望など"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-gray-200/60 border border-gray-300/50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {saving ? '作成中…' : '注文を作成'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [orders, setOrders] = useState<OrderFull[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('active')
  const [showNewForm, setShowNewForm] = useState(false)
  const [toast, setToast] = useState<{ msg: string; onUndo?: () => Promise<void> } | null>(null)

  const showToast = useCallback((msg: string, onUndo?: () => Promise<void>) => {
    setToast({ msg, onUndo })
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)

    const { data: orderData } = await (supabase.from('orders') as any)
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!orderData) { setLoading(false); return }

    const customerIds = [...new Set(orderData.filter((o: Order) => o.customer_id).map((o: Order) => o.customer_id))]
    const childIds    = [...new Set(orderData.filter((o: Order) => o.child_id).map((o: Order) => o.child_id))]
    const orderIds    = orderData.map((o: Order) => o.id)

    const [{ data: customerData }, { data: childData }, { data: itemData }] = await Promise.all([
      customerIds.length > 0
        ? supabase.from('customers').select('*').in('id', customerIds as string[])
        : Promise.resolve({ data: [] }),
      childIds.length > 0
        ? supabase.from('children').select('*').in('id', childIds as string[])
        : Promise.resolve({ data: [] }),
      orderIds.length > 0
        ? (supabase.from('order_items') as any).select('*').in('order_id', orderIds as string[]).order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    const customerMap = Object.fromEntries((customerData ?? []).map((c: Customer) => [c.id, c]))
    const childMap    = Object.fromEntries((childData ?? []).map((c: Child) => [c.id, c]))
    const itemsMap: Record<string, OrderItem[]> = {}
    for (const item of (itemData ?? []) as OrderItem[]) {
      if (!itemsMap[item.order_id]) itemsMap[item.order_id] = []
      itemsMap[item.order_id].push(item)
    }

    const enriched: OrderFull[] = orderData.map((o: Order) => ({
      ...o,
      customer: o.customer_id ? customerMap[o.customer_id] : undefined,
      child:    o.child_id    ? childMap[o.child_id]       : undefined,
      items:    itemsMap[o.id] ?? [],
    }))

    setOrders(enriched)
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filteredOrders = orders.filter(o => {
    if (filterTab === 'active') return o.status !== 'delivered' && o.status !== 'cancelled'
    if (filterTab === 'unpaid') return o.payment_status !== 'paid' && o.status !== 'cancelled'
    return true
  })

  const activeCount  = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length
  const unpaidCount  = orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').length

  const FILTER_TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'active',  label: '未完了',   count: activeCount },
    { id: 'unpaid',  label: '入金待ち', count: unpaidCount },
    { id: 'all',     label: '全て' },
  ]

  function handleOrderCreated(orderId: string) {
    setShowNewForm(false)
    showToast('注文を作成しました')
    fetchOrders()
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur border-b border-gray-200/60">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ShoppingBag size={18} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">注文管理</h1>
              <p className="text-xs text-gray-500">{orders.length}件</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={15} />
            新規注文
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* New Order Form */}
        {showNewForm && (
          <NewOrderForm
            storeId={storeId}
            onCreated={handleOrderCreated}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-white/80 border border-gray-200/60 rounded-xl p-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                filterTab === tab.id
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filterTab === tab.id ? 'bg-indigo-500/30 text-indigo-300' : 'bg-gray-200/60 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '手配中', value: orders.filter(o => o.status === 'processing').length, color: 'text-amber-400' },
            { label: '準備完了', value: orders.filter(o => o.status === 'ready').length, color: 'text-emerald-400' },
            { label: '未入金', value: orders.filter(o => o.payment_status === 'unpaid' && o.status !== 'cancelled').length, color: 'text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/80 border border-gray-200/60 rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/80 border border-gray-200/60 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">注文がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onRefresh={fetchOrders}
                onToast={(msg, undo) => showToast(msg, undo)}
              />
            ))}
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} onUndo={toast.onUndo} onClose={() => setToast(null)} />}
      <BottomNav />
    </div>
  )
}
