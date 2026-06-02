'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { BottomNav } from '../_components/BottomNav'
import { QrRegistrationModal } from '../_components/QrRegistrationModal'
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
      type === 'err' ? 'bg-red-600' : 'bg-gray-100 border border-gray-300'
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
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
  if (loading) return <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-gray-500" /></div>
  if (!data)   return <p className="text-gray-400 text-xs">顧客情報なし</p>
  return (
    <div className="space-y-1.5">
      {data.kana && <p className="text-gray-600 text-xs">{data.kana}</p>}
      {data.tel  && (
        <a href={`tel:${data.tel}`} className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
          <Phone size={11} />{data.tel}
        </a>
      )}
      {(data.children ?? []).map(c => (
        <div key={c.id} className="flex items-center gap-1.5">
          <GraduationCap size={11} className="text-amber-600 shrink-0" />
          <span className="text-amber-600 text-xs font-bold">{c.name}</span>
          {c.school_name && <span className="text-gray-500 text-xs truncate">{c.school_name}{c.grade && ` ${c.grade}`}</span>}
        </div>
      ))}
      <a href={`/${storeId}/admin/crm?customerId=${customerId}`}
        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-0.5">
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
  const [loading,  setLoading]  = useState<string | null>(null)
  const [custOpen, setCustOpen] = useState(false)
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
        ? 'bg-gray-50 border-gray-200'
        : repair.status === 'completed'
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${
          repair.status === 'delivered' ? 'bg-gray-100'
          : repair.status === 'completed' ? 'bg-emerald-100'
          : 'bg-amber-100'
        }`}>
          {repair.status === 'delivered' ? <Package size={14} className="text-gray-500" />
          : repair.status === 'completed' ? <CheckCheck size={14} className="text-emerald-600" />
          : <Scissors size={14} className="text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          {(customerName || childName) && (
            <button onClick={() => repair.customer_id && setCustOpen(v => !v)}
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
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${REPAIR_STATUS_COLORS[repair.status]}`}>
              {REPAIR_STATUS_LABELS[repair.status]}
            </span>
            {repair.slip_number && (
              <span className="text-xs text-gray-500 font-mono">#{repair.slip_number}</span>
            )}
            {repair.notified && (
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
          <p className="font-bold text-gray-900 text-sm">{repair.item_name}</p>
          <p className="text-gray-600 text-xs mt-0.5">{repair.content}</p>
          {repair.price != null && <p className="text-gray-500 text-xs mt-0.5">¥{repair.price.toLocaleString()}</p>}
          {repair.notes && <p className="text-gray-400 text-xs mt-1 italic">📝 {repair.notes}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />受付 {fmtDate(repair.received_date)}</span>
            {repair.completed_date && <span className="flex items-center gap-1"><CheckCheck size={10} />完了 {fmtDate(repair.completed_date)}</span>}
            {repair.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(repair.delivered_date)}</span>}
          </div>
        </div>
      </div>

      {custOpen && repair.customer_id && storeId && (
        <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
          <CustomerInfoPanel customerId={repair.customer_id} storeId={storeId} />
        </div>
      )}

      {repair.status === 'received' && (
        <button onClick={async () => { setLoading('complete'); await onComplete(repair.id); setLoading(null) }}
          disabled={!!loading}
          className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading === 'complete' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><CheckCheck size={14} />お直し完了・LINE通知を送る</>}
        </button>
      )}

      {repair.status === 'completed' && (
        <div className="mt-3 space-y-2">
          <button onClick={async () => { setLoading('deliver'); await onDeliver(repair.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
          <button onClick={async () => { setLoading('revert'); await onRevert(repair.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2 rounded-xl font-bold text-xs border border-amber-200 text-amber-600 hover:text-amber-600 hover:border-amber-300 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
            {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />預かり中に戻す</>}
          </button>
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

// ============================================================
// 統合新規依頼受付フォーム
// ============================================================
type IntakeFormType = 'repair' | 'repair_consult' | 'purchase' | 'inquiry' | 'payment_pending'
const INTAKE_OPTIONS: {
  value: IntakeFormType; label: string
  ph_item: string; ph_content: string
  showContent: boolean; showPrice: boolean; showSlip: boolean; showDate: boolean; showPrepaid: boolean
  isPurchase: boolean
}[] = [
  { value: 'repair',          label: '✂️ お直し',        ph_item: '例：○○高校スラックス',   ph_content: '例：裾上げ5cm',        showContent: true,  showPrice: true,  showSlip: true,  showDate: true,  showPrepaid: true,  isPurchase: false },
  { value: 'repair_consult',  label: '🔍 お直し相談',    ph_item: '例：ブレザー',             ph_content: '例：採寸・見積り相談', showContent: true,  showPrice: true,  showSlip: false, showDate: false, showPrepaid: false, isPurchase: false },
  { value: 'purchase',        label: '📦 追加購入・注文', ph_item: '例：○○高校学ラン 165A',  ph_content: '',                     showContent: false, showPrice: true,  showSlip: false, showDate: false, showPrepaid: false, isPurchase: true  },
  { value: 'inquiry',         label: '❓ その他問合せ',   ph_item: '例：問合せ内容の概要',    ph_content: '例：詳細',             showContent: true,  showPrice: false, showSlip: false, showDate: false, showPrepaid: false, isPurchase: false },
  { value: 'payment_pending', label: '💴 入金待ち',      ph_item: '例：未回収案件の概要',    ph_content: '',                     showContent: false, showPrice: true,  showSlip: false, showDate: false, showPrepaid: false, isPurchase: false },
]

function NewIntakeForm({ customerId, childId, storeId, reservationUrl, onSaved, onCancel, defaultType }: {
  customerId: string; childId: string | null; storeId: string
  reservationUrl?: string | null
  onSaved: () => void; onCancel: () => void; defaultType?: IntakeFormType
}) {
  const [intakeType,  setIntakeType]  = useState<IntakeFormType>(defaultType ?? 'repair')
  const [itemName,    setItemName]    = useState('')
  const [content,     setContent]     = useState('')
  const [maker,       setMaker]       = useState('')
  const [slipNumber,  setSlipNumber]  = useState('')
  const [price,       setPrice]       = useState('')
  const [prepaid,     setPrepaid]     = useState(false)
  const [notes,       setNotes]       = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const opt = INTAKE_OPTIONS.find(o => o.value === intakeType) ?? INTAKE_OPTIONS[0]

  const handleSave = async () => {
    if (!itemName.trim()) { setError('内容を入力してください'); return }
    if (intakeType === 'repair' && !content.trim()) { setError('お直し内容を入力してください'); return }
    setLoading(true); setError(null)
    if (opt.isPurchase) {
      const { error: err } = await supabase.from('purchase_orders').insert({
        store_id: storeId, customer_id: customerId,
        child_id: childId ?? null,
        item_name: itemName.trim(),
        maker: maker.trim() || null,
        notes: notes.trim() || null,
        price: price ? parseInt(price) : null,
        status: 'ordered', ordered_date: new Date().toISOString().slice(0, 10),
      })
      setLoading(false)
      if (err) { setError(`保存失敗: ${err.message}`); return }
    } else {
      const { error: err } = await (supabase as any).from('repair_histories').insert({
        store_id: storeId, customer_id: customerId,
        child_id: childId ?? null,
        item_name: itemName.trim(), content: content.trim(),
        slip_number: slipNumber.trim() || null,
        price: price ? parseInt(price) : null,
        notes: notes.trim() || null,
        status: 'received', received_date: new Date().toISOString().slice(0, 10),
        request_type: intakeType,
        prepaid,
        desired_completion_date: desiredDate || null,
      })
      setLoading(false)
      if (err) { setError(`保存失敗: ${err.message}`); return }
    }
    onSaved()
  }

  const contentLabel =
    intakeType === 'repair'        ? 'お直し内容' :
    intakeType === 'repair_consult' ? '相談内容'   : '詳細'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <p className="font-black text-gray-900 text-sm">依頼受付</p>
          <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
        </div>

        {/* 依頼タイプ選択 */}
        <div className="grid grid-cols-2 gap-1">
          {INTAKE_OPTIONS.map(o => (
            <button key={o.value} type="button"
              onClick={() => { setIntakeType(o.value); setError(null) }}
              className={`text-[11px] font-bold py-2 px-1 rounded-xl border transition-all ${
                intakeType === o.value
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
              }`}>
              {o.label}
            </button>
          ))}
          {reservationUrl && (
            <a href={reservationUrl} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-bold py-2 px-1 rounded-xl border border-sky-300 bg-sky-50 text-sky-700 flex items-center justify-center">
              🗓️ 来店予約（外部）
            </a>
          )}
        </div>

        <Field label={opt.isPurchase ? '商品名' : '内容・商品名'} required>
          <input type="text"
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
            placeholder={opt.ph_item} value={itemName}
            onChange={e => { setItemName(e.target.value); setError(null) }} />
        </Field>

        {opt.isPurchase && (
          <Field label="メーカー">
            <input type="text"
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
              placeholder="例：カンコー、トンボ"
              value={maker} onChange={e => setMaker(e.target.value)} />
          </Field>
        )}

        {opt.showContent && (
          <Field label={contentLabel} required={intakeType === 'repair'}>
            <input type="text"
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
              placeholder={opt.ph_content} value={content}
              onChange={e => { setContent(e.target.value); setError(null) }} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-2">
          {opt.showPrice && (
            <Field label="金額（円）">
              <input type="number" inputMode="numeric"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
                placeholder="例：1200" value={price} onChange={e => setPrice(e.target.value)} />
            </Field>
          )}
          {opt.showSlip && (
            <Field label="伝票番号">
              <input type="text"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm font-mono focus:border-indigo-500 focus:outline-none placeholder-gray-400"
                placeholder="例：001" value={slipNumber} onChange={e => setSlipNumber(e.target.value)} />
            </Field>
          )}
        </div>

        {opt.showDate && (
          <Field label="希望完了日">
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: '1週間後', days: 7 },
                  { label: '2週間後', days: 14 },
                  { label: '1ヶ月後', days: 30 },
                ].map(({ label, days }) => {
                  const d = new Date(); d.setDate(d.getDate() + days)
                  const val = d.toISOString().slice(0, 10)
                  return (
                    <button key={days} type="button"
                      onClick={() => setDesiredDate(val)}
                      className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                        desiredDate === val
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {label}
                    </button>
                  )
                })}
                {desiredDate && (
                  <button type="button" onClick={() => setDesiredDate('')}
                    className="text-xs px-2 py-1.5 rounded-xl border border-gray-300 text-gray-400 hover:bg-gray-100">
                    クリア
                  </button>
                )}
              </div>
              <input type="date" value={desiredDate} onChange={e => setDesiredDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          </Field>
        )}

        {opt.showPrepaid && (
          <button type="button" onClick={() => setPrepaid(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
              prepaid ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-400 bg-red-50'
            }`}>
            <div className="text-left">
              <p className={`font-bold text-sm ${prepaid ? 'text-emerald-700' : 'text-red-700'}`}>
                {prepaid ? '✅ 支払済み' : '⚠️ 未払い'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">受付時に支払いを頂いた場合は「支払済み」に</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${prepaid ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${prepaid ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
          </button>
        )}

        <Field label="メモ">
          <input type="text"
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
            placeholder="スタッフへの申し送り等" value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle size={13} />{error}
          </div>
        )}
        <button onClick={handleSave} disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '受付として登録する'}
        </button>
      </div>
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
  showToast, schoolOptions, defaultIntakeType, reservationUrl,
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
  const [expanded,       setExpanded]       = useState(false)
  const [repairs,        setRepairs]        = useState<RepairHistory[]>([])
  const [purchases,      setPurchases]      = useState<PurchaseOrder[]>([])
  const [loading,        setLoading]        = useState(false)
  const [showNewIntake,  setShowNewIntake]  = useState(false)

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
              {/* 依頼受付ボタン（統一） */}
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
    <div className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-gray-900 text-sm flex items-center gap-2">
          <Pencil size={14} className="text-amber-600" />お子様情報を編集
        </p>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none"
            value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
            placeholder="ヤマダ ハナコ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="学校名">
          <select value={schoolName} onChange={e => setSchoolName(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none">
            <option value="">選択</option>
            {(schoolOptions ?? SCHOOL_OPTIONS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="学年">
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none">
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
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
    <div className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-gray-900 text-sm flex items-center gap-2">
          <Pencil size={14} className="text-amber-600" />保護者情報を編集
        </p>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none"
            value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
            placeholder="ヤマダ タロウ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <Field label="電話番号">
        <input type="tel" inputMode="tel" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
          placeholder="090-1234-5678" value={tel} onChange={e => setTel(e.target.value)} />
      </Field>
      <Field label="メモ">
        <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
          placeholder="アレルギー・注意事項など" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
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
    <div className="bg-white border border-indigo-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-gray-900 text-sm flex items-center gap-2">
          <GraduationCap size={14} className="text-indigo-600" />お子様を追加
        </p>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
            placeholder="山田 花子" value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
            placeholder="ヤマダ ハナコ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="学校名">
          <select value={schoolName} onChange={e => setSchoolName(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">選択</option>
            {(schoolOptions ?? SCHOOL_OPTIONS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="学年">
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
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
  const { storeId }  = useParams<{ storeId: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const defaultIntakeType = (searchParams?.get('type') ?? 'repair') as IntakeFormType

  const [storeName,        setStoreName]        = useState('')
  const [customers,        setCustomers]        = useState<Customer[]>([])
  const [searchQuery,      setSearchQuery]      = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [editingCustomer,    setEditingCustomer]    = useState(false)
  const [editingStaffNotes,  setEditingStaffNotes]  = useState(false)
  const [staffNotesInput,    setStaffNotesInput]    = useState('')
  const [customerChildren,   setCustomerChildren]   = useState<Child[]>([])
  const [editingChild,       setEditingChild]       = useState<Child | null>(null)
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
  const [groupStoreIds,     setGroupStoreIds]     = useState<string[]>([])
  const [storeNameMap,      setStoreNameMap]      = useState<Record<string, string>>({})
  const [reservationUrl,    setReservationUrl]    = useState<string | null>(null)

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

  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string; onUndo?: () => Promise<void> } | null>(null)
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inlineDetailRef = useRef<HTMLDivElement>(null)

  // ── Quick intake (order-first flow) ──────────────────────
  const [showQuickIntake,    setShowQuickIntake]    = useState(false)
  const [qiStep,             setQiStep]             = useState<1 | 2 | 3>(1)
  const [qiIntakeType,       setQiIntakeType]       = useState<IntakeFormType>('repair')
  const [qiItemName,         setQiItemName]         = useState('')
  const [qiContent,          setQiContent]          = useState('')
  const [qiPrice,            setQiPrice]            = useState('')
  const [qiNotes,            setQiNotes]            = useState('')
  const [qiDesiredDate,      setQiDesiredDate]      = useState('')
  const [qiMaker,            setQiMaker]            = useState('')
  const [qiCustomerId,       setQiCustomerId]       = useState<string | null>(null)
  const [qiChildId,          setQiChildId]          = useState<string | null>(null)
  const [qiCustomerSearch,   setQiCustomerSearch]   = useState('')
  const [qiFoundCustomers,   setQiFoundCustomers]   = useState<Customer[]>([])
  const [qiSearching,        setQiSearching]        = useState(false)
  const [qiChildren,         setQiChildren]         = useState<Child[]>([])
  const [qiSaving,           setQiSaving]           = useState(false)

  const resetQi = useCallback(() => {
    setQiStep(1); setQiIntakeType('repair')
    setQiItemName(''); setQiContent(''); setQiPrice(''); setQiNotes('')
    setQiDesiredDate(''); setQiMaker('')
    setQiCustomerId(null); setQiChildId(null)
    setQiCustomerSearch(''); setQiFoundCustomers([]); setQiChildren([])
  }, [])

  useEffect(() => {
    if (!qiCustomerSearch.trim()) { setQiFoundCustomers([]); return }
    const t = setTimeout(async () => {
      setQiSearching(true)
      const { data } = await supabase.from('customers').select('*')
        .eq('store_id', storeId).is('deleted_at', null)
        .or(`name.ilike.%${qiCustomerSearch}%,kana.ilike.%${qiCustomerSearch}%,tel.ilike.%${qiCustomerSearch}%`)
        .order('updated_at', { ascending: false }).limit(10)
      setQiFoundCustomers(data ?? [])
      setQiSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [qiCustomerSearch, storeId])

  const handleQiSelectCustomer = useCallback(async (customer: Customer) => {
    setQiCustomerId(customer.id)
    const { data: kids } = await supabase.from('children').select('*')
      .eq('customer_id', customer.id).order('name')
    const childArr = kids ?? []
    setQiChildren(childArr)
    if (childArr.length === 0) {
      setQiChildId(null)
      setQiStep(3)
    } else {
      setQiStep(3)
    }
  }, [])

  const showToast = useCallback((type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => {
    setToast({ type, msg, onUndo })
  }, [])

  // 選択顧客インライン展開時のスクロール調整
  useEffect(() => {
    if (!selectedCustomer || !inlineDetailRef.current) return
    const el = inlineDetailRef.current
    setTimeout(() => {
      const rect = el.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - 72) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 60)
  }, [selectedCustomer?.id])

  // ── 初期ロード ──────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    ;(supabase.from('stores') as any)
      .select('name, group_id, alert_days_repair, alert_days_purchase, school_names, reservation_url')
      .eq('id', storeId).single()
      .then(async ({ data }: { data: any }) => {
        if (data?.name) setStoreName(data.name ?? '')
        if (data?.alert_days_repair   != null) setAlertDaysRepair(data.alert_days_repair)
        if (data?.alert_days_purchase != null) setAlertDaysPurchase(data.alert_days_purchase)
        if (Array.isArray(data?.school_names) && data.school_names.length > 0)
          setSchoolOptions(data.school_names)
        if (data?.reservation_url) setReservationUrl(data.reservation_url)
        if (data?.group_id) {
          const { data: gStores } = await (supabase.from('stores') as any)
            .select('id, name').eq('group_id', data.group_id)
          if (gStores && gStores.length > 1) {
            setGroupStoreIds(gStores.map((s: any) => s.id))
            const nameMap: Record<string, string> = {}
            gStores.forEach((s: any) => { nameMap[s.id] = s.name })
            setStoreNameMap(nameMap)
          } else {
            setGroupStoreIds([storeId])
          }
        } else {
          setGroupStoreIds([storeId])
        }
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

  const handleQiSave = useCallback(async () => {
    if (!qiCustomerId || !qiItemName.trim()) return
    setQiSaving(true)
    let err: { message: string } | null = null
    if (qiIntakeType === 'purchase') {
      const res = await supabase.from('purchase_orders').insert({
        store_id: storeId, customer_id: qiCustomerId,
        child_id: qiChildId ?? null,
        item_name: qiItemName.trim(), maker: qiMaker.trim() || null,
        notes: qiNotes.trim() || null,
        price: qiPrice ? parseInt(qiPrice) : null,
        status: 'ordered', ordered_date: new Date().toISOString().slice(0, 10),
      })
      err = res.error
    } else {
      const res = await (supabase as any).from('repair_histories').insert({
        store_id: storeId, customer_id: qiCustomerId,
        child_id: qiChildId ?? null,
        item_name: qiItemName.trim(), content: qiContent.trim(),
        price: qiPrice ? parseInt(qiPrice) : null,
        notes: qiNotes.trim() || null,
        status: 'received', received_date: new Date().toISOString().slice(0, 10),
        request_type: qiIntakeType, prepaid: false,
        desired_completion_date: qiDesiredDate || null,
      })
      err = res.error
    }
    setQiSaving(false)
    if (err) { showToast('err', `保存失敗: ${err.message}`); return }
    showToast('ok', '依頼を受け付けました')
    setShowQuickIntake(false)
    resetQi()
    fetchStats()
  }, [qiCustomerId, qiChildId, qiItemName, qiContent, qiPrice, qiNotes, qiDesiredDate, qiMaker, qiIntakeType, storeId, showToast, resetQi, fetchStats])

  const fetchAllCustomers = useCallback(async () => {
    if (!storeId || groupStoreIds.length === 0) return
    setAllLoading(true)
    const q = supabase.from('customers').select('*, children(school_name)').in('store_id', groupStoreIds)
    const { data } = await (showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null))
      .order('kana', { ascending: true }).limit(500)
    setAllCustomers(data ?? [])
    setAllLoading(false)
  }, [storeId, showDeleted, groupStoreIds])

  useEffect(() => { fetchAllCustomers() }, [fetchAllCustomers])

  // ── 顧客検索（お子様名でもヒット・削除済み切替対応）──
  const searchCustomers = useCallback(async (q: string, deleted = false) => {
    if (!storeId || !q.trim()) { setCustomers([]); setCustomerLoading(false); return }
    setCustomerLoading(true)

    const sIds = groupStoreIds.length > 0 ? groupStoreIds : [storeId]
    const baseQuery = () => {
      const q2 = supabase.from('customers').select('*').in('store_id', sIds)
      return deleted ? q2.not('deleted_at', 'is', null) : q2.is('deleted_at', null)
    }

    const { data: direct } = await baseQuery()
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q.replace(/-/g, '')}%,parent_name.ilike.%${q}%`)
      .order('updated_at', { ascending: false }).limit(20)

    const { data: childHits } = await supabase.from('children').select('customer_id, name').in('store_id', sIds)
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
    fetchStats()
    if (showRepairCompleted) fetchRepairCompleted()
    let msg = '✅ 完了処理しました'
    try {
      const res = await fetch('/api/notify-repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repairId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) msg = '✅ 完了処理 + LINE通知を送信しました'
      else if (!j.skipped)    msg = `完了済み・通知失敗: ${j.error ?? '不明'}`
    } catch { msg = '完了済み・通知APIエラー' }
    showToast('ok', msg, async () => {
      await supabase.from('repair_histories')
        .update({ status: 'received', completed_date: null, notified: false }).eq('id', repairId)
      fetchStats()
      if (showRepairReceived) fetchRepairReceived()
      if (showRepairCompleted) fetchRepairCompleted()
    })
  }, [showToast, fetchStats, showRepairReceived, showRepairCompleted, fetchRepairReceived, fetchRepairCompleted])

  const handleRepairDeliver = useCallback(async (repairId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'delivered', delivered_date: today }).eq('id', repairId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setRepairCompletedList(prev => prev.filter(r => r.id !== repairId))
    fetchStats()
    showToast('ok', '📦 お渡し済みにしました', async () => {
      await supabase.from('repair_histories')
        .update({ status: 'completed', delivered_date: null }).eq('id', repairId)
      fetchStats()
      if (showRepairCompleted) fetchRepairCompleted()
    })
  }, [showToast, fetchStats, showRepairCompleted, fetchRepairCompleted])

  const handleRepairRevert = useCallback(async (repairId: string) => {
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'received', completed_date: null, notified: false }).eq('id', repairId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setRepairCompletedList(prev => prev.filter(r => r.id !== repairId))
    fetchStats()
    if (showRepairReceived) fetchRepairReceived()
    showToast('ok', '🔄 預かり中に戻しました', async () => {
      await supabase.from('repair_histories')
        .update({ status: 'completed' }).eq('id', repairId)
      fetchStats()
      if (showRepairCompleted) fetchRepairCompleted()
    })
  }, [showToast, fetchStats, showRepairReceived, showRepairCompleted, fetchRepairReceived, fetchRepairCompleted])

  // ── 追加購入アクション ─────────────────────────────────
  const handlePurchaseStock = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    setPurchaseReceivedList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseArrived) fetchPurchaseArrived()
    let msg = '✅ 在庫確保済みにしました'
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) msg = '✅ 在庫確保・入荷連絡を送信しました'
      else if (!j.skipped)    msg = `在庫確保済み・通知失敗: ${j.error ?? '不明'}`
    } catch { msg = '在庫確保済み・通知APIエラー' }
    showToast('ok', msg, async () => {
      await supabase.from('purchase_orders')
        .update({ status: 'received', arrived_date: null, notified: false }).eq('id', orderId)
      fetchStats()
      if (showPurchaseReceived) fetchPurchaseReceived()
    })
  }, [showToast, fetchStats, showPurchaseReceived, showPurchaseArrived, fetchPurchaseReceived, fetchPurchaseArrived])

  const handlePurchaseBackOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders').update({ status: 'on_order' }).eq('id', orderId)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    setPurchaseReceivedList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseInProgress) fetchPurchaseInProgress()
    showToast('ok', '✅ メーカー発注済みにしました', async () => {
      await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', orderId)
      fetchStats()
      if (showPurchaseReceived) fetchPurchaseReceived()
    })
  }, [showToast, fetchStats, showPurchaseReceived, showPurchaseInProgress, fetchPurchaseReceived, fetchPurchaseInProgress])

  const handlePurchaseArrive = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `入荷処理失敗: ${error.message}`); return }
    setPurchaseInProgressList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseArrived) fetchPurchaseArrived()
    let msg = '✅ 入荷連絡済みにしました'
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) msg = '✅ 入荷連絡済み + LINE通知を送信しました'
      else if (!j.skipped)    msg = `入荷連絡済み・通知失敗: ${j.error ?? '不明'}`
    } catch { msg = '入荷連絡済み・通知APIエラー' }
    showToast('ok', msg, async () => {
      await supabase.from('purchase_orders')
        .update({ status: 'on_order', arrived_date: null, notified: false }).eq('id', orderId)
      fetchStats()
      if (showPurchaseInProgress) fetchPurchaseInProgress()
    })
  }, [showToast, fetchStats, showPurchaseInProgress, showPurchaseArrived, fetchPurchaseInProgress, fetchPurchaseArrived])

  const handlePurchaseDeliver = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'delivered', delivered_date: today }).eq('id', orderId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setPurchaseArrivedList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    showToast('ok', '📦 お渡し済みにしました', async () => {
      await supabase.from('purchase_orders')
        .update({ status: 'arrived', delivered_date: null }).eq('id', orderId)
      fetchStats()
      if (showPurchaseArrived) fetchPurchaseArrived()
    })
  }, [showToast, fetchStats, showPurchaseArrived, fetchPurchaseArrived])

  const handlePurchaseRevert = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'ordered', arrived_date: null, notified: false }).eq('id', orderId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setPurchaseInProgressList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseReceived) fetchPurchaseReceived()
    showToast('ok', '🔄 依頼受付に戻しました', async () => {
      await supabase.from('purchase_orders').update({ status: 'on_order' }).eq('id', orderId)
      fetchStats()
      if (showPurchaseInProgress) fetchPurchaseInProgress()
    })
  }, [showToast, fetchStats, showPurchaseReceived, showPurchaseInProgress, fetchPurchaseReceived, fetchPurchaseInProgress])

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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} onClose={() => setToast(null)} />}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <h1 className="font-black text-gray-900 text-base flex items-center gap-2">
              顧客管理（CRM）
            </h1>
            {storeName && <p className="text-gray-500 text-xs">{storeName}</p>}
          </div>
          <button onClick={() => { resetQi(); setShowQuickIntake(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all">
            <Plus size={13} />先に内容入力
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">

        {/* 業務進捗管理はお直し・注文管理タブに移行しました */}

        {/* ══════════════════════════════════════════════════
            顧客管理セクション
           ══════════════════════════════════════════════════ */}
        <section className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-gray-700">顧客管理</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-indigo-100 border-indigo-200 text-indigo-700">
                <QrCode size={12} />新規登録QR
              </button>
              <button onClick={() => { setShowDeleted(v => !v); setSearchQuery(''); setCustomers([]); setAllCustomers([]); setSelectedCustomer(null); setKanaFilter(null) }}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showDeleted ? 'bg-red-100 border-red-300 text-red-600' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
                {showDeleted ? <><EyeOff size={12} />削除済みを非表示</> : <><Eye size={12} />削除済みを表示</>}
              </button>
            </div>
          </div>

          {/* 検索 — sticky */}
          <div className="sticky top-[56px] z-20 bg-gray-50 -mx-4 px-4 pb-2 pt-1">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setKanaFilter(null) }}
                placeholder="保護者名・お子様名・フリガナ・電話番号"
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-9 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none transition-colors shadow-sm" />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setCustomers([]); setSelectedCustomer(null) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 学校フィルター — 常時表示 */}
          {schoolOptions.length > 0 && (
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
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-900'
                    }`}>
                    {s}
                    {count > 0 && <span className={`ml-1 ${active ? 'text-amber-100' : 'text-gray-500'}`}>({count})</span>}
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
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-900'
                    }`}>
                    {row}
                    {count > 0 && !active && (
                      <span className="block text-[9px] text-gray-500 font-normal leading-none -mt-0.5">{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* 顧客リスト */}
          {(() => {
            const isSearchMode = !!searchQuery.trim()
            // 検索結果 or 全顧客 をベースに、学校フィルターを重ねて適用
            const base = isSearchMode ? customers : kanaFilter
              ? allCustomers.filter(c => getKanaRow(c.kana) === kanaFilter)
              : allCustomers
            const list = schoolFilter
              ? base.filter(c => (c as any).children?.some((ch: any) => ch.school_name === schoolFilter))
              : base
            const loading = isSearchMode ? customerLoading : allLoading

            if (loading) return (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-indigo-600" /></div>
            )
            if (list.length === 0) return (
              <div className="text-center py-6 text-gray-500">
                <User size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{isSearchMode ? '該当する顧客が見つかりません' : '顧客がいません'}</p>
              </div>
            )
            return (
              <div className="space-y-1.5 mb-4 animate-fade-in">
                {list.map(c => {
                  const childrenArr = (c as any).children as { id: string; name: string; school_name: string | null }[] | undefined ?? []
                  const isOpen = selectedCustomer?.id === c.id
                  return (
                  <Fragment key={c.id}>
                    <button onClick={() => { setSelectedCustomer(prev => prev?.id === c.id ? null : c); setEditingCustomer(false); setEditingStaffNotes(false); setShowAddChild(false) }}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                        isOpen
                          ? 'bg-indigo-50 border-indigo-400 text-gray-900 rounded-b-none border-b-0'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                          <User size={16} className={isOpen ? 'text-indigo-600' : 'text-gray-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {childMatchMap[c.id] ? (
                            <>
                              <p className="font-black text-gray-900 text-base leading-tight truncate">{childMatchMap[c.id]}</p>
                              <p className="text-xs text-gray-500 truncate">保護者: {c.name}{c.kana ? ` (${c.kana})` : ''}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-sm truncate">{c.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {c.kana ?? c.tel ?? 'LINE未連携'}
                              </p>
                            </>
                          )}
                          {/* Children preview chips */}
                          {childrenArr.length > 0 && !isOpen && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {childrenArr.slice(0, 3).map((ch) => (
                                <span key={ch.id} className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                                  {ch.name}
                                </span>
                              ))}
                              {childrenArr.length > 3 && (
                                <span className="text-[10px] text-gray-400 px-1 py-0.5">+{childrenArr.length - 3}人</span>
                              )}
                            </div>
                          )}
                          {Object.keys(storeNameMap).length > 1 && storeNameMap[(c as any).store_id] && (
                            <p className="text-[10px] text-gray-500">{storeNameMap[(c as any).store_id]}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(c as any).staff_notes && (
                            <span className="text-[11px]" title="引き継ぎノートあり">📝</span>
                          )}
                          {c.line_user_id
                            ? <MessageCircle size={13} className="text-emerald-600" />
                            : <span className="text-[10px] text-gray-500">LINE未</span>
                          }
                          {isOpen
                            ? <ChevronUp size={14} className="text-indigo-500" />
                            : <ChevronDown size={14} className="text-gray-400" />
                          }
                        </div>
                      </div>
                    </button>

                    {/* 選択中顧客 — インライン展開 */}
                    {isOpen && (
                      <div ref={inlineDetailRef} className="space-y-4 border border-indigo-200 rounded-b-2xl p-4 bg-indigo-50/30 border-t-0 -mt-px">

                        {/* 保護者情報 */}
                        {editingCustomer ? (
                          <EditCustomerForm
                            customer={selectedCustomer}
                            onSaved={updated => {
                              setSelectedCustomer(updated)
                              setCustomers(prev => prev.map(cu => cu.id === updated.id ? updated : cu))
                              setEditingCustomer(false)
                              showToast('ok', '保護者情報を更新しました')
                            }}
                            onCancel={() => setEditingCustomer(false)}
                          />
                        ) : (
                          <div className="bg-white border border-gray-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-11 h-11 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                                <User size={20} className="text-indigo-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-gray-900 text-base">{selectedCustomer.name}</p>
                                {selectedCustomer.kana && <p className="text-gray-500 text-xs">{selectedCustomer.kana}</p>}
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  {selectedCustomer.tel && (
                                    <span className="flex items-center gap-1 text-gray-600 text-xs"><Phone size={11} />{selectedCustomer.tel}</span>
                                  )}
                                  {selectedCustomer.line_user_id
                                    ? <span className="flex items-center gap-1 text-emerald-600 text-xs"><MessageCircle size={11} />LINE連携済み</span>
                                    : <span className="text-gray-400 text-xs">LINE未連携</span>
                                  }
                                </div>
                                {selectedCustomer.notes && (
                                  <p className="text-gray-500 text-xs mt-1 bg-gray-100 rounded-lg px-2 py-1">📝 {selectedCustomer.notes}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {showDeleted ? (
                                  <button onClick={() => handleRestore(selectedCustomer)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-600 hover:bg-emerald-200 active:scale-90 transition-all text-xs font-bold">
                                    <ArchiveRestore size={13} />復元
                                  </button>
                                ) : (
                                  <button onClick={() => setDeleteTarget(selectedCustomer)}
                                    className="p-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-90 transition-all">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                                {!showDeleted && (
                                  <button onClick={() => setEditingCustomer(true)}
                                    className="p-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200 active:scale-90 transition-all">
                                    <Pencil size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 引き継ぎノート */}
                        {!editingCustomer && selectedCustomer && (
                          <div className="bg-white border border-gray-200 rounded-2xl p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-bold text-gray-600 flex items-center gap-1">📝 引き継ぎノート</p>
                              {!editingStaffNotes && (
                                <button
                                  onClick={() => { setEditingStaffNotes(true); setStaffNotesInput((selectedCustomer as any).staff_notes ?? '') }}
                                  className="text-[10px] text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-all">
                                  編集
                                </button>
                              )}
                            </div>
                            {editingStaffNotes ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={3}
                                  value={staffNotesInput}
                                  onChange={e => setStaffNotesInput(e.target.value)}
                                  placeholder="スタッフ間の引き継ぎ事項・クレーム履歴・対応メモ等"
                                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400 resize-none bg-gray-50"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingStaffNotes(false)}
                                    className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600">キャンセル</button>
                                  <button onClick={async () => {
                                    const { data, error: err } = await supabase.from('customers')
                                      .update({ staff_notes: staffNotesInput.trim() || null } as any)
                                      .eq('id', selectedCustomer.id).select().single()
                                    if (err) { showToast('err', '保存失敗'); return }
                                    const updated = { ...selectedCustomer, staff_notes: staffNotesInput.trim() || null } as any
                                    setSelectedCustomer(updated)
                                    setCustomers(prev => prev.map(cu => cu.id === updated.id ? updated : cu))
                                    setEditingStaffNotes(false)
                                    showToast('ok', '引き継ぎノートを保存しました')
                                  }}
                                    className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white">保存</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                                {(selectedCustomer as any).staff_notes || <span className="text-gray-400">まだノートはありません</span>}
                              </p>
                            )}
                          </div>
                        )}

                        {/* お子様一覧 */}
                        {!editingCustomer && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">お子様 ({customerChildren.length}人)</p>

                            {customerChildren.map(child => (
                              editingChild?.id === child.id ? (
                                <EditChildForm key={child.id} child={child}
                                  schoolOptions={schoolOptions}
                                  onSaved={updated => {
                                    setCustomerChildren(prev => prev.map(cu => cu.id === updated.id ? updated : cu))
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
                                    defaultIntakeType={defaultIntakeType}
                                    reservationUrl={reservationUrl}
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
                                      className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200 active:scale-90 transition-all">
                                      <Pencil size={12} />
                                    </button>
                                    <button onClick={() => setDeleteChildTarget(child)}
                                      className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-90 transition-all">
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
                                className="w-full py-3 rounded-xl border border-dashed border-indigo-300 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                                <Plus size={14} />お子様を追加
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Fragment>
                  )
                })}
              </div>
            )
          })()}
        </section>
      </div>

      {/* 削除確認モーダル */}
      {deleteTarget && !deleteMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-gray-900 font-black text-lg mb-1">顧客を削除しますか？</h3>
            <p className="text-gray-700 text-sm font-bold mb-2">{deleteTarget.name} 様</p>

            {/* お子様リスト警告 */}
            {customerChildren.length > 0 && (
              <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-xs font-bold mb-1.5">⚠️ 以下のお子様も一緒に削除されます</p>
                {customerChildren.map(ch => (
                  <p key={ch.id} className="text-gray-700 text-xs ml-2">・{ch.name}{ch.school_name ? `（${ch.school_name}）` : ''}</p>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              <button onClick={() => setDeleteMode('soft')}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-amber-50 border border-amber-300 text-left active:scale-[0.98] transition-all">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <EyeOff size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-amber-700 text-sm">通常削除（非表示）</p>
                  <p className="text-gray-500 text-xs mt-0.5">データは保持されます。「削除済みを表示」から復元可能です</p>
                </div>
              </button>
              <button onClick={() => setDeleteMode('hard')}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-red-50 border border-red-300 text-left active:scale-[0.98] transition-all">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-red-600 text-sm">完全削除</p>
                  <p className="text-gray-500 text-xs mt-0.5">データベースから完全に削除されます。復元不可</p>
                </div>
              </button>
            </div>
            <button onClick={() => setDeleteTarget(null)} className="w-full mt-3 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm">キャンセル</button>
          </div>
        </div>
      )}

      {/* 削除最終確認 */}
      {deleteTarget && deleteMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-gray-900 font-black text-lg mb-1">
              {deleteMode === 'soft' ? '通常削除しますか？' : '完全削除しますか？'}
            </h3>
            <p className="text-gray-700 text-sm font-bold mb-1">{deleteTarget.name} 様</p>
            {customerChildren.length > 0 && (
              <p className="text-red-600 text-xs mb-1">お子様 {customerChildren.length}人（{customerChildren.map(c => c.name).join('・')}）も削除されます</p>
            )}
            <p className="text-gray-500 text-xs mb-5 mt-1">
              {deleteMode === 'soft'
                ? 'データは保持されます。「削除済みを表示」から復元できます'
                : '⚠️ お直し・購入履歴・整理券も全て削除されます。この操作は取り消せません'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteMode(null)} className="py-4 rounded-xl bg-gray-100 text-gray-600 font-bold">戻る</button>
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
      {showQrModal && (
        <QrRegistrationModal
          storeId={storeId}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* お子様削除確認モーダル */}
      {deleteChildTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-gray-900 font-black text-lg mb-1">お子様を削除しますか？</h3>
            <p className="text-gray-600 text-sm mb-1">{deleteChildTarget.name} さん</p>
            <p className="text-gray-500 text-xs mb-5">お直し・追加購入履歴のお子様紐付けが外れます（履歴は保持されます）</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteChildTarget(null)} className="py-4 rounded-xl bg-gray-100 text-gray-600 font-bold">キャンセル</button>
              <button onClick={handleDeleteChild} disabled={deleteChildLoading}
                className="py-4 rounded-xl bg-red-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all">
                {deleteChildLoading && <Loader2 size={16} className="animate-spin" />}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Quick Intake Modal (order-first flow) ───────── */}
      {showQuickIntake && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowQuickIntake(false); resetQi() } }}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {qiStep > 1 && (
                  <button onClick={() => setQiStep(s => (s - 1) as 1 | 2 | 3)}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <h2 className="text-base font-black text-gray-900">
                  {qiStep === 1 ? '①内容を入力' : qiStep === 2 ? '②顧客を選択' : '③お子様 & 確認'}
                </h2>
              </div>
              <button onClick={() => { setShowQuickIntake(false); resetQi() }}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

              {/* ── Step 1: Form ─────────────────────────────── */}
              {qiStep === 1 && (
                <>
                  {/* Intake type buttons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {INTAKE_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setQiIntakeType(o.value)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          qiIntakeType === o.value ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                        }`}>{o.label}</button>
                    ))}
                    {reservationUrl && (
                      <a href={reservationUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => { setShowQuickIntake(false); resetQi() }}
                        className="py-2 rounded-xl text-xs font-bold border border-sky-300 bg-sky-50 text-sky-700 flex items-center justify-center">
                        🗓️ 来店予約（外部）
                      </a>
                    )}
                  </div>

                  {(() => {
                    const qiOpt = INTAKE_OPTIONS.find(o => o.value === qiIntakeType) ?? INTAKE_OPTIONS[0]
                    return (
                      <>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            {qiOpt.isPurchase ? '商品名' : '内容・商品名'} <span className="text-red-500">*</span>
                          </label>
                          <input type="text" value={qiItemName} onChange={e => setQiItemName(e.target.value)}
                            placeholder={qiOpt.ph_item}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>

                        {qiOpt.isPurchase ? (
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">メーカー</label>
                            <input type="text" value={qiMaker} onChange={e => setQiMaker(e.target.value)}
                              placeholder="例：カンコー"
                              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                          </div>
                        ) : qiOpt.showContent ? (
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">
                              {qiIntakeType === 'repair' ? 'お直し内容' : qiIntakeType === 'repair_consult' ? '相談内容' : '詳細'}
                            </label>
                            <input type="text" value={qiContent} onChange={e => setQiContent(e.target.value)}
                              placeholder={qiOpt.ph_content}
                              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                          {qiOpt.showPrice && (
                            <div>
                              <label className="text-xs font-bold text-gray-600 block mb-1">金額（円）</label>
                              <input type="number" value={qiPrice} onChange={e => setQiPrice(e.target.value)}
                                placeholder="例：1200"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                            </div>
                          )}
                          {qiOpt.showDate && (
                            <div>
                              <label className="text-xs font-bold text-gray-600 block mb-1">希望完了日</label>
                              <input type="date" value={qiDesiredDate} onChange={e => setQiDesiredDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">メモ</label>
                          <input type="text" value={qiNotes} onChange={e => setQiNotes(e.target.value)}
                            placeholder="スタッフへの申し送り等"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>
                      </>
                    )
                  })()}

                  <button
                    onClick={() => { if (qiItemName.trim()) setQiStep(2) }}
                    disabled={!qiItemName.trim()}
                    className="w-full py-3 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 flex items-center justify-center gap-2">
                    次へ → 顧客を選ぶ
                  </button>
                </>
              )}

              {/* ── Step 2: Customer Search ───────────────────── */}
              {qiStep === 2 && (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 font-bold">
                    {INTAKE_OPTIONS.find(o => o.value === qiIntakeType)?.label ?? ''} — {qiItemName}
                    {qiContent && ` (${qiContent})`}
                    {qiPrice && ` ¥${parseInt(qiPrice).toLocaleString()}`}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">顧客を検索</label>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={qiCustomerSearch}
                        onChange={e => setQiCustomerSearch(e.target.value)}
                        placeholder="名前・フリガナ・電話番号"
                        className="w-full pl-8 pr-3 border border-gray-300 rounded-xl py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                    </div>
                  </div>

                  {qiSearching && <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-indigo-500" /></div>}
                  {!qiSearching && qiFoundCustomers.length > 0 && (
                    <div className="space-y-1.5">
                      {qiFoundCustomers.map(c => (
                        <button key={c.id} onClick={() => handleQiSelectCustomer(c)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.98] transition-all flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <User size={14} className="text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 truncate">{c.name}</p>
                            <p className="text-xs text-gray-500 truncate">{c.kana ?? c.tel ?? 'LINE未連携'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!qiSearching && qiCustomerSearch.trim() && qiFoundCustomers.length === 0 && (
                    <p className="text-center text-gray-400 text-xs py-3">該当する顧客が見つかりません</p>
                  )}
                </>
              )}

              {/* ── Step 3: Child & Confirm ───────────────────── */}
              {qiStep === 3 && (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 font-bold">
                    {INTAKE_OPTIONS.find(o => o.value === qiIntakeType)?.label ?? ''} — {qiItemName}
                    {qiContent && ` (${qiContent})`}
                    {qiPrice && ` ¥${parseInt(qiPrice).toLocaleString()}`}
                  </div>

                  {qiChildren.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1.5">お子様を選択（任意）</label>
                      <div className="space-y-1.5">
                        <button onClick={() => setQiChildId(null)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm font-bold ${
                            qiChildId === null ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          保護者本人として登録
                        </button>
                        {qiChildren.map(ch => (
                          <button key={ch.id} onClick={() => setQiChildId(ch.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                              qiChildId === ch.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                            }`}>
                            <p className="font-bold text-sm text-gray-900">{ch.name}</p>
                            {ch.school_name && <p className="text-xs text-amber-600">{ch.school_name}{ch.grade ? ` ${ch.grade}` : ''}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={handleQiSave} disabled={qiSaving}
                    className="w-full py-3.5 rounded-xl font-black text-base bg-gradient-to-r from-indigo-600 to-violet-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                    {qiSaving ? <><Loader2 size={16} className="animate-spin" />登録中...</> : '受付として登録する'}
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
