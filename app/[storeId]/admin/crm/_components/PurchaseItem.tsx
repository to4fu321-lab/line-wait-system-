'use client'

import { useState } from 'react'
import {
  Package, CheckCheck, Loader2, CalendarDays,
  AlertCircle, RotateCcw, ShoppingBag, Bell,
} from 'lucide-react'
import {
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
} from '@/types/crm'
import type { PurchaseOrder } from '@/types/crm'
import type { PurchaseWithCustomer } from './types'
import { fmtDate } from './utils'
import { CustomerInfoPanel } from './CustomerForms'

// ============================================================
// 追加購入アイテム
// ============================================================
export function PurchaseItem({ order, showCustomer = false, storeId, onStock, onBackOrder, onArrive, onDeliver, onRevert, alertDays }: {
  order: PurchaseOrder | PurchaseWithCustomer
  showCustomer?: boolean
  storeId?: string
  onStock:     (id: string) => Promise<void>
  onBackOrder: (id: string) => Promise<void>
  onArrive:    (id: string) => Promise<void>
  onDeliver:   (id: string) => Promise<void>
  onRevert:    (id: string) => Promise<void>
  alertDays?: number
}) {
  const [loading,  setLoading]  = useState<string | null>(null)
  const [custOpen, setCustOpen] = useState(false)
  const customerName = showCustomer ? (order as PurchaseWithCustomer).customer?.name : null
  const childName    = showCustomer ? (order as PurchaseWithCustomer).child?.name    : null
  const isOverdue = alertDays != null && order.status === 'arrived' && order.arrived_date &&
    (Date.now() - new Date(order.arrived_date).getTime()) / 86400000 > alertDays
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - new Date(order.arrived_date!).getTime()) / 86400000)
    : 0

  const cardBg =
    order.status === 'delivered' ? 'bg-gray-50 border-gray-200' :
    order.status === 'arrived'   ? 'bg-emerald-50 border-emerald-200' :
    order.status === 'stocked'   ? 'bg-violet-50 border-violet-200' :
    order.status === 'on_order'  ? 'bg-orange-50 border-orange-200' :
                                   'bg-blue-50 border-blue-200'

  const iconBg =
    order.status === 'delivered' ? 'bg-gray-100' :
    order.status === 'arrived'   ? 'bg-emerald-100' :
    order.status === 'stocked'   ? 'bg-violet-100' :
    order.status === 'on_order'  ? 'bg-orange-100' :
                                   'bg-blue-100'

  const icon =
    order.status === 'delivered' ? <Package size={14} className="text-gray-500" /> :
    order.status === 'arrived'   ? <CheckCheck size={14} className="text-emerald-600" /> :
    order.status === 'stocked'   ? <ShoppingBag size={14} className="text-violet-600" /> :
    order.status === 'on_order'  ? <ShoppingBag size={14} className="text-orange-600" /> :
                                   <ShoppingBag size={14} className="text-blue-600" />

  return (
    <div className={`rounded-2xl border p-4 transition-all ${cardBg}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          {(customerName || childName) && (
            <button onClick={() => order.customer_id && setCustOpen(v => !v)}
              className="w-full text-left active:opacity-70 mb-2">
              <p className={`font-black text-lg leading-tight truncate ${childName ? 'text-gray-900' : 'text-gray-800'}`}>
                {childName ?? customerName} 様
              </p>
              {childName && customerName && (
                <p className="text-gray-500 text-xs truncate">保護者: {customerName}</p>
              )}
            </button>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PURCHASE_STATUS_COLORS[order.status]}`}>
              {PURCHASE_STATUS_LABELS[order.status]}
            </span>
            {order.notified && (
              <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                LINE通知済み
              </span>
            )}
            {isOverdue && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-300 flex items-center gap-1">
                <AlertCircle size={10} />お渡し{overdueDays}日超過
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900 text-sm">{order.item_name}</p>
          {order.notes && <p className="text-gray-600 text-xs mt-0.5">{order.notes}</p>}
          {order.price != null && <p className="text-gray-500 text-xs mt-0.5">¥{order.price.toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />受付 {fmtDate(order.ordered_date)}</span>
            {order.arrived_date   && <span className="flex items-center gap-1"><Bell size={10} />入荷 {fmtDate(order.arrived_date)}</span>}
            {order.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(order.delivered_date)}</span>}
          </div>
        </div>
      </div>

      {custOpen && order.customer_id && storeId && (
        <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
          <CustomerInfoPanel customerId={order.customer_id} storeId={storeId} />
        </div>
      )}

      {/* 依頼受付 → 在庫確保（即入荷連絡）or メーカー発注 */}
      {(order.status === 'received' || order.status === 'ordered') && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={async () => { setLoading('stock'); await onStock(order.id); setLoading(null) }}
            disabled={!!loading}
            className="py-2.5 rounded-xl font-bold text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
            {loading === 'stock' ? <Loader2 size={12} className="animate-spin" /> : '在庫確保・入荷連絡'}
          </button>
          <button
            onClick={async () => { setLoading('backorder'); await onBackOrder(order.id); setLoading(null) }}
            disabled={!!loading}
            className="py-2.5 rounded-xl font-bold text-xs bg-orange-600/80 hover:bg-orange-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
            {loading === 'backorder' ? <Loader2 size={12} className="animate-spin" /> : 'メーカー発注済み'}
          </button>
        </div>
      )}

      {/* 在庫確保済み / メーカー発注済み → 入荷済み */}
      {(order.status === 'stocked' || order.status === 'on_order') && (
        <div className="mt-3 space-y-2">
          <button onClick={async () => { setLoading('arrive'); await onArrive(order.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'arrive' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><Bell size={14} />入荷確認・LINE通知を送る</>}
          </button>
          <button onClick={async () => { setLoading('revert'); await onRevert(order.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2 rounded-xl font-bold text-xs border border-blue-300 text-blue-600 hover:text-blue-600 hover:border-blue-400 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
            {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />依頼受付に戻す</>}
          </button>
        </div>
      )}

      {/* 入荷済み → お渡し済み */}
      {order.status === 'arrived' && (
        <div className="mt-3">
          <button onClick={async () => { setLoading('deliver'); await onDeliver(order.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
        </div>
      )}
    </div>
  )
}
