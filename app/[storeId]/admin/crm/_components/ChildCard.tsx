'use client'

import { useState, useCallback } from 'react'
import {
  Loader2, Plus, GraduationCap, Scissors, ShoppingBag,
  ChevronDown, ChevronUp, Pencil, X, Check, Package,
  Ruler, RotateCcw, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Child, RepairHistory, PurchaseOrder } from '@/types/crm'
import type { IntakeFormType } from './types'
import { RepairItem } from './RepairItem'
import { PurchaseItem } from './PurchaseItem'
import { NewIntakeForm } from './NewIntakeForm'

// ── 型定義 ──────────────────────────────────────────────────
interface UniformOrderItem {
  id: string
  item_name: string
  size_label: string | null
  quantity: number
  unit_price: number | null
}

interface UniformOrderLocal {
  id: string
  status: string
  payment_status: string
  total_amount: number | null
  notes: string | null
  expected_delivery_date: string | null
  created_at: string
  updated_at: string
  items: UniformOrderItem[]
}

interface MeasurementLocal {
  id: string
  measured_date: string | null
  height_cm: number | null
  weight_kg: number | null
  confirmed_sizes: Record<string, unknown> | null
  staff_memo: string | null
  status: string | null
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

// ── EditUniformOrderModal ─────────────────────────────────────
function EditUniformOrderModal({
  order, onSaved, onClose,
}: {
  order: UniformOrderLocal
  onSaved: (updated: UniformOrderLocal) => void
  onClose: () => void
}) {
  const [notes,      setNotes]      = useState(order.notes ?? '')
  const [dueDate,    setDueDate]    = useState(order.expected_delivery_date ?? '')
  const [payStatus,  setPayStatus]  = useState(order.payment_status ?? 'unpaid')
  const [items,      setItems]      = useState<UniformOrderItem[]>(order.items.map(i => ({ ...i })))
  const [saving,     setSaving]     = useState(false)
  const [newItem,    setNewItem]    = useState<{ item_name: string; size_label: string; quantity: string; unit_price: string } | null>(null)

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
    onSaved({
      ...order,
      notes: notes.trim() || null,
      expected_delivery_date: dueDate || null,
      payment_status: payStatus,
      total_amount: total || null,
      items,
    })
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: keyof UniformOrderItem, value: string | number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }
  function addNewItem() {
    if (!newItem || !newItem.item_name.trim()) return
    const id = crypto.randomUUID()
    setItems(prev => [...prev, {
      id,
      item_name: newItem.item_name.trim(),
      size_label: newItem.size_label.trim() || null,
      quantity: parseInt(newItem.quantity) || 1,
      unit_price: newItem.unit_price ? parseInt(newItem.unit_price) : null,
    }])
    setNewItem(null)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '90dvh' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-black text-gray-900">制服注文を編集</h2>
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
                    <input value={item.item_name}
                      onChange={e => updateItem(idx, 'item_name', e.target.value)}
                      className="w-full text-xs font-bold bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400 pb-0.5"
                      placeholder="商品名" />
                    <div className="flex gap-2 mt-1">
                      <input value={item.size_label ?? ''}
                        onChange={e => updateItem(idx, 'size_label', e.target.value)}
                        className="w-20 text-xs bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400"
                        placeholder="サイズ" />
                      <input type="number" value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-12 text-xs bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400 text-center"
                        placeholder="数" min="1" />
                      <span className="text-xs text-gray-400">× ¥</span>
                      <input type="number" value={item.unit_price ?? ''}
                        onChange={e => updateItem(idx, 'unit_price', e.target.value ? parseInt(e.target.value) : 0)}
                        className="w-20 text-xs bg-transparent border-b border-gray-200 focus:outline-none focus:border-indigo-400"
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

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">メモ・備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 resize-none" />
          </div>

          {/* Expected delivery date */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">希望お渡し日</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400" />
          </div>

          {/* Payment status */}
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

// ============================================================
// お子様カード（展開可能）
// ============================================================
export function ChildCard({
  child, customerId, storeId,
  onRepairComplete, onRepairDeliver, onRepairRevert,
  onPurchaseStock, onPurchaseBackOrder,
  onPurchaseArrive, onPurchaseDeliver, onPurchaseRevert,
  onRefreshStats,
  showToast, defaultIntakeType, reservationUrl,
}: {
  child: Child
  customerId: string
  storeId: string
  defaultIntakeType?: IntakeFormType
  reservationUrl?: string | null
  onRepairComplete:    (id: string) => Promise<void>
  onRepairDeliver:     (id: string) => Promise<void>
  onRepairRevert:      (id: string) => Promise<void>
  onPurchaseStock:     (id: string) => Promise<void>
  onPurchaseBackOrder: (id: string) => Promise<void>
  onPurchaseArrive:    (id: string) => Promise<void>
  onPurchaseDeliver:   (id: string) => Promise<void>
  onPurchaseRevert:    (id: string) => Promise<void>
  onRefreshStats:      () => void
  showToast:           (type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => void
  schoolOptions?:      string[]
}) {
  const [expanded,      setExpanded]      = useState(false)
  const [repairs,       setRepairs]       = useState<RepairHistory[]>([])
  const [purchases,     setPurchases]     = useState<PurchaseOrder[]>([])
  const [uniformOrders, setUniformOrders] = useState<UniformOrderLocal[]>([])
  const [measurements,  setMeasurements]  = useState<MeasurementLocal[]>([])
  const [loading,       setLoading]       = useState(false)
  const [showNewIntake, setShowNewIntake] = useState(false)
  const [editOrder,     setEditOrder]     = useState<UniformOrderLocal | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: p }, { data: u }, { data: m }] = await Promise.all([
      supabase.from('repair_histories').select('*').eq('child_id', child.id).order('received_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('child_id', child.id).order('ordered_date', { ascending: false }),
      (supabase as any).from('uniform_orders')
        .select('*, items:uniform_order_items(id,item_name,size_label,quantity,unit_price)')
        .eq('child_id', child.id)
        .order('created_at', { ascending: false }),
      (supabase as any).from('measurements')
        .select('id,measured_date,height_cm,weight_kg,confirmed_sizes,staff_memo,status')
        .eq('child_id', child.id)
        .order('measured_date', { ascending: false }),
    ])
    setRepairs(r ?? [])
    setPurchases(p ?? [])
    setUniformOrders(u ?? [])
    setMeasurements(m ?? [])
    setLoading(false)
  }, [child.id])

  const handleExpand = () => {
    if (!expanded) fetchData()
    setExpanded(v => !v)
  }

  async function updateOrderStatus(orderId: string, newStatus: string, msg: string) {
    const { error } = await (supabase as any).from('uniform_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId)
    if (error) { showToast('err', '更新に失敗しました'); return }
    setUniformOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    showToast('ok', msg)
  }

  async function deleteOrder(orderId: string) {
    await (supabase as any).from('uniform_order_items').delete().eq('order_id', orderId)
    const { error } = await (supabase as any).from('uniform_orders').delete().eq('id', orderId)
    if (error) { showToast('err', '削除に失敗しました'); return }
    setUniformOrders(prev => prev.filter(o => o.id !== orderId))
    showToast('ok', '注文を削除しました')
  }

  return (
    <>
      {editOrder && (
        <EditUniformOrderModal
          order={editOrder}
          onSaved={updated => {
            setUniformOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
            setEditOrder(null)
            showToast('ok', '注文を更新しました')
          }}
          onClose={() => setEditOrder(null)}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={handleExpand} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
            <GraduationCap size={16} className="text-indigo-700" />
          </div>
          <div className="flex-1 min-w-0">
            {child.school_name && (
              <p className="font-black text-amber-600 text-xs leading-tight truncate">
                {[child.school_name, child.grade].filter(Boolean).join(' ')}
              </p>
            )}
            <p className="font-black text-gray-900 text-xl leading-tight truncate">{child.name}</p>
            {!child.school_name && child.grade && (
              <p className="text-gray-500 text-xs">{child.grade}</p>
            )}
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-indigo-600" /></div>
            ) : (
              <>
                {/* 依頼受付ボタン */}
                {showNewIntake ? (
                  <div>
                    <NewIntakeForm storeId={storeId} customerId={customerId} childId={child.id}
                      defaultType={defaultIntakeType ?? 'repair'}
                      reservationUrl={reservationUrl}
                      onSaved={() => { setShowNewIntake(false); fetchData(); onRefreshStats(); showToast('ok', '依頼を受け付けました') }}
                      onCancel={() => setShowNewIntake(false)} />
                  </div>
                ) : (
                  <button onClick={() => setShowNewIntake(true)}
                    className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40">
                    <Plus size={16} />依頼を受け付ける
                  </button>
                )}

                {/* 制服注文履歴 */}
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Package size={11} />制服注文 ({uniformOrders.length}件)
                  </p>
                  {uniformOrders.length === 0 ? (
                    <p className="text-gray-300 text-xs text-center py-2">制服注文はありません</p>
                  ) : (
                    <div className="space-y-2">
                      {uniformOrders.map(o => (
                        <UniformOrderInlineCard
                          key={o.id}
                          order={o}
                          onStatusChange={updateOrderStatus}
                          onEdit={() => setEditOrder(o)}
                          onDelete={() => deleteOrder(o.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* 採寸履歴 */}
                {measurements.length > 0 && (
                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Ruler size={11} />採寸履歴 ({measurements.length}件)
                    </p>
                    <div className="space-y-1.5">
                      {measurements.map(m => (
                        <div key={m.id} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {m.measured_date && <span className="text-[10px] font-bold text-gray-500">{m.measured_date}</span>}
                            {m.height_cm && <span className="text-xs text-gray-700">身長 {m.height_cm}cm</span>}
                            {m.weight_kg && <span className="text-xs text-gray-700">体重 {m.weight_kg}kg</span>}
                            {m.status && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                m.status === 'ordered' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
                              }`}>{m.status === 'ordered' ? '注文済み' : m.status === 'measured' ? '採寸済み' : m.status}</span>
                            )}
                          </div>
                          {m.confirmed_sizes && Object.keys(m.confirmed_sizes).length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-1">
                              {Object.entries(m.confirmed_sizes).map(([k, v]) => {
                                const label = typeof v === 'object' && v !== null
                                  ? ((v as Record<string, unknown>).size_label as string ?? JSON.stringify(v))
                                  : String(v)
                                return (
                                  <span key={k} className="text-[10px] bg-white border border-gray-200 rounded-full px-2 py-0.5">
                                    {k}: {label}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                          {m.staff_memo && <p className="text-[10px] text-gray-500 mt-1">{m.staff_memo}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* お直し履歴 */}
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Scissors size={11} />依頼履歴 ({repairs.length}件)
                  </p>
                  {repairs.length === 0 ? (
                    <p className="text-gray-300 text-xs text-center py-3">履歴はありません</p>
                  ) : (
                    <div className="space-y-2">
                      {repairs.map(r => (
                        <RepairItem key={r.id} repair={r}
                          onComplete={onRepairComplete} onDeliver={onRepairDeliver} onRevert={onRepairRevert} />
                      ))}
                    </div>
                  )}
                </div>

                {/* 追加購入履歴 */}
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShoppingBag size={11} />追加購入 ({purchases.length}件)
                  </p>
                  {purchases.length === 0 ? (
                    <p className="text-gray-300 text-xs text-center py-3">追加購入履歴はありません</p>
                  ) : (
                    <div className="space-y-2">
                      {purchases.map(o => (
                        <PurchaseItem key={o.id} order={o}
                          onStock={onPurchaseStock} onBackOrder={onPurchaseBackOrder}
                          onArrive={onPurchaseArrive} onDeliver={onPurchaseDeliver} onRevert={onPurchaseRevert} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── インライン注文カード ──────────────────────────────────────
function UniformOrderInlineCard({
  order, onStatusChange, onEdit, onDelete,
}: {
  order: UniformOrderLocal
  onStatusChange: (id: string, status: string, msg: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open,          setOpen]          = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading,       setLoading]       = useState(false)

  const statusLabel = STATUS_LABELS[order.status] ?? order.status
  const badgeColor  = STATUS_COLORS[order.status]  ?? 'bg-gray-100 text-gray-500 border-gray-200'

  const itemsSummary = order.items.length > 0
    ? order.items.map(i => `${i.item_name}${i.size_label ? ` (${i.size_label})` : ''}×${i.quantity}`).join(' / ')
    : '（商品なし）'

  async function doStatus(newStatus: string, msg: string) {
    setLoading(true)
    await onStatusChange(order.id, newStatus, msg)
    setLoading(false)
  }

  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white">
      <button onClick={() => setOpen(v => !v)} className="w-full text-left px-3 py-2.5 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold">制服</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${badgeColor}`}>{statusLabel}</span>
            {order.payment_status === 'paid' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-bold">支払済</span>
            )}
            {order.payment_status === 'partial' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 font-bold">内金あり</span>
            )}
          </div>
          <p className="text-xs font-bold text-gray-800 truncate">{itemsSummary}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {order.total_amount != null && (
              <span className="text-xs font-black text-gray-600">¥{order.total_amount.toLocaleString()}</span>
            )}
            <span className="text-[10px] text-gray-400">{order.created_at?.slice(0, 10)}</span>
          </div>
        </div>
        {open ? <ChevronUp size={13} className="text-gray-400 mt-0.5 shrink-0" /> : <ChevronDown size={13} className="text-gray-400 mt-0.5 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-2">
          {/* Items list */}
          {order.items.length > 0 && (
            <div className="space-y-0.5">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{item.item_name}{item.size_label ? ` (${item.size_label})` : ''}</span>
                  <span className="text-gray-500">×{item.quantity}{item.unit_price != null ? ` ¥${item.unit_price.toLocaleString()}` : ''}</span>
                </div>
              ))}
            </div>
          )}
          {order.notes && <p className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1">{order.notes}</p>}
          {order.expected_delivery_date && (
            <p className="text-[10px] text-gray-500">希望日: {order.expected_delivery_date}</p>
          )}

          {/* Status progression */}
          <div className="flex gap-1.5 flex-wrap">
            {order.status === 'confirmed' && (
              <button onClick={() => doStatus('ordered', '発注済みにしました')} disabled={loading}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-orange-600 text-white flex items-center justify-center gap-1 disabled:opacity-50">
                {loading ? <Loader2 size={11} className="animate-spin" /> : '🚚 発注する'}
              </button>
            )}
            {order.status === 'ordered' && (
              <button onClick={() => doStatus('arrived', '入荷完了にしました')} disabled={loading}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white flex items-center justify-center gap-1 disabled:opacity-50">
                {loading ? <Loader2 size={11} className="animate-spin" /> : '📦 入荷完了'}
              </button>
            )}
            {order.status === 'arrived' && (
              <button onClick={() => doStatus('delivered', 'お渡し済みにしました')} disabled={loading}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-600 text-white flex items-center justify-center gap-1 disabled:opacity-50">
                {loading ? <Loader2 size={11} className="animate-spin" /> : '✅ お渡し済み'}
              </button>
            )}
            {order.status !== 'confirmed' && order.status !== 'delivered' && (
              <button onClick={() => doStatus('confirmed', '受注済みに戻しました')} disabled={loading}
                className="px-2 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 flex items-center gap-1 disabled:opacity-50">
                <RotateCcw size={10} />戻す
              </button>
            )}
          </div>

          {/* Edit / Delete */}
          <div className="flex gap-1.5">
            <button onClick={onEdit}
              className="flex-1 py-2 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors">
              <Pencil size={11} />編集
            </button>
            {confirmDelete ? (
              <div className="flex gap-1">
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-600">戻る</button>
                <button onClick={onDelete} disabled={loading}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50">削除</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="px-2 py-2 rounded-lg text-xs font-bold border border-red-200 text-red-400 flex items-center gap-1 hover:bg-red-50 transition-colors">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
