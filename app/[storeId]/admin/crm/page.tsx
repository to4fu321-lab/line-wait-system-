'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Plus, User, Phone,
  CheckCheck, Package, Loader2, X, MessageCircle,
  CalendarDays, Pencil, AlertCircle, ChevronDown, ChevronUp,
  RotateCcw, ShoppingBag, Bell, Scissors, GraduationCap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type {
  Customer, Child, RepairHistory, PurchaseOrder,
  RepairStatus, PurchaseStatus,
} from '@/types/crm'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
  GRADE_OPTIONS,
} from '@/types/crm'

// ============================================================
// ユーティリティ
// ============================================================
function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
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
type RepairWithCustomer   = RepairHistory   & { customer: Pick<Customer, 'name' | 'tel'> | null }
type PurchaseWithCustomer = PurchaseOrder   & { customer: Pick<Customer, 'name' | 'tel'> | null }

// ============================================================
// お直しアイテム
// ============================================================
function RepairItem({ repair, showCustomer = false, onComplete, onDeliver, onRevert }: {
  repair: RepairHistory | RepairWithCustomer
  showCustomer?: boolean
  onComplete: (id: string) => Promise<void>
  onDeliver:  (id: string) => Promise<void>
  onRevert:   (id: string) => Promise<void>
}) {
  const [loading,         setLoading]         = useState<string | null>(null)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmRevert,   setConfirmRevert]   = useState(false)
  const customerName = showCustomer ? (repair as RepairWithCustomer).customer?.name : null

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
          {customerName && (
            <p className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
              <User size={10} />{customerName}
            </p>
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
function PurchaseItem({ order, showCustomer = false, onArrive, onDeliver, onRevert }: {
  order: PurchaseOrder | PurchaseWithCustomer
  showCustomer?: boolean
  onArrive:  (id: string) => Promise<void>
  onDeliver: (id: string) => Promise<void>
  onRevert:  (id: string) => Promise<void>
}) {
  const [loading,       setLoading]       = useState<string | null>(null)
  const [confirmArrive, setConfirmArrive] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const customerName = showCustomer ? (order as PurchaseWithCustomer).customer?.name : null

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      order.status === 'delivered'
        ? 'bg-zinc-900/30 border-zinc-800/40'
        : order.status === 'arrived'
        ? 'bg-emerald-950/40 border-emerald-500/20'
        : 'bg-gradient-to-br from-blue-950/40 to-indigo-950/30 border-blue-500/20'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${
          order.status === 'delivered' ? 'bg-zinc-800'
          : order.status === 'arrived' ? 'bg-emerald-500/20'
          : 'bg-blue-500/20'
        }`}>
          {order.status === 'delivered' ? <Package size={14} className="text-zinc-500" />
          : order.status === 'arrived'  ? <CheckCheck size={14} className="text-emerald-400" />
          : <ShoppingBag size={14} className="text-blue-400" />}
        </div>
        <div className="flex-1 min-w-0">
          {customerName && (
            <p className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
              <User size={10} />{customerName}
            </p>
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
          </div>
          <p className="font-bold text-white text-sm">{order.item_name}</p>
          {order.notes && <p className="text-zinc-400 text-xs mt-0.5">{order.notes}</p>}
          {order.price != null && <p className="text-zinc-500 text-xs mt-0.5">¥{order.price.toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-zinc-600 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />注文 {fmtDate(order.ordered_date)}</span>
            {order.arrived_date   && <span className="flex items-center gap-1"><Bell size={10} />入荷 {fmtDate(order.arrived_date)}</span>}
            {order.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(order.delivered_date)}</span>}
          </div>
        </div>
      </div>

      {order.status === 'ordered' && (
        confirmArrive ? (
          <div className="mt-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 space-y-2">
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
            className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 transition-all flex items-center justify-center gap-2">
            <Bell size={14} />入荷確認・LINE通知を送る
          </button>
        )
      )}

      {order.status === 'arrived' && (
        <div className="mt-3 space-y-2">
          <button
            onClick={async () => { setLoading('deliver'); await onDeliver(order.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-200 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={14} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
          {confirmRevert ? (
            <div className="bg-blue-950/50 border border-blue-500/30 rounded-xl p-3 space-y-2">
              <p className="text-xs text-center text-blue-300 font-bold">注文中に戻しますか？</p>
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
              <RotateCcw size={12} />注文中に戻す
            </button>
          )}
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
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '注文中として登録する'}
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
  onPurchaseArrive, onPurchaseDeliver, onPurchaseRevert,
  onRefreshStats,
  showToast,
}: {
  child: Child
  customerId: string
  storeId: string
  onRepairComplete:  (id: string) => Promise<void>
  onRepairDeliver:   (id: string) => Promise<void>
  onRepairRevert:    (id: string) => Promise<void>
  onPurchaseArrive:  (id: string) => Promise<void>
  onPurchaseDeliver: (id: string) => Promise<void>
  onPurchaseRevert:  (id: string) => Promise<void>
  onRefreshStats:    () => void
  showToast:         (type: 'ok' | 'err', msg: string) => void
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
function EditChildForm({ child, onSaved, onCancel }: {
  child: Child
  onSaved: (c: Child) => void
  onCancel: () => void
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
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            placeholder="○○中学校" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
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
function AddChildFormCRM({ customerId, storeId, onSaved, onCancel }: {
  customerId: string; storeId: string; onSaved: (c: Child) => void; onCancel: () => void
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
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="○○中学校" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
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

  // 未対応統計
  const [stats, setStats] = useState({ repairReceived: 0, repairCompleted: 0, purchaseOrdered: 0, purchaseArrived: 0 })

  // 未対応リスト
  const [showRepairReceived,  setShowRepairReceived]  = useState(false)
  const [repairReceivedList,  setRepairReceivedList]  = useState<RepairWithCustomer[]>([])
  const [repairReceivedLoading, setRepairReceivedLoading] = useState(false)

  const [showRepairCompleted,  setShowRepairCompleted]  = useState(false)
  const [repairCompletedList,  setRepairCompletedList]  = useState<RepairWithCustomer[]>([])
  const [repairCompletedLoading, setRepairCompletedLoading] = useState(false)

  const [showPurchaseOrdered,  setShowPurchaseOrdered]  = useState(false)
  const [purchaseOrderedList,  setPurchaseOrderedList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseOrderedLoading, setPurchaseOrderedLoading] = useState(false)

  const [showPurchaseArrived,  setShowPurchaseArrived]  = useState(false)
  const [purchaseArrivedList,  setPurchaseArrivedList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseArrivedLoading, setPurchaseArrivedLoading] = useState(false)

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

  const fetchStats = useCallback(async () => {
    if (!storeId) return
    const [{ data: rData }, { data: pData }] = await Promise.all([
      supabase.from('repair_histories').select('status').eq('store_id', storeId).in('status', ['received', 'completed']),
      supabase.from('purchase_orders').select('status').eq('store_id', storeId).in('status', ['ordered', 'arrived']),
    ])
    setStats({
      repairReceived:  (rData ?? []).filter(r => r.status === 'received').length,
      repairCompleted: (rData ?? []).filter(r => r.status === 'completed').length,
      purchaseOrdered: (pData ?? []).filter(r => r.status === 'ordered').length,
      purchaseArrived: (pData ?? []).filter(r => r.status === 'arrived').length,
    })
  }, [storeId])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ── 顧客検索 ──────────────────────────────────────────
  const searchCustomers = useCallback(async (q: string) => {
    if (!storeId || !q.trim()) { setCustomers([]); setCustomerLoading(false); return }
    setCustomerLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId)
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q.replace(/-/g, '')}%,parent_name.ilike.%${q}%`)
      .order('updated_at', { ascending: false }).limit(20)
    setCustomers(data ?? []); setCustomerLoading(false)
  }, [storeId])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, searchCustomers])

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
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'received')
      .order('received_date', { ascending: false })
    setRepairReceivedList((data ?? []) as RepairWithCustomer[]); setRepairReceivedLoading(false)
  }, [storeId])

  const fetchRepairCompleted = useCallback(async () => {
    if (!storeId) return; setRepairCompletedLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'completed')
      .order('completed_date', { ascending: false })
    setRepairCompletedList((data ?? []) as RepairWithCustomer[]); setRepairCompletedLoading(false)
  }, [storeId])

  const fetchPurchaseOrdered = useCallback(async () => {
    if (!storeId) return; setPurchaseOrderedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'ordered')
      .order('ordered_date', { ascending: false })
    setPurchaseOrderedList((data ?? []) as PurchaseWithCustomer[]); setPurchaseOrderedLoading(false)
  }, [storeId])

  const fetchPurchaseArrived = useCallback(async () => {
    if (!storeId) return; setPurchaseArrivedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'arrived')
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
  const handlePurchaseArrive = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `入荷処理失敗: ${error.message}`); return }
    setPurchaseOrderedList(prev => prev.filter(o => o.id !== orderId))
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) showToast('ok', '✅ 入荷済み + LINE通知を送信しました')
      else if (j.skipped)     showToast('ok', '✅ 入荷済みにしました（LINE未連携のため通知なし）')
      else                    showToast('err', `入荷済み・通知失敗: ${j.error ?? '不明'}`)
    } catch { showToast('err', '入荷済み・通知APIエラー') }
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
    setPurchaseArrivedList(prev => prev.filter(o => o.id !== orderId))
    showToast('ok', '🔄 注文中に戻しました')
    fetchStats()
    if (showPurchaseOrdered) fetchPurchaseOrdered()
  }, [showToast, fetchStats, showPurchaseOrdered, fetchPurchaseOrdered])

  // ── トグル関数 ─────────────────────────────────────────
  const toggleRepairReceived = () => {
    if (!showRepairReceived) fetchRepairReceived()
    setShowRepairReceived(v => !v)
  }
  const toggleRepairCompleted = () => {
    if (!showRepairCompleted) fetchRepairCompleted()
    setShowRepairCompleted(v => !v)
  }
  const togglePurchaseOrdered = () => {
    if (!showPurchaseOrdered) fetchPurchaseOrdered()
    setShowPurchaseOrdered(v => !v)
  }
  const togglePurchaseArrived = () => {
    if (!showPurchaseArrived) fetchPurchaseArrived()
    setShowPurchaseArrived(v => !v)
  }

  const pendingTotal = stats.repairReceived + stats.repairCompleted + stats.purchaseOrdered + stats.purchaseArrived

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

        {/* ══════════════════════════════════════════════════
            未対応セクション
           ══════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-black text-zinc-300">未対応一覧</h2>
            {pendingTotal > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{pendingTotal}</span>
            )}
          </div>

          {/* お直し統計 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button onClick={toggleRepairReceived}
              className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
                showRepairReceived ? 'bg-amber-500/20 border-amber-400/40 ring-1 ring-amber-400/30' : 'bg-amber-950/40 border-amber-500/20'
              }`}>
              <p className="text-xs text-amber-400/70 font-bold flex items-center justify-center gap-1">
                <Scissors size={10} />お直し預かり中 {showRepairReceived ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </p>
              <p className="text-3xl font-black text-amber-300 leading-none mt-0.5">{stats.repairReceived}</p>
              <p className="text-xs text-amber-500/50 mt-0.5">件</p>
            </button>
            <button onClick={toggleRepairCompleted}
              className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
                showRepairCompleted ? 'bg-emerald-500/20 border-emerald-400/40 ring-1 ring-emerald-400/30' : 'bg-emerald-950/40 border-emerald-500/20'
              }`}>
              <p className="text-xs text-emerald-400/70 font-bold flex items-center justify-center gap-1">
                <Scissors size={10} />お直し完了済み {showRepairCompleted ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </p>
              <p className="text-3xl font-black text-emerald-300 leading-none mt-0.5">{stats.repairCompleted}</p>
              <p className="text-xs text-emerald-500/50 mt-0.5">件</p>
            </button>
          </div>

          {/* 追加購入統計 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button onClick={togglePurchaseOrdered}
              className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
                showPurchaseOrdered ? 'bg-blue-500/20 border-blue-400/40 ring-1 ring-blue-400/30' : 'bg-blue-950/40 border-blue-500/20'
              }`}>
              <p className="text-xs text-blue-400/70 font-bold flex items-center justify-center gap-1">
                <ShoppingBag size={10} />注文中 {showPurchaseOrdered ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </p>
              <p className="text-3xl font-black text-blue-300 leading-none mt-0.5">{stats.purchaseOrdered}</p>
              <p className="text-xs text-blue-500/50 mt-0.5">件</p>
            </button>
            <button onClick={togglePurchaseArrived}
              className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
                showPurchaseArrived ? 'bg-emerald-500/20 border-emerald-400/40 ring-1 ring-emerald-400/30' : 'bg-emerald-950/40 border-emerald-500/20'
              }`}>
              <p className="text-xs text-emerald-400/70 font-bold flex items-center justify-center gap-1">
                <ShoppingBag size={10} />入荷済み（要お渡し） {showPurchaseArrived ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </p>
              <p className="text-3xl font-black text-emerald-300 leading-none mt-0.5">{stats.purchaseArrived}</p>
              <p className="text-xs text-emerald-500/50 mt-0.5">件</p>
            </button>
          </div>

          {/* お直し預かり中リスト */}
          {showRepairReceived && (
            <div className="space-y-2 animate-fade-in mb-2">
              <p className="text-xs font-bold text-amber-400/70 uppercase tracking-wider px-1">
                お直し預かり中 — {repairReceivedList.length}件
              </p>
              {repairReceivedLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-amber-400" /></div>
              ) : repairReceivedList.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-sm">預かり中のお直しはありません</div>
              ) : repairReceivedList.map(r => (
                <RepairItem key={r.id} repair={r} showCustomer
                  onComplete={handleRepairComplete} onDeliver={handleRepairDeliver} onRevert={handleRepairRevert} />
              ))}
            </div>
          )}

          {/* お直し完了済みリスト */}
          {showRepairCompleted && (
            <div className="space-y-2 animate-fade-in mb-2">
              <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-wider px-1">
                お直し完了済み — {repairCompletedList.length}件
              </p>
              {repairCompletedLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-emerald-400" /></div>
              ) : repairCompletedList.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-sm">完了済みのお直しはありません</div>
              ) : repairCompletedList.map(r => (
                <RepairItem key={r.id} repair={r} showCustomer
                  onComplete={handleRepairComplete} onDeliver={handleRepairDeliver} onRevert={handleRepairRevert} />
              ))}
            </div>
          )}

          {/* 注文中リスト */}
          {showPurchaseOrdered && (
            <div className="space-y-2 animate-fade-in mb-2">
              <p className="text-xs font-bold text-blue-400/70 uppercase tracking-wider px-1">
                注文中 — {purchaseOrderedList.length}件
              </p>
              {purchaseOrderedLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
              ) : purchaseOrderedList.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-sm">注文中の商品はありません</div>
              ) : purchaseOrderedList.map(o => (
                <PurchaseItem key={o.id} order={o} showCustomer
                  onArrive={handlePurchaseArrive} onDeliver={handlePurchaseDeliver} onRevert={handlePurchaseRevert} />
              ))}
            </div>
          )}

          {/* 入荷済みリスト */}
          {showPurchaseArrived && (
            <div className="space-y-2 animate-fade-in mb-2">
              <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-wider px-1">
                入荷済み（要お渡し） — {purchaseArrivedList.length}件
              </p>
              {purchaseArrivedLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-emerald-400" /></div>
              ) : purchaseArrivedList.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-sm">入荷済みの商品はありません</div>
              ) : purchaseArrivedList.map(o => (
                <PurchaseItem key={o.id} order={o} showCustomer
                  onArrive={handlePurchaseArrive} onDeliver={handlePurchaseDeliver} onRevert={handlePurchaseRevert} />
              ))}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════
            顧客管理セクション
           ══════════════════════════════════════════════════ */}
        <section className="border-t border-white/5 pt-4">
          <h2 className="text-sm font-black text-zinc-300 mb-3">顧客管理</h2>

          {/* 検索 */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="名前・フリガナ・電話番号で検索"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-3 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none transition-colors" />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setCustomers([]); setSelectedCustomer(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* 顧客リスト */}
          {searchQuery.trim() && (
            customerLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
            ) : customers.length === 0 ? (
              <div className="text-center py-6 text-zinc-600">
                <User size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">該当する顧客が見つかりません</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4 animate-fade-in">
                {customers.map(c => (
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
                          {c.kana ?? c.tel ?? 'LINE未連携'}
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
          )}

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
                    <button onClick={() => setEditingCustomer(true)}
                      className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-90 transition-all shrink-0">
                      <Pencil size={14} />
                    </button>
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
                          onPurchaseArrive={handlePurchaseArrive}
                          onPurchaseDeliver={handlePurchaseDeliver}
                          onPurchaseRevert={handlePurchaseRevert}
                          onRefreshStats={fetchStats}
                          showToast={showToast}
                        />
                        <button
                          onClick={() => setEditingChild(child)}
                          className="absolute top-3 right-10 p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-90 transition-all">
                          <Pencil size={12} />
                        </button>
                      </div>
                    )
                  ))}

                  {showAddChild ? (
                    <AddChildFormCRM
                      customerId={selectedCustomer.id}
                      storeId={storeId}
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
    </div>
  )
}
