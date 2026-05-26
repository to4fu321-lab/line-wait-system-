'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ffbixfbddxguhdhayqqy.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYml4ZmJkZHhndWhkaGF5cXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0NTI3NjgsImV4cCI6MjA1ODAyODc2OH0.nicSHNjMlnqDapnlKJ1y9fqbGfR7SfJ5-vdONzDR9sA'
)

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderFull extends Order {
  customer?: Customer
  child?: Child
  items?: OrderItem[]
}

type FilterTab = 'all' | 'active' | 'unpaid'

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm px-5 py-3 rounded-xl shadow-lg">
      {msg}
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
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-4 mt-3 space-y-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">商品を追加</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <input
            type="text"
            placeholder="商品名 *"
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <input
          type="text"
          placeholder="サイズ"
          value={sizeLabel}
          onChange={e => setSizeLabel(e.target.value)}
          className="bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
        />
        <input
          type="number"
          placeholder="数量"
          min={1}
          value={quantity}
          onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
        />
        <input
          type="number"
          placeholder="単価（円）"
          value={unitPrice}
          onChange={e => setUnitPrice(e.target.value)}
          className="bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
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
  onToast: (msg: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const items = order.items ?? []
  const computedTotal = items.reduce(
    (sum, it) => sum + (it.unit_price ?? 0) * it.quantity,
    0
  )

  async function advanceStatus() {
    const next = ORDER_STATUS_NEXT[order.status]
    if (!next) return
    await (supabase.from('orders') as any)
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    onToast(`ステータスを「${ORDER_STATUS_LABELS[next]}」に更新しました`)
    onRefresh()
  }

  async function advancePayment() {
    const next = PAYMENT_STATUS_NEXT[order.payment_status]
    if (!next) return
    await (supabase.from('orders') as any)
      .update({ payment_status: next, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    onToast(`支払いを「${PAYMENT_STATUS_LABELS[next]}」に更新しました`)
    onRefresh()
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
    <div className={`bg-zinc-900/60 border rounded-2xl overflow-hidden transition-all ${isDone ? 'border-zinc-800/60 opacity-70' : 'border-zinc-700/50'}`}>
      {/* Header */}
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {order.order_number && (
              <span className="text-xs font-mono text-zinc-500">#{order.order_number}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
              {PAYMENT_STATUS_LABELS[order.payment_status]}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <User size={13} className="text-zinc-500 shrink-0" />
            <span className="text-sm font-medium text-zinc-100 truncate">
              {order.customer?.name ?? '（顧客未設定）'}
            </span>
            {order.child && (
              <span className="text-xs text-zinc-500 truncate">/ {order.child.name}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
            <span>{dateLabel}</span>
            {items.length > 0 && (
              <span>{items.length}点</span>
            )}
            {computedTotal > 0 && (
              <span className="text-zinc-300 font-medium">
                ¥{computedTotal.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-zinc-500 mt-1 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-zinc-500 mt-1 shrink-0" />
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800/60">
          {/* Meta */}
          {(order.height || order.weight || order.notes) && (
            <div className="pt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
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
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
              <Package size={12} />
              注文明細
            </p>
            {items.length === 0 && (
              <p className="text-xs text-zinc-600 italic">明細なし</p>
            )}
            {items.map(item => (
              <div
                key={item.id}
                className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3 flex items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-zinc-100">{item.item_name}</span>
                    {item.size_label && (
                      <span className="text-xs text-zinc-500">{item.size_label}</span>
                    )}
                    <span className="text-xs text-zinc-500">×{item.quantity}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ORDER_STATUS_COLORS[item.status === 'on_order' ? 'processing' : item.status === 'stocked' ? 'confirmed' : item.status === 'ready' ? 'ready' : item.status === 'delivered' ? 'delivered' : item.status === 'cancelled' ? 'cancelled' : 'draft']}`}>
                      {ORDER_ITEM_STATUS_LABELS[item.status]}
                    </span>
                    {item.unit_price != null && (
                      <span className="text-xs text-zinc-400">¥{item.unit_price.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {ITEM_STATUS_NEXT[item.status] && !isDone && (
                    <button
                      onClick={() => advanceItemStatus(item)}
                      className="text-xs px-2 py-1 bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-300 rounded-lg transition-colors whitespace-nowrap"
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
                className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-zinc-700/50 hover:border-indigo-500/40 rounded-xl text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
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
                <button
                  onClick={advancePayment}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <CreditCard size={13} />
                  {PAYMENT_STATUS_LABELS[PAYMENT_STATUS_NEXT[order.payment_status]!]}
                </button>
              )}
              {!confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="py-2 px-3 bg-zinc-800 hover:bg-red-900/40 text-zinc-500 hover:text-red-400 text-xs rounded-xl transition-colors"
                >
                  キャンセル
                </button>
              ) : (
                <div className="w-full flex items-center gap-2 bg-red-900/20 border border-red-700/30 rounded-xl p-3">
                  <span className="text-xs text-red-300 flex-1">キャンセルしますか？</span>
                  <button onClick={() => setConfirmCancel(false)} className="text-xs text-zinc-400 px-2 py-1">戻る</button>
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
    <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">新規注文</h3>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Customer search */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">顧客</label>
        {selectedCustomer ? (
          <div className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2">
            <User size={13} className="text-indigo-400" />
            <span className="text-sm text-zinc-100 flex-1">{selectedCustomer.name}</span>
            <button
              onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
              className="text-zinc-500 hover:text-zinc-300"
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
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
            />
            {customers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700/50 rounded-xl overflow-hidden z-10 shadow-xl">
                {customers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomers([]) }}
                    className="w-full text-left px-3 py-2.5 hover:bg-zinc-700/60 transition-colors"
                  >
                    <div className="text-sm text-zinc-100">{c.name}</div>
                    {c.kana && <div className="text-xs text-zinc-500">{c.kana}</div>}
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
          <label className="text-xs text-zinc-400">お子様</label>
          <select
            value={selectedChildId}
            onChange={e => setSelectedChildId(e.target.value)}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/50"
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
          <label className="text-xs text-zinc-400 flex items-center gap-1"><Ruler size={11} />身長 (cm)</label>
          <input
            type="number"
            placeholder="例: 155"
            value={height}
            onChange={e => setHeight(e.target.value)}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 flex items-center gap-1"><Weight size={11} />体重 (kg)</label>
          <input
            type="number"
            placeholder="例: 45"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs text-zinc-400 flex items-center gap-1"><FileText size={11} />メモ</label>
        <textarea
          placeholder="備考・ご要望など"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
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
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ShoppingBag size={18} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-100">注文管理</h1>
              <p className="text-xs text-zinc-500">{orders.length}件</p>
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
        <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                filterTab === tab.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filterTab === tab.id ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800/60 text-zinc-600'
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
            <div key={stat.label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
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
                onToast={showToast}
              />
            ))}
          </div>
        )}
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
