'use client'

import { useState, useEffect } from 'react'
import {
  BellRing, CheckCheck, UserX, Clock,
  Loader2, Phone, User, GraduationCap,
  MapPin, Bell, BellOff, Ruler, ClipboardList,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Queue, QueueStatus } from '@/types/database'
import {
  CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS,
  GENDER_LABELS, GENDER_STYLES,
} from '@/types/database'

// ============================================================
// 共通パーツ
// ============================================================
export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-500 shrink-0 w-10">{label}</span>
      <span className="text-gray-700 font-medium break-all">{value}</span>
    </div>
  )
}

// ============================================================
// 顧客情報インラインパネル
// ============================================================
type CustomerInfo = {
  id: string; name: string; kana: string | null; tel: string | null
  children: { id: string; name: string; school_name: string | null; grade: string | null }[]
}

export function CustomerInfoPanel({ customerId, storeId }: { customerId: string; storeId: string }) {
  const [data, setData]       = useState<CustomerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('customers').select('id, name, kana, tel, children(id, name, school_name, grade)')
      .eq('id', customerId).single()
      .then(({ data: d }) => { setData(d as CustomerInfo | null); setLoading(false) })
  }, [customerId])
  if (loading) return <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-gray-500" /></div>
  if (!data)   return <p className="text-gray-400 text-xs">顧客情報なし</p>
  return (
    <div className="space-y-1.5">
      {data.kana && <p className="text-gray-500 text-xs">{data.kana}</p>}
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
      <a href={`/${storeId}/admin/crm`}
        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-0.5">
        <User size={10} />顧客管理で編集
      </a>
    </div>
  )
}

// ============================================================
// 待ちカード
// ============================================================
export function WaitingCard({ ticket, storeId, onAction, onCheckIn, onStartFitting }: {
  ticket: Queue; storeId: string
  onAction: (id: string, s: QueueStatus) => Promise<void>
  onCheckIn: (id: string) => Promise<void>
  onStartFitting?: (ticket: Queue) => void
}) {
  const [loading, setLoading]   = useState<string | null>(null)
  const [custOpen, setCustOpen] = useState(false)
  const waitMin   = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000)
  const details   = (ticket.details ?? {}) as Record<string, string>
  const isRemoteUnchecked = ticket.is_remote && !ticket.checked_in

  const act = async (s: QueueStatus) => { setLoading(s); await onAction(ticket.id, s); setLoading(null) }

  return (
    <div className={`backdrop-blur-sm border rounded-2xl p-4 shadow-xl animate-fade-in ${
      isRemoteUnchecked
        ? 'bg-white border-gray-200'
        : 'bg-white border-blue-200 shadow-blue-100'
    }`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center w-14">
          <div className={`ticket-number text-3xl font-black leading-none tracking-tight ${isRemoteUnchecked ? 'text-gray-500' : 'text-blue-600'}`}>
            {String(ticket.ticket_number).padStart(3,'0')}
          </div>
          <div className={`text-xs mt-1 flex items-center justify-center gap-0.5 ${isRemoteUnchecked ? 'text-gray-400' : 'text-blue-600/50'}`}>
            <Clock size={9} />{waitMin}分
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {ticket.is_remote && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                ticket.checked_in
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-gray-100 text-gray-500 border-gray-300'
              }`}>
                {ticket.checked_in ? <><MapPin size={10} />到着済</> : <>🏠 遠隔待ち</>}
              </span>
            )}
            <span className={`text-sm px-2.5 py-1 rounded-full font-black ${
              isRemoteUnchecked ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700 border border-blue-300'
            }`}>
              {CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}
            </span>
            {ticket.gender !== 'other' && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GENDER_STYLES[ticket.gender]}`}>
                {GENDER_LABELS[ticket.gender]}
              </span>
            )}
            {ticket.line_user_id
              ? <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded-full">LINE✓</span>
              : <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">LINE×</span>}
            {details.source === 'crm_register' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300">📱 新規登録</span>
            )}
          </div>
          {ticket.school_name && (
            <p className={`text-sm font-black truncate leading-tight mt-1 ${isRemoteUnchecked ? 'text-gray-500' : 'text-amber-600'}`}>
              {ticket.school_name}
            </p>
          )}
          <button onClick={() => ticket.customer_id && setCustOpen(v => !v)}
            className={`font-black text-xl leading-tight truncate text-left w-full flex items-center gap-1 mt-0.5 ${isRemoteUnchecked ? 'text-gray-500' : 'text-gray-900'}`}>
            {ticket.child_name ?? ticket.customer_name} 様
            {ticket.customer_id && <User size={12} className={`shrink-0 ${custOpen ? 'text-indigo-600' : 'text-gray-400'}`} />}
          </button>
          {ticket.child_name && (
            <p className={`text-xs truncate ${isRemoteUnchecked ? 'text-gray-400' : 'text-gray-500'}`}>
              保護者: {ticket.customer_name}
            </p>
          )}
        </div>

      </div>

      {(details.height || details.weight || details.parentPhone || details.note) && (
        <div className="mt-2.5 space-y-1.5">
          {(details.height || details.weight || details.parentPhone) && (
            <div className="flex items-center gap-2 flex-wrap">
              {details.height && (
                <span className={`text-base font-black px-3 py-1 rounded-xl border ${isRemoteUnchecked ? 'bg-gray-100 border-gray-200 text-gray-500' : 'bg-indigo-100 border-indigo-200 text-indigo-700'}`}>
                  {details.height}cm
                </span>
              )}
              {details.weight && (
                <span className={`text-base font-black px-3 py-1 rounded-xl border ${isRemoteUnchecked ? 'bg-gray-100 border-gray-200 text-gray-500' : 'bg-violet-100 border-violet-200 text-violet-700'}`}>
                  {details.weight}kg
                </span>
              )}
              {details.parentPhone && (
                <a href={`tel:${details.parentPhone}`}
                  className="flex items-center gap-1.5 text-blue-600 text-sm font-bold">
                  <Phone size={12} />{details.parentPhone}
                </a>
              )}
            </div>
          )}
          {details.note && (
            <div className={`rounded-xl px-3 py-2 border ${isRemoteUnchecked ? 'bg-gray-100 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-sm font-bold leading-snug ${isRemoteUnchecked ? 'text-gray-500' : 'text-amber-700'}`}>💬 {details.note}</p>
            </div>
          )}
        </div>
      )}

      {custOpen && ticket.customer_id && (
        <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
          <CustomerInfoPanel customerId={ticket.customer_id} storeId={storeId} />
        </div>
      )}

      {isRemoteUnchecked ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 border border-gray-300">
            <span className="text-gray-500 text-xs">🏠 遠隔チェックイン待ち — 顧客が到着次第チェックインします</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onCheckIn(ticket.id)} disabled={!!loading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300 active:scale-95 disabled:opacity-50 transition-all">
              {loading === 'checkin' ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              代理チェックイン
            </button>
            <button onClick={() => act('cancelled')} disabled={!!loading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 disabled:opacity-50 transition-all">
              {loading === 'cancelled' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <button onClick={() => act('calling')} disabled={!!loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-900/40">
            {loading === 'calling' ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
            呼 出
          </button>
          {ticket.category === 'fitting' && onStartFitting && (
            <button
              onClick={async () => { await act('calling'); onStartFitting(ticket) }}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-teal-600 hover:bg-teal-500 text-white transition-all active:scale-95 disabled:opacity-50">
              {loading === 'calling' ? <Loader2 size={15} className="animate-spin" /> : <Ruler size={15} />}
              呼出 &amp; 採寸へ進む
            </button>
          )}
          {ticket.customer_id && ticket.category !== 'fitting' && (
            <a href={`/${storeId}/admin/crm?customer=${ticket.customer_id}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-95">
              <ClipboardList size={15} />受付入力へ進む
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 呼出中カード（常時アクションボタン表示）
// ============================================================
export function CallingCard({ ticket, storeId, onAction, onGoToFitting }: {
  ticket: Queue; storeId: string
  onAction: (id: string, s: QueueStatus) => Promise<void>
  onGoToFitting?: (ticket: Queue) => void
}) {
  const [loading, setLoading]   = useState<string | null>(null)
  const [custOpen, setCustOpen] = useState(false)
  const waitMin   = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000)
  const details   = (ticket.details ?? {}) as Record<string, string>

  const act = async (s: QueueStatus) => { setLoading(s); await onAction(ticket.id, s); setLoading(null) }
  const recall = async () => {
    setLoading('recalling')
    await onAction(ticket.id, 'calling')
    setLoading(null)
  }

  return (
    <div className="bg-amber-50 backdrop-blur-sm border border-amber-300 rounded-2xl p-4 shadow-xl shadow-amber-100 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center w-14">
          <div className="ticket-number text-3xl font-black text-amber-600 leading-none tracking-tight animate-pulse">
            {String(ticket.ticket_number).padStart(3,'0')}
          </div>
          <div className="text-xs text-amber-600/50 mt-1 flex items-center justify-center gap-0.5">
            <Clock size={9} />{waitMin}分
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-sm bg-amber-100 text-amber-700 border border-amber-300 px-2.5 py-1 rounded-full font-black animate-pulse">🔔 呼出中</span>
            <span className="text-sm font-black text-gray-700">{CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}</span>
            {ticket.gender !== 'other' && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GENDER_STYLES[ticket.gender]}`}>{GENDER_LABELS[ticket.gender]}</span>
            )}
            {details.source === 'crm_register' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300">📱 新規登録</span>
            )}
          </div>
          {ticket.school_name && (
            <p className="text-sm font-black text-amber-600 truncate leading-tight">
              {ticket.school_name}
            </p>
          )}
          <button onClick={() => ticket.customer_id && setCustOpen(v => !v)}
            className="font-black text-gray-900 text-xl leading-tight truncate text-left w-full flex items-center gap-1 mt-0.5">
            {ticket.child_name ?? ticket.customer_name} 様
            {ticket.customer_id && <User size={12} className={`shrink-0 ${custOpen ? 'text-indigo-600' : 'text-gray-400'}`} />}
          </button>
          {ticket.child_name && (
            <p className="text-gray-500 text-xs truncate">保護者: {ticket.customer_name}</p>
          )}
        </div>
      </div>

      {custOpen && ticket.customer_id && (
        <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
          <CustomerInfoPanel customerId={ticket.customer_id} storeId={storeId} />
        </div>
      )}

      {(details.height || details.weight || details.parentPhone || details.note) && (
        <div className="mt-2.5 space-y-1.5">
          {(details.height || details.weight || details.parentPhone) && (
            <div className="flex items-center gap-2 flex-wrap">
              {details.height && (
                <span className="bg-indigo-100 border border-indigo-200 text-indigo-700 text-base font-black px-3 py-1 rounded-xl">
                  {details.height}cm
                </span>
              )}
              {details.weight && (
                <span className="bg-violet-100 border border-violet-200 text-violet-700 text-base font-black px-3 py-1 rounded-xl">
                  {details.weight}kg
                </span>
              )}
              {details.parentPhone && (
                <a href={`tel:${details.parentPhone}`}
                  className="flex items-center gap-1.5 text-blue-600 text-sm font-bold">
                  <Phone size={12} />{details.parentPhone}
                </a>
              )}
            </div>
          )}
          {details.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <p className="text-amber-700 text-sm font-bold leading-snug">💬 {details.note}</p>
            </div>
          )}
        </div>
      )}

      {ticket.category === 'fitting' && onGoToFitting && (
        <button
          onClick={() => onGoToFitting(ticket)}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-teal-600 hover:bg-teal-500 text-white active:scale-95 transition-all">
          <Ruler size={15} />採寸へ進む
        </button>
      )}
      {ticket.customer_id && ticket.category !== 'fitting' && (
        <a href={`/${storeId}/admin/crm?customer=${ticket.customer_id}`}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 transition-all">
          <ClipboardList size={15} />受付入力へ進む
        </a>
      )}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <button onClick={() => act('completed')} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-black text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-900/40 transition-all">
          {loading === 'completed' ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}完了
        </button>
        <button onClick={recall} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-black text-sm bg-orange-500/30 hover:bg-orange-500/50 text-orange-300 border border-orange-500/30 active:scale-95 disabled:opacity-50 transition-all">
          {loading === 'recalling' ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}再呼出
        </button>
        <button onClick={() => act('cancelled')} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-black text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 disabled:opacity-50 transition-all">
          {loading === 'cancelled' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}不在
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 履歴カード
// ============================================================
export function HistoryCard({ ticket, storeId, onAction }: {
  ticket: Queue; storeId: string; onAction: (id: string, s: QueueStatus) => Promise<void>
}) {
  const [loading,  setLoading]  = useState<string | null>(null)
  const [open,     setOpen]     = useState(false)
  const [custOpen, setCustOpen] = useState(false)
  const details   = (ticket.details ?? {}) as Record<string, string>
  const hasDetail = !!(details.height || details.weight || details.parentPhone || details.note)
  const isDone    = ticket.status === 'completed'
  const act = async (s: QueueStatus) => { setLoading(s); await onAction(ticket.id, s); setLoading(null) }

  const waitMin = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000)
  const recvTime = new Date(ticket.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`backdrop-blur-sm border rounded-xl p-3 transition-all opacity-75 hover:opacity-100 ${
      isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-300'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`ticket-number text-2xl font-black tabular-nums leading-none shrink-0 ${isDone ? 'text-emerald-600/70' : 'text-gray-500'}`}>
          {String(ticket.ticket_number).padStart(3,'0')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isDone ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-gray-100 text-gray-500 border border-gray-300'
            }`}>{STATUS_LABELS[ticket.status]}</span>
            {ticket.is_remote && <span className="text-xs text-gray-500">🏠</span>}
            <span className="text-xs text-gray-500">{CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}</span>
            <span className="text-xs text-gray-400">{recvTime}受付 · {waitMin}分</span>
          </div>
          {ticket.school_name && (
            <p className={`text-xs font-black truncate mt-0.5 ${isDone ? 'text-amber-600/60' : 'text-amber-600/80'}`}>
              {ticket.school_name}
            </p>
          )}
          <button onClick={() => (ticket as any).customer_id && setCustOpen(v => !v)}
            className="font-black text-gray-900 text-base truncate mt-0.5 text-left w-full flex items-center gap-1">
            {ticket.child_name ?? ticket.customer_name} 様
            {(ticket as any).customer_id && <User size={10} className={`shrink-0 ${custOpen ? 'text-indigo-600' : 'text-gray-400'}`} />}
          </button>
          {ticket.child_name && <p className="text-gray-400 text-xs truncate">保護者: {ticket.customer_name}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ticket.status === 'cancelled' && (
            <button onClick={() => act('waiting')} disabled={loading === 'waiting'}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 active:scale-95 transition-all disabled:opacity-50">
              {loading === 'waiting' ? <Loader2 size={12} className="animate-spin inline" /> : '待機に戻す'}
            </button>
          )}
          {hasDetail && (
            <button onClick={() => setOpen(v => !v)} className="text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
              {open ? '閉' : '詳'}
            </button>
          )}
        </div>
      </div>

      {custOpen && (ticket as any).customer_id && (
        <div className="mt-2 pt-2 border-t border-gray-200 animate-fade-in">
          <CustomerInfoPanel customerId={(ticket as any).customer_id} storeId={storeId} />
        </div>
      )}

      {open && hasDetail && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          {details.height      && <DetailRow label="身長" value={`${details.height}cm`} />}
          {details.weight      && <DetailRow label="体重" value={`${details.weight}kg`} />}
          {details.parentPhone && <DetailRow label="保護者TEL" value={details.parentPhone} />}
          {details.note        && <DetailRow label="相談事項" value={details.note} />}
        </div>
      )}
    </div>
  )
}
