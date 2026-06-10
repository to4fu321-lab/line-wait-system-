'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Loader2, Package, Pencil, Trash2,
  X, Check, Plus, RotateCcw, ChevronDown, ChevronUp,
  Phone, User, Filter,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { checkNewStudentConflicts } from '@/lib/uniformAllocation'
import type { ConflictItem } from '@/lib/uniformAllocation'
import { AllocationWarningModal } from '../repairs/_components/AllocationWarningModal'
import { BottomNav } from '../_components/BottomNav'

// ── 型定義 ──────────────────────────────────────────────────
interface OrderItem {
  id: string
  item_name: string
  size_label: string | null
  quantity: number
  unit_price: number | null
}

interface UniformOrder {
  id: string
  store_id: string
  customer_id: string
  child_id: string | null
  priority: 'new_student' | 'normal'
  status: string
  payment_status: string
  total_amount: number | null
  notes: string | null
  expected_delivery_date: string | null
  created_at: string
  updated_at: string
  customer: { id: string; name: string; tel: string | null } | null
  child: { name: string; school_name: string | null } | null
  items: OrderItem[]
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: '受注済み', ordered: '発注済み', arrived: '入荷済み', delivered: 'お渡し済み',
}
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-orange-100 text-orange-700 border-orange-200',
  ordered:   'bg-blue-100 text-blue-700 border-blue-200',
  arrived:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  delivered: 'bg-gray-100 text-gray-500 border-gray-200',
}
const STATUS_ACCENTS: Record<string, string> = {
  confirmed: 'bg-orange-400', ordered: 'bg-blue-400', arrived: 'bg-emerald-400', delivered: 'bg-gray-300',
}
const PAY_LABELS: Record<string, string> = { unpaid: '未払い', partial: '内金あり', paid: '支払済み' }
const PAY_COLORS: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-500 border-red-200',
  partial: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
}

// ── Toast ────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'ok'|'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl ${
      type === 'err' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
    }`}>{msg}</div>
  )
}

// ── EditOrderModal ────────────────────────────────────────────
function EditOrderModal({
  order, onSaved, onClose,
}: {
  order: UniformOrder
  onSaved: (updated: UniformOrder) => void
  onClose: () => void
}) {
  const [notes,     setNotes]     = useState(order.notes ?? '')
  const [dueDate,   setDueDate]   = useState(order.expected_delivery_date ?? '')
  const [payStatus, setPayStatus] = useState(order.payment_status ?? 'unpaid')
  const [items,     setItems]     = useState<OrderItem[]>(order.items.map(i => ({ ...i })))
  const [saving,    setSaving]    = useState(false)
  const [newItem,   setNewItem]   = useState<{ item_name: string; size_label: string; quantity: string; unit_price: string } | null>(null)

  const total = items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0)

  async function save() {
    setSaving(true)
    const { error: orderErr } = await (supabase as any).from('uniform_orders').update({
      notes: notes.trim() || null,
      expected_delivery_date: dueDate || null,
      payment_status: payStatus,
      total_amount: total || null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)
    if (orderErr) { setSaving(false); return }

    // 全削除→再挿入
    await (supabase as any).from('uniform_order_items').delete().eq('order_id', order.id)
    if (items.length > 0) {
      await (supabase as any).from('uniform_order_items').insert(
        items.map(item => ({
          order_id: order.id,
          item_name: item.item_name,
          size_label: item.size_label || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))
      )
    }
    setSaving(false)
    onSaved({ ...order, notes: notes.trim() || null, expected_delivery_date: dueDate || null,
      payment_status: payStatus, total_amount: total || null, items })
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: keyof OrderItem, val: string | number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }
  function addNewItem() {
    if (!newItem?.item_name.trim()) return
    setItems(prev => [...prev, {
      id: crypto.randomUUID(), item_name: newItem.item_name.trim(),
      size_label: newItem.size_label.trim() || null,
      quantity: parseInt(newItem.quantity) || 1,
      unit_price: newItem.unit_price ? parseInt(newItem.unit_price) : null,
    }])
    setNewItem(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '90dvh' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">注文を編集</h2>
            <p className="text-xs text-gray-500">{order.child?.name ?? order.customer?.name ?? '顧客不明'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Items */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">注文商品</p>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <input value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)}
                      className="w-full text-xs font-bold bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400 pb-0.5"
                      placeholder="商品名" />
                    <div className="flex gap-2 mt-1">
                      <input value={item.size_label ?? ''} onChange={e => updateItem(idx, 'size_label', e.target.value)}
                        className="w-20 text-xs bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400"
                        placeholder="サイズ" />
                      <input type="number" value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-12 text-xs bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400 text-center"
                        min="1" />
                      <span className="text-xs text-gray-400">× ¥</span>
                      <input type="number" value={item.unit_price ?? ''}
                        onChange={e => updateItem(idx, 'unit_price', e.target.value ? parseInt(e.target.value) : 0)}
                        className="w-24 text-xs bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400"
                        placeholder="単価" />
                    </div>
                  </div>
                  <button onClick={() => removeItem(idx)}
                    className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {newItem ? (
              <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 space-y-2">
                <input value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p!, item_name: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                  placeholder="商品名 *" autoFocus />
                <div className="flex gap-2">
                  <input value={newItem.size_label} onChange={e => setNewItem(p => ({ ...p!, size_label: e.target.value }))}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                    placeholder="サイズ" />
                  <input type="number" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p!, quantity: e.target.value }))}
                    className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 text-center"
                    placeholder="数" min="1" />
                  <input type="number" value={newItem.unit_price} onChange={e => setNewItem(p => ({ ...p!, unit_price: e.target.value }))}
                    className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                    placeholder="単価 ¥" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setNewItem(null)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600">キャンセル</button>
                  <button onClick={addNewItem} disabled={!newItem.item_name.trim()}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-40">追加</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setNewItem({ item_name: '', size_label: '', quantity: '1', unit_price: '' })}
                className="w-full mt-2 py-2 rounded-xl border border-dashed border-indigo-300 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1 hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <Plus size={12} />商品を追加
              </button>
            )}
            {items.length > 0 && (
              <p className="text-right text-xs font-black text-gray-700 mt-2">合計: ¥{total.toLocaleString()}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">メモ・備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">希望お渡し日</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-2">支払い状況</label>
            <div className="flex gap-2">
              {[['unpaid', '未払い'], ['partial', '内金あり'], ['paid', '支払済み']].map(([v, l]) => (
                <button key={v} onClick={() => setPayStatus(v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    payStatus === v ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
          <button onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-xl font-black text-sm bg-indigo-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" />保存中...</> : <><Check size={16} />保存する</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OrderCard ─────────────────────────────────────────────────
function OrderCard({
  order, storeId, onStatusChange, onEdit, onDelete,
}: {
  order: UniformOrder
  storeId: string
  onStatusChange: (id: string, status: string, msg: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open,          setOpen]          = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [conflicts,     setConflicts]     = useState<ConflictItem[] | null>(null)

  const name = order.child?.name ?? order.customer?.name ?? '（顧客不明）'
  const isNew = order.priority === 'new_student'

  async function doStatus(newStatus: string, msg: string) {
    setLoading(true)
    await onStatusChange(order.id, newStatus, msg)
    setLoading(false)
  }

  async function handleArrived() {
    if (!isNew) {
      setLoading(true)
      const found = await checkNewStudentConflicts(order.id, storeId)
      setLoading(false)
      if (found.length > 0) { setConflicts(found); return }
    }
    await doStatus('arrived', '入荷完了にしました')
  }

  return (
    <>
      {conflicts && (
        <AllocationWarningModal
          conflicts={conflicts}
          onProceed={async () => { setConflicts(null); await doStatus('arrived', '入荷完了にしました') }}
          onCancel={() => setConflicts(null)}
        />
      )}
    <div className={`border rounded-2xl overflow-hidden bg-white shadow-sm ${isNew ? 'border-orange-300' : 'border-gray-200'}`}>
      <div className={`h-1 w-full ${isNew ? 'bg-orange-500' : STATUS_ACCENTS[order.status] ?? 'bg-gray-200'}`} />
      <button className="w-full text-left px-4 pt-3 pb-3 flex items-start gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold">制服注文</span>
            {isNew && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 font-black">🌸 新入生</span>}
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${STATUS_COLORS[order.status] ?? ''}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${PAY_COLORS[order.payment_status] ?? ''}`}>
              {PAY_LABELS[order.payment_status] ?? order.payment_status}
            </span>
          </div>
          <p className="text-sm font-black text-gray-900 leading-snug mb-0.5">
            {order.items.length > 0
              ? order.items.map(i => i.item_name).join('・')
              : '（商品なし）'}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {order.child?.school_name && (
              <span className="text-[11px] font-black text-amber-600">{order.child.school_name}</span>
            )}
            <span className="text-sm font-bold text-gray-800">{name}</span>
            {order.child && order.customer && (
              <span className="text-[11px] text-gray-400">（保護者: {order.customer.name}）</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {order.total_amount != null && (
              <span className="text-sm font-black text-gray-600">¥{order.total_amount.toLocaleString()}</span>
            )}
            <span className="text-[10px] text-gray-400">注文日 {order.created_at?.slice(0, 10)}</span>
            {order.expected_delivery_date && (
              <span className="text-[10px] text-gray-400">希望日 {order.expected_delivery_date}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 self-center ml-1">
          {open ? <ChevronUp size={15} className="text-gray-300" /> : <ChevronDown size={15} className="text-gray-300" />}
        </div>
      </button>

      {/* Status action buttons */}
      <div className="px-4 pb-3 space-y-2">
        {order.status === 'confirmed' && (
          <button onClick={() => doStatus('ordered', '発注済みにしました')} disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-orange-600 hover:bg-orange-500 flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-orange-200 active:scale-[0.98] transition-all">
            {loading ? <Loader2 size={16} className="animate-spin" /> : '🚚 発注する'}
          </button>
        )}
        {order.status === 'ordered' && (
          <button onClick={handleArrived} disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-200 active:scale-[0.98] transition-all">
            {loading ? <Loader2 size={16} className="animate-spin" /> : '📦 入荷完了（お渡し待ちへ）'}
          </button>
        )}
        {order.status === 'arrived' && (
          <button onClick={() => doStatus('delivered', 'お渡し済みにしました')} disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-gray-700 hover:bg-gray-600 flex items-center justify-center gap-2 disabled:opacity-50 shadow-md active:scale-[0.98] transition-all">
            {loading ? <Loader2 size={16} className="animate-spin" /> : '✅ お渡し済みにする'}
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2.5">
          {order.items.length > 0 && (
            <div className="bg-gray-50 rounded-xl px-3 py-2 space-y-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium">{item.item_name}{item.size_label ? ` (${item.size_label})` : ''}</span>
                  <span className="text-gray-500">×{item.quantity}{item.unit_price != null ? ` ¥${item.unit_price.toLocaleString()}` : ''}</span>
                </div>
              ))}
            </div>
          )}
          {order.notes && (
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">📝 {order.notes}</p>
          )}

          {/* Contact + CRM link */}
          <div className="flex items-center gap-3 flex-wrap">
            {order.customer?.tel && (
              <a href={`tel:${order.customer.tel}`}
                className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                <Phone size={12} />{order.customer.tel}
              </a>
            )}
            <a href={`/${storeId}/admin/crm`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium">
              <User size={11} />CRM
            </a>
          </div>

          {/* Revert */}
          {order.status !== 'confirmed' && order.status !== 'delivered' && (
            <button onClick={() => doStatus('confirmed', '受注済みに戻しました')} disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-all">
              <RotateCcw size={11} />受注済みに戻す
            </button>
          )}
          {order.status === 'delivered' && (
            <button onClick={() => doStatus('arrived', '入荷済みに戻しました')} disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-all">
              <RotateCcw size={11} />入荷済みに戻す
            </button>
          )}

          {/* Edit */}
          <button onClick={onEdit}
            className="w-full py-2.5 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 active:scale-95 transition-all">
            <Pencil size={11} />注文内容を変更する
          </button>

          {/* Delete */}
          {confirmDelete ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 space-y-2.5">
              <p className="text-sm text-red-700 font-black text-center">本当に削除しますか？</p>
              <p className="text-[10px] text-red-400 text-center">この操作は取り消せません</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                <button onClick={onDelete} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-black flex items-center justify-center gap-1 disabled:opacity-50">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} />削除する</>}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-red-200 bg-red-50 text-red-500 flex items-center justify-center gap-1.5 hover:bg-red-100 active:scale-95 transition-all">
              <Trash2 size={11} />キャンセル（削除）
            </button>
          )}
        </div>
      )}
    </div>
    </>
  )
}

// ============================================================
// 注文管理ページ
// ============================================================
export default function OrdersPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()

  const [orders,      setOrders]      = useState<UniformOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [searchText,  setSearchText]  = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [payFilter,   setPayFilter]   = useState<string>('all')
  const [toast,       setToast]       = useState<{ type: 'ok'|'err'; msg: string } | null>(null)
  const [editOrder,   setEditOrder]   = useState<UniformOrder | null>(null)

  const showToast = useCallback((type: 'ok'|'err', msg: string) => {
    setToast({ type, msg })
  }, [])

  const fetchOrders = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('uniform_orders')
      .select('*, priority, customer:customers(id,name,tel), child:children(name,school_name), items:uniform_order_items(id,item_name,size_label,quantity,unit_price)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
    if (error) { showToast('err', `読み込みに失敗: ${error.message}`); setLoading(false); return }
    setOrders(data ?? [])
    setLoading(false)
  }, [storeId, showToast])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter)
    if (payFilter !== 'all') list = list.filter(o => o.payment_status === payFilter)
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter(o =>
        o.customer?.name?.toLowerCase().includes(q) ||
        o.child?.name?.toLowerCase().includes(q) ||
        o.child?.school_name?.toLowerCase().includes(q) ||
        o.items?.some(i => i.item_name.toLowerCase().includes(q)) ||
        o.notes?.toLowerCase().includes(q)
      )
    }
    return list
  }, [orders, statusFilter, payFilter, searchText])

  const counts = useMemo(() => ({
    all:       orders.length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    ordered:   orders.filter(o => o.status === 'ordered').length,
    arrived:   orders.filter(o => o.status === 'arrived').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }), [orders])

  const totalAmount = useMemo(() =>
    filtered.reduce((s, o) => s + (o.total_amount ?? 0), 0),
  [filtered])

  async function handleStatusChange(id: string, newStatus: string, msg: string) {
    const { error } = await (supabase as any).from('uniform_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast('err', '更新に失敗しました'); return }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
    showToast('ok', msg)
  }

  async function handleDelete(id: string) {
    await (supabase as any).from('uniform_order_items').delete().eq('order_id', id)
    const { error } = await (supabase as any).from('uniform_orders').delete().eq('id', id)
    if (error) { showToast('err', '削除に失敗しました'); return }
    setOrders(prev => prev.filter(o => o.id !== id))
    showToast('ok', '注文を削除しました')
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {editOrder && (
        <EditOrderModal
          order={editOrder}
          onSaved={updated => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
            setEditOrder(null)
            showToast('ok', '注文を更新しました')
          }}
          onClose={() => setEditOrder(null)}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.back()}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-95 transition-all">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <h1 className="font-black text-gray-900 text-base flex items-center gap-2">
                <Package size={16} className="text-indigo-600" />制服注文管理
              </h1>
              <p className="text-gray-500 text-xs">{counts.all}件 · 合計 ¥{totalAmount.toLocaleString()}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="顧客名・お子様名・学校・商品名"
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-9 py-2.5 text-sm focus:border-indigo-500 focus:outline-none shadow-sm" />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'all',       label: `全て (${counts.all})` },
              { id: 'confirmed', label: `受注 (${counts.confirmed})` },
              { id: 'ordered',   label: `発注 (${counts.ordered})` },
              { id: 'arrived',   label: `入荷 (${counts.arrived})` },
              { id: 'delivered', label: `渡済 (${counts.delivered})` },
            ].map(t => (
              <button key={t.id} onClick={() => setStatusFilter(t.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === t.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>{t.label}</button>
            ))}
            {/* Payment filter */}
            <select value={payFilter} onChange={e => setPayFilter(e.target.value)}
              className="shrink-0 ml-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-500 focus:outline-none focus:border-indigo-400">
              <option value="all">支払: 全て</option>
              <option value="unpaid">未払い</option>
              <option value="partial">内金あり</option>
              <option value="paid">支払済み</option>
            </select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-400">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-xs font-bold text-gray-400">読み込み中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">{searchText || statusFilter !== 'all' || payFilter !== 'all'
              ? '条件に一致する注文がありません'
              : '注文はまだありません'}</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold text-gray-500 px-1">{filtered.length}件表示中</p>
            {filtered.map(o => (
              <OrderCard
                key={o.id}
                order={o}
                storeId={storeId}
                onStatusChange={handleStatusChange}
                onEdit={() => setEditOrder(o)}
                onDelete={() => handleDelete(o.id)}
              />
            ))}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
