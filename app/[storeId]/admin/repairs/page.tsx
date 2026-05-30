'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  Scissors, ShoppingBag, Loader2, ChevronDown, ChevronUp,
  Phone, User, Check, RotateCcw, Package, ClipboardList,
  Banknote, Plus, AlertCircle, CreditCard, CheckCheck,
  History, CalendarDays,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
  REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS,
} from '@/types/crm'
import type { RepairStatus, PurchaseStatus, RequestType } from '@/types/crm'
import { BottomNav } from '../_components/BottomNav'

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function todayJst() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

// ── Types ─────────────────────────────────────────────────────
interface RepairRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  slip_number: string | null; item_name: string; content: string
  status: RepairStatus; received_date: string; completed_date: string | null
  delivered_date: string | null; price: number | null; notes: string | null
  notified: boolean; request_type: RequestType | null; prepaid: boolean | null
  desired_completion_date: string | null
  created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string; school_name: string | null } | null
}

interface PurchaseRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  item_name: string; maker: string | null; notes: string | null; status: PurchaseStatus
  price: number | null; ordered_date: string; arrived_date: string | null
  delivered_date: string | null; notified: boolean; created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string; school_name: string | null } | null
}

interface DeliveryItem {
  id:             string
  kind:           'repair' | 'purchase'
  store_id:       string
  customer_id:    string
  child_id:       string | null
  item_name:      string
  sub_label:      string
  status:         string
  prev_status:    string
  received_date:  string
  ready_date:     string | null
  desired_completion_date: string | null
  delivered_date: string | null
  price:          number | null
  slip_number:    string | null
  notified:       boolean
  payment_status: string | null
  customer:       { name: string; tel: string | null } | null
  child:          { name: string; school_name: string | null } | null
}

function rawToItem(row: Record<string, unknown>, kind: 'repair' | 'purchase'): DeliveryItem {
  return {
    id:             row.id as string,
    kind,
    store_id:       row.store_id as string,
    customer_id:    row.customer_id as string,
    child_id:       row.child_id as string | null,
    item_name:      row.item_name as string,
    sub_label:      kind === 'repair' ? (row.content as string ?? '') : (row.notes as string ?? ''),
    status:         row.status as string,
    prev_status:    kind === 'repair' ? 'completed' : 'arrived',
    received_date:  kind === 'repair' ? (row.received_date as string) : (row.ordered_date as string),
    ready_date:     kind === 'repair' ? (row.completed_date as string | null) : (row.arrived_date as string | null),
    desired_completion_date: kind === 'repair' ? (row.desired_completion_date as string | null ?? null) : null,
    delivered_date: row.delivered_date as string | null,
    price:          row.price as number | null,
    slip_number:    kind === 'repair' ? (row.slip_number as string | null) : null,
    notified:       (row.notified as boolean) ?? false,
    payment_status: row.payment_status as string | null ?? null,
    customer:       row.customer as { name: string; tel: string | null } | null,
    child:          row.child as { name: string; school_name: string | null } | null,
  }
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, type, onUndo, onClose }: {
  msg: string; type: 'ok' | 'err'; onUndo?: () => Promise<void>; onClose: () => void
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
      type === 'err' ? 'bg-red-600' : 'bg-gray-900 border border-gray-700'
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

// ── Repair Card ───────────────────────────────────────────────
function RepairCard({ item, storeId, onRefresh, onToast }: {
  item: RepairRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)
  const reqType = (item.request_type ?? 'repair') as RequestType

  const today = new Date(); today.setHours(0,0,0,0)
  const deadlineDate = item.desired_completion_date ? new Date(item.desired_completion_date) : null
  if (deadlineDate) deadlineDate.setHours(0,0,0,0)
  const daysUntilDeadline = deadlineDate ? Math.floor((deadlineDate.getTime() - today.getTime()) / 86400000) : null
  const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0 && item.status === 'received'
  const isDueSoon = daysUntilDeadline !== null && daysUntilDeadline <= 1 && daysUntilDeadline >= 0 && item.status === 'received'

  async function update(
    patch: Record<string, unknown>,
    msg: string,
    undoPatch?: Record<string, unknown>
  ) {
    setLoading(true)
    const { error } = await (supabase as any)
      .from('repair_histories')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', msg, undoPatch ? async () => {
      await (supabase as any).from('repair_histories')
        .update({ ...undoPatch, updated_at: new Date().toISOString() }).eq('id', item.id)
      onRefresh()
    } : undefined)
  }

  const completeLabel = reqType === 'repair'       ? 'お直し完了・連絡する'
                      : reqType === 'hold_request' ? '確保済み・連絡する'
                      : '対応完了・連絡する'

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-sm ${
      isOverdue ? 'bg-red-50 border-red-400 border-2' :
      isDueSoon ? 'bg-amber-50 border-amber-400' :
      item.status === 'received' ? 'bg-white border-slate-200' : 'bg-white border-slate-100 opacity-70'
    }`}>
      <button className="w-full text-left p-4 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${REQUEST_TYPE_COLORS[reqType]}`}>
              {REQUEST_TYPE_LABELS[reqType]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${REPAIR_STATUS_COLORS[item.status]}`}>
              {REPAIR_STATUS_LABELS[item.status]}
            </span>
            {item.slip_number && <span className="text-xs font-mono text-gray-400">#{item.slip_number}</span>}
            {isOverdue && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1 animate-pulse">
                🚨 期限超過 {Math.abs(daysUntilDeadline!)}日
              </span>
            )}
            {isDueSoon && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1">
                ⚠️ 期限間近
              </span>
            )}
          </div>
          {item.child?.school_name && (
            <p className="text-xs font-black text-amber-600 truncate mt-1.5 leading-tight">{item.child.school_name}</p>
          )}
          <p className={`font-black text-xl leading-tight truncate ${item.child?.school_name ? '' : 'mt-1.5'} text-slate-900`}>
            {item.child?.name ?? item.customer?.name ?? '（顧客不明）'}
          </p>
          {item.child && (
            <p className="text-[10px] text-slate-400 truncate leading-tight">保護者: {item.customer?.name}</p>
          )}
          <p className="text-sm font-semibold text-slate-800 mt-1.5 leading-snug">
            {item.item_name}{item.content ? ` — ${item.content}` : ''}
          </p>
          <div className="flex items-end gap-2 mt-1.5">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {item.prepaid ? (
                <span className="text-xs px-2 py-0.5 rounded-full border font-bold bg-emerald-100 text-emerald-700 border-emerald-300">
                  支払済
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full border font-black bg-red-600 text-white border-red-600 animate-pulse">
                  未払い
                </span>
              )}
              {item.price != null && (
                <span className={`text-sm font-black ${item.prepaid ? 'text-gray-500' : 'text-red-700'}`}>
                  ¥{item.price.toLocaleString()}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500">依頼受け日: {fmtDate(item.received_date)}</p>
              {item.desired_completion_date && (
                <p className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-slate-500'}`}>
                  希望完了日: {fmtDate(item.desired_completion_date)}
                </p>
              )}
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400 mt-1 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 mt-1 shrink-0" />}
      </button>

      {item.status === 'received' && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <button
            onClick={() => update(
              { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
              `${completeLabel}にしました`,
              { status: 'received', completed_date: null, notified: false }
            )}
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm">
            {loading
              ? <Loader2 size={18} className="animate-spin" />
              : <><Scissors size={18} />✂️ {completeLabel}</>
            }
          </button>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {item.notes && <p className="text-xs text-gray-600 pt-3">{item.notes}</p>}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          {item.prepaid ? (
            <button
              onClick={() => update({ prepaid: false }, '未払いに戻しました', { prepaid: true })}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border-2 bg-emerald-100 border-emerald-200 text-emerald-700">
              <Banknote size={15} />✅ 支払済み — タップで未払いに戻す
            </button>
          ) : confirmPay ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
              <p className="text-xs text-emerald-700 font-bold text-center">支払い完了にしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmPay(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">キャンセル</button>
                <button onClick={() => { update({ prepaid: true }, '支払い完了にしました'); setConfirmPay(false) }}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1">
                  <Banknote size={13} />支払い完了
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmPay(true)}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border-2 bg-red-100 border-red-400 text-red-700">
              <Banknote size={15} />⚠️ 未払い — タップして支払い確認
            </button>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <User size={11} />顧客詳細
          </a>
          <div className="flex flex-wrap gap-2 pt-1">
            {item.status === 'received' && (
              <button
                onClick={() => update(
                  { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
                  `${completeLabel}にしました`,
                  { status: 'received', completed_date: null, notified: false }
                )}
                disabled={loading}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5">
                <Check size={13} />{completeLabel}
              </button>
            )}
            {item.status !== 'received' && (
              <button
                onClick={() => update(
                  { status: 'received', completed_date: null, delivered_date: null, notified: false },
                  '受付中に戻しました',
                  { status: item.status, completed_date: item.completed_date, delivered_date: item.delivered_date, notified: item.notified }
                )}
                disabled={loading}
                className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 text-xs rounded-xl transition-colors flex items-center gap-1">
                <RotateCcw size={11} />受付中に戻す
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
  item: PurchaseRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const nextStep = PURCHASE_STATUS_FLOW[item.status]

  async function update(
    patch: Record<string, unknown>,
    msg: string,
    undoPatch?: Record<string, unknown>
  ) {
    setLoading(true)
    const { error } = await (supabase as any).from('purchase_orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', msg, undoPatch ? async () => {
      await (supabase as any).from('purchase_orders')
        .update({ ...undoPatch, updated_at: new Date().toISOString() }).eq('id', item.id)
      onRefresh()
    } : undefined)
  }

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${item.status === 'delivered' ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
      <button className="w-full text-left p-4 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${PURCHASE_STATUS_COLORS[item.status]}`}>
              {PURCHASE_STATUS_LABELS[item.status]}
            </span>
          </div>
          {item.child?.school_name && (
            <p className="text-xs font-black text-amber-600 truncate mt-1.5 leading-tight">{item.child.school_name}</p>
          )}
          <p className={`font-black text-xl leading-tight truncate ${item.child?.school_name ? '' : 'mt-1.5'} text-slate-900`}>
            {item.child?.name ?? item.customer?.name ?? '（顧客不明）'}
          </p>
          {item.child && (
            <p className="text-[10px] text-slate-400 truncate leading-tight">保護者: {item.customer?.name}</p>
          )}
          <p className="text-sm font-semibold text-slate-800 mt-1.5 leading-snug">{item.item_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">依頼: {fmtDate(item.ordered_date)}</span>
            {item.price != null && <span className="text-sm font-bold text-slate-700">¥{item.price.toLocaleString()}</span>}
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-500 mt-1 shrink-0" /> : <ChevronDown size={15} className="text-gray-500 mt-1 shrink-0" />}
      </button>

      {nextStep && item.status !== 'delivered' && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <button
            onClick={() => {
              const patch: Record<string, unknown> = { status: nextStep.next }
              const undoPatch: Record<string, unknown> = { status: item.status, arrived_date: item.arrived_date, delivered_date: item.delivered_date, notified: item.notified }
              if (nextStep.next === 'arrived') { patch.arrived_date = new Date().toISOString().slice(0, 10); patch.notified = true }
              if (nextStep.next === 'delivered') patch.delivered_date = new Date().toISOString().slice(0, 10)
              update(patch, `${nextStep.label}にしました`, undoPatch)
            }}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm ${nextStep.color}`}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
            {nextStep.label}
          </button>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {item.notes && <p className="text-xs text-gray-600 pt-3">{item.notes}</p>}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <User size={11} />顧客詳細
          </a>
          {nextStep && (
            <button onClick={() => {
              const patch: Record<string, unknown> = { status: nextStep.next }
              const undoPatch: Record<string, unknown> = { status: item.status, arrived_date: item.arrived_date, delivered_date: item.delivered_date, notified: item.notified }
              if (nextStep.next === 'arrived') { patch.arrived_date = new Date().toISOString().slice(0, 10); patch.notified = true }
              if (nextStep.next === 'delivered') patch.delivered_date = new Date().toISOString().slice(0, 10)
              update(patch, `${nextStep.label}にしました`, undoPatch)
            }} disabled={loading} className={`w-full py-2.5 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 ${nextStep.color}`}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
              {nextStep.label}
            </button>
          )}
          {(item.status === 'received' || item.status === 'ordered') && (
            <button onClick={() => update(
              { status: 'stocked', arrived_date: new Date().toISOString().slice(0, 10), notified: true },
              '店頭在庫確保しました',
              { status: item.status, arrived_date: null, notified: false }
            )}
              disabled={loading} className="w-full py-2.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              店頭在庫確保（取り置き済み）
            </button>
          )}
          {item.status !== 'received' && item.status !== 'ordered' && (
            <button onClick={() => update(
              { status: 'received', arrived_date: null, delivered_date: null, notified: false },
              '依頼受付に戻しました',
              { status: item.status, arrived_date: item.arrived_date, delivered_date: item.delivered_date, notified: item.notified }
            )}
              disabled={loading} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 text-xs rounded-xl transition-colors flex items-center justify-center gap-1">
              <RotateCcw size={11} />依頼受付に戻す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Maker Order Panel ─────────────────────────────────────────
function MakerGroup({ maker, items, storeId, onRefresh, onToast }: {
  maker: string; items: PurchaseRow[]; storeId: string
  onRefresh: () => void; onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
}) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)

  async function markOrdered() {
    setLoading(true)
    const ids = items.map(i => i.id)
    const prevStatuses = Object.fromEntries(items.map(i => [i.id, i.status]))
    const { error } = await (supabase as any).from('purchase_orders')
      .update({ status: 'on_order', updated_at: new Date().toISOString() })
      .in('id', ids)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', `${maker}: ${items.length}件を発注済みにしました`, async () => {
      await Promise.all(ids.map(id =>
        (supabase as any).from('purchase_orders')
          .update({ status: prevStatuses[id], updated_at: new Date().toISOString() }).eq('id', id)
      ))
      onRefresh()
    })
  }

  return (
    <div className="bg-white border border-gray-300 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <button className="flex-1 text-left flex items-center gap-2" onClick={() => setOpen(v => !v)}>
          <div>
            <p className="font-bold text-gray-900 text-sm">{maker}</p>
            <p className="text-xs text-gray-500">{items.length}件 未発注</p>
          </div>
          {open ? <ChevronUp size={14} className="text-gray-500 ml-auto" /> : <ChevronDown size={14} className="text-gray-500 ml-auto" />}
        </button>
        <button onClick={markOrdered} disabled={loading}
          className="shrink-0 px-3 py-2 bg-orange-700 hover:bg-orange-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
          発注済みに
        </button>
      </div>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {items.map(item => (
            <div key={item.id} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.customer?.name ?? '顧客不明'}{item.child ? ` / ${item.child.name}` : ''}
                {' · '}{fmtDate(item.ordered_date)}
              </p>
              {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
              {item.price != null && <p className="text-xs text-gray-400">¥{item.price.toLocaleString()}</p>}
              <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1">
                <User size={10} />顧客詳細
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MakerOrderPanel({ purchases, storeId, onRefresh, onToast }: {
  purchases: PurchaseRow[]; storeId: string
  onRefresh: () => void; onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
}) {
  const grouped = purchases.reduce<Record<string, PurchaseRow[]>>((acc, p) => {
    const key = p.maker?.trim() || '（メーカー未設定）'
    ;(acc[key] ??= []).push(p)
    return acc
  }, {})

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-sm">未発注の追加購入はありません</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([maker, items]) => (
        <MakerGroup key={maker} maker={maker} items={items} storeId={storeId} onRefresh={onRefresh} onToast={onToast} />
      ))}
    </div>
  )
}

// ── Payment Badge (for delivery items) ───────────────────────
function PaymentBadge({ status, onToggle, loading }: {
  status: string | null; onToggle: () => void; loading: boolean
}) {
  const isPaid = status === 'paid'
  const [confirmPay,   setConfirmPay]   = useState(false)
  const [confirmUnpay, setConfirmUnpay] = useState(false)

  if (!isPaid && confirmPay) {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1">
        <span className="text-[10px] text-emerald-700 font-bold">支払い完了？</span>
        <button onClick={() => setConfirmPay(false)} className="text-[10px] text-gray-500 px-1">✕</button>
        <button onClick={() => { setConfirmPay(false); onToggle() }} disabled={loading}
          className="text-[10px] text-white bg-emerald-600 px-2 py-0.5 rounded-lg font-bold flex items-center gap-0.5">
          <CreditCard size={8} />完了
        </button>
      </div>
    )
  }
  if (isPaid && confirmUnpay) {
    return (
      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
        <span className="text-[10px] text-red-700 font-bold">未払いに戻す？</span>
        <button onClick={() => setConfirmUnpay(false)} className="text-[10px] text-gray-500 px-1">✕</button>
        <button onClick={() => { setConfirmUnpay(false); onToggle() }} disabled={loading}
          className="text-[10px] text-white bg-red-600 px-2 py-0.5 rounded-lg font-bold">
          戻す
        </button>
      </div>
    )
  }
  return (
    <button onClick={isPaid ? () => setConfirmUnpay(true) : () => setConfirmPay(true)} disabled={loading}
      className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border transition-all active:scale-95 disabled:opacity-50 ${
        isPaid
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
          : 'bg-red-100 text-red-600 border-red-200'
      }`}>
      <CreditCard size={9} />
      {loading ? <Loader2 size={9} className="animate-spin" /> : (isPaid ? '支払済' : '未払い')}
    </button>
  )
}

// ── Waiting Card (お渡し待ち) ─────────────────────────────────
function WaitingCard({ item, alertDays, onDeliver, onPaymentToggle }: {
  item: DeliveryItem
  alertDays: number
  onDeliver: (item: DeliveryItem, paid: boolean) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
}) {
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [payAtDeliver,  setPayAtDeliver]  = useState(item.payment_status === 'paid')
  const [unpaidConfirm, setUnpaidConfirm] = useState(false)
  const [loading,       setLoading]       = useState<string | null>(null)

  const isOverdue = item.ready_date &&
    (Date.now() - new Date(item.ready_date).getTime()) / 86400000 > alertDays
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - new Date(item.ready_date!).getTime()) / 86400000)
    : 0

  const studentName = item.child?.name ?? item.customer?.name ?? '（名前なし）'
  const parentName  = item.child ? item.customer?.name : null
  const itemContent = item.sub_label ? `${item.item_name} — ${item.sub_label}` : item.item_name

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
            item.kind === 'repair'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'bg-teal-100 text-teal-700 border-teal-300'
          }`}>
            {item.kind === 'repair' ? 'お直し完了' : '取置き入荷済み'}
          </span>
          {item.notified && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
              LINE通知済み
            </span>
          )}
          {isOverdue && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
              <AlertCircle size={9} />{overdueDays}日超過
            </span>
          )}
          {item.slip_number && (
            <span className="text-xs font-mono text-gray-400">#{item.slip_number}</span>
          )}
        </div>

        {item.child?.school_name && (
          <p className="text-xs font-black text-amber-600 truncate mt-1.5 leading-tight">{item.child.school_name}</p>
        )}
        <p className={`font-black text-xl leading-tight truncate ${item.child?.school_name ? '' : 'mt-1.5'} text-slate-900`}>
          {studentName}
        </p>
        {parentName && (
          <p className="text-[10px] text-slate-400 truncate leading-tight">保護者: {parentName}</p>
        )}

        <p className="text-sm font-semibold text-slate-800 mt-1.5 leading-snug">{itemContent}</p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <PaymentBadge
            status={item.payment_status}
            loading={loading === 'payment'}
            onToggle={async () => {
              setLoading('payment')
              await onPaymentToggle(item)
              setLoading(null)
            }}
          />
          {item.price != null && (
            <span className={`text-sm font-black ${item.payment_status === 'paid' ? 'text-gray-500' : 'text-red-700'}`}>
              ¥{item.price.toLocaleString()}
            </span>
          )}
          <div className="text-right ml-auto shrink-0">
            <p className="text-xs text-slate-500">依頼受け日: {fmtDate(item.received_date)}</p>
            {item.desired_completion_date && (
              <p className="text-xs font-semibold text-slate-500">希望完了日: {fmtDate(item.desired_completion_date)}</p>
            )}
          </div>
        </div>

        {item.customer?.tel && (
          <a href={`tel:${item.customer.tel}`}
            className="flex items-center gap-1.5 text-blue-600 text-xs font-bold mt-2">
            <Phone size={11} />{item.customer.tel}
          </a>
        )}
      </div>

      {!confirmOpen ? (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <button onClick={() => setConfirmOpen(true)}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">
            <Package size={18} />お渡し済みにする
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          <p className="text-sm font-black text-gray-900 text-center">お渡し確認</p>
          <p className="text-xs text-gray-600 text-center">
            <span className="font-bold text-gray-900">{studentName}</span> 様にお渡ししますか？
            {item.child && <span className="text-gray-500">（保護者: {parentName}）</span>}
          </p>

          <button onClick={() => setPayAtDeliver(v => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
              payAtDeliver ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-300 bg-gray-200/50'
            }`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              payAtDeliver ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
            }`}>
              {payAtDeliver && <CheckCheck size={11} className="text-white" />}
            </div>
            <div className="text-left">
              <p className={`text-sm font-bold ${payAtDeliver ? 'text-emerald-700' : 'text-gray-500'}`}>代金を受け取った</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.price != null ? `¥${item.price.toLocaleString()}` : '金額未設定'}
              </p>
            </div>
          </button>

          {unpaidConfirm && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 space-y-2">
              <p className="text-sm font-black text-red-700 text-center flex items-center justify-center gap-1.5">
                <AlertCircle size={16} />まだ未払いです！
              </p>
              <p className="text-xs text-red-600 text-center">未払いのままお渡し済みにしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setUnpaidConfirm(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-gray-200 text-gray-700 active:scale-95">
                  戻る
                </button>
                <button
                  onClick={async () => {
                    setUnpaidConfirm(false)
                    setLoading('deliver')
                    await onDeliver(item, false)
                    setLoading(null)
                    setConfirmOpen(false)
                  }}
                  disabled={!!loading}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-red-600 text-white active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading === 'deliver' ? <Loader2 size={12} className="animate-spin" /> : '未払いのままお渡し'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setConfirmOpen(false); setUnpaidConfirm(false) }}
              className="py-3 rounded-xl font-bold text-sm bg-gray-300 text-gray-700 active:scale-95 transition-all">
              キャンセル
            </button>
            <button
              onClick={async () => {
                if (!payAtDeliver && item.payment_status !== 'paid') {
                  setUnpaidConfirm(true)
                  return
                }
                setLoading('deliver')
                await onDeliver(item, payAtDeliver)
                setLoading(null)
                setConfirmOpen(false)
              }}
              disabled={!!loading || unpaidConfirm}
              className="py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
              {loading === 'deliver'
                ? <><Loader2 size={13} className="animate-spin" />処理中...</>
                : <><Package size={13} />お渡し</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Completed Card (お渡し完了) ───────────────────────────────
function CompletedCard({ item, onRevert, onPaymentToggle }: {
  item: DeliveryItem
  onRevert: (item: DeliveryItem) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
}) {
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [loading,       setLoading]       = useState<string | null>(null)
  const [custOpen,      setCustOpen]      = useState(false)

  const isUnpaidDelivered = item.payment_status !== 'paid'

  return (
    <div className={`rounded-2xl border p-4 ${
      isUnpaidDelivered
        ? 'border-2 border-red-500 bg-red-50'
        : 'bg-gray-100 border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center bg-gray-200">
          <Package size={14} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          {item.customer && (
            <button onClick={() => setCustOpen(v => !v)}
              className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1 w-full text-left active:opacity-70">
              <User size={10} />
              {item.customer.name}
              {item.child && <span className="text-gray-500">（{item.child.name}）</span>}
              <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform text-gray-500 ${custOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-gray-300/60 text-gray-500 border-gray-300">
              お渡し済み
            </span>
            {isUnpaidDelivered && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full border bg-red-600 text-white border-red-600 flex items-center gap-1 animate-pulse">
                <AlertCircle size={9} />代金未回収
              </span>
            )}
            <PaymentBadge
              status={item.payment_status}
              loading={loading === 'payment'}
              onToggle={async () => {
                setLoading('payment')
                await onPaymentToggle(item)
                setLoading(null)
              }}
            />
          </div>
          <p className="font-bold text-gray-700 text-sm">{item.item_name}</p>
          {item.sub_label && <p className="text-gray-500 text-xs mt-0.5">{item.sub_label}</p>}
          {item.price != null && <p className="text-gray-500 text-xs mt-0.5">¥{item.price.toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-[10px]">
            <span className="flex items-center gap-1">
              <CalendarDays size={9} />受付 {fmtDate(item.received_date)}
            </span>
            {item.delivered_date && (
              <span className="flex items-center gap-1">
                <Package size={9} />お渡し {fmtDate(item.delivered_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      {custOpen && item.customer?.tel && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
            <Phone size={11} />{item.customer.tel}
          </a>
        </div>
      )}

      {!confirmRevert ? (
        <button onClick={() => setConfirmRevert(true)}
          className="w-full mt-3 py-2 rounded-xl font-bold text-xs border border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all flex items-center justify-center gap-1.5 active:scale-95">
          <RotateCcw size={11} />お渡しを取り消す
        </button>
      ) : (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-center text-amber-700 font-bold">お渡しを取り消して前の状態に戻しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmRevert(false)}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95">
              キャンセル
            </button>
            <button
              onClick={async () => {
                setLoading('revert')
                await onRevert(item)
                setLoading(null)
                setConfirmRevert(false)
              }}
              disabled={!!loading}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-amber-600 text-white active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
              {loading === 'revert'
                ? <Loader2 size={12} className="animate-spin" />
                : <><RotateCcw size={12} />取り消す</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
type ActiveTab = 'request' | 'purchase' | 'delivery'
type DeliverySubTab = 'waiting' | 'history'
type RequestFilter = 'all' | RequestType
type SortOrder = 'priority' | 'received_asc' | 'deadline_asc' | 'school' | 'name' | 'unpaid_first' | 'item' | 'category'

export default function RepairsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [tab,              setTab]              = useState<ActiveTab>('request')
  const [deliverySubTab,   setDeliverySubTab]   = useState<DeliverySubTab>('waiting')
  const [repairs,          setRepairs]          = useState<RepairRow[]>([])
  const [purchases,        setPurchases]        = useState<PurchaseRow[]>([])
  const [waiting,          setWaiting]          = useState<DeliveryItem[]>([])
  const [history,          setHistory]          = useState<DeliveryItem[]>([])
  const [loading,          setLoading]          = useState(true)
  const [histLoading,      setHistLoading]      = useState(false)
  const [histFetched,      setHistFetched]      = useState(false)
  const [alertDays,        setAlertDays]        = useState(7)
  const [fetchError,       setFetchError]       = useState<string | null>(null)
  const [toast,            setToast]            = useState<{ type: 'ok' | 'err'; msg: string; onUndo?: () => Promise<void> } | null>(null)
  const [requestFilter,    setRequestFilter]    = useState<RequestFilter>('all')
  const [sortOrder,        setSortOrder]        = useState<SortOrder>('priority')
  const [purchaseFilter,   setPurchaseFilter]   = useState<'pending' | 'on_order' | 'arrived' | null>(null)
  const [purchaseViewMode, setPurchaseViewMode] = useState<'list' | 'order_mgmt'>('list')

  const showToast = useCallback((type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => {
    setToast({ type, msg, onUndo })
  }, [])

  // Fetch alert days from store settings
  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('stores').select('alert_days_repair')
      .eq('id', storeId).single()
      .then(({ data }: { data: { alert_days_repair: number } | null }) => {
        if (data?.alert_days_repair) setAlertDays(data.alert_days_repair)
      })
  }, [storeId])

  const fetchAll = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    setFetchError(null)
    const [
      { data: repairData,  error: repairErr  },
      { data: purchaseData, error: purchaseErr },
      { data: waitRepairs },
      { data: waitPurchases },
    ] = await Promise.all([
      (supabase as any).from('repair_histories')
        .select('*, desired_completion_date, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'received')
        .order('received_date', { ascending: true }),
      (supabase as any).from('purchase_orders')
        .select('*, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).neq('status', 'delivered')
        .order('ordered_date', { ascending: true }),
      supabase.from('repair_histories')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'completed')
        .order('completed_date', { ascending: true }),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'arrived')
        .order('arrived_date', { ascending: true }),
    ])
    if (repairErr)   setFetchError(repairErr.message)
    else if (purchaseErr) setFetchError(purchaseErr.message)
    setRepairs(repairData ?? [])
    setPurchases(purchaseData ?? [])
    const waitingItems: DeliveryItem[] = [
      ...(waitRepairs   ?? []).map((r: Record<string, unknown>) => rawToItem(r, 'repair')),
      ...(waitPurchases ?? []).map((p: Record<string, unknown>) => rawToItem(p, 'purchase')),
    ].sort((a, b) => {
      const da = a.ready_date ?? a.received_date
      const db = b.ready_date ?? b.received_date
      return da.localeCompare(db)
    })
    setWaiting(waitingItems)
    setLoading(false)
  }, [storeId])

  const fetchHistory = useCallback(async () => {
    if (!storeId || histFetched) return
    setHistLoading(true)
    const [{ data: hRepairs }, { data: hPurchases }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
    ])
    const histItems: DeliveryItem[] = [
      ...(hRepairs   ?? []).map((r: Record<string, unknown>) => rawToItem(r, 'repair')),
      ...(hPurchases ?? []).map((p: Record<string, unknown>) => rawToItem(p, 'purchase')),
    ].sort((a, b) => (b.delivered_date ?? '').localeCompare(a.delivered_date ?? ''))
    setHistory(histItems)
    setHistLoading(false)
    setHistFetched(true)
  }, [storeId, histFetched])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (tab === 'delivery' && deliverySubTab === 'history' && !histFetched) fetchHistory()
  }, [tab, deliverySubTab, histFetched, fetchHistory])

  // ── Delivery actions ──────────────────────────────────────────
  const handleDeliver = useCallback(async (item: DeliveryItem, paid: boolean) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = { status: 'delivered', delivered_date: todayJst() }
    if (paid) update.payment_status = 'paid'
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setWaiting(prev => prev.filter(i => i.id !== item.id))
    const snapshot = { ...item }
    showToast('ok', '📦 お渡し済みにしました', async () => {
      const revert: Record<string, unknown> = {
        status: snapshot.prev_status,
        delivered_date: null,
        payment_status: snapshot.payment_status,
      }
      if (item.kind === 'repair') revert.completed_date = snapshot.ready_date
      else                        revert.arrived_date   = snapshot.ready_date
      await (supabase as any).from(table).update(revert).eq('id', snapshot.id)
      await fetchAll()
    })
    setHistFetched(false)
  }, [showToast, fetchAll])

  const handleRevert = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = {
      status: item.prev_status,
      delivered_date: null,
      payment_status: 'unpaid',
    }
    if (item.kind === 'repair') update.completed_date = item.ready_date
    else                        update.arrived_date   = item.ready_date
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `取り消し失敗: ${error.message}`); return }
    setHistory(prev => prev.filter(i => i.id !== item.id))
    await fetchAll()
    showToast('ok', '🔄 お渡し前の状態に戻しました')
  }, [showToast, fetchAll])

  const handlePaymentToggle = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const newStatus  = item.payment_status === 'paid' ? 'unpaid' : 'paid'
    const prevStatus = item.payment_status
    const { error } = await (supabase as any).from(table)
      .update({ payment_status: newStatus }).eq('id', item.id)
    if (error) { showToast('err', '支払状態の更新に失敗しました'); return }
    const updater = (prev: DeliveryItem[]) =>
      prev.map(i => i.id === item.id ? { ...i, payment_status: newStatus } : i)
    setWaiting(updater)
    setHistory(updater)
    if (newStatus === 'unpaid') {
      showToast('ok', '未払いに戻しました', async () => {
        await (supabase as any).from(table).update({ payment_status: prevStatus }).eq('id', item.id)
        const revert = (prev: DeliveryItem[]) =>
          prev.map(i => i.id === item.id ? { ...i, payment_status: prevStatus } : i)
        setWaiting(revert)
        setHistory(revert)
      })
    }
  }, [showToast])

  // ── Counts & derived ─────────────────────────────────────────
  const todayDate = new Date(); todayDate.setHours(0,0,0,0)

  const reqCounts = {
    all:          repairs.length,
    repair:       repairs.filter(r => (r.request_type ?? 'repair') === 'repair').length,
    walk_in:      repairs.filter(r => r.request_type === 'walk_in').length,
    hold_request: repairs.filter(r => r.request_type === 'hold_request').length,
  }
  const purchaseCounts = {
    pending:  purchases.filter(p => ['received', 'ordered'].includes(p.status)).length,
    on_order: purchases.filter(p => p.status === 'on_order').length,
    arrived:  purchases.filter(p => p.status === 'arrived').length,
  }

  const overdueCount = repairs.filter(r => {
    if (!r.desired_completion_date) return false
    const d = new Date(r.desired_completion_date); d.setHours(0,0,0,0)
    return d < todayDate
  }).length

  function priorityScore(r: RepairRow, today: Date): number {
    if (!r.desired_completion_date) return 500
    const deadline = new Date(r.desired_completion_date)
    deadline.setHours(0, 0, 0, 0)
    const d = Math.floor((deadline.getTime() - today.getTime()) / 86400000)
    if (d < 0) return d - 1000
    if (d === 0) return -100
    if (d === 1) return -50
    return d
  }

  const sortFn = (a: RepairRow, b: RepairRow): number => {
    switch (sortOrder) {
      case 'priority':     return priorityScore(a, todayDate) - priorityScore(b, todayDate)
      case 'received_asc': return a.received_date.localeCompare(b.received_date)
      case 'deadline_asc': {
        const da = a.desired_completion_date ?? '9999-12-31'
        const db = b.desired_completion_date ?? '9999-12-31'
        return da.localeCompare(db)
      }
      case 'school': return (a.child?.school_name ?? '').localeCompare(b.child?.school_name ?? '', 'ja')
      case 'name': {
        const na = a.child?.name ?? a.customer?.name ?? ''
        const nb = b.child?.name ?? b.customer?.name ?? ''
        return na.localeCompare(nb, 'ja')
      }
      case 'unpaid_first': {
        const pa = a.prepaid ? 1 : 0
        const pb = b.prepaid ? 1 : 0
        if (pa !== pb) return pa - pb
        return priorityScore(a, todayDate) - priorityScore(b, todayDate)
      }
      case 'item':     return a.item_name.localeCompare(b.item_name, 'ja')
      case 'category': return (a.request_type ?? '').localeCompare(b.request_type ?? '')
      default:         return 0
    }
  }

  const filteredRepairs = (requestFilter === 'all' ? repairs : repairs.filter(r => (r.request_type ?? 'repair') === requestFilter)).slice().sort(sortFn)

  const filteredPurchases = purchaseFilter === 'pending'
    ? purchases.filter(p => ['received', 'ordered'].includes(p.status))
    : purchaseFilter === 'on_order'
    ? purchases.filter(p => p.status === 'on_order')
    : purchaseFilter === 'arrived'
    ? purchases.filter(p => p.status === 'arrived')
    : purchases

  const waitingUnpaid = waiting.filter(i => i.payment_status !== 'paid')
  const waitingPaid   = waiting.filter(i => i.payment_status === 'paid')

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <ClipboardList size={17} className="text-indigo-600" />
            </div>
            <h1 className="text-base font-bold text-gray-900 flex-1">案件</h1>
            <a href={`/${storeId}/admin/crm`}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all">
              <Plus size={14} />依頼受付
            </a>
          </div>

          {/* 今日やること */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 mb-3 grid grid-cols-3 divide-x divide-indigo-200">
            <button onClick={() => { setTab('request'); setRequestFilter('all') }}
              className="text-center px-2 active:scale-95 transition-all">
              <div className={`text-2xl font-black leading-tight ${overdueCount > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                {overdueCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">🚨 期限超過</div>
            </button>
            <button onClick={() => { setTab('purchase'); setPurchaseFilter('pending') }}
              className="text-center px-2 active:scale-95 transition-all">
              <div className={`text-2xl font-black leading-tight ${purchaseCounts.pending > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                {purchaseCounts.pending}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">📦 未発注</div>
            </button>
            <button onClick={() => { setTab('delivery'); setDeliverySubTab('waiting') }}
              className="text-center px-2 active:scale-95 transition-all">
              <div className={`text-2xl font-black leading-tight ${waiting.length > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                {waiting.length}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">🎁 お渡し待ち</div>
            </button>
          </div>

          {/* Main tabs */}
          <div className="flex gap-1 bg-slate-200 rounded-xl p-1">
            <button onClick={() => setTab('request')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg text-sm font-bold transition-all ${tab === 'request' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-600 font-medium hover:text-slate-800'}`}>
              <ClipboardList size={15} />依頼一覧
              {repairs.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${tab === 'request' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {repairs.length}
                </span>
              )}
            </button>
            <button onClick={() => setTab('purchase')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg text-sm font-bold transition-all ${tab === 'purchase' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-600 font-medium hover:text-slate-800'}`}>
              <ShoppingBag size={15} />発注管理
              {(purchaseCounts.pending + purchaseCounts.on_order + purchaseCounts.arrived) > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${tab === 'purchase' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {purchaseCounts.pending + purchaseCounts.on_order + purchaseCounts.arrived}
                </span>
              )}
            </button>
            <button onClick={() => setTab('delivery')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg text-sm font-bold transition-all ${tab === 'delivery' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-600 font-medium hover:text-slate-800'}`}>
              <Package size={15} />お渡し
              {waiting.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${tab === 'delivery' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {waiting.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-32 space-y-4">
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
            DBエラー: {fetchError}
          </div>
        )}

        {/* 依頼一覧 — sort & filter */}
        {tab === 'request' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 shrink-0">並び替え:</label>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as SortOrder)}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:border-indigo-500 focus:outline-none">
                <option value="priority">① 作業優先順位（期限近い順）</option>
                <option value="received_asc">② 依頼受け日順（古い順）</option>
                <option value="deadline_asc">③ 希望完了日順（近い順）</option>
                <option value="school">④ 学校順</option>
                <option value="name">⑤ 顧客名順</option>
                <option value="unpaid_first">⑥ 未払い優先</option>
                <option value="item">⑦ 作業・アイテム順</option>
                <option value="category">⑧ 購入区分別</option>
              </select>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'all'          as const, label: 'すべて',    count: reqCounts.all,          color: 'text-gray-700' },
                { key: 'repair'       as const, label: 'お直し',    count: reqCounts.repair,       color: 'text-amber-600' },
                { key: 'walk_in'      as const, label: '来店依頼',  count: reqCounts.walk_in,      color: 'text-sky-600' },
                { key: 'hold_request' as const, label: '取置き依頼', count: reqCounts.hold_request, color: 'text-violet-600' },
              ]).map(f => (
                <button key={f.key}
                  onClick={() => setRequestFilter(f.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                    requestFilter === f.key
                      ? 'bg-slate-800 border-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}>
                  {f.label}
                  {f.count > 0 && <span className={`font-bold ${requestFilter === f.key ? 'text-white' : f.color}`}>{f.count}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 発注管理 — filter */}
        {tab === 'purchase' && (
          <>
            {purchaseCounts.pending > 0 && (
              <button onClick={() => setPurchaseViewMode(m => m === 'order_mgmt' ? 'list' : 'order_mgmt')}
                className={`w-full py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
                  purchaseViewMode === 'order_mgmt'
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    : 'bg-orange-700 hover:bg-orange-600 text-white'
                }`}>
                <Package size={15} />
                {purchaseViewMode === 'order_mgmt' ? '発注管理を閉じる' : `📋 発注管理（未発注 ${purchaseCounts.pending}件）`}
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'pending'  as const, label: '依頼受付中', value: purchaseCounts.pending,  color: 'text-blue-600' },
                { key: 'on_order' as const, label: '発注済み',   value: purchaseCounts.on_order, color: 'text-orange-600' },
                { key: 'arrived'  as const, label: '入荷済み',   value: purchaseCounts.arrived,  color: 'text-emerald-600' },
              ]).map(s => (
                <button key={s.key}
                  onClick={() => setPurchaseFilter(f => f === s.key ? null : s.key)}
                  className={`rounded-xl p-3 text-center transition-all border ${
                    purchaseFilter === s.key
                      ? 'bg-gray-200 border-gray-400 ring-1 ring-inset ring-gray-400'
                      : 'bg-white border-gray-200'
                  }`}>
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  {purchaseFilter === s.key && <div className="text-[10px] text-gray-400 mt-0.5">絞込中 ✕</div>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* お渡し — sub-tabs */}
        {tab === 'delivery' && (
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
            {([
              { id: 'waiting' as const, label: 'お渡し待ち', count: waiting.length },
              { id: 'history' as const, label: '完了履歴',   count: null },
            ]).map(t => (
              <button key={t.id} onClick={() => setDeliverySubTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  deliverySubTab === t.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.id === 'waiting' ? <Package size={14} /> : <History size={14} />}
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                    deliverySubTab === t.id ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Lists */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : tab === 'request' ? (
          repairs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">作業中の依頼はありません</p>
              <p className="text-xs mt-1 text-gray-300">完了済みはお渡しタブで確認できます</p>
            </div>
          ) : filteredRepairs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">該当する依頼はありません</p>
              <button onClick={() => setRequestFilter('all')} className="mt-2 text-xs text-indigo-600">絞り込みを解除</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRepairs.map(r => (
                <RepairCard key={r.id} item={r} storeId={storeId} onRefresh={fetchAll} onToast={showToast} />
              ))}
            </div>
          )
        ) : tab === 'purchase' ? (
          purchaseViewMode === 'order_mgmt' ? (
            <MakerOrderPanel
              purchases={purchases.filter(p => ['received', 'ordered'].includes(p.status))}
              storeId={storeId} onRefresh={fetchAll} onToast={showToast}
            />
          ) : purchases.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">対応中の追加購入はありません</p>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">該当する追加購入はありません</p>
              <button onClick={() => setPurchaseFilter(null)} className="mt-2 text-xs text-indigo-600">絞り込みを解除</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map(p => (
                <PurchaseCard key={p.id} item={p} storeId={storeId} onRefresh={fetchAll} onToast={showToast} />
              ))}
            </div>
          )
        ) : (
          // お渡しタブ
          deliverySubTab === 'waiting' ? (
            waiting.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Package size={44} className="mx-auto mb-3 opacity-15" />
                <p className="text-sm font-bold">お渡し待ちのアイテムはありません</p>
                <p className="text-xs mt-1 text-gray-400">お直し完了・入荷済みの商品がここに表示されます</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...waitingUnpaid, ...waitingPaid].map(item => (
                  <WaitingCard
                    key={item.id}
                    item={item}
                    alertDays={alertDays}
                    onDeliver={handleDeliver}
                    onPaymentToggle={handlePaymentToggle}
                  />
                ))}
              </div>
            )
          ) : (
            histLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-indigo-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <History size={44} className="mx-auto mb-3 opacity-15" />
                <p className="text-sm font-bold">お渡し完了履歴はありません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <CompletedCard
                    key={item.id}
                    item={item}
                    onRevert={handleRevert}
                    onPaymentToggle={handlePaymentToggle}
                  />
                ))}
              </div>
            )
          )
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} onClose={() => setToast(null)} />}
      <BottomNav />
    </div>
  )
}
