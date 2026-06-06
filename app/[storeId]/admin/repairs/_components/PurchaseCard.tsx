'use client'

import { useState } from 'react'
import {
  Loader2, ChevronDown, ChevronUp,
  Phone, User, Check, RotateCcw,
  Pencil, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
} from '@/types/crm'
import { fmtDate } from './utils'
import type { PurchaseRow, UniformOrderRow } from './types'

export function PurchaseCard({ item, storeId, onRefresh, onToast, onEdit }: {
  item: PurchaseRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [open,           setOpen]           = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [confirmPrimary, setConfirmPrimary] = useState(false)
  const [confirmCancel,  setConfirmCancel]  = useState(false)

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

  const statusAccent =
    ['received', 'ordered'].includes(item.status) ? 'border-orange-200 bg-white' :
    item.status === 'on_order' ? 'border-blue-200 bg-white' :
    item.status === 'stocked'  ? 'border-teal-200 bg-white' :
    'border-gray-200 bg-white'

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-sm ${statusAccent}`}>
      {/* Status accent strip */}
      <div className={`h-1 w-full ${
        ['received', 'ordered'].includes(item.status) ? 'bg-orange-400' :
        item.status === 'on_order' ? 'bg-blue-400' :
        item.status === 'stocked'  ? 'bg-teal-400' : 'bg-gray-200'
      }`} />
      <button className="w-full text-left px-4 pt-3 pb-3 flex items-start gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${PURCHASE_STATUS_COLORS[item.status]}`}>
              {PURCHASE_STATUS_LABELS[item.status]}
            </span>
            {item.maker && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-semibold">
                {item.maker}
              </span>
            )}
          </div>
          <p className="text-lg font-black text-gray-900 leading-snug mb-1 tracking-tight">{item.item_name}</p>
          {item.notes && <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">{item.notes}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.child?.school_name && (
              <span className="text-[11px] font-black text-amber-600">{item.child.school_name}</span>
            )}
            <span className="text-sm font-bold text-gray-800">{name}</span>
            {item.child && (
              <span className="text-[11px] text-gray-400">（保護者: {item.customer?.name}）</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {item.price != null && (
              <span className="text-sm font-black text-gray-600">¥{item.price.toLocaleString()}</span>
            )}
            <span className="text-[10px] text-gray-400">依頼 {fmtDate(item.ordered_date)}</span>
          </div>
        </div>
        <div className="shrink-0 self-center ml-1">
          {open ? <ChevronUp size={15} className="text-gray-300" /> : <ChevronDown size={15} className="text-gray-300" />}
        </div>
      </button>

      {/* Primary action button — 2-tap confirmation */}
      {primaryBtn && (
        <div className="px-4 pb-4">
          {confirmPrimary ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 space-y-3">
              <p className="text-xs text-center text-gray-600 font-bold">もう一度タップして確定します</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmPrimary(false)}
                  className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold active:scale-95 transition-all">
                  戻る
                </button>
                <button onClick={() => { setConfirmPrimary(false); primaryBtn.onClick() }} disabled={loading}
                  className={`flex-1 py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all shadow-sm ${primaryBtn.color}`}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  確定する
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmPrimary(true)} disabled={loading}
              className={`w-full py-4 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md ${primaryBtn.color}`}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : primaryBtn.label}
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-3 flex-wrap">
            {item.customer?.tel && (
              <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                <Phone size={12} />{item.customer.tel}
              </a>
            )}
            <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium">
              <User size={11} />顧客詳細
            </a>
          </div>
          {onEdit && (
            <button onClick={() => onEdit(item)}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 active:scale-95 transition-all">
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
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
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
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-all">
              <RotateCcw size={11} />依頼受付に戻す
            </button>
          )}

          {/* Cancel / delete */}
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-red-200 bg-red-50 text-red-500 flex items-center justify-center gap-1.5 hover:bg-red-100 active:scale-95 transition-all">
              <Trash2 size={11} />キャンセル（削除）
            </button>
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 space-y-2.5">
              <p className="text-sm text-red-700 font-black text-center">本当に削除しますか？</p>
              <p className="text-[10px] text-red-400 text-center">この操作は取り消せません</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                <button onClick={async () => {
                  setLoading(true)
                  const { error } = await (supabase as any).from('purchase_orders').delete().eq('id', item.id)
                  setLoading(false)
                  if (error) { onToast('err', '削除に失敗しました'); return }
                  onToast('ok', '削除しました')
                  onRefresh()
                }} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-black flex items-center justify-center gap-1 disabled:opacity-50">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} />削除する</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function UniformOrderCard({ item, storeId, onRefresh, onToast }: {
  item: UniformOrderRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)

  async function update(patch: Record<string, unknown>, msg: string) {
    setLoading(true)
    const { error } = await (supabase as any)
      .from('uniform_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', msg)
  }

  const name = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  const statusLabel =
    item.status === 'confirmed' ? '受注済み' :
    item.status === 'ordered'   ? '発注済み' :
    item.status === 'arrived'   ? '入荷済み' : item.status

  const accent =
    item.status === 'confirmed' ? 'bg-orange-400' :
    item.status === 'ordered'   ? 'bg-blue-400' :
    item.status === 'arrived'   ? 'bg-emerald-400' : 'bg-gray-300'

  const badgeColor =
    item.status === 'confirmed' ? 'bg-orange-100 text-orange-700 border-orange-200' :
    item.status === 'ordered'   ? 'bg-blue-100 text-blue-700 border-blue-200' :
    item.status === 'arrived'   ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'

  return (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden shadow-sm bg-white">
      <div className={`h-1 w-full ${accent}`} />
      <button className="w-full text-left px-4 pt-3 pb-3 flex items-start gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold">制服注文</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${badgeColor}`}>{statusLabel}</span>
          </div>
          <p className="text-base font-black text-gray-900 leading-snug mb-1">
            {(item.items ?? []).map(i => i.item_name).join('・') || '（商品なし）'}
          </p>
          {item.notes && <p className="text-xs text-gray-400 mb-1.5">{item.notes}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.child?.school_name && (
              <span className="text-[11px] font-black text-amber-600">{item.child.school_name}</span>
            )}
            <span className="text-sm font-bold text-gray-800">{name}</span>
            {item.child && <span className="text-[11px] text-gray-400">（保護者: {item.customer?.name}）</span>}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {item.total_amount != null && (
              <span className="text-sm font-black text-gray-600">¥{item.total_amount.toLocaleString()}</span>
            )}
            <span className="text-[10px] text-gray-400">注文 {fmtDate(item.created_at)}</span>
            {item.expected_delivery_date && (
              <span className="text-[10px] text-gray-400">希望 {fmtDate(item.expected_delivery_date)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 self-center ml-1">
          {open ? <ChevronUp size={15} className="text-gray-300" /> : <ChevronDown size={15} className="text-gray-300" />}
        </div>
      </button>

      {/* Action buttons */}
      <div className="px-4 pb-4 space-y-2">
        {item.status === 'confirmed' && (
          <button onClick={() => update({ status: 'ordered' }, '発注済みにしました')} disabled={loading}
            className="w-full py-4 rounded-xl font-black text-sm text-white bg-orange-600 hover:bg-orange-500 flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-orange-200 active:scale-[0.98] transition-all">
            {loading ? <Loader2 size={16} className="animate-spin" /> : '🚚 発注する'}
          </button>
        )}
        {item.status === 'ordered' && (
          <button onClick={() => update({ status: 'arrived' }, '入荷完了・連絡しました')} disabled={loading}
            className="w-full py-4 rounded-xl font-black text-sm text-white bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-200 active:scale-[0.98] transition-all">
            {loading ? <Loader2 size={16} className="animate-spin" /> : '📦 入荷完了（お渡し待ちへ）'}
          </button>
        )}
        {item.status === 'arrived' && (
          <button onClick={() => update({ status: 'delivered' }, 'お渡し済みにしました')} disabled={loading}
            className="w-full py-4 rounded-xl font-black text-sm text-white bg-gray-600 hover:bg-gray-500 flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-gray-200 active:scale-[0.98] transition-all">
            {loading ? <Loader2 size={16} className="animate-spin" /> : '✅ お渡し済みにする'}
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
          {(item.items ?? []).length > 0 && (
            <div className="space-y-1">
              {(item.items ?? []).map((i, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium">{i.item_name}</span>
                  <span className="text-gray-500">×{i.quantity}{i.unit_price != null ? ` ¥${i.unit_price.toLocaleString()}` : ''}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap mt-1">
            {item.customer?.tel && (
              <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                <Phone size={12} />{item.customer.tel}
              </a>
            )}
            <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium">
              <User size={11} />顧客詳細
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
