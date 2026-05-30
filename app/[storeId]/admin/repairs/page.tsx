'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Scissors, ShoppingBag, Loader2, ChevronDown, ChevronUp,
  Phone, User, Check, RotateCcw, Package, ClipboardList,
  Banknote, Plus, AlertCircle, CreditCard, CheckCheck,
  History, CalendarDays, Copy, X, Pencil, Truck, LayoutDashboard,
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
  desired_completion_date: string | null; work_started: boolean
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

// ── Repair Card (お直し・依頼カード) ──────────────────────────
function RepairCard({ item, storeId, onRefresh, onToast, onEdit }: {
  item: RepairRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: RepairRow) => void
}) {
  const [open,       setOpen]       = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)

  const reqType = (item.request_type ?? 'repair') as RequestType
  const name    = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const deadlineDate = item.desired_completion_date ? new Date(item.desired_completion_date) : null
  if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0)
  const daysLeft   = deadlineDate ? Math.floor((deadlineDate.getTime() - today.getTime()) / 86400000) : null
  const isOverdue  = daysLeft !== null && daysLeft < 0
  const isDueSoon  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 1

  async function update(patch: Record<string, unknown>, msg: string, undoPatch?: Record<string, unknown>) {
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

  // Primary action config
  let primaryBtn: { label: string; color: string; onClick: () => void } | null = null
  if (reqType === 'repair') {
    if (!item.work_started) {
      primaryBtn = {
        label: '✂️ 作業開始',
        color: 'bg-amber-500 hover:bg-amber-400 shadow-amber-200',
        onClick: () => update({ work_started: true }, '作業開始しました', { work_started: false }),
      }
    } else {
      primaryBtn = {
        label: '✅ お直し完了',
        color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
        onClick: () => update(
          { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
          'お直し完了・連絡しました',
          { status: 'received', completed_date: null, notified: false }
        ),
      }
    }
  } else if (reqType === 'walk_in') {
    primaryBtn = {
      label: '✅ 対応完了・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '対応完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'hold_request') {
    primaryBtn = {
      label: '✅ 確保済み・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '確保済みにしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  }

  const cardBg =
    isOverdue  ? 'bg-red-50 border-red-400 border-2' :
    isDueSoon  ? 'bg-amber-50 border-amber-400 border-2' :
    item.work_started ? 'bg-amber-50/40 border-amber-300' :
    'bg-white border-slate-200'

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-sm ${cardBg}`}>
      {/* Clickable summary area */}
      <button className="w-full text-left px-4 pt-4 pb-3 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${REQUEST_TYPE_COLORS[reqType]}`}>
              {REQUEST_TYPE_LABELS[reqType]}
            </span>
            {item.work_started && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">✂️ 作業中</span>
            )}
            {isOverdue && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-black animate-pulse">
                🚨 期限超過 {Math.abs(daysLeft!)}日
              </span>
            )}
            {isDueSoon && !isOverdue && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-black">⚠️ 期限間近</span>
            )}
            {!item.prepaid && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-black animate-pulse">未払い</span>
            )}
          </div>

          {/* Hero: お直し内容 */}
          {item.content ? (
            <p className="text-xl font-black text-slate-900 leading-snug mb-1">{item.content}</p>
          ) : (
            <p className="text-base font-black text-slate-400 leading-snug mb-1 italic">（内容未記入）</p>
          )}

          {/* Item name */}
          <p className="text-sm font-semibold text-slate-500 leading-tight mb-2">{item.item_name}</p>

          {/* Customer */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.child?.school_name && (
              <span className="text-xs font-black text-amber-600">{item.child.school_name}</span>
            )}
            <span className="text-sm font-bold text-slate-800">{name}</span>
            {item.child && (
              <span className="text-xs text-slate-400">（保護者: {item.customer?.name}）</span>
            )}
          </div>

          {/* Price + dates */}
          <div className="flex items-end justify-between mt-2">
            <div className="flex items-center gap-2">
              {item.price != null && (
                <span className={`text-sm font-black ${item.prepaid ? 'text-slate-500' : 'text-red-700'}`}>
                  ¥{item.price.toLocaleString()}
                </span>
              )}
              {item.slip_number && (
                <span className="text-[10px] font-mono text-slate-400">#{item.slip_number}</span>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">受付: {fmtDate(item.received_date)}</p>
              {item.desired_completion_date && (
                <p className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-slate-400'}`}>
                  希望: {fmtDate(item.desired_completion_date)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 mt-1">
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {/* Primary action button — always visible */}
      {primaryBtn && (
        <div className="px-4 pb-4">
          <button
            onClick={primaryBtn.onClick}
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-base text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md ${primaryBtn.color}`}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : primaryBtn.label}
          </button>
        </div>
      )}

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100 pt-3">
          {item.notes && <p className="text-xs text-gray-600">{item.notes}</p>}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <User size={11} />顧客詳細
          </a>

          {/* Payment toggle */}
          {item.prepaid ? (
            <button onClick={() => update({ prepaid: false }, '未払いに戻しました', { prepaid: true })}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 bg-emerald-100 border-emerald-200 text-emerald-700">
              <Banknote size={14} />✅ 支払済み — タップで未払いに戻す
            </button>
          ) : confirmPay ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
              <p className="text-xs text-emerald-700 font-bold text-center">支払い完了にしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmPay(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">キャンセル</button>
                <button onClick={() => { update({ prepaid: true }, '支払い完了にしました'); setConfirmPay(false) }}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1">
                  <Banknote size={13} />支払い完了
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmPay(true)}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 bg-red-100 border-red-400 text-red-700">
              <Banknote size={14} />⚠️ 未払い — タップして支払い確認
            </button>
          )}

          {onEdit && (
            <button onClick={() => onEdit(item)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 active:scale-95 transition-all">
              <Pencil size={11} />注文内容を変更する
            </button>
          )}

          {item.status !== 'received' && (
            <button onClick={() => update(
              { status: 'received', completed_date: null, delivered_date: null, notified: false },
              '受付中に戻しました',
              { status: item.status, completed_date: item.completed_date, delivered_date: item.delivered_date, notified: item.notified }
            )} disabled={loading}
              className="w-full py-2 rounded-xl font-bold text-xs border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100 active:scale-95 transition-all">
              <RotateCcw size={11} />受付中に戻す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Purchase Card ─────────────────────────────────────────────
function PurchaseCard({ item, storeId, onRefresh, onToast, onEdit }: {
  item: PurchaseRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)

  async function update(patch: Record<string, unknown>, msg: string, undoPatch?: Record<string, unknown>) {
    setLoading(true)
    const { error } = await (supabase as any)
      .from('purchase_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', msg, undoPatch ? async () => {
      await (supabase as any).from('purchase_orders')
        .update({ ...undoPatch, updated_at: new Date().toISOString() }).eq('id', item.id)
      onRefresh()
    } : undefined)
  }

  // Primary action: 発注する or 入荷完了
  let primaryBtn: { label: string; color: string; onClick: () => void } | null = null
  if (['received', 'ordered'].includes(item.status)) {
    primaryBtn = {
      label: '🚚 発注する',
      color: 'bg-orange-600 hover:bg-orange-500 shadow-orange-200',
      onClick: () => update(
        { status: 'on_order' },
        '発注済みにしました',
        { status: item.status }
      ),
    }
  } else if (['on_order', 'stocked'].includes(item.status)) {
    primaryBtn = {
      label: '📦 入荷完了（お渡し待ちへ）',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'arrived', arrived_date: new Date().toISOString().slice(0, 10), notified: true },
        '入荷完了・連絡しました',
        { status: item.status, arrived_date: item.arrived_date, notified: item.notified }
      ),
    }
  }

  const name = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button className="w-full text-left px-4 pt-4 pb-3 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${PURCHASE_STATUS_COLORS[item.status]}`}>
              {PURCHASE_STATUS_LABELS[item.status]}
            </span>
            {item.maker && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                {item.maker}
              </span>
            )}
          </div>
          <p className="text-lg font-black text-slate-900 leading-snug mb-1">{item.item_name}</p>
          {item.notes && <p className="text-xs text-slate-500 mb-1.5">{item.notes}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.child?.school_name && (
              <span className="text-xs font-black text-amber-600">{item.child.school_name}</span>
            )}
            <span className="text-sm font-bold text-slate-700">{name}</span>
            {item.child && (
              <span className="text-xs text-slate-400">（保護者: {item.customer?.name}）</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {item.price != null && (
              <span className="text-sm font-black text-slate-600">¥{item.price.toLocaleString()}</span>
            )}
            <span className="text-xs text-slate-400">依頼: {fmtDate(item.ordered_date)}</span>
          </div>
        </div>
        <div className="shrink-0 mt-1">
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {/* Primary action button — always visible */}
      {primaryBtn && (
        <div className="px-4 pb-4">
          <button onClick={primaryBtn.onClick} disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-base text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md ${primaryBtn.color}`}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : primaryBtn.label}
          </button>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100 pt-3">
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <User size={11} />顧客詳細
          </a>
          {onEdit && (
            <button onClick={() => onEdit(item)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 active:scale-95 transition-all">
              <Pencil size={11} />注文内容を変更する
            </button>
          )}
          {/* In-store stock option for unordered */}
          {['received', 'ordered'].includes(item.status) && (
            <button onClick={() => update(
              { status: 'stocked', arrived_date: new Date().toISOString().slice(0, 10), notified: true },
              '店頭在庫確保しました',
              { status: item.status, arrived_date: null, notified: false }
            )} disabled={loading}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              店頭在庫確保（取り置き済み）
            </button>
          )}
          {!['received', 'ordered'].includes(item.status) && (
            <button onClick={() => update(
              { status: 'received', arrived_date: null, delivered_date: null, notified: false },
              '依頼受付に戻しました',
              { status: item.status, arrived_date: item.arrived_date, delivered_date: item.delivered_date, notified: item.notified }
            )} disabled={loading}
              className="w-full py-2 rounded-xl font-bold text-xs border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100">
              <RotateCcw size={11} />依頼受付に戻す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Aggregated Order UI ───────────────────────────────────────
interface OrderGroup {
  groupKey:   string
  item_name:  string
  maker:      string | null
  totalCount: number
  orders:     PurchaseRow[]
}

function AggregatedOrderCard({ group, checked, onCheck, onToast, onEdit }: {
  group: OrderGroup; checked: boolean; onCheck: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [open,   setOpen]   = useState(false)
  const [copied, setCopied] = useState(false)

  function copyToClipboard() {
    const breakdown = group.orders
      .map(o => `・${o.child?.name ?? o.customer?.name ?? '不明'}${o.notes ? `（${o.notes}）` : ''}`)
      .join('\n')
    const lines = [
      `【品名】${group.item_name}`,
      group.maker ? `【メーカー】${group.maker}` : null,
      `【数量】${group.totalCount}件`,
      `─内訳─`,
      breakdown,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => onToast('err', 'コピーに失敗しました'))
  }

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-colors ${
      checked ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={e => { e.stopPropagation(); onCheck() }}
          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
            checked ? 'border-orange-500 bg-orange-500' : 'border-gray-300 hover:border-gray-400'
          }`}>
          {checked && <Check size={13} className="text-white" />}
        </button>
        <button className="flex-1 text-left min-w-0" onClick={() => setOpen(v => !v)}>
          {group.maker && <p className="text-[10px] font-bold text-gray-400 leading-tight">{group.maker}</p>}
          <p className="font-black text-gray-900 text-sm leading-snug">{group.item_name}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-orange-600">{group.totalCount}</span>
            <span className="text-xs font-bold text-gray-500">件</span>
            <span className="text-[10px] text-gray-400">/ {group.orders.length}人</span>
          </div>
        </button>
        <button onClick={copyToClipboard}
          className={`shrink-0 p-2 rounded-xl transition-all ${
            copied ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}>
          {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
        </button>
        <button onClick={() => setOpen(v => !v)} className="shrink-0 text-gray-400 p-1">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-gray-100">
          {group.orders.map((order, idx) => (
            <div key={order.id} className={`px-4 py-2.5 flex items-start gap-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-gray-500">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{order.child?.name ?? order.customer?.name ?? '（不明）'}</p>
                {order.child && <p className="text-[10px] text-gray-400">保護者: {order.customer?.name}</p>}
                {order.notes && <p className="text-xs text-gray-500 mt-0.5">{order.notes}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">依頼日: {fmtDate(order.ordered_date)}</p>
              </div>
              {order.price != null && (
                <p className="text-xs font-bold text-gray-600 shrink-0">¥{order.price.toLocaleString()}</p>
              )}
              {onEdit && (
                <button onClick={() => onEdit(order)}
                  className="shrink-0 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                  <Pencil size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AggregatedOrderList({ orders, storeId, onRefresh, onToast, onEdit }: {
  orders: PurchaseRow[]; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [checked,  setChecked]  = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState(false)

  const groups = useMemo<OrderGroup[]>(() => {
    const map = new Map<string, OrderGroup>()
    for (const order of orders) {
      const key = order.item_name.trim()
      if (!map.has(key)) map.set(key, { groupKey: key, item_name: order.item_name, maker: order.maker, totalCount: 0, orders: [] })
      const g = map.get(key)!
      g.totalCount++
      g.orders.push(order)
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.maker && b.maker) return a.maker.localeCompare(b.maker, 'ja')
      if (a.maker) return -1; if (b.maker) return 1
      return a.item_name.localeCompare(b.item_name, 'ja')
    })
  }, [orders])

  useEffect(() => { setChecked(new Set()) }, [orders])

  function toggleCheck(key: string) {
    setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleAll() {
    setChecked(checked.size === groups.length ? new Set() : new Set(groups.map(g => g.groupKey)))
  }

  async function bulkMarkOrdered() {
    const selectedGroups = groups.filter(g => checked.has(g.groupKey))
    const selectedIds    = selectedGroups.flatMap(g => g.orders.map(o => o.id))
    if (selectedIds.length === 0) return
    const prevStatuses = Object.fromEntries(selectedGroups.flatMap(g => g.orders.map(o => [o.id, o.status])))
    setUpdating(true)
    const { error } = await (supabase as any)
      .from('purchase_orders')
      .update({ status: 'on_order', updated_at: new Date().toISOString() })
      .in('id', selectedIds)
    setUpdating(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', `${selectedIds.length}件を発注済みにしました`, async () => {
      await Promise.all(
        Object.entries(prevStatuses).map(([id, status]) =>
          (supabase as any).from('purchase_orders')
            .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
        )
      )
      onRefresh()
    })
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <ShoppingBag size={24} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">未発注の追加購入はありません</p>
      </div>
    )
  }

  const allChecked   = checked.size === groups.length && groups.length > 0
  const checkedTotal = groups.filter(g => checked.has(g.groupKey)).reduce((s, g) => s + g.totalCount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-800">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${allChecked ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
            {allChecked && <Check size={11} className="text-white" />}
          </div>
          {allChecked ? 'すべて解除' : 'すべて選択'}
        </button>
        <span className="text-xs text-gray-400">{groups.length}品目 / 計{orders.length}件</span>
      </div>
      <div className="space-y-2 pb-4">
        {groups.map(group => (
          <AggregatedOrderCard key={group.groupKey} group={group}
            checked={checked.has(group.groupKey)} onCheck={() => toggleCheck(group.groupKey)}
            onToast={onToast} onEdit={onEdit} />
        ))}
      </div>
      {checked.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
          <div className="max-w-lg w-full bg-orange-700 text-white rounded-2xl shadow-2xl p-3 flex items-center gap-3 pointer-events-auto">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold opacity-70">選択中</p>
              <p className="text-sm font-black">{checked.size}品目 / {checkedTotal}件</p>
            </div>
            <button onClick={bulkMarkOrdered} disabled={updating}
              className="shrink-0 px-5 py-2.5 bg-white text-orange-700 font-black text-sm rounded-xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow">
              {updating ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              まとめて発注済みに
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payment Badge ─────────────────────────────────────────────
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
          className="text-[10px] text-white bg-red-600 px-2 py-0.5 rounded-lg font-bold">戻す</button>
      </div>
    )
  }
  return (
    <button onClick={isPaid ? () => setConfirmUnpay(true) : () => setConfirmPay(true)} disabled={loading}
      className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border transition-all active:scale-95 disabled:opacity-50 ${
        isPaid ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'
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
          <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-blue-600 text-xs font-bold mt-2">
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
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
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
              <div className="flex gap-2">
                <button onClick={() => setUnpaidConfirm(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-gray-200 text-gray-700">戻る</button>
                <button onClick={async () => {
                  setUnpaidConfirm(false); setLoading('deliver')
                  await onDeliver(item, false); setLoading(null); setConfirmOpen(false)
                }} disabled={!!loading}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-red-600 text-white disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading === 'deliver' ? <Loader2 size={12} className="animate-spin" /> : '未払いのままお渡し'}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setConfirmOpen(false); setUnpaidConfirm(false) }}
              className="py-3 rounded-xl font-bold text-sm bg-gray-300 text-gray-700">キャンセル</button>
            <button onClick={async () => {
              if (!payAtDeliver && item.payment_status !== 'paid') { setUnpaidConfirm(true); return }
              setLoading('deliver')
              await onDeliver(item, payAtDeliver)
              setLoading(null); setConfirmOpen(false)
            }} disabled={!!loading || unpaidConfirm}
              className="py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading === 'deliver' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><Package size={13} />お渡し</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Completed Card ────────────────────────────────────────────
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
      isUnpaidDelivered ? 'border-2 border-red-500 bg-red-50' : 'bg-gray-100 border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center bg-gray-200">
          <Package size={14} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          {item.customer && (
            <button onClick={() => setCustOpen(v => !v)}
              className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1 w-full text-left">
              <User size={10} />
              {item.customer.name}
              {item.child && <span className="text-gray-500">（{item.child.name}）</span>}
              <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform text-gray-500 ${custOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-gray-300/60 text-gray-500 border-gray-300">お渡し済み</span>
            {isUnpaidDelivered && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full border bg-red-600 text-white border-red-600 flex items-center gap-1 animate-pulse">
                <AlertCircle size={9} />代金未回収
              </span>
            )}
            <PaymentBadge status={item.payment_status} loading={loading === 'payment'}
              onToggle={async () => { setLoading('payment'); await onPaymentToggle(item); setLoading(null) }} />
          </div>
          <p className="font-bold text-gray-700 text-sm">{item.item_name}</p>
          {item.sub_label && <p className="text-gray-500 text-xs mt-0.5">{item.sub_label}</p>}
          {item.price != null && <p className="text-gray-500 text-xs mt-0.5">¥{item.price.toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-[10px]">
            <span className="flex items-center gap-1"><CalendarDays size={9} />受付 {fmtDate(item.received_date)}</span>
            {item.delivered_date && (
              <span className="flex items-center gap-1"><Package size={9} />お渡し {fmtDate(item.delivered_date)}</span>
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
          className="w-full mt-3 py-2 rounded-xl font-bold text-xs border border-gray-300 text-gray-500 hover:border-gray-400 flex items-center justify-center gap-1.5">
          <RotateCcw size={11} />お渡しを取り消す
        </button>
      ) : (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-center text-amber-700 font-bold">お渡しを取り消して前の状態に戻しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmRevert(false)}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-gray-200 text-gray-700">キャンセル</button>
            <button onClick={async () => {
              setLoading('revert'); await onRevert(item); setLoading(null); setConfirmRevert(false)
            }} disabled={!!loading}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-amber-600 text-white disabled:opacity-50 flex items-center justify-center gap-1">
              {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />取り消す</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ kind, item, onClose, onSave, onToast }: {
  kind: 'repair' | 'purchase'
  item: RepairRow | PurchaseRow
  onClose: () => void
  onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [saving,   setSaving]   = useState(false)
  const [itemName, setItemName] = useState(item.item_name)
  const [content,  setContent]  = useState(kind === 'repair' ? (item as RepairRow).content : '')
  const [maker,    setMaker]    = useState(kind === 'purchase' ? ((item as PurchaseRow).maker ?? '') : '')
  const [price,    setPrice]    = useState(String(item.price ?? ''))
  const [deadline, setDeadline] = useState(kind === 'repair' ? ((item as RepairRow).desired_completion_date ?? '') : '')
  const [notes,    setNotes]    = useState(item.notes ?? '')

  async function handleSave() {
    if (!itemName.trim()) return
    setSaving(true)
    const table = kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const patch: Record<string, unknown> = {
      item_name: itemName.trim(),
      notes:     notes.trim() || null,
      price:     price ? Number(price) : null,
      updated_at: new Date().toISOString(),
    }
    if (kind === 'repair') {
      patch.content = content.trim()
      patch.desired_completion_date = deadline || null
    } else {
      patch.maker = maker.trim() || null
    }
    const { error } = await (supabase as any).from(table).update(patch).eq('id', item.id)
    setSaving(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onToast('ok', '変更を保存しました')
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Pencil size={14} className="text-indigo-500" />注文内容を変更
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 font-medium">
          {kind === 'repair' ? '✂️ お直し依頼' : '📦 追加購入'}
          {' — '}
          {(kind === 'repair' ? (item as RepairRow).customer?.name : (item as PurchaseRow).customer?.name) ?? '顧客不明'}
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">品名・商品名 <span className="text-red-500">*</span></label>
          <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="例: ○○中学校 スラックス Mサイズ" />
        </div>
        {kind === 'repair' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">お直し内容</label>
            <input type="text" value={content} onChange={e => setContent(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="例: 裾上げ 3cm、サイズ変更 M→L" />
          </div>
        )}
        {kind === 'purchase' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">メーカー</label>
            <input type="text" value={maker} onChange={e => setMaker(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="例: カンコー" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">金額（税込）</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="1200" />
          </div>
          {kind === 'repair' && (
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">希望完了日</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">備考・サイズ変更メモ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
            placeholder="数量変更・サイズ変更などの追記事項" />
        </div>
        <button onClick={handleSave} disabled={saving || !itemName.trim()}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          変更を保存する
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
type ActiveTab = 'repair' | 'purchase' | 'delivery' | 'summary'
type DeliverySubTab = 'waiting' | 'history'
type SortOrder = 'priority' | 'received_asc' | 'deadline_asc' | 'school' | 'name' | 'unpaid_first'

export default function RepairsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [tab,          setTab]          = useState<ActiveTab>('repair')
  const [deliverySubTab, setDeliverySubTab] = useState<DeliverySubTab>('waiting')
  const [repairs,      setRepairs]      = useState<RepairRow[]>([])
  const [purchases,    setPurchases]    = useState<PurchaseRow[]>([])
  const [waiting,      setWaiting]      = useState<DeliveryItem[]>([])
  const [history,      setHistory]      = useState<DeliveryItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [histLoading,  setHistLoading]  = useState(false)
  const [histFetched,  setHistFetched]  = useState(false)
  const [alertDays,    setAlertDays]    = useState(7)
  const [fetchError,   setFetchError]   = useState<string | null>(null)
  const [toast,        setToast]        = useState<{ type: 'ok' | 'err'; msg: string; onUndo?: () => Promise<void> } | null>(null)
  const [sortOrder,    setSortOrder]    = useState<SortOrder>('priority')
  const [editItem,     setEditItem]     = useState<RepairRow | PurchaseRow | null>(null)
  const [editKind,     setEditKind]     = useState<'repair' | 'purchase' | null>(null)

  const showToast = useCallback((type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => {
    setToast({ type, msg, onUndo })
  }, [])

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
      { data: repairData,   error: repairErr   },
      { data: purchaseData, error: purchaseErr  },
      { data: waitRepairs  },
      { data: waitPurchases },
    ] = await Promise.all([
      (supabase as any).from('repair_histories')
        .select('*, desired_completion_date, work_started, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'received')
        .order('received_date', { ascending: true }),
      (supabase as any).from('purchase_orders')
        .select('*, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).not('status', 'in', '("arrived","delivered")')
        .order('ordered_date', { ascending: true }),
      supabase.from('repair_histories')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'completed')
        .order('completed_date', { ascending: true }),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'arrived')
        .order('arrived_date', { ascending: true }),
    ])
    if (repairErr)    setFetchError(repairErr.message)
    else if (purchaseErr) setFetchError(purchaseErr.message)
    setRepairs(repairData ?? [])
    setPurchases(purchaseData ?? [])
    const waitingItems: DeliveryItem[] = [
      ...(waitRepairs   ?? []).map((r: Record<string, unknown>) => rawToItem(r, 'repair')),
      ...(waitPurchases ?? []).map((p: Record<string, unknown>) => rawToItem(p, 'purchase')),
    ].sort((a, b) => (a.ready_date ?? a.received_date).localeCompare(b.ready_date ?? b.received_date))
    setWaiting(waitingItems)
    setLoading(false)
  }, [storeId])

  const fetchHistory = useCallback(async () => {
    if (!storeId || histFetched) return
    setHistLoading(true)
    const [{ data: hRepairs }, { data: hPurchases }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
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

  // ── Delivery actions ───────────────────────────────────────
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
        status: snapshot.prev_status, delivered_date: null, payment_status: snapshot.payment_status,
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
    const update: Record<string, unknown> = { status: item.prev_status, delivered_date: null, payment_status: 'unpaid' }
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
    const { error } = await (supabase as any).from(table).update({ payment_status: newStatus }).eq('id', item.id)
    if (error) { showToast('err', '支払状態の更新に失敗しました'); return }
    const updater = (prev: DeliveryItem[]) =>
      prev.map(i => i.id === item.id ? { ...i, payment_status: newStatus } : i)
    setWaiting(updater)
    setHistory(updater)
    if (newStatus === 'unpaid') {
      showToast('ok', '未払いに戻しました', async () => {
        await (supabase as any).from(table).update({ payment_status: prevStatus }).eq('id', item.id)
        setWaiting(p => p.map(i => i.id === item.id ? { ...i, payment_status: prevStatus } : i))
        setHistory(p => p.map(i => i.id === item.id ? { ...i, payment_status: prevStatus } : i))
      })
    }
  }, [showToast])

  // ── Sort + derived ─────────────────────────────────────────
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)

  function priorityScore(r: RepairRow): number {
    if (!r.desired_completion_date) return 500
    const d = new Date(r.desired_completion_date); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((d.getTime() - todayDate.getTime()) / 86400000)
    if (diff < 0) return diff - 1000
    if (diff === 0) return -100
    if (diff === 1) return -50
    return diff
  }

  const sortFn = (a: RepairRow, b: RepairRow): number => {
    switch (sortOrder) {
      case 'priority':     return priorityScore(a) - priorityScore(b)
      case 'received_asc': return a.received_date.localeCompare(b.received_date)
      case 'deadline_asc': {
        const da = a.desired_completion_date ?? '9999-12-31'
        const db = b.desired_completion_date ?? '9999-12-31'
        return da.localeCompare(db)
      }
      case 'school':       return (a.child?.school_name ?? '').localeCompare(b.child?.school_name ?? '', 'ja')
      case 'name': {
        const na = a.child?.name ?? a.customer?.name ?? ''
        const nb = b.child?.name ?? b.customer?.name ?? ''
        return na.localeCompare(nb, 'ja')
      }
      case 'unpaid_first': {
        const pa = a.prepaid ? 1 : 0; const pb = b.prepaid ? 1 : 0
        return pa !== pb ? pa - pb : priorityScore(a) - priorityScore(b)
      }
      default: return 0
    }
  }

  const sortedRepairs = repairs.slice().sort(sortFn)

  // 発注タブ: arrived は お渡し待ちに移動済みなので除外済み
  const purchaseUnordered = purchases.filter(p => ['received', 'ordered'].includes(p.status))
  const purchaseOnOrder   = purchases.filter(p => p.status === 'on_order')
  const purchaseStocked   = purchases.filter(p => p.status === 'stocked')

  // ダッシュボード counts
  const repairNotStarted  = repairs.filter(r => r.request_type === 'repair' && !r.work_started)
  const repairInProgress  = repairs.filter(r => r.request_type === 'repair' && r.work_started)
  const repairOther       = repairs.filter(r => r.request_type !== 'repair')
  const overdueRepairs    = repairs.filter(r => {
    if (!r.desired_completion_date) return false
    const d = new Date(r.desired_completion_date); d.setHours(0, 0, 0, 0)
    return d < todayDate
  })

  // 作業可能数（今すぐアクションを起こせる件数）
  const actionableNow =
    repairNotStarted.length +   // 作業開始ボタン
    repairOther.length +        // 来店・取置き対応
    purchaseUnordered.length +  // 発注ボタン
    waiting.length              // お渡しボタン

  // 全案件合計（進行中含む）
  const totalActive =
    repairs.length +
    purchases.length +
    waiting.length

  const waitingUnpaid = waiting.filter(i => i.payment_status !== 'paid')
  const waitingPaid   = waiting.filter(i => i.payment_status === 'paid')

  // ── Tab definitions ────────────────────────────────────────
  const tabs = [
    {
      id: 'repair'   as const,
      label: 'お直し',
      icon: Scissors,
      count: repairs.length,
      urgentCount: overdueRepairs.length,
      accent: 'bg-amber-600',
    },
    {
      id: 'purchase' as const,
      label: '発注',
      icon: ShoppingBag,
      count: purchases.length,
      urgentCount: purchaseUnordered.length,
      accent: 'bg-blue-600',
    },
    {
      id: 'delivery' as const,
      label: 'お渡し',
      icon: Package,
      count: waiting.length,
      urgentCount: 0,
      accent: 'bg-violet-600',
    },
    {
      id: 'summary'  as const,
      label: 'サマリー',
      icon: LayoutDashboard,
      count: 0,
      urgentCount: 0,
      accent: 'bg-slate-600',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900">
      {/* ── Header / Dashboard ────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">

          {/* Title row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <LayoutDashboard size={17} className="text-indigo-600" />
            </div>
            <h1 className="text-base font-bold text-gray-900 flex-1">業務ダッシュボード</h1>
            <a href={`/${storeId}/admin/crm`}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all">
              <Plus size={14} />依頼受付
            </a>
          </div>

          {/* Dashboard summary card */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl px-4 py-3 mb-3 text-white">
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[10px] font-bold opacity-70 uppercase tracking-wider mb-0.5">今すぐ対応できる件数</p>
                <div className="flex items-baseline gap-2">
                  <span className={`font-black leading-none ${actionableNow >= 10 ? 'text-5xl' : 'text-6xl'}`}>
                    {actionableNow}
                  </span>
                  <span className="text-base font-bold opacity-70">件</span>
                </div>
                <p className="text-xs opacity-60 mt-1">全案件合計: {totalActive} 件</p>
              </div>
              {overdueRepairs.length > 0 && (
                <div className="ml-auto bg-red-500/30 border border-red-400/50 rounded-xl px-3 py-2 text-center">
                  <p className="text-2xl font-black text-red-200">{overdueRepairs.length}</p>
                  <p className="text-[9px] font-bold text-red-200 opacity-90">🚨 期限超過</p>
                </div>
              )}
            </div>
            {/* Lane breakdown */}
            <div className="grid grid-cols-3 gap-2 mt-3 border-t border-white/20 pt-3">
              <button onClick={() => setTab('repair')} className="text-center active:scale-95 transition-all">
                <p className={`text-2xl font-black ${repairs.length > 0 ? 'text-white' : 'text-white/30'}`}>{repairs.length}</p>
                <p className="text-[9px] font-bold text-white/60">✂️ お直し</p>
              </button>
              <button onClick={() => setTab('purchase')} className="text-center active:scale-95 transition-all">
                <p className={`text-2xl font-black ${purchases.length > 0 ? 'text-white' : 'text-white/30'}`}>{purchases.length}</p>
                <p className="text-[9px] font-bold text-white/60">📦 発注</p>
              </button>
              <button onClick={() => setTab('delivery')} className="text-center active:scale-95 transition-all">
                <p className={`text-2xl font-black ${waiting.length > 0 ? 'text-white' : 'text-white/30'}`}>{waiting.length}</p>
                <p className="text-[9px] font-bold text-white/60">🎁 お渡し待ち</p>
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0.5 bg-slate-200 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-all ${
                  tab === t.id ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <t.icon size={15} />
                <span className="text-[11px] font-bold leading-none">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-32 space-y-4">
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
            DBエラー: {fetchError}
          </div>
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
                  deliverySubTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>

        ) : tab === 'repair' ? (
          /* ── ①お直しタブ ─────────────────────────────────── */
          <div className="space-y-4">
            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 shrink-0">並び替え:</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:border-indigo-500 focus:outline-none">
                <option value="priority">作業優先順（期限近い順）</option>
                <option value="received_asc">依頼受け日順（古い順）</option>
                <option value="deadline_asc">希望完了日順（近い順）</option>
                <option value="school">学校順</option>
                <option value="name">顧客名順</option>
                <option value="unpaid_first">未払い優先</option>
              </select>
            </div>

            {sortedRepairs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Scissors size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">対応中のお直し・依頼はありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedRepairs.map(r => (
                  <RepairCard key={r.id} item={r} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                    onEdit={item => { setEditItem(item); setEditKind('repair') }} />
                ))}
              </div>
            )}
          </div>

        ) : tab === 'purchase' ? (
          /* ── ②発注タブ ───────────────────────────────────── */
          <div className="space-y-6">
            {purchases.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">対応中の発注はありません</p>
              </div>
            ) : (
              <>
                {/* 未発注: 集約リスト */}
                {purchaseUnordered.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                      <p className="text-sm font-black text-orange-700">未発注 — メーカーへ発注してください</p>
                      <span className="ml-auto text-sm font-black text-orange-600">{purchaseUnordered.length}件</span>
                    </div>
                    <AggregatedOrderList
                      orders={purchaseUnordered}
                      storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                      onEdit={item => { setEditItem(item); setEditKind('purchase') }}
                    />
                  </section>
                )}

                {/* 発注済み: 入荷待ち */}
                {purchaseOnOrder.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-sm font-black text-blue-700">発注済み — 入荷を待っています</p>
                      <span className="ml-auto text-sm font-black text-blue-600">{purchaseOnOrder.length}件</span>
                    </div>
                    <div className="space-y-3">
                      {purchaseOnOrder.map(p => (
                        <PurchaseCard key={p.id} item={p} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                          onEdit={item => { setEditItem(item); setEditKind('purchase') }} />
                      ))}
                    </div>
                  </section>
                )}

                {/* 在庫確保済み */}
                {purchaseStocked.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                      <p className="text-sm font-black text-teal-700">在庫確保済み — お渡し待ちに移動できます</p>
                      <span className="ml-auto text-sm font-black text-teal-600">{purchaseStocked.length}件</span>
                    </div>
                    <div className="space-y-3">
                      {purchaseStocked.map(p => (
                        <PurchaseCard key={p.id} item={p} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                          onEdit={item => { setEditItem(item); setEditKind('purchase') }} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

        ) : tab === 'delivery' ? (
          /* ── ③お渡しタブ ─────────────────────────────────── */
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
                  <WaitingCard key={item.id} item={item} alertDays={alertDays}
                    onDeliver={handleDeliver} onPaymentToggle={handlePaymentToggle} />
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
                  <CompletedCard key={item.id} item={item} onRevert={handleRevert} onPaymentToggle={handlePaymentToggle} />
                ))}
              </div>
            )
          )

        ) : (
          /* ── ④サマリータブ ───────────────────────────────── */
          <div className="space-y-4">
            {/* Stage overview */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-black text-slate-500 mb-3 uppercase tracking-wider">📊 案件ステータス一覧</p>
              <div className="space-y-2.5">
                {[
                  { label: '✂️ お直し 未着手',   value: repairNotStarted.length,  color: 'bg-amber-100 text-amber-800',   onClick: () => setTab('repair') },
                  { label: '✂️ お直し 作業中',    value: repairInProgress.length,  color: 'bg-amber-200 text-amber-900',   onClick: () => setTab('repair') },
                  { label: '📋 来店・取置き対応', value: repairOther.length,       color: 'bg-indigo-100 text-indigo-800', onClick: () => setTab('repair') },
                  { label: '📦 発注 未発注',       value: purchaseUnordered.length, color: 'bg-orange-100 text-orange-800', onClick: () => setTab('purchase') },
                  { label: '📦 発注 発注済み',     value: purchaseOnOrder.length,   color: 'bg-blue-100 text-blue-800',     onClick: () => setTab('purchase') },
                  { label: '📦 発注 在庫確保済み', value: purchaseStocked.length,   color: 'bg-teal-100 text-teal-800',     onClick: () => setTab('purchase') },
                  { label: '🎁 お渡し待ち',        value: waiting.length,           color: 'bg-violet-100 text-violet-800', onClick: () => setTab('delivery') },
                ].map(s => (
                  <button key={s.label} onClick={s.onClick}
                    className="w-full flex items-center gap-3 active:scale-[0.98] transition-all">
                    <span className="flex-1 text-sm font-semibold text-slate-700 text-left">{s.label}</span>
                    <span className={`px-3 py-1 rounded-xl text-sm font-black ${s.color}`}>{s.value} 件</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Overdue alert */}
            {overdueRepairs.length > 0 && (
              <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4">
                <p className="text-sm font-black text-red-700 mb-3 flex items-center gap-2">
                  <AlertCircle size={16} />🚨 期限超過 — 今すぐ対応が必要です（{overdueRepairs.length}件）
                </p>
                <div className="space-y-2">
                  {overdueRepairs.map(r => {
                    const d = new Date(r.desired_completion_date!); d.setHours(0,0,0,0)
                    const days = Math.abs(Math.floor((d.getTime() - todayDate.getTime()) / 86400000))
                    const name = r.child?.name ?? r.customer?.name ?? '不明'
                    return (
                      <button key={r.id} onClick={() => setTab('repair')}
                        className="w-full text-left bg-white border border-red-200 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-all">
                        <p className="text-sm font-black text-slate-900">{r.content || r.item_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-red-600">{days}日超過</span>
                          <span className="text-xs text-slate-500">{name}</span>
                          {r.child?.school_name && <span className="text-xs font-bold text-amber-600">{r.child.school_name}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* History link */}
            <button
              onClick={() => { setTab('delivery'); setDeliverySubTab('history'); if (!histFetched) fetchHistory() }}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-all">
              <History size={18} className="text-slate-500" />
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-slate-700">お渡し完了履歴を見る</p>
                <p className="text-xs text-slate-400 mt-0.5">完了済みのお直し・発注の履歴</p>
              </div>
              <ChevronDown size={14} className="text-slate-400 -rotate-90" />
            </button>
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} onClose={() => setToast(null)} />}
      {editItem && editKind && (
        <EditModal kind={editKind} item={editItem}
          onClose={() => setEditItem(null)}
          onSave={() => { setEditItem(null); fetchAll() }}
          onToast={(t, m) => showToast(t, m)} />
      )}
      <BottomNav />
    </div>
  )
}
