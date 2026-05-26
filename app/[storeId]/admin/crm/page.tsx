'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BottomNav } from '../_components/BottomNav'
import {
  ArrowLeft, Search, Plus, User, Phone,
  CheckCheck, Package, Loader2, X, MessageCircle,
  CalendarDays, Pencil, AlertCircle, ChevronDown, ChevronUp,
  RotateCcw, ShoppingBag, Bell, Scissors, GraduationCap,
  Trash2, ArchiveRestore, Eye, EyeOff, QrCode,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type {
  Customer, Child, RepairHistory, PurchaseOrder,
  RepairStatus, PurchaseStatus,
} from '@/types/crm'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
  GRADE_OPTIONS, SCHOOL_OPTIONS,
} from '@/types/crm'

// ============================================================
// ユーティリティ
// ============================================================
function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

const KANA_ROWS = ['ア','カ','サ','タ','ナ','ハ','マ','ヤ','ラ','ワ','他'] as const
type KanaRow = typeof KANA_ROWS[number]

function getKanaRow(kana: string | null | undefined): KanaRow {
  if (!kana) return '他'
  const code = kana.charCodeAt(0)
  if (code >= 0x30A2 && code <= 0x30AA) return 'ア'
  if (code >= 0x30AB && code <= 0x30B4) return 'カ'
  if (code >= 0x30B5 && code <= 0x30BE) return 'サ'
  if (code >= 0x30BF && code <= 0x30C9) return 'タ'
  if (code >= 0x30CA && code <= 0x30CE) return 'ナ'
  if (code >= 0x30CF && code <= 0x30DD) return 'ハ'
  if (code >= 0x30DE && code <= 0x30E2) return 'マ'
  if (code >= 0x30E4 && code <= 0x30E8) return 'ヤ'
  if (code >= 0x30E9 && code <= 0x30ED) return 'ラ'
  if (code >= 0x30EF && code <= 0x30F3) return 'ワ'
  return '他'
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
// 未対応セクション — Repair + Purchase の型
// ============================================================
type RepairWithCustomer   = RepairHistory   & { customer: Pick<Customer, 'name' | 'tel'> | null; child: { name: string } | null }
type PurchaseWithCustomer = PurchaseOrder   & { customer: Pick<Customer, 'name' | 'tel'> | null; child: { name: string } | null }

// ============================================================
// 顧客情報インラインパネル（お直し・取置きカード内）
// ============================================================
type CustomerInfoData = {
  id: string; name: string; kana: string | null; tel: string | null
  children: { id: string; name: string; school_name: string | null; grade: string | null }[]
}
function CustomerInfoPanel({ customerId, storeId }: { customerId: string; storeId: string }) {
  const [data, setData]       = useState<CustomerInfoData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('customers').select('id, name, kana, tel, children(id, name, school_name, grade)')
      .eq('id', customerId).single()
      .then(({ data: d }) => { setData(d as CustomerInfoData | null); setLoading(false) })
  }, [customerId])
  if (loading) return <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-zinc-500" /></div>
  if (!data)   return <p className="text-zinc-600 text-xs">顧客情報なし</p>
  return (
    <div className="space-y-1.5">
      {data.kana && <p className="text-zinc-400 text-xs">{data.kana}</p>}
      {data.tel  && (
        <a href={`tel:${data.tel}`} className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
          <Phone size={11} />{data.tel}
        </a>
      )}
      {(data.children ?? []).map(c => (
        <div key={c.id} className="flex items-center gap-1.5">
          <GraduationCap size={11} className="text-amber-400 shrink-0" />
          <span className="text-amber-300 text-xs font-bold">{c.name}</span>
          {c.school_name && <span className="text-zinc-500 text-xs truncate">{c.school_name}{c.grade && ` ${c.grade}`}</span>}
        </div>
      ))}
      <a href={`/${storeId}/admin/crm?customerId=${customerId}`}
        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-0.5">
        <User size={10} />顧客管理で編集
      </a>
    </div>
  )
}

// ============================================================
// お直しアイテム
// ============================================================
function RepairItem({ repair, showCustomer = false, storeId, onComplete, onDeliver, onRevert, alertDays }: {
  repair: RepairHistory | RepairWithCustomer
  showCustomer?: boolean
  storeId?: string
  onComplete: (id: string) => Promise<void>
  onDeliver:  (id: string) => Promise<void>
  onRevert:   (id: string) => Promise<void>
  alertDays?: number
}) {
  const [loading,         setLoading]         = useState<string | null>(null)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmRevert,   setConfirmRevert]   = useState(false)
  const [custOpen,        setCustOpen]        = useState(false)
  const customerName = showCustomer ? (repair as RepairWithCustomer).customer?.name : null
  const childName    = showCustomer ? (repair as RepairWithCustomer).child?.name    : null
  const isOverdue = alertDays != null && repair.status === 'completed' && repair.completed_date &&
    (Date.now() - new Date(repair.completed_date).getTime()) / 86400000 > alertDays
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - new Date(repair.completed_date!).getTime()) / 86400000)
    : 0

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      repair.status === 'delivered'
        ? 'bg-zinc-900/30 border-zinc-800/40'
        : repair.status === 'completed'
        ? 'bg-emerald-950/40 border-emerald-500/20'
        : 'bg-gradient-to-br from-amber-950/40 to-orange-950/30 border-amber-500/20'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${
          repair.status === 'delivered' ? 'bg-zinc-800'
          : repair.status === 'completed' ? 'bg-emerald-500/20'
          : 'bg-amber-500/20'
        }`}>
          {repair.status === 'delivered' ? <Package size={14} className="text-zinc-500" />
          : repair.status === 'completed' ? <CheckCheck size={14} className="text-emerald-400" />
          : <Scissors size={14} className="text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          {(customerName || childName) && (
            <button onClick={() => repair.customer_id && setCustOpen(v => !v)}
              className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1 w-full text-left active:opacity-70">
              <User size={10} />{customerName}{childName && <span className="text-amber-300">（{childName}）</span>}
              {repair.customer_id && <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform ${custOpen ? 'rotate-180' : ''}`} />}
            </button>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${REPAIR_STATUS_COLORS[repair.status]}`}>
              {REPAIR_STATUS_LABELS[repair.status]}
            </span>
            {repair.slip_number && (
              <span className="text-xs text-zinc-500 font-mono">#{repair.slip_number}</span>
            )}
            {repair.notified && (
              <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                LINE通知済み
              </span>
            )}
            {isOverdue && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                <AlertCircle size={10} />お渡し{overdueDays}日超過
              </span>
            )}
          </div>
          <p className="font-bold text-white text-sm">{repair.item_name}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{repair.content}</p>
          {repair.price != null && <p className="text-zinc-500 text-xs mt-0.5">¥{repair.price.toLocaleString()}</p>}
          {repair.notes && <p className="text-zinc-600 text-xs mt-1 italic">📝 {repair.notes}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-zinc-600 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />受付 {fmtDate(repair.received_date)}</span>
            {repair.completed_date && <span className="flex items-center gap-1"><CheckCheck size={10} />完了 {fmtDate(repair.completed_date)}</span>}
            {repair.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(repair.delivered_date)}</span>}
          </div>
        </div>
      </div>

      {custOpen && repair.customer_id && storeId && (
        <div className="mt-3 pt-3 border-t border-white/10 animate-fade-in">
          <CustomerInfoPanel customerId={repair.customer_id} storeId={storeId} />
        </div>
      )}

      {repair.status === 'received' && (
        confirmComplete ? (
          <div className="mt-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-center text-emerald-300 font-bold">✂️ お直し完了 · LINEで通知を送りますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmComplete(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-zinc-700 text-zinc-300 active:scale-95 transition-all">
                キャンセル
              </button>
              <button
                onClick={async () => { setLoading('complete'); await onComplete(repair.id); setLoading(null); setConfirmComplete(false) }}
                disabled={!!loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'complete' ? <><Loader2 size={13} className="animate-spin" />送信中...</> : <><CheckCheck size={13} />送信する</>}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmComplete(true)}
            className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 transition-all flex items-center justify-center gap-2">
            <CheckCheck size={14} />お直し完了・LINE通知を送る
          </button>
        )
      )}

      {repair.status === 'completed' && (
        <div className="mt-3 space-y-2">
          <button
            onClick={async () => { setLoading('deliver'); await onDeliver(repair.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-200 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={14} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
          {confirmRevert ? (
            <div className="bg-amber-950/50 border border-amber-500/30 rounded-xl p-3 space-y-2">
              <p className="text-xs text-center text-amber-300 font-bold">預かり中に戻しますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRevert(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-zinc-700 text-zinc-300 active:scale-95">キャンセル</button>
                <button
                  onClick={async () => { setLoading('revert'); await onRevert(repair.id); setLoading(null); setConfirmRevert(false) }}
                  disabled={!!loading}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-amber-600 text-white active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />戻す</>}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmRevert(true)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-amber-500/20 text-amber-500/70 hover:text-amber-400 hover:border-amber-500/40 transition-all flex items-center justify-center gap-1.5">
              <RotateCcw size={12} />預かり中に戻す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 追加購入アイテム
// ============================================================
function PurchaseItem({ order, showCustomer = false, storeId, onStock, onBackOrder, onArrive, onDeliver, onRevert, alertDays }: {
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
  const [loading,       setLoading]       = useState<string | null>(null)
  const [confirmStock,  setConfirmStock]  = useState(false)
  const [confirmArrive, setConfirmArrive] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [custOpen,      setCustOpen]      = useState(false)
  const customerName = showCustomer ? (order as PurchaseWithCustomer).customer?.name : null
  const childName    = showCustomer ? (order as PurchaseWithCustomer).child?.name    : null
  const isOverdue = alertDays != null && order.status === 'arrived' && order.arrived_date &&
    (Date.now() - new Date(order.arrived_date).getTime()) / 86400000 > alertDays
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - new Date(order.arrived_date!).getTime()) / 86400000)
    : 0

  const cardBg =
    order.status === 'delivered' ? 'bg-zinc-900/30 border-zinc-800/40' :
    order.status === 'arrived'   ? 'bg-emerald-950/40 border-emerald-500/20' :
    order.status === 'stocked'   ? 'bg-gradient-to-br from-violet-950/40 to-purple-950/30 border-violet-500/20' :
    order.status === 'on_order'  ? 'bg-gradient-to-br from-orange-950/40 to-amber-950/30 border-orange-500/20' :
                                   'bg-gradient-to-br from-blue-950/40 to-indigo-950/30 border-blue-500/20'

  const iconBg =
    order.status === 'delivered' ? 'bg-zinc-800' :
    order.status === 'arrived'   ? 'bg-emerald-500/20' :
    order.status === 'stocked'   ? 'bg-violet-500/20' :
    order.status === 'on_order'  ? 'bg-orange-500/20' :
                                   'bg-blue-500/20'

  const icon =
    order.status === 'delivered' ? <Package size={14} className="text-zinc-500" /> :
    order.status === 'arrived'   ? <CheckCheck size={14} className="text-emerald-400" /> :
    order.status === 'stocked'   ? <ShoppingBag size={14} className="text-violet-400" /> :
    order.status === 'on_order'  ? <ShoppingBag size={14} className="text-orange-400" /> :
                                   <ShoppingBag size={14} className="text-blue-400" />

  return (
    <div className={`rounded-2xl border p-4 transition-all ${cardBg}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          {(customerName || childName) && (
            <button onClick={() => order.customer_id && setCustOpen(v => !v)}
              className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1 w-full text-left active:opacity-70">
              <User size={10} />{customerName}{childName && <span className="text-amber-300">（{childName}）</span>}
              {order.customer_id && <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform ${custOpen ? 'rotate-180' : ''}`} />}
            </button>
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
            {isOverdue && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                <AlertCircle size={10} />お渡し{overdueDays}日超過
              </span>
            )}
          </div>
          <p className="font-bold text-white text-sm">{order.item_name}</p>
          {order.notes && <p className="text-zinc-400 text-xs mt-0.5">{order.notes}</p>}
          {order.price != null && <p className="text-zinc-500 text-xs mt-0.5">¥{order.price.toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-zinc-600 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />受付 {fmtDate(order.ordered_date)}</span>
            {order.arrived_date   && <span className="flex items-center gap-1"><Bell size={10} />入荷 {fmtDate(order.arrived_date)}</span>}
            {order.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(order.delivered_date)}</span>}
          </div>
        </div>
      </div>

      {custOpen && order.customer_id && storeId && (
        <div className="mt-3 pt-3 border-t border-white/10 animate-fade-in">
          <CustomerInfoPanel customerId={order.customer_id} storeId={storeId} />
        </div>
      )}

      {/* 依頼受付 → 在庫確保（即入荷連絡）or メーカー発注 */}
      {(order.status === 'received' || order.status === 'ordered') && (
        confirmStock ? (
          <div className="mt-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-center text-emerald-300 font-bold">📦 在庫確保済み · LINEで入荷連絡しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmStock(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-zinc-700 text-zinc-300 active:scale-95 transition-all">
                キャンセル
              </button>
              <button
                onClick={async () => { setLoading('stock'); await onStock(order.id); setLoading(null); setConfirmStock(false) }}
                disabled={!!loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'stock' ? <><Loader2 size={13} className="animate-spin" />送信中...</> : <><Bell size={13} />通知する</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirmStock(true)}
              disabled={!!loading}
              className="py-2.5 rounded-xl font-bold text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
              在庫確保・入荷連絡
            </button>
            <button
              onClick={async () => { setLoading('backorder'); await onBackOrder(order.id); setLoading(null) }}
              disabled={!!loading}
              className="py-2.5 rounded-xl font-bold text-xs bg-orange-600/80 hover:bg-orange-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
              {loading === 'backorder' ? <Loader2 size={12} className="animate-spin" /> : 'メーカー発注済み'}
            </button>
          </div>
        )
      )}

      {/* 在庫確保済み / メーカー発注済み → 入荷済み */}
      {(order.status === 'stocked' || order.status === 'on_order') && (
        <div className="mt-3 space-y-2">
          {confirmArrive ? (
            <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 space-y-2">
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
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 transition-all flex items-center justify-center gap-2">
              <Bell size={14} />入荷確認・LINE通知を送る
            </button>
          )}
          {confirmRevert ? (
            <div className="bg-blue-950/50 border border-blue-500/30 rounded-xl p-3 space-y-2">
              <p className="text-xs text-center text-blue-300 font-bold">依頼受付に戻しますか？</p>
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
              <RotateCcw size={12} />依頼受付に戻す
            </button>
          )}
        </div>
      )}

      {/* 入荷済み → お渡し済み */}
      {order.status === 'arrived' && (
        <div className="mt-3 space-y-2">
          <button
            onClick={async () => { setLoading('deliver'); await onDeliver(order.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-200 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={14} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 新規お直しフォーム
// ============================================================
function NewRepairForm({ customerId, childId, storeId, onSaved, onCancel }: {
  customerId: string; childId: string | null; storeId: string; onSaved: () => void; onCancel: () => void
}) {
  const [itemName,   setItemName]   = useState('')
  const [content,    setContent]    = useState('')
  const [slipNumber, setSlipNumber] = useState('')
  const [price,      setPrice]      = useState('')
  const [notes,      setNotes]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSave = async () => {
    if (!itemName.trim()) { setError('商品名を入力してください'); return }
    if (!content.trim())  { setError('お直し内容を入力してください'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('repair_histories').insert({
      store_id: storeId, customer_id: customerId,
      child_id: childId ?? null,
      item_name: itemName.trim(), content: content.trim(),
      slip_number: slipNumber.trim() || null,
      price: price ? parseInt(price) : null,
      notes: notes.trim() || null,
      status: 'received', received_date: new Date().toISOString().slice(0, 10),
    })
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    onSaved()
  }

  return (
    <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <Scissors size={14} className="text-amber-400" />新規お直し受付
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <Field label="商品名" required>
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="例：○○高校スラックス" value={itemName} onChange={e => { setItemName(e.target.value); setError(null) }} />
      </Field>
      <Field label="お直し内容" required>
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="例：裾上げ5cm / ウエスト出し" value={content} onChange={e => { setContent(e.target.value); setError(null) }} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="伝票番号">
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
            placeholder="例：001" value={slipNumber} onChange={e => setSlipNumber(e.target.value)} />
        </Field>
        <Field label="金額（円）">
          <input type="number" inputMode="numeric" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="例：500" value={price} onChange={e => setPrice(e.target.value)} />
        </Field>
      </div>
      <Field label="メモ">
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="スタッフへの申し送り等" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '預かりとして登録する'}
      </button>
    </div>
  )
}

// ============================================================
// 新規発注フォーム
// ============================================================
function NewPurchaseForm({ customerId, childId, storeId, onSaved, onCancel }: {
  customerId: string; childId: string | null; storeId: string; onSaved: () => void; onCancel: () => void
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
      child_id: childId ?? null,
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
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '依頼として登録する'}
      </button>
    </div>
  )
}

// ============================================================
// お子様カード（展開可能）
// ============================================================
function ChildCard({
  child, customerId, storeId,
  onRepairComplete, onRepairDeliver, onRepairRevert,
  onPurchaseStock, onPurchaseBackOrder,
  onPurchaseArrive, onPurchaseDeliver, onPurchaseRevert,
  onRefreshStats,
  showToast, schoolOptions,
}: {
  child: Child
  customerId: string
  storeId: string
  onRepairComplete:    (id: string) => Promise<void>
  onRepairDeliver:     (id: string) => Promise<void>
  onRepairRevert:      (id: string) => Promise<void>
  onPurchaseStock:     (id: string) => Promise<void>
  onPurchaseBackOrder: (id: string) => Promise<void>
  onPurchaseArrive:    (id: string) => Promise<void>
  onPurchaseDeliver:   (id: string) => Promise<void>
  onPurchaseRevert:    (id: string) => Promise<void>
  onRefreshStats:      () => void
  showToast:           (type: 'ok' | 'err', msg: string) => void
  schoolOptions?:      string[]
}) {
  const [expanded,       setExpanded]       = useState(false)
  const [repairs,        setRepairs]        = useState<RepairHistory[]>([])
  const [purchases,      setPurchases]      = useState<PurchaseOrder[]>([])
  const [loading,        setLoading]        = useState(false)
  const [showNewRepair,  setShowNewRepair]  = useState(false)
  const [showNewPurchase,setShowNewPurchase]= useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('repair_histories').select('*').eq('child_id', child.id).order('received_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('child_id', child.id).order('ordered_date', { ascending: false }),
    ])
    setRepairs(r ?? [])
    setPurchases(p ?? [])
    setLoading(false)
  }, [child.id])

  const handleExpand = () => {
    if (!expanded) fetchData()
    setExpanded(v => !v)
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
      <button onClick={handleExpand} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800/40 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <GraduationCap size={16} className="text-indigo-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">{child.name}</p>
          <p className="text-zinc-500 text-xs">
            {[child.school_name, child.grade].filter(Boolean).join(' · ') || 'お子様'}
          </p>
        </div>
        {expanded ? <ChevronUp size={16} className="text-zinc-500 shrink-0" /> : <ChevronDown size={16} className="text-zinc-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60 pt-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
          ) : (
            <>
              {/* お直し履歴 */}
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Scissors size={11} />お直し履歴 ({repairs.length}件)
                </p>
                {repairs.length === 0 ? (
                  <p className="text-zinc-700 text-xs text-center py-3">お直し履歴はありません</p>
                ) : (
                  <div className="space-y-2">
                    {repairs.map(r => (
                      <RepairItem key={r.id} repair={r}
                        onComplete={onRepairComplete} onDeliver={onRepairDeliver} onRevert={onRepairRevert} />
                    ))}
                  </div>
                )}
                {showNewRepair ? (
                  <div className="mt-2">
                    <NewRepairForm storeId={storeId} customerId={customerId} childId={child.id}
                      onSaved={() => { setShowNewRepair(false); fetchData(); onRefreshStats(); showToast('ok', 'お直しを受け付けました') }}
                      onCancel={() => setShowNewRepair(false)} />
                  </div>
                ) : (
                  <button onClick={() => setShowNewRepair(true)}
                    className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-amber-500/30 text-amber-400/70 hover:text-amber-300 hover:border-amber-500/50 transition-colors text-xs font-bold flex items-center justify-center gap-1.5">
                    <Plus size={12} />お直しを受け付ける
                  </button>
                )}
              </div>

              {/* 追加購入履歴 */}
              <div className="pt-2 border-t border-zinc-800/40">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShoppingBag size={11} />追加購入 ({purchases.length}件)
                </p>
                {purchases.length === 0 ? (
                  <p className="text-zinc-700 text-xs text-center py-3">追加購入履歴はありません</p>
                ) : (
                  <div className="space-y-2">
                    {purchases.map(o => (
                      <PurchaseItem key={o.id} order={o}
                        onStock={onPurchaseStock} onBackOrder={onPurchaseBackOrder}
                        onArrive={onPurchaseArrive} onDeliver={onPurchaseDeliver} onRevert={onPurchaseRevert} />
                    ))}
                  </div>
                )}
                {showNewPurchase ? (
                  <div className="mt-2">
                    <NewPurchaseForm storeId={storeId} customerId={customerId} childId={child.id}
                      onSaved={() => { setShowNewPurchase(false); fetchData(); onRefreshStats(); showToast('ok', '発注を登録しました') }}
                      onCancel={() => setShowNewPurchase(false)} />
                  </div>
                ) : (
                  <button onClick={() => setShowNewPurchase(true)}
                    className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-blue-500/30 text-blue-400/70 hover:text-blue-300 hover:border-blue-500/50 transition-colors text-xs font-bold flex items-center justify-center gap-1.5">
                    <Plus size={12} />追加購入を登録する
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// お子様編集フォーム
// ============================================================
function EditChildForm({ child, onSaved, onCancel, schoolOptions }: {
  child: Child
  onSaved: (c: Child) => void
  onCancel: () => void
  schoolOptions?: string[]
}) {
  const [name,       setName]       = useState(child.name)
  const [kana,       setKana]       = useState(child.kana ?? '')
  const [schoolName, setSchoolName] = useState(child.school_name ?? '')
  const [grade,      setGrade]      = useState(child.grade ?? '')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('お名前を入力してください'); return }
    setLoading(true); setError(null)
    const { data, error: err } = await supabase.from('children')
      .update({ name: name.trim(), kana: kana.trim() || null, school_name: schoolName.trim() || null, grade: grade || null })
      .eq('id', child.id).select().single()
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    if (data) onSaved(data as Child)
  }

  return (
    <div className="bg-zinc-900/80 border border-amber-500/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <Pencil size={14} className="text-amber-400" />お子様情報を編集
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            placeholder="ヤマダ ハナコ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="学校名">
          <select value={schoolName} onChange={e => setSchoolName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none">
            <option value="">選択</option>
            {(schoolOptions ?? SCHOOL_OPTIONS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="学年">
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none">
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '変更を保存する'}
      </button>
    </div>
  )
}

// ============================================================
// 顧客編集フォーム
// ============================================================
function EditCustomerForm({ customer, onSaved, onCancel }: {
  customer: Customer; onSaved: (c: Customer) => void; onCancel: () => void
}) {
  const [name,    setName]    = useState(customer.name)
  const [kana,    setKana]    = useState(customer.kana ?? '')
  const [tel,     setTel]     = useState(customer.tel ?? '')
  const [notes,   setNotes]   = useState(customer.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('氏名を入力してください'); return }
    setLoading(true); setError(null)
    const { data, error: err } = await supabase.from('customers')
      .update({ name: name.trim(), kana: kana.trim() || null, tel: tel.trim() || null, notes: notes.trim() || null })
      .eq('id', customer.id).select().single()
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    if (data) onSaved(data as Customer)
  }

  return (
    <div className="bg-zinc-900/80 border border-amber-500/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <Pencil size={14} className="text-amber-400" />保護者情報を編集
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            placeholder="ヤマダ タロウ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <Field label="電話番号">
        <input type="tel" inputMode="tel" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
          placeholder="090-1234-5678" value={tel} onChange={e => setTel(e.target.value)} />
      </Field>
      <Field label="メモ">
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
          placeholder="アレルギー・注意事項など" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '変更を保存する'}
      </button>
    </div>
  )
}

// ============================================================
// お子様追加フォーム（CRM内）
// ============================================================
function AddChildFormCRM({ customerId, storeId, onSaved, onCancel, schoolOptions }: {
  customerId: string; storeId: string; onSaved: (c: Child) => void; onCancel: () => void
  schoolOptions?: string[]
}) {
  const [name,       setName]       = useState('')
  const [kana,       setKana]       = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [grade,      setGrade]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('お名前を入力してください'); return }
    setLoading(true); setError(null)
    const { data, error: err } = await supabase.from('children').insert({
      customer_id: customerId, store_id: storeId,
      name: name.trim(), kana: kana.trim() || null,
      school_name: schoolName.trim() || null, grade: grade || null,
    }).select().single()
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    if (data) onSaved(data as Child)
  }

  return (
    <div className="bg-zinc-900/80 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <GraduationCap size={14} className="text-indigo-400" />お子様を追加
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="山田 花子" value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="ヤマダ ハナコ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="学校名">
          <select value={schoolName} onChange={e => setSchoolName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">選択</option>
            {(schoolOptions ?? SCHOOL_OPTIONS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="学年">
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />登録中...</> : '追加する'}
      </button>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function CRMPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()

  const [storeName,        setStoreName]        = useState('')
  const [customers,        setCustomers]        = useState<Customer[]>([])
  const [searchQuery,      setSearchQuery]      = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [editingCustomer,  setEditingCustomer]  = useState(false)
  const [customerChildren, setCustomerChildren] = useState<Child[]>([])
  const [editingChild,     setEditingChild]     = useState<Child | null>(null)
  const [showAddChild,     setShowAddChild]     = useState(false)
  const [customerLoading,  setCustomerLoading]  = useState(false)
  const [childMatchMap,    setChildMatchMap]    = useState<Record<string, string>>({}) // customerId -> matched child name
  const [showDeleted,      setShowDeleted]      = useState(false)
  const [deleteTarget,     setDeleteTarget]     = useState<Customer | null>(null)
  const [deleteMode,       setDeleteMode]       = useState<'soft' | 'hard' | null>(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const [deleteChildTarget, setDeleteChildTarget] = useState<Child | null>(null)
  const [deleteChildLoading, setDeleteChildLoading] = useState(false)
  const [showQrModal,      setShowQrModal]      = useState(false)

  const [allCustomers,      setAllCustomers]      = useState<Customer[]>([])
  const [allLoading,        setAllLoading]        = useState(true)
  const [kanaFilter,        setKanaFilter]        = useState<KanaRow | null>(null)

  const [alertDaysRepair,   setAlertDaysRepair]   = useState(7)
  const [alertDaysPurchase, setAlertDaysPurchase] = useState(7)
  const [schoolOptions,     setSchoolOptions]     = useState<string[]>([])
  const [schoolFilter,      setSchoolFilter]      = useState<string | null>(null)

  // 未対応統計
  const [stats, setStats] = useState({ repairReceived: 0, repairCompleted: 0, purchaseReceived: 0, purchaseInProgress: 0, purchaseArrived: 0 })

  // 未対応リスト
  const [showRepairReceived,  setShowRepairReceived]  = useState(false)
  const [repairReceivedList,  setRepairReceivedList]  = useState<RepairWithCustomer[]>([])
  const [repairReceivedLoading, setRepairReceivedLoading] = useState(false)

  const [showRepairCompleted,  setShowRepairCompleted]  = useState(false)
  const [repairCompletedList,  setRepairCompletedList]  = useState<RepairWithCustomer[]>([])
  const [repairCompletedLoading, setRepairCompletedLoading] = useState(false)

  const [showPurchaseReceived,  setShowPurchaseReceived]  = useState(false)
  const [purchaseReceivedList,  setPurchaseReceivedList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseReceivedLoading, setPurchaseReceivedLoading] = useState(false)

  const [showPurchaseInProgress,  setShowPurchaseInProgress]  = useState(false)
  const [purchaseInProgressList,  setPurchaseInProgressList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseInProgressLoading, setPurchaseInProgressLoading] = useState(false)

  const [showPurchaseArrived,  setShowPurchaseArrived]  = useState(false)
  const [purchaseArrivedList,  setPurchaseArrivedList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseArrivedLoading, setPurchaseArrivedLoading] = useState(false)

  const [showDelivered,       setShowDelivered]       = useState(false)
  const [deliveredRepairs,    setDeliveredRepairs]    = useState<RepairWithCustomer[]>([])
  const [deliveredPurchases,  setDeliveredPurchases]  = useState<PurchaseWithCustomer[]>([])
  const [deliveredLoading,    setDeliveredLoading]    = useState(false)

  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ type, msg })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── 初期ロード ──────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    supabase.from('stores').select('name').eq('id', storeId).single()
      .then(({ data }) => { if (data) setStoreName(data.name ?? '') })
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    ;(supabase.from('stores') as any)
      .select('alert_days_repair, alert_days_purchase, school_names')
      .eq('id', storeId).single()
      .then(({ data }: { data: any }) => {
        if (data?.alert_days_repair   != null) setAlertDaysRepair(data.alert_days_repair)
        if (data?.alert_days_purchase != null) setAlertDaysPurchase(data.alert_days_purchase)
        if (Array.isArray(data?.school_names) && data.school_names.length > 0)
          setSchoolOptions(data.school_names)
      })
  }, [storeId])

  const fetchStats = useCallback(async () => {
    if (!storeId) return
    const [{ data: rData }, { data: pData }] = await Promise.all([
      supabase.from('repair_histories').select('status').eq('store_id', storeId).in('status', ['received', 'completed']),
      supabase.from('purchase_orders').select('status').eq('store_id', storeId).in('status', ['ordered', 'received', 'stocked', 'on_order', 'arrived']),
    ])
    setStats({
      repairReceived:     (rData ?? []).filter(r => r.status === 'received').length,
      repairCompleted:    (rData ?? []).filter(r => r.status === 'completed').length,
      purchaseReceived:   (pData ?? []).filter(r => r.status === 'received' || r.status === 'ordered').length,
      purchaseInProgress: (pData ?? []).filter(r => r.status === 'stocked' || r.status === 'on_order').length,
      purchaseArrived:    (pData ?? []).filter(r => r.status === 'arrived').length,
    })
  }, [storeId])

  useEffect(() => { fetchStats() }, [fetchStats])

  const fetchAllCustomers = useCallback(async () => {
    if (!storeId) return
    setAllLoading(true)
    const q = supabase.from('customers').select('*, children(school_name)').eq('store_id', storeId)
    const { data } = await (showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null))
      .order('kana', { ascending: true }).limit(500)
    setAllCustomers(data ?? [])
    setAllLoading(false)
  }, [storeId, showDeleted])

  useEffect(() => { fetchAllCustomers() }, [fetchAllCustomers])

  // ── 顧客検索（お子様名でもヒット・削除済み切替対応）──
  const searchCustomers = useCallback(async (q: string, deleted = false) => {
    if (!storeId || !q.trim()) { setCustomers([]); setCustomerLoading(false); return }
    setCustomerLoading(true)

    const baseQuery = () => {
      const q2 = supabase.from('customers').select('*').eq('store_id', storeId)
      return deleted ? q2.not('deleted_at', 'is', null) : q2.is('deleted_at', null)
    }

    const { data: direct } = await baseQuery()
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q.replace(/-/g, '')}%,parent_name.ilike.%${q}%`)
      .order('updated_at', { ascending: false }).limit(20)

    const { data: childHits } = await supabase.from('children').select('customer_id, name').eq('store_id', storeId)
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%`)

    // お子様マッチマップ（customerId → 最初にマッチしたお子様名）
    const matchMap: Record<string, string> = {}
    let merged = direct ?? []
    if (childHits && childHits.length > 0) {
      childHits.forEach(ch => { if (!matchMap[ch.customer_id]) matchMap[ch.customer_id] = ch.name })
      const ids = [...new Set(childHits.map(c => c.customer_id))]
      const existingIds = new Set(merged.map(c => c.id))
      const newIds = ids.filter(id => !existingIds.has(id))
      if (newIds.length > 0) {
        const { data: fromChildren } = await baseQuery().in('id', newIds).order('updated_at', { ascending: false })
        merged = [...merged, ...(fromChildren ?? [])]
      }
    }

    setChildMatchMap(matchMap)
    setCustomers(merged); setCustomerLoading(false)
  }, [storeId])

  // ── 削除処理 ──────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget || !deleteMode) return
    setDeleteLoading(true)
    if (deleteMode === 'soft') {
      await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id)
    } else {
      // 1. すべての整理券から顧客・子供の参照を外す
      const { error: qErr } = await supabase.from('queues')
        .update({ customer_id: null, child_id: null })
        .eq('customer_id', deleteTarget.id)
      if (qErr) { showToast('err', `削除失敗: ${qErr.message}`); setDeleteLoading(false); return }
      // 2. お直し履歴・購入注文を削除
      await Promise.all([
        supabase.from('repair_histories').delete().eq('customer_id', deleteTarget.id),
        supabase.from('purchase_orders').delete().eq('customer_id', deleteTarget.id),
      ])
      // 3. お子様を削除
      await supabase.from('children').delete().eq('customer_id', deleteTarget.id)
      // 4. 顧客本体を削除
      const { error: custErr } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
      if (custErr) { showToast('err', `削除失敗: ${custErr.message}`); setDeleteLoading(false); return }
    }
    setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id))
    if (selectedCustomer?.id === deleteTarget.id) setSelectedCustomer(null)
    setDeleteTarget(null); setDeleteMode(null); setDeleteLoading(false)
    showToast('ok', deleteMode === 'soft' ? '非表示にしました' : '完全削除しました')
  }, [deleteTarget, deleteMode, selectedCustomer, showToast])

  // ── 復元処理 ──────────────────────────────────────────
  const handleRestore = useCallback(async (customer: Customer) => {
    await supabase.from('customers').update({ deleted_at: null }).eq('id', customer.id)
    setCustomers(prev => prev.filter(c => c.id !== customer.id))
    if (selectedCustomer?.id === customer.id) setSelectedCustomer(null)
  }, [selectedCustomer])

  // ── お子様削除 ────────────────────────────────────────
  const handleDeleteChild = useCallback(async () => {
    if (!deleteChildTarget) return
    setDeleteChildLoading(true)
    // 関連レコードの child_id を NULL に（FK制約対策）
    await Promise.all([
      supabase.from('repair_histories').update({ child_id: null }).eq('child_id', deleteChildTarget.id),
      supabase.from('purchase_orders').update({ child_id: null }).eq('child_id', deleteChildTarget.id),
      supabase.from('queues').update({ child_id: null }).eq('child_id', deleteChildTarget.id),
    ])
    await supabase.from('children').delete().eq('id', deleteChildTarget.id)
    setCustomerChildren(prev => prev.filter(c => c.id !== deleteChildTarget.id))
    setDeleteChildTarget(null); setDeleteChildLoading(false)
  }, [deleteChildTarget])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(searchQuery, showDeleted), 300)
    return () => clearTimeout(t)
  }, [searchQuery, showDeleted, searchCustomers])

  const fetchCustomerChildren = useCallback(async (customerId: string) => {
    const { data } = await supabase.from('children').select('*').eq('customer_id', customerId).order('created_at', { ascending: true })
    setCustomerChildren(data ?? [])
  }, [])

  useEffect(() => {
    if (selectedCustomer) fetchCustomerChildren(selectedCustomer.id)
    else setCustomerChildren([])
  }, [selectedCustomer, fetchCustomerChildren])

  // ── 未対応リスト fetch ──────────────────────────────
  const fetchRepairReceived = useCallback(async () => {
    if (!storeId) return; setRepairReceivedLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).eq('status', 'received')
      .order('received_date', { ascending: false })
    setRepairReceivedList((data ?? []) as RepairWithCustomer[]); setRepairReceivedLoading(false)
  }, [storeId])

  const fetchRepairCompleted = useCallback(async () => {
    if (!storeId) return; setRepairCompletedLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).eq('status', 'completed')
      .order('completed_date', { ascending: false })
    setRepairCompletedList((data ?? []) as RepairWithCustomer[]); setRepairCompletedLoading(false)
  }, [storeId])

  const fetchPurchaseReceived = useCallback(async () => {
    if (!storeId) return; setPurchaseReceivedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).in('status', ['ordered', 'received'])
      .order('ordered_date', { ascending: false })
    setPurchaseReceivedList((data ?? []) as PurchaseWithCustomer[]); setPurchaseReceivedLoading(false)
  }, [storeId])

  const fetchPurchaseInProgress = useCallback(async () => {
    if (!storeId) return; setPurchaseInProgressLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).in('status', ['stocked', 'on_order'])
      .order('ordered_date', { ascending: false })
    setPurchaseInProgressList((data ?? []) as PurchaseWithCustomer[]); setPurchaseInProgressLoading(false)
  }, [storeId])

  const fetchPurchaseArrived = useCallback(async () => {
    if (!storeId) return; setPurchaseArrivedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).eq('status', 'arrived')
      .order('arrived_date', { ascending: false })
    setPurchaseArrivedList((data ?? []) as PurchaseWithCustomer[]); setPurchaseArrivedLoading(false)
  }, [storeId])

  // ── お直しアクション ───────────────────────────────────
  const handleRepairComplete = useCallback(async (repairId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'completed', completed_date: today }).eq('id', repairId)
    if (error) { showToast('err', `完了処理失敗: ${error.message}`); return }
    setRepairReceivedList(prev => prev.filter(r => r.id !== repairId))
    try {
      const res = await fetch('/api/notify-repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repairId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) showToast('ok', '✅ 完了処理 + LINE通知を送信しました')
      else if (j.skipped)     showToast('ok', '✅ 完了処理済み（LINE未連携のため通知なし）')
      else                    showToast('err', `完了済み・通知失敗: ${j.error ?? '不明'}`)
    } catch { showToast('err', '完了済み・通知APIエラー') }
    fetchStats()
    if (showRepairCompleted) fetchRepairCompleted()
  }, [showToast, fetchStats, showRepairCompleted, fetchRepairCompleted])

  const handleRepairDeliver = useCallback(async (repairId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'delivered', delivered_date: today }).eq('id', repairId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setRepairCompletedList(prev => prev.filter(r => r.id !== repairId))
    showToast('ok', '📦 お渡し済みにしました')
    fetchStats()
  }, [showToast, fetchStats])

  const handleRepairRevert = useCallback(async (repairId: string) => {
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'received', completed_date: null, notified: false }).eq('id', repairId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setRepairCompletedList(prev => prev.filter(r => r.id !== repairId))
    showToast('ok', '🔄 預かり中に戻しました')
    fetchStats()
    if (showRepairReceived) fetchRepairReceived()
  }, [showToast, fetchStats, showRepairReceived, fetchRepairReceived])

  // ── 追加購入アクション ─────────────────────────────────
  const handlePurchaseStock = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    setPurchaseReceivedList(prev => prev.filter(o => o.id !== orderId))
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) showToast('ok', '✅ 在庫確保・入荷連絡を送信しました')
      else if (j.skipped)     showToast('ok', '✅ 在庫確保済みにしました（LINE未連携のため通知なし）')
      else                    showToast('err', `在庫確保済み・通知失敗: ${j.error ?? '不明'}`)
    } catch { showToast('err', '在庫確保済み・通知APIエラー') }
    fetchStats()
    if (showPurchaseArrived) fetchPurchaseArrived()
  }, [showToast, fetchStats, showPurchaseArrived, fetchPurchaseArrived])

  const handlePurchaseBackOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders').update({ status: 'on_order' }).eq('id', orderId)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    setPurchaseReceivedList(prev => prev.filter(o => o.id !== orderId))
    showToast('ok', '✅ メーカー発注済みにしました')
    fetchStats()
    if (showPurchaseInProgress) fetchPurchaseInProgress()
  }, [showToast, fetchStats, showPurchaseInProgress, fetchPurchaseInProgress])

  const handlePurchaseArrive = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `入荷処理失敗: ${error.message}`); return }
    setPurchaseInProgressList(prev => prev.filter(o => o.id !== orderId))
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) showToast('ok', '✅ 入荷連絡済み + LINE通知を送信しました')
      else if (j.skipped)     showToast('ok', '✅ 入荷連絡済みにしました（LINE未連携のため通知なし）')
      else                    showToast('err', `入荷連絡済み・通知失敗: ${j.error ?? '不明'}`)
    } catch { showToast('err', '入荷連絡済み・通知APIエラー') }
    fetchStats()
    if (showPurchaseArrived) fetchPurchaseArrived()
  }, [showToast, fetchStats, showPurchaseArrived, fetchPurchaseArrived])

  const handlePurchaseDeliver = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'delivered', delivered_date: today }).eq('id', orderId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setPurchaseArrivedList(prev => prev.filter(o => o.id !== orderId))
    showToast('ok', '📦 お渡し済みにしました')
    fetchStats()
  }, [showToast, fetchStats])

  const handlePurchaseRevert = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'ordered', arrived_date: null, notified: false }).eq('id', orderId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setPurchaseInProgressList(prev => prev.filter(o => o.id !== orderId))
    showToast('ok', '🔄 依頼受付に戻しました')
    fetchStats()
    if (showPurchaseReceived) fetchPurchaseReceived()
  }, [showToast, fetchStats, showPurchaseReceived, fetchPurchaseReceived])

  // ── トグル関数 ─────────────────────────────────────────
  const toggleRepairReceived = () => {
    if (!showRepairReceived) fetchRepairReceived()
    setShowRepairReceived(v => !v)
  }
  const toggleRepairCompleted = () => {
    if (!showRepairCompleted) fetchRepairCompleted()
    setShowRepairCompleted(v => !v)
  }
  const togglePurchaseReceived = () => {
    if (!showPurchaseReceived) fetchPurchaseReceived()
    setShowPurchaseReceived(v => !v)
  }
  const togglePurchaseInProgress = () => {
    if (!showPurchaseInProgress) fetchPurchaseInProgress()
    setShowPurchaseInProgress(v => !v)
  }
  const togglePurchaseArrived = () => {
    if (!showPurchaseArrived) fetchPurchaseArrived()
    setShowPurchaseArrived(v => !v)
  }

  const fetchDeliveredHistory = useCallback(async () => {
    if (!storeId) return; setDeliveredLoading(true)
    const [{ data: rData }, { data: pData }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name, tel), child:children(name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(50),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name, tel), child:children(name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(50),
    ])
    setDeliveredRepairs((rData ?? []) as RepairWithCustomer[])
    setDeliveredPurchases((pData ?? []) as PurchaseWithCustomer[])
    setDeliveredLoading(false)
  }, [storeId])

  const toggleDelivered = () => {
    if (!showDelivered) fetchDeliveredHistory()
    setShowDelivered(v => !v)
  }

  const pendingTotal = stats.repairReceived + stats.repairCompleted + stats.purchaseReceived + stats.purchaseInProgress + stats.purchaseArrived

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
              顧客管理（CRM）
            </h1>
            {storeName && <p className="text-zinc-500 text-xs">{storeName}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">

        {/* 業務進捗管理はお直し・注文管理タブに移行しました */}

        {/* ══════════════════════════════════════════════════
            顧客管理セクション
           ══════════════════════════════════════════════════ */}
        <section className="border-t border-white/5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-zinc-300">顧客管理</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-indigo-500/20 border-indigo-500/40 text-indigo-300">
                <QrCode size={12} />新規登録QR
              </button>
              <button onClick={() => { setShowDeleted(v => !v); setSearchQuery(''); setCustomers([]); setAllCustomers([]); setSelectedCustomer(null); setKanaFilter(null) }}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showDeleted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>
                {showDeleted ? <><EyeOff size={12} />削除済みを非表示</> : <><Eye size={12} />削除済みを表示</>}
              </button>
            </div>
          </div>

          {/* 検索 */}
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setKanaFilter(null) }}
              placeholder="保護者名・お子様名・フリガナ・電話番号"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-3 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none transition-colors" />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setCustomers([]); setSelectedCustomer(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* 学校フィルター */}
          {!searchQuery.trim() && schoolOptions.length > 0 && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {schoolOptions.map(s => {
                const active = schoolFilter === s
                const count = allCustomers.filter(c =>
                  (c as any).children?.some((ch: any) => ch.school_name === s)
                ).length
                return (
                  <button key={s}
                    onClick={() => { setSchoolFilter(active ? null : s); setKanaFilter(null) }}
                    className={`px-3 h-8 rounded-lg text-xs font-bold transition-all active:scale-90 ${
                      active
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/40'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}>
                    {s}
                    {count > 0 && <span className={`ml-1 ${active ? 'text-amber-100' : 'text-zinc-600'}`}>({count})</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* あいうえおインデックス */}
          {!searchQuery.trim() && !schoolFilter && (
            <div className="flex gap-1 mb-3 flex-wrap">
              {KANA_ROWS.map(row => {
                const count = allCustomers.filter(c => getKanaRow(c.kana) === row).length
                const active = kanaFilter === row
                return (
                  <button key={row}
                    onClick={() => setKanaFilter(active ? null : row)}
                    disabled={count === 0}
                    className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-black transition-all active:scale-90 disabled:opacity-25 disabled:cursor-default ${
                      active
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}>
                    {row}
                    {count > 0 && !active && (
                      <span className="block text-[9px] text-zinc-600 font-normal leading-none -mt-0.5">{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* 顧客リスト */}
          {(() => {
            const isSearchMode = !!searchQuery.trim()
            const list = isSearchMode
              ? customers
              : schoolFilter
                ? allCustomers.filter(c =>
                    (c as any).children?.some((ch: any) => ch.school_name === schoolFilter)
                  )
                : kanaFilter
                  ? allCustomers.filter(c => getKanaRow(c.kana) === kanaFilter)
                  : allCustomers
            const loading = isSearchMode ? customerLoading : allLoading

            if (loading) return (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
            )
            if (list.length === 0) return (
              <div className="text-center py-6 text-zinc-600">
                <User size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{isSearchMode ? '該当する顧客が見つかりません' : '顧客がいません'}</p>
              </div>
            )
            return (
              <div className="space-y-2 mb-4 animate-fade-in">
                {list.map(c => (
                  <button key={c.id} onClick={() => { setSelectedCustomer(prev => prev?.id === c.id ? null : c); setEditingCustomer(false); setShowAddChild(false) }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                      selectedCustomer?.id === c.id
                        ? 'bg-indigo-600/30 border-indigo-500/50 text-white'
                        : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-300 hover:border-zinc-600'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedCustomer?.id === c.id ? 'bg-indigo-500/40' : 'bg-zinc-800'}`}>
                        <User size={16} className={selectedCustomer?.id === c.id ? 'text-indigo-300' : 'text-zinc-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{c.name}</p>
                        <p className="text-xs text-zinc-500 truncate">
                          {childMatchMap[c.id]
                            ? <span className="text-indigo-400">子: {childMatchMap[c.id]}</span>
                            : (c.kana ?? c.tel ?? 'LINE未連携')
                          }
                        </p>
                      </div>
                      {c.line_user_id
                        ? <MessageCircle size={13} className="text-emerald-400 shrink-0" />
                        : <span className="text-[10px] text-zinc-600 shrink-0">LINE未</span>
                      }
                    </div>
                  </button>
                ))}
              </div>
            )
          })()}

          {/* 選択中顧客詳細 */}
          {selectedCustomer && (
            <div className="space-y-4 pt-2 border-t border-white/5">

              {/* 保護者情報 */}
              {editingCustomer ? (
                <EditCustomerForm
                  customer={selectedCustomer}
                  onSaved={updated => {
                    setSelectedCustomer(updated)
                    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
                    setEditingCustomer(false)
                    showToast('ok', '保護者情報を更新しました')
                  }}
                  onCancel={() => setEditingCustomer(false)}
                />
              ) : (
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
                      {selectedCustomer.notes && (
                        <p className="text-zinc-500 text-xs mt-1 bg-zinc-800/50 rounded-lg px-2 py-1">📝 {selectedCustomer.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {showDeleted ? (
                        <button onClick={() => handleRestore(selectedCustomer)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 active:scale-90 transition-all text-xs font-bold">
                          <ArchiveRestore size={13} />復元
                        </button>
                      ) : (
                        <button onClick={() => setDeleteTarget(selectedCustomer)}
                          className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 active:scale-90 transition-all">
                          <Trash2 size={14} />
                        </button>
                      )}
                      {!showDeleted && (
                        <button onClick={() => setEditingCustomer(true)}
                          className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-90 transition-all">
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* お子様一覧 */}
              {!editingCustomer && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">お子様 ({customerChildren.length}人)</p>

                  {customerChildren.map(child => (
                    editingChild?.id === child.id ? (
                      <EditChildForm key={child.id} child={child}
                        schoolOptions={schoolOptions}
                        onSaved={updated => {
                          setCustomerChildren(prev => prev.map(c => c.id === updated.id ? updated : c))
                          setEditingChild(null)
                          showToast('ok', 'お子様情報を更新しました')
                        }}
                        onCancel={() => setEditingChild(null)}
                      />
                    ) : (
                      <div key={child.id} className="relative">
                        <ChildCard
                          child={child}
                          customerId={selectedCustomer.id}
                          storeId={storeId}
                          onRepairComplete={handleRepairComplete}
                          onRepairDeliver={handleRepairDeliver}
                          onRepairRevert={handleRepairRevert}
                          onPurchaseStock={handlePurchaseStock}
                          onPurchaseBackOrder={handlePurchaseBackOrder}
                          onPurchaseArrive={handlePurchaseArrive}
                          onPurchaseDeliver={handlePurchaseDeliver}
                          onPurchaseRevert={handlePurchaseRevert}
                          onRefreshStats={fetchStats}
                          showToast={showToast}
                        />
                        <div className="absolute top-3 right-2 flex items-center gap-1">
                          <button onClick={() => setEditingChild(child)}
                            className="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-90 transition-all">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDeleteChildTarget(child)}
                            className="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 active:scale-90 transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}

                  {showAddChild ? (
                    <AddChildFormCRM
                      customerId={selectedCustomer.id}
                      storeId={storeId}
                      schoolOptions={schoolOptions}
                      onSaved={newChild => {
                        setCustomerChildren(prev => [...prev, newChild])
                        setShowAddChild(false)
                        showToast('ok', 'お子様を追加しました')
                      }}
                      onCancel={() => setShowAddChild(false)}
                    />
                  ) : (
                    <button onClick={() => setShowAddChild(true)}
                      className="w-full py-3 rounded-xl border border-dashed border-indigo-500/30 text-indigo-400/70 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                      <Plus size={14} />お子様を追加
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* 削除確認モーダル */}
      {deleteTarget && !deleteMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-white font-black text-lg mb-1">顧客を削除しますか？</h3>
            <p className="text-zinc-300 text-sm font-bold mb-2">{deleteTarget.name} 様</p>

            {/* お子様リスト警告 */}
            {customerChildren.length > 0 && (
              <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-xs font-bold mb-1.5">⚠️ 以下のお子様も一緒に削除されます</p>
                {customerChildren.map(ch => (
                  <p key={ch.id} className="text-zinc-300 text-xs ml-2">・{ch.name}{ch.school_name ? `（${ch.school_name}）` : ''}</p>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              <button onClick={() => setDeleteMode('soft')}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left active:scale-[0.98] transition-all">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <EyeOff size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-amber-300 text-sm">通常削除（非表示）</p>
                  <p className="text-zinc-500 text-xs mt-0.5">データは保持されます。「削除済みを表示」から復元可能です</p>
                </div>
              </button>
              <button onClick={() => setDeleteMode('hard')}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-left active:scale-[0.98] transition-all">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-red-400 text-sm">完全削除</p>
                  <p className="text-zinc-500 text-xs mt-0.5">データベースから完全に削除されます。復元不可</p>
                </div>
              </button>
            </div>
            <button onClick={() => setDeleteTarget(null)} className="w-full mt-3 py-3 rounded-2xl bg-zinc-800 text-zinc-400 font-bold text-sm">キャンセル</button>
          </div>
        </div>
      )}

      {/* 削除最終確認 */}
      {deleteTarget && deleteMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-white font-black text-lg mb-1">
              {deleteMode === 'soft' ? '通常削除しますか？' : '完全削除しますか？'}
            </h3>
            <p className="text-zinc-300 text-sm font-bold mb-1">{deleteTarget.name} 様</p>
            {customerChildren.length > 0 && (
              <p className="text-red-400 text-xs mb-1">お子様 {customerChildren.length}人（{customerChildren.map(c => c.name).join('・')}）も削除されます</p>
            )}
            <p className="text-zinc-600 text-xs mb-5 mt-1">
              {deleteMode === 'soft'
                ? 'データは保持されます。「削除済みを表示」から復元できます'
                : '⚠️ お直し・購入履歴・整理券も全て削除されます。この操作は取り消せません'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteMode(null)} className="py-4 rounded-xl bg-zinc-800 text-white font-bold">戻る</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className={`py-4 rounded-xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95 ${deleteMode === 'soft' ? 'bg-amber-500' : 'bg-red-600'}`}>
                {deleteLoading && <Loader2 size={16} className="animate-spin" />}
                {deleteMode === 'soft' ? '非表示にする' : '完全削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規登録QRモーダル */}
      {showQrModal && (() => {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2010126882-aUahQStD'
        const url    = `https://liff.line.me/${liffId}/${storeId}`
        const qrSrc  = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(url)}`
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-xs text-center relative">
              <button onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
              <p className="font-black text-white text-base mb-1">新規会員登録</p>
              <p className="text-zinc-500 text-xs mb-4">お客様のLINEでこのQRコードを読み取ってもらってください</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="登録QRコード" width={240} height={240}
                className="mx-auto rounded-2xl bg-white p-2" />
              <p className="text-zinc-600 text-[10px] mt-4 break-all">{url}</p>
            </div>
          </div>
        )
      })()}

      {/* お子様削除確認モーダル */}
      {deleteChildTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-white font-black text-lg mb-1">お子様を削除しますか？</h3>
            <p className="text-zinc-400 text-sm mb-1">{deleteChildTarget.name} さん</p>
            <p className="text-zinc-600 text-xs mb-5">お直し・追加購入履歴のお子様紐付けが外れます（履歴は保持されます）</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteChildTarget(null)} className="py-4 rounded-xl bg-zinc-800 text-white font-bold">キャンセル</button>
              <button onClick={handleDeleteChild} disabled={deleteChildLoading}
                className="py-4 rounded-xl bg-red-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all">
                {deleteChildLoading && <Loader2 size={16} className="animate-spin" />}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  )
}
