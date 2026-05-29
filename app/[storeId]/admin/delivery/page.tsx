'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BottomNav } from '../_components/BottomNav'
import {
  ArrowLeft, Package, CheckCheck, RotateCcw, Loader2,
  Scissors, ShoppingBag, Phone, User, GraduationCap,
  CalendarDays, Bell, History, CreditCard, AlertCircle,
  ChevronDown, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── types ─────────────────────────────────────────────────────

interface DeliveryItem {
  id:             string
  kind:           'repair' | 'purchase'
  store_id:       string
  customer_id:    string
  child_id:       string | null
  item_name:      string
  sub_label:      string          // content or notes
  status:         string
  prev_status:    string          // status to revert to
  received_date:  string
  ready_date:     string | null   // completed_date or arrived_date
  delivered_date: string | null
  price:          number | null
  slip_number:    string | null
  notified:       boolean
  payment_status: string | null   // 'unpaid' | 'paid' | null (column may not exist yet)
  customer:       { name: string; tel: string | null } | null
  child:          { name: string; school_name: string | null } | null
  overdueAlertDays?: number
}

// ── utils ─────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}
function todayJst() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

function Toast({ msg, type, onUndo }: { msg: string; type: 'ok' | 'err' | 'undo'; onUndo?: () => Promise<void> | void }) {
  const [undoing, setUndoing] = useState(false)
  const handleUndo = async () => {
    if (!onUndo || undoing) return
    setUndoing(true)
    await onUndo()
    setUndoing(false)
  }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl animate-fade-in max-w-xs ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-900 border border-gray-700'
    }`}>
      <span className="flex-1">{msg}</span>
      {onUndo && (
        <button onClick={handleUndo} disabled={undoing}
          className="shrink-0 px-3 py-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black active:scale-95 transition-all disabled:opacity-50">
          {undoing ? '…' : '取消し'}
        </button>
      )}
    </div>
  )
}

// ── 支払いバッジ ───────────────────────────────────────────────

function PaymentBadge({ status, onToggle, loading }: {
  status: string | null
  onToggle: () => void
  loading: boolean
}) {
  const isPaid = status === 'paid'
  const [confirmPay,   setConfirmPay]   = useState(false)
  const [confirmUnpay, setConfirmUnpay] = useState(false)

  // 未払い → 支払い確認
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

  // 支払い済み → 未払いに戻す確認
  if (isPaid && confirmUnpay) {
    return (
      <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-500/40 rounded-xl px-2 py-1">
        <span className="text-[10px] text-red-200 font-bold">未払いに戻す？</span>
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

// ── お渡し待ちカード ──────────────────────────────────────────

function WaitingCard({ item, alertDays, onDeliver, onPaymentToggle }: {
  item: DeliveryItem
  alertDays: number
  onDeliver: (item: DeliveryItem, paid: boolean) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
}) {
  const [confirmOpen,  setConfirmOpen]  = useState(false)
  const [payAtDeliver, setPayAtDeliver] = useState(item.payment_status === 'paid')
  const [loading,      setLoading]      = useState<string | null>(null)
  const [custOpen,     setCustOpen]     = useState(false)

  const isOverdue = item.ready_date &&
    (Date.now() - new Date(item.ready_date).getTime()) / 86400000 > alertDays
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - new Date(item.ready_date!).getTime()) / 86400000)
    : 0

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      item.kind === 'repair'
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-emerald-50 border-emerald-200'
    }`}>
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${
          item.kind === 'repair' ? 'bg-emerald-500/20' : 'bg-teal-500/20'
        }`}>
          {item.kind === 'repair'
            ? <Scissors size={14} className="text-emerald-600" />
            : <ShoppingBag size={14} className="text-teal-600" />
          }
        </div>

        <div className="flex-1 min-w-0">
          {/* 顧客名 */}
          {item.customer && (
            <button onClick={() => setCustOpen(v => !v)}
              className="w-full text-left active:opacity-70 flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                {item.child?.school_name && (
                  <p className="text-xs font-black text-amber-600 truncate leading-tight">{item.child.school_name}</p>
                )}
                <p className={`font-black text-lg leading-tight truncate ${item.child ? 'text-gray-900' : 'text-indigo-600'}`}>
                  {item.child?.name ?? item.customer.name}
                </p>
                {item.child && (
                  <p className="text-xs text-gray-500 truncate">保護者: {item.customer.name}</p>
                )}
              </div>
              <ChevronDown size={14} className={`mt-1 shrink-0 text-gray-500 transition-transform ${custOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* バッジ群 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              item.kind === 'repair'
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}>
              {item.kind === 'repair' ? 'お直し完了' : '取置き入荷済み'}
            </span>
            <PaymentBadge
              status={item.payment_status}
              loading={loading === 'payment'}
              onToggle={async () => {
                setLoading('payment')
                await onPaymentToggle(item)
                setLoading(null)
              }}
            />
            {item.notified && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                LINE通知済み
              </span>
            )}
            {isOverdue && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                <AlertCircle size={9} />{overdueDays}日超過
              </span>
            )}
          </div>

          <p className="font-bold text-gray-900 text-sm">{item.item_name}</p>
          {item.sub_label && <p className="text-gray-600 text-xs mt-0.5">{item.sub_label}</p>}
          {item.price != null && <p className="text-gray-500 text-xs mt-0.5">¥{item.price.toLocaleString()}</p>}
          {item.slip_number && <p className="text-gray-400 text-xs mt-0.5 font-mono">#{item.slip_number}</p>}

          {/* 日付 */}
          <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-[10px]">
            <span className="flex items-center gap-1">
              <CalendarDays size={9} />受付 {fmtDate(item.received_date)}
            </span>
            {item.ready_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500/70' : ''}`}>
                {item.kind === 'repair'
                  ? <><CheckCheck size={9} />完了 {fmtDate(item.ready_date)}</>
                  : <><Bell size={9} />入荷 {fmtDate(item.ready_date)}</>
                }
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 顧客情報展開 */}
      {custOpen && item.customer && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1 animate-fade-in">
          {item.child && (
            <div className="flex items-center gap-1.5">
              <GraduationCap size={11} className="text-amber-600 shrink-0" />
              <span className="text-amber-600 text-xs font-bold">{item.child.name}</span>
            </div>
          )}
          {item.customer.tel && (
            <a href={`tel:${item.customer.tel}`}
              className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
              <Phone size={11} />{item.customer.tel}
            </a>
          )}
        </div>
      )}

      {/* お渡しボタン */}
      {!confirmOpen ? (
        <button onClick={() => setConfirmOpen(true)}
          className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30">
          <Package size={14} />お渡し済みにする
        </button>
      ) : (
        <div className="mt-3 bg-white border border-indigo-300 rounded-2xl p-4 space-y-3 animate-fade-in">
          <p className="text-sm font-black text-gray-900 text-center">お渡し確認</p>
          <p className="text-xs text-gray-600 text-center">
            <span className="font-bold text-gray-900">{item.child?.name ?? item.customer?.name ?? '（名前なし）'}</span> 様にお渡ししますか？
            {item.child && <span className="text-gray-500">（保護者: {item.customer?.name}）</span>}
          </p>

          {/* 支払い確認 */}
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
              <p className={`text-sm font-bold ${payAtDeliver ? 'text-emerald-700' : 'text-gray-500'}`}>
                代金を受け取った
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.price != null ? `¥${item.price.toLocaleString()}` : '金額未設定'}
              </p>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmOpen(false)}
              className="py-3 rounded-xl font-bold text-sm bg-gray-300 text-gray-700 active:scale-95 transition-all">
              キャンセル
            </button>
            <button
              onClick={async () => {
                setLoading('deliver')
                await onDeliver(item, payAtDeliver)
                setLoading(null)
                setConfirmOpen(false)
              }}
              disabled={!!loading}
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

// ── お渡し完了カード（履歴）─────────────────────────────────

function CompletedCard({ item, onRevert, onPaymentToggle }: {
  item: DeliveryItem
  onRevert: (item: DeliveryItem) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
}) {
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [loading,       setLoading]       = useState<string | null>(null)
  const [custOpen,      setCustOpen]      = useState(false)

  return (
    <div className="rounded-2xl border bg-gray-100 border-gray-200 p-4">
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
        <div className="mt-2 pt-2 border-t border-gray-200 animate-fade-in">
          <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
            <Phone size={11} />{item.customer.tel}
          </a>
        </div>
      )}

      {/* 戻すボタン */}
      {!confirmRevert ? (
        <button onClick={() => setConfirmRevert(true)}
          className="w-full mt-3 py-2 rounded-xl font-bold text-xs border border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all flex items-center justify-center gap-1.5 active:scale-95">
          <RotateCcw size={11} />お渡しを取り消す
        </button>
      ) : (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 animate-fade-in">
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

// ── メインページ ──────────────────────────────────────────────

type TabType = 'waiting' | 'history'

export default function DeliveryPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()

  const [tab,          setTab]          = useState<TabType>('waiting')
  const [storeName,    setStoreName]    = useState('')
  const [alertDays,    setAlertDays]    = useState(7)
  const [waiting,      setWaiting]      = useState<DeliveryItem[]>([])
  const [history,      setHistory]      = useState<DeliveryItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [histLoading,  setHistLoading]  = useState(false)
  const [histFetched,  setHistFetched]  = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err' | 'undo'; msg: string; onUndo?: () => Promise<void> | void } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'ok' | 'err' | 'undo', msg: string, onUndo?: () => Promise<void> | void) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ type, msg, onUndo })
    timerRef.current = setTimeout(() => setToast(null), onUndo ? 5000 : 3000)
  }, [])

  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('stores').select('name, alert_days_repair, alert_days_purchase')
      .eq('id', storeId).single()
      .then(({ data }: { data: { name: string; alert_days_repair: number; alert_days_purchase: number } | null }) => {
        if (data) {
          setStoreName(data.name ?? '')
          const days = Math.max(data.alert_days_repair ?? 7, data.alert_days_purchase ?? 7)
          setAlertDays(days)
        }
      })
  }, [storeId])

  const rawToItem = (row: Record<string, unknown>, kind: 'repair' | 'purchase'): DeliveryItem => ({
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
    delivered_date: row.delivered_date as string | null,
    price:          row.price as number | null,
    slip_number:    kind === 'repair' ? (row.slip_number as string | null) : null,
    notified:       row.notified as boolean ?? false,
    payment_status: (row as Record<string, unknown>).payment_status as string | null ?? null,
    customer:       row.customer as { name: string; tel: string | null } | null,
    child:          row.child as { name: string } | null,
  })

  const fetchWaiting = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const [{ data: repairs }, { data: purchases }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'completed')
        .order('completed_date', { ascending: true }),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'arrived')
        .order('arrived_date', { ascending: true }),
    ])
    const items: DeliveryItem[] = [
      ...(repairs   ?? []).map(r => rawToItem(r as Record<string, unknown>, 'repair')),
      ...(purchases ?? []).map(p => rawToItem(p as Record<string, unknown>, 'purchase')),
    ].sort((a, b) => {
      const da = a.ready_date ?? a.received_date
      const db = b.ready_date ?? b.received_date
      return da.localeCompare(db)
    })
    setWaiting(items)
    setLoading(false)
  }, [storeId])

  const fetchHistory = useCallback(async () => {
    if (!storeId) return
    setHistLoading(true)
    const [{ data: repairs }, { data: purchases }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name, tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
    ])
    const items: DeliveryItem[] = [
      ...(repairs   ?? []).map(r => rawToItem(r as Record<string, unknown>, 'repair')),
      ...(purchases ?? []).map(p => rawToItem(p as Record<string, unknown>, 'purchase')),
    ].sort((a, b) => (b.delivered_date ?? '').localeCompare(a.delivered_date ?? ''))
    setHistory(items)
    setHistLoading(false)
    setHistFetched(true)
  }, [storeId])

  useEffect(() => { fetchWaiting() }, [fetchWaiting])

  useEffect(() => {
    if (tab === 'history' && !histFetched) fetchHistory()
  }, [tab, histFetched, fetchHistory])

  // ── アクション ──────────────────────────────────────────────

  const handleDeliver = useCallback(async (item: DeliveryItem, paid: boolean) => {
    const today = todayJst()
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = {
      status: 'delivered',
      delivered_date: today,
    }
    if (paid) update.payment_status = 'paid'

    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }

    setWaiting(prev => prev.filter(i => i.id !== item.id))

    // undo用のスナップショット
    const snapshot = { ...item }
    showToast('undo', '📦 お渡し済みにしました', async () => {
      const revertUpdate: Record<string, unknown> = {
        status: snapshot.prev_status,
        delivered_date: null,
        payment_status: snapshot.payment_status,
      }
      if (item.kind === 'repair') revertUpdate.completed_date = snapshot.ready_date
      else                        revertUpdate.arrived_date   = snapshot.ready_date
      await (supabase as any).from(table).update(revertUpdate).eq('id', snapshot.id)
      await fetchWaiting()
      if (histFetched) setHistFetched(false)
      showToast('ok', '取り消しました')
    })

    if (histFetched) setHistFetched(false)
  }, [showToast, fetchWaiting, histFetched])

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
    await fetchWaiting()
    showToast('ok', '🔄 お渡し前の状態に戻しました')
  }, [showToast, fetchWaiting])

  const handlePaymentToggle = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const newStatus = item.payment_status === 'paid' ? 'unpaid' : 'paid'
    const prevStatus = item.payment_status
    const { error } = await (supabase as any).from(table)
      .update({ payment_status: newStatus }).eq('id', item.id)
    if (error) { showToast('err', '支払状態の更新失敗（SQLマイグレーションが必要な場合があります）'); return }
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

  // ── render ─────────────────────────────────────────────────

  const waitingUnpaid = waiting.filter(i => i.payment_status !== 'paid')
  const waitingPaid   = waiting.filter(i => i.payment_status === 'paid')

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} />}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin`)}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-90 transition-all">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-gray-900 text-base">お渡し管理</h1>
            {storeName && <p className="text-gray-500 text-xs">{storeName}</p>}
          </div>
          <button onClick={() => { fetchWaiting(); if (tab === 'history') setHistFetched(false) }}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-90 transition-all">
            <RefreshCw size={16} className="text-gray-600" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* タブ */}
        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
          {([
            { id: 'waiting', label: 'お渡し待ち', icon: Package, count: waiting.length },
            { id: 'history', label: 'お渡し完了', icon: History, count: null },
          ] as const).map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                tab === t.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon size={14} />
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                  tab === t.id ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* お渡し待ちタブ */}
        {tab === 'waiting' && (
          loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-indigo-400" />
            </div>
          ) : waiting.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Package size={44} className="mx-auto mb-3 opacity-15" />
              <p className="text-sm font-bold">お渡し待ちのアイテムはありません</p>
              <p className="text-xs mt-1 text-gray-600">お直し完了・入荷済みの商品がここに表示されます</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 未払いを先に、支払済みを後に */}
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
        )}

        {/* お渡し完了タブ（履歴）*/}
        {tab === 'history' && (
          histLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-indigo-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <History size={44} className="mx-auto mb-3 opacity-15" />
              <p className="text-sm font-bold">履歴はまだありません</p>
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
        )}
      </div>
      <BottomNav />
    </div>
  )
}
