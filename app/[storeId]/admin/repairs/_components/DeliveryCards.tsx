'use client'

import { useState } from 'react'
import {
  Loader2, CreditCard, Package, RotateCcw, Trash2, Phone,
  User, Check, CheckCheck, AlertCircle, CalendarDays, ChevronDown, ChevronUp,
} from 'lucide-react'
import { fmtDate, fmtReqNo } from './utils'
import type { DeliveryItem } from './types'

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
export function WaitingCard({ item, alertDays, onDeliver, onPaymentToggle, onRevertWaiting, onDelete, isSimpleMode }: {
  item: DeliveryItem
  alertDays: number
  onDeliver: (item: DeliveryItem, paid: boolean, deliveredBy: string) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
  onRevertWaiting: (item: DeliveryItem) => Promise<void>
  onDelete: (item: DeliveryItem) => Promise<void>
  isSimpleMode?: boolean
}) {
  const [open,          setOpen]          = useState(false)
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [payAtDeliver,  setPayAtDeliver]  = useState(item.payment_status === 'paid')
  const [unpaidConfirm, setUnpaidConfirm] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading,       setLoading]       = useState<string | null>(null)
  const [staffName,     setStaffName]     = useState('')
  const [simpleConfirm, setSimpleConfirm] = useState(false)

  const waitDays   = item.ready_date
    ? Math.floor((Date.now() - new Date(item.ready_date).getTime()) / 86400000)
    : 0
  const alertLevel = waitDays >= 14 ? 3 : waitDays >= 7 ? 2 : waitDays >= 3 ? 1 : 0
  const reqNo      = fmtReqNo(item.kind, item.request_no, item.id)
  const studentName = item.child?.name ?? item.customer?.name ?? '（名前なし）'

  // ── Simple mode card ──────────────────────────────────────────
  if (isSimpleMode) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-sm border-2 border-indigo-100 bg-white">
        {/* 受付番号ヘッダー */}
        <div className="px-4 py-2.5 flex items-center justify-between bg-indigo-600">
          <span className="text-indigo-200 text-xs font-bold">受付番号</span>
          <span className="text-white text-2xl font-black font-mono tracking-wider">{reqNo}</span>
        </div>

        <div className="p-4 space-y-3">
          {/* 学校名 + お客様名 */}
          <div>
            {item.child?.school_name && (
              <p className="text-amber-600 text-base font-black mb-0.5">{item.child.school_name}</p>
            )}
            <p className="text-gray-900 text-2xl font-black leading-tight">{studentName}</p>
          </div>

          {/* アイテム・内容 */}
          {(item.item_name || item.sub_label) && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
              {item.item_name && (
                <p className="text-gray-800 text-lg font-bold leading-tight">{item.item_name}</p>
              )}
              {item.sub_label && (
                <p className="text-gray-600 text-base leading-snug">{item.sub_label}</p>
              )}
            </div>
          )}

          {/* 金額 */}
          {item.price != null && (
            <p className="text-gray-700 text-base font-bold">¥{item.price.toLocaleString()}</p>
          )}

          {/* お渡しボタン / 確認ダイアログ */}
          {simpleConfirm ? (
            <div className="rounded-2xl border-2 border-indigo-400 bg-indigo-50 p-4 space-y-3">
              <p className="text-base font-black text-indigo-800 text-center">お渡しを確定しますか？</p>
              <button onClick={() => setPayAtDeliver(v => !v)}
                style={{ touchAction: 'manipulation' }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  payAtDeliver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  payAtDeliver ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                }`}>
                  {payAtDeliver && <CheckCheck size={10} className="text-white" />}
                </div>
                <p className={`font-bold text-sm ${payAtDeliver ? 'text-emerald-700' : 'text-gray-500'}`}>
                  代金を受け取った{item.price != null ? `（¥${item.price.toLocaleString()}）` : ''}
                </p>
              </button>
              <div className="flex gap-2">
                <button onClick={() => setSimpleConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-white border-2 border-gray-200 text-gray-600">
                  戻る
                </button>
                <button
                  onClick={async () => {
                    setLoading('deliver')
                    await onDeliver(item, payAtDeliver, '')
                    setLoading(null)
                    setSimpleConfirm(false)
                  }}
                  disabled={loading === 'deliver'}
                  className="flex-1 py-3 rounded-xl font-black text-sm bg-indigo-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading === 'deliver'
                    ? <Loader2 size={16} className="animate-spin" />
                    : <><Package size={16} />お渡し済みにする</>}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSimpleConfirm(true)}
              disabled={!!loading}
              className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-900/20 disabled:opacity-50">
              <Package size={20} />📦 お渡し済みにする
            </button>
          )}

          {/* 戻すボタン */}
          {confirmRevert ? (
            <div className="flex gap-2">
              <button onClick={() => setConfirmRevert(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-white border-2 border-gray-200 text-gray-600">
                キャンセル
              </button>
              <button
                onClick={async () => {
                  setLoading('revert')
                  await onRevertWaiting(item)
                  setLoading(null)
                  setConfirmRevert(false)
                }}
                disabled={loading === 'revert'}
                className="flex-1 py-2.5 rounded-xl font-black text-sm bg-amber-500 text-white disabled:opacity-50 flex items-center justify-center gap-1.5">
                {loading === 'revert' ? <Loader2 size={14} className="animate-spin" /> : <><RotateCcw size={14} />戻す</>}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRevert(true)}
              className="w-full py-3 rounded-xl font-bold text-sm border-2 border-amber-300 text-amber-700 bg-amber-50 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <RotateCcw size={14} />お直し中に戻す
            </button>
          )}

          {/* 電話リンク */}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`}
              className="flex items-center justify-center gap-1.5 text-indigo-500 text-sm font-bold py-1">
              <Phone size={14} />{item.customer.tel}
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-2xl shadow-sm overflow-hidden transition-all ${
      alertLevel >= 2 ? 'bg-red-50 border-red-300 border-2'
      : alertLevel === 1 ? 'bg-amber-50 border-amber-300'
      : 'bg-white border-gray-200'
    }`}>
      {alertLevel >= 2 && <div className="h-1 bg-red-500 w-full" />}
      {alertLevel === 1 && <div className="h-1 bg-amber-400 w-full" />}

      {/* ── Compact summary row (tap to expand) ── */}
      <button className="w-full text-left px-3 pt-2 pb-2 flex items-center gap-3" onClick={() => { setOpen(v => !v); setConfirmOpen(false) }}>
        {/* Request number */}
        <div className="shrink-0 text-center w-14">
          <p className="text-xl font-black text-indigo-700 leading-none tabular-nums font-mono">{reqNo}</p>
          <p className="text-[8px] text-gray-400 leading-none mt-0.5">依頼番号</p>
        </div>
        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            {item.child?.school_name && (
              <span className="text-[10px] font-black text-amber-600 truncate max-w-[8rem]">{item.child.school_name}</span>
            )}
            <span className={`text-[10px] font-bold px-1.5 py-0 rounded-full border leading-5 ${
              item.kind === 'repair'
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-teal-100 text-teal-700 border-teal-200'
            }`}>
              {item.kind === 'repair' ? '✂️ お直し' : '📦 注文品'}
            </span>
            {alertLevel >= 1 && (
              <span className={`text-[10px] font-bold px-1.5 py-0 rounded-full leading-5 ${
                alertLevel >= 3 ? 'bg-red-600 text-white animate-pulse'
                : alertLevel >= 2 ? 'bg-red-100 text-red-700 border border-red-200'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {alertLevel >= 3 ? '📢 要連絡' : `⚠️ ${waitDays}日`}
              </span>
            )}
          </div>
          <p className="text-base font-black text-gray-900 leading-tight truncate">{studentName}</p>
          <p className="text-xs text-gray-500 truncate leading-tight">
            {item.item_name}{item.sub_label ? ` — ${item.sub_label}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <PaymentBadge
              status={item.payment_status}
              loading={loading === 'payment'}
              onToggle={async () => {
                setLoading('payment')
                await onPaymentToggle(item)
                setLoading(null)
              }}
            />
            {item.desired_completion_date && (
              <span className="text-[10px] font-bold text-indigo-600">希望 {fmtDate(item.desired_completion_date)}</span>
            )}
          </div>
        </div>
        {/* Right: price + chevron */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {item.price != null && (
            <p className={`text-sm font-black ${item.payment_status === 'paid' ? 'text-gray-400' : 'text-red-600'}`}>
              ¥{item.price.toLocaleString()}
            </p>
          )}
          {open
            ? <ChevronUp size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* ── Expanded actions ── */}
      {open && (
        <div className="border-t border-gray-100">
          {/* Phone + notif info */}
          <div className="px-3 py-1.5 flex items-center gap-3 text-xs">
            {item.customer?.tel && (
              <a href={`tel:${item.customer.tel}`}
                className="flex items-center gap-1 text-indigo-600 font-bold">
                <Phone size={10} />{item.customer.tel}
              </a>
            )}
            {item.notified && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">通知済み</span>
            )}
            {item.slip_number && (
              <span className="text-[10px] font-mono text-gray-400">伝票#{item.slip_number}</span>
            )}
          </div>

          {confirmDelete ? (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-sm text-red-700 font-black text-center">本当に削除しますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                <button onClick={async () => {
                  setLoading('delete'); await onDelete(item); setLoading(null)
                }} disabled={!!loading}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black flex items-center justify-center gap-1 disabled:opacity-50">
                  {loading === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} />削除する</>}
                </button>
              </div>
            </div>
          ) : confirmRevert ? (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-xs text-amber-700 font-bold text-center">前の状態（作業中/発注中）に戻しますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRevert(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                <button onClick={async () => {
                  setLoading('revert'); await onRevertWaiting(item); setLoading(null); setConfirmRevert(false)
                }} disabled={!!loading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-black flex items-center justify-center gap-1 disabled:opacity-50">
                  {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />戻す</>}
                </button>
              </div>
            </div>
          ) : !confirmOpen ? (
            <div className="px-3 pb-3 space-y-1.5">
              <button onClick={() => setConfirmOpen(true)}
                className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-900/15">
                <Package size={14} />お渡し済みにする
              </button>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRevert(true)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center gap-1 hover:bg-amber-100 active:scale-95 transition-all">
                  <RotateCcw size={10} />前の状態に戻す
                </button>
                <button onClick={() => setConfirmDelete(true)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs border border-red-200 bg-red-50 text-red-500 flex items-center justify-center gap-1 hover:bg-red-100 active:scale-95 transition-all">
                  <Trash2 size={10} />キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 pb-3 space-y-2 pt-1">
              <p className="text-sm font-black text-gray-900 text-center">お渡し確認</p>
              <input
                type="text" value={staffName} onChange={e => setStaffName(e.target.value)}
                placeholder="担当スタッフ名（任意）"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-indigo-400"
              />
              <button onClick={() => setPayAtDeliver(v => !v)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all ${
                  payAtDeliver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                }`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  payAtDeliver ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                }`}>
                  {payAtDeliver && <CheckCheck size={10} className="text-white" />}
                </div>
                <div className="text-left flex-1">
                  <p className={`text-sm font-bold ${payAtDeliver ? 'text-emerald-700' : 'text-gray-500'}`}>代金を受け取った</p>
                  <p className="text-xs text-gray-400">{item.price != null ? `¥${item.price.toLocaleString()}` : '金額未設定'}</p>
                </div>
              </button>
              {unpaidConfirm && (
                <div className="rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-3 space-y-2">
                  <p className="text-sm font-black text-red-700 text-center flex items-center justify-center gap-1.5">
                    <AlertCircle size={14} />まだ未払いです！
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setUnpaidConfirm(false)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-white border border-gray-200 text-gray-700">戻る</button>
                    <button onClick={async () => {
                      setUnpaidConfirm(false); setLoading('deliver')
                      await onDeliver(item, false, staffName); setLoading(null); setConfirmOpen(false)
                    }} disabled={!!loading}
                      className="flex-1 py-2.5 rounded-xl font-black text-xs bg-red-600 text-white disabled:opacity-50 flex items-center justify-center gap-1">
                      {loading === 'deliver' ? <Loader2 size={11} className="animate-spin" /> : '未払いのままお渡し'}
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setConfirmOpen(false); setUnpaidConfirm(false) }}
                  className="py-2.5 rounded-xl font-bold text-sm bg-gray-100 border border-gray-200 text-gray-600">戻る</button>
                <button onClick={async () => {
                  if (!payAtDeliver && item.payment_status !== 'paid') { setUnpaidConfirm(true); return }
                  setLoading('deliver')
                  await onDeliver(item, payAtDeliver, staffName)
                  setLoading(null); setConfirmOpen(false)
                }} disabled={!!loading || unpaidConfirm}
                  className="py-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm">
                  {loading === 'deliver' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><Package size={13} />お渡しする</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Completed Card ────────────────────────────────────────────
export function CompletedCard({ item, onRevert, onPaymentToggle }: {
  item: DeliveryItem
  onRevert: (item: DeliveryItem) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
}) {
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [loading,       setLoading]       = useState<string | null>(null)
  const [custOpen,      setCustOpen]      = useState(false)
  const isUnpaidDelivered = item.payment_status !== 'paid'

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isUnpaidDelivered ? 'border-2 border-red-400 bg-red-50' : 'bg-gray-100 border-gray-200'
    }`}>
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center bg-gray-300/60">
            <Package size={14} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            {item.customer && (
              <button onClick={() => setCustOpen(v => !v)}
                className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1 w-full text-left">
                <User size={10} />
                {item.customer.name}
                {item.child && <span className="text-gray-400">（{item.child.name}）</span>}
                <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform text-gray-400 ${custOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-300/50 text-gray-500 border border-gray-300">お渡し済み</span>
              {isUnpaidDelivered && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1 animate-pulse">
                  <AlertCircle size={9} />代金未回収
                </span>
              )}
              <PaymentBadge status={item.payment_status} loading={loading === 'payment'}
                onToggle={async () => { setLoading('payment'); await onPaymentToggle(item); setLoading(null) }} />
            </div>
            <p className="font-bold text-gray-700 text-sm">{item.item_name}</p>
            {item.sub_label && <p className="text-gray-400 text-xs mt-0.5">{item.sub_label}</p>}
            {item.price != null && <p className="text-gray-400 text-xs mt-0.5">¥{item.price.toLocaleString()}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-[10px] flex-wrap">
              <span className="flex items-center gap-1"><CalendarDays size={9} />受付 {fmtDate(item.received_date)}</span>
              {item.delivered_date && (
                <span className="flex items-center gap-1 text-indigo-400"><Package size={9} />お渡し {fmtDate(item.delivered_date)}</span>
              )}
              {item.delivered_by && (
                <span className="flex items-center gap-1 text-indigo-400">👤 {item.delivered_by}</span>
              )}
            </div>
          </div>
        </div>
        {custOpen && item.customer?.tel && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-300/50">
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold">
              <Phone size={11} />{item.customer.tel}
            </a>
          </div>
        )}
      </div>
      {!confirmRevert ? (
        <div className="px-4 pb-3.5">
          <button onClick={() => setConfirmRevert(true)}
            className="w-full py-2.5 rounded-xl font-bold text-xs border border-gray-300 text-gray-500 hover:bg-white hover:border-gray-400 flex items-center justify-center gap-1.5 transition-all">
            <RotateCcw size={11} />お渡しを取り消す
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2.5">
          <p className="text-xs text-center text-amber-700 font-bold">前の状態に戻しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmRevert(false)}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-white border border-gray-200 text-gray-600">戻る</button>
            <button onClick={async () => {
              setLoading('revert'); await onRevert(item); setLoading(null); setConfirmRevert(false)
            }} disabled={!!loading}
              className="flex-1 py-3 rounded-xl font-black text-sm bg-amber-600 text-white disabled:opacity-50 flex items-center justify-center gap-1">
              {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />取り消す</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
