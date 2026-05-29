'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  BellRing, CheckCheck, UserX, RefreshCw, Clock, Users,
  Loader2, Store, Phone, User, GraduationCap,
  ChevronRight, LayoutDashboard, X, MapPin, BellOff, Bell,
  CalendarDays, QrCode,
} from 'lucide-react'
import { BottomNav } from './_components/BottomNav'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueStatus } from '@/types/database'
import {
  CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS,
  GENDER_LABELS, GENDER_STYLES,
} from '@/types/database'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BAmZx5b8ScrgrqWa822FdQhtfHV2CSyqvxNeQX-Ds1KsqztPPRtZRyBP_LaQZmCLejg8Ivd7Gu4cBxKtNwodb3o'

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type AdminView  = 'loading' | 'select_store' | 'pin' | 'dashboard'
type HistoryTab = 'completed' | 'cancelled'

interface StoreInfo { id: string; name: string; pin: string; group_id?: string | null }

// ============================================================
// 店舗選択画面
// ============================================================
function StoreSelectScreen({ stores, groupCode, onSelect }: { stores: StoreInfo[]; groupCode: string | null; onSelect: (s: StoreInfo) => void }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.25),transparent)] pointer-events-none" />
      <div className="relative text-center mb-10 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
          <span className="text-4xl">🏪</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">管理画面</h1>
        <p className="text-zinc-400 mt-2 text-sm">店舗を選択してください</p>
      </div>
      <div className="relative w-full max-w-sm space-y-3 animate-fade-in">
        {stores.map(store => (
          <button key={store.id} onClick={() => onSelect(store)}
            className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-indigo-500/40 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left group shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Store size={18} className="text-indigo-400" />
            </div>
            <span className="text-white text-lg font-bold flex-1">{store.name}</span>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-300 transition-colors" />
          </button>
        ))}
        <div className="pt-4 border-t border-white/5">
          <a href={groupCode ? `/company/${groupCode}` : '/super-admin'} className="flex items-center gap-3 text-zinc-500 hover:text-zinc-300 transition-colors py-2 px-1 text-sm">
            <LayoutDashboard size={15} /><span>{groupCode ? '会社管理ダッシュボード' : '総管理ダッシュボード'}</span>
            <ChevronRight size={13} className="ml-auto" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PIN認証画面
// ============================================================
function PinScreen({ storeName, storePin, onAuth, onBack }: {
  storeName: string; storePin: string; onAuth: () => void; onBack: () => void
}) {
  const [pin, setPin]     = useState('')
  const [error, setError] = useState(false)

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d; setPin(next); setError(false)
    if (next.length === 4) {
      if (next === storePin) { sessionStorage.setItem('admin_auth', '1'); onAuth() }
      else setTimeout(() => { setPin(''); setError(true) }, 400)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
      <div className="relative text-center mb-8 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
          <span className="text-4xl">🔒</span>
        </div>
        <h1 className="text-2xl font-black text-white">スタッフ専用</h1>
        <p className="text-indigo-400 font-bold mt-1 text-lg">{storeName}</p>
        <p className="text-zinc-500 text-sm mt-1">PINを入力してください</p>
      </div>
      <div className="relative flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
            pin.length > i ? error ? 'bg-red-400 scale-110' : 'bg-indigo-400 scale-110 shadow-lg shadow-indigo-500/50' : 'bg-zinc-700'
          }`} />
        ))}
      </div>
      {error && <p className="relative text-red-400 text-sm mb-4 font-medium animate-pulse">PINが違います</p>}
      <div className="relative grid grid-cols-3 gap-3 w-60">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
            className={`h-15 py-4 rounded-2xl text-xl font-bold transition-all active:scale-90 ${
              d === '' ? 'invisible' : d === '⌫' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' :
              'bg-white/5 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 hover:border-indigo-500/30'
            }`}>{d}</button>
        ))}
      </div>
      <button onClick={onBack} className="relative mt-8 text-zinc-500 text-sm hover:text-zinc-300 transition-colors">
        ← 店舗を選び直す
      </button>
    </div>
  )
}

// ============================================================
// 共通パーツ
// ============================================================
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-zinc-500 shrink-0 w-10">{label}</span>
      <span className="text-zinc-300 font-medium break-all">{value}</span>
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

function CustomerInfoPanel({ customerId, storeId }: { customerId: string; storeId: string }) {
  const [data, setData]       = useState<CustomerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('customers').select('id, name, kana, tel, children(id, name, school_name, grade)')
      .eq('id', customerId).single()
      .then(({ data: d }) => { setData(d as CustomerInfo | null); setLoading(false) })
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
      <a href={`/${storeId}/admin/crm`}
        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-0.5">
        <User size={10} />顧客管理で編集
      </a>
    </div>
  )
}

// ============================================================
// 待ちカード
// ============================================================
function WaitingCard({ ticket, storeId, onAction, onCheckIn }: {
  ticket: Queue; storeId: string
  onAction: (id: string, s: QueueStatus) => Promise<void>
  onCheckIn: (id: string) => Promise<void>
}) {
  const [loading, setLoading]   = useState<string | null>(null)
  const [open, setOpen]         = useState(false)
  const [custOpen, setCustOpen] = useState(false)
  const waitMin   = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000)
  const details   = (ticket.details ?? {}) as Record<string, string>
  const hasDetail = !!(details.height || details.weight || details.parentPhone || details.note)
  const isRemoteUnchecked = ticket.is_remote && !ticket.checked_in

  const act = async (s: QueueStatus) => { setLoading(s); await onAction(ticket.id, s); setLoading(null) }

  return (
    <div className={`backdrop-blur-sm border rounded-2xl p-4 shadow-xl animate-fade-in ${
      isRemoteUnchecked
        ? 'bg-zinc-900/60 border-zinc-600/40'
        : 'bg-gradient-to-br from-blue-950/60 to-indigo-950/40 border-blue-500/20 shadow-blue-950/30'
    }`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center w-14">
          <div className={`ticket-number text-3xl font-black leading-none tracking-tight ${isRemoteUnchecked ? 'text-zinc-400' : 'text-blue-300'}`}>
            {String(ticket.ticket_number).padStart(3,'0')}
          </div>
          <div className={`text-xs mt-1 flex items-center justify-center gap-0.5 ${isRemoteUnchecked ? 'text-zinc-600' : 'text-blue-400/50'}`}>
            <Clock size={9} />{waitMin}分
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {ticket.is_remote && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                ticket.checked_in
                  ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-600/50'
              }`}>
                {ticket.checked_in ? <><MapPin size={10} />到着済</> : <>🏠 遠隔待ち</>}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isRemoteUnchecked ? 'bg-zinc-800 text-zinc-500' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}
            </span>
            {ticket.gender !== 'other' && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GENDER_STYLES[ticket.gender]}`}>
                {GENDER_LABELS[ticket.gender]}
              </span>
            )}
            {ticket.line_user_id
              ? <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">LINE✓</span>
              : <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full">LINE×</span>}
          </div>
          <button onClick={() => ticket.customer_id && setCustOpen(v => !v)}
            className={`font-bold text-base leading-tight truncate text-left w-full flex items-center gap-1 ${isRemoteUnchecked ? 'text-zinc-400' : 'text-white'}`}>
            {ticket.customer_name} 様
            {ticket.customer_id && <User size={11} className={`shrink-0 ${custOpen ? 'text-indigo-400' : 'text-zinc-600'}`} />}
          </button>
          {ticket.child_name && <p className="text-zinc-400 text-xs truncate">お子様: {ticket.child_name}</p>}
          <p className="text-zinc-500 text-xs truncate mt-0.5">{ticket.school_name}</p>
        </div>

        <button onClick={() => setOpen(v => !v)}
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
            hasDetail ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800/80 text-zinc-600'
          }`}>{open ? '閉' : '詳'}</button>
      </div>

      {open && hasDetail && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
          {details.height      && <DetailRow label="身長" value={`${details.height}cm`} />}
          {details.weight      && <DetailRow label="体重" value={`${details.weight}kg`} />}
          {details.parentPhone && <DetailRow label="保護者TEL" value={details.parentPhone} />}
          {details.note        && <DetailRow label="相談事項" value={details.note} />}
        </div>
      )}

      {custOpen && ticket.customer_id && (
        <div className="mt-3 pt-3 border-t border-white/5 animate-fade-in">
          <CustomerInfoPanel customerId={ticket.customer_id} storeId={storeId} />
        </div>
      )}

      {isRemoteUnchecked ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
            <span className="text-zinc-500 text-xs">🏠 遠隔チェックイン待ち — 顧客が到着次第チェックインします</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onCheckIn(ticket.id)} disabled={!!loading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 active:scale-95 disabled:opacity-50 transition-all">
              {loading === 'checkin' ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              代理チェックイン
            </button>
            <button onClick={() => act('cancelled')} disabled={!!loading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 active:scale-95 disabled:opacity-50 transition-all">
              {loading === 'cancelled' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => act('calling')} disabled={!!loading}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-900/40">
          {loading === 'calling' ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
          呼 出
        </button>
      )}
    </div>
  )
}

// ============================================================
// 呼出中カード（常時アクションボタン表示）
// ============================================================
function CallingCard({ ticket, storeId, onAction }: { ticket: Queue; storeId: string; onAction: (id: string, s: QueueStatus) => Promise<void> }) {
  const [loading, setLoading]   = useState<string | null>(null)
  const [open, setOpen]         = useState(false)
  const [custOpen, setCustOpen] = useState(false)
  const waitMin   = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000)
  const details   = (ticket.details ?? {}) as Record<string, string>
  const hasDetail = !!(details.height || details.weight || details.parentPhone || details.note)

  const act = async (s: QueueStatus) => { setLoading(s); await onAction(ticket.id, s); setLoading(null) }
  const recall = async () => {
    setLoading('recalling')
    await onAction(ticket.id, 'calling')
    setLoading(null)
  }

  return (
    <div className="bg-gradient-to-br from-amber-950/60 to-orange-950/40 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-4 shadow-xl shadow-amber-950/40 ring-1 ring-amber-500/10 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center w-14">
          <div className="ticket-number text-3xl font-black text-amber-300 leading-none tracking-tight animate-pulse">
            {String(ticket.ticket_number).padStart(3,'0')}
          </div>
          <div className="text-xs text-amber-400/50 mt-1 flex items-center justify-center gap-0.5">
            <Clock size={9} />{waitMin}分
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">🔔 呼出中</span>
            <span className="text-xs text-zinc-400">{CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}</span>
            {ticket.gender !== 'other' && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GENDER_STYLES[ticket.gender]}`}>{GENDER_LABELS[ticket.gender]}</span>
            )}
          </div>
          <button onClick={() => ticket.customer_id && setCustOpen(v => !v)}
            className="font-bold text-white text-base leading-tight truncate text-left w-full flex items-center gap-1">
            {ticket.customer_name} 様
            {ticket.customer_id && <User size={11} className={`shrink-0 ${custOpen ? 'text-indigo-400' : 'text-zinc-600'}`} />}
          </button>
          {ticket.child_name && <p className="text-zinc-400 text-xs truncate">お子様: {ticket.child_name}</p>}
          <p className="text-zinc-500 text-xs truncate mt-0.5">{ticket.school_name}</p>
        </div>
        <button onClick={() => setOpen(v => !v)}
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
            hasDetail ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800/80 text-zinc-600'
          }`}>{open ? '閉' : '詳'}</button>
      </div>

      {custOpen && ticket.customer_id && (
        <div className="mt-3 pt-3 border-t border-white/5 animate-fade-in">
          <CustomerInfoPanel customerId={ticket.customer_id} storeId={storeId} />
        </div>
      )}

      {open && hasDetail && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
          {details.height      && <DetailRow label="身長" value={`${details.height}cm`} />}
          {details.weight      && <DetailRow label="体重" value={`${details.weight}kg`} />}
          {details.parentPhone && <DetailRow label="保護者TEL" value={details.parentPhone} />}
          {details.note        && <DetailRow label="相談事項" value={details.note} />}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-3">
        <button onClick={() => act('completed')} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-black text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-900/40 transition-all">
          {loading === 'completed' ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}完了
        </button>
        <button onClick={recall} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-black text-sm bg-orange-500/30 hover:bg-orange-500/50 text-orange-300 border border-orange-500/30 active:scale-95 disabled:opacity-50 transition-all">
          {loading === 'recalling' ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}再呼出
        </button>
        <button onClick={() => act('cancelled')} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-black text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 active:scale-95 disabled:opacity-50 transition-all">
          {loading === 'cancelled' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}不在
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 履歴カード
// ============================================================
function HistoryCard({ ticket, storeId, onAction }: {
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
      isDone ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-zinc-900/60 border-zinc-700/50'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`ticket-number text-2xl font-black tabular-nums leading-none shrink-0 ${isDone ? 'text-emerald-400/70' : 'text-zinc-500'}`}>
          {String(ticket.ticket_number).padStart(3,'0')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}>{STATUS_LABELS[ticket.status]}</span>
            {ticket.is_remote && <span className="text-xs text-zinc-500">🏠</span>}
            <span className="text-xs text-zinc-500">{CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}</span>
            <span className="text-xs text-zinc-600">{recvTime}受付 · {waitMin}分</span>
          </div>
          <button onClick={() => (ticket as any).customer_id && setCustOpen(v => !v)}
            className="font-bold text-zinc-300 text-sm truncate mt-0.5 text-left w-full flex items-center gap-1">
            {ticket.customer_name} 様
            {(ticket as any).customer_id && <User size={10} className={`shrink-0 ${custOpen ? 'text-indigo-400' : 'text-zinc-600'}`} />}
          </button>
          {ticket.child_name && <p className="text-zinc-500 text-xs truncate">お子様: {ticket.child_name}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ticket.status === 'cancelled' && (
            <button onClick={() => act('waiting')} disabled={loading === 'waiting'}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 active:scale-95 transition-all disabled:opacity-50">
              {loading === 'waiting' ? <Loader2 size={12} className="animate-spin inline" /> : '待機に戻す'}
            </button>
          )}
          {hasDetail && (
            <button onClick={() => setOpen(v => !v)} className="text-xs font-bold px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
              {open ? '閉' : '詳'}
            </button>
          )}
        </div>
      </div>

      {custOpen && (ticket as any).customer_id && (
        <div className="mt-2 pt-2 border-t border-white/5 animate-fade-in">
          <CustomerInfoPanel customerId={(ticket as any).customer_id} storeId={storeId} />
        </div>
      )}

      {open && hasDetail && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
          {details.height      && <DetailRow label="身長" value={`${details.height}cm`} />}
          {details.weight      && <DetailRow label="体重" value={`${details.weight}kg`} />}
          {details.parentPhone && <DetailRow label="保護者TEL" value={details.parentPhone} />}
          {details.note        && <DetailRow label="相談事項" value={details.note} />}
        </div>
      )}
    </div>
  )
}

// ============================================================
// ダッシュボード
// ============================================================
function AdminDashboard({ store, groupCode, onLogout }: { store: StoreInfo; groupCode: string | null; onLogout: () => void }) {
  const [queues,         setQueues]         = useState<Queue[]>([])
  const [refreshing,     setRefreshing]     = useState(false)
  const [historyTab,     setHistoryTab]     = useState<HistoryTab>('completed')
  const [historyVisible, setHistoryVisible] = useState(false)
  const [toast,          setToast]          = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [isOpen,         setIsOpen]         = useState<boolean | null>(null)
  const [notificationPlan, setNotificationPlan] = useState<'calling_only' | 'full'>('calling_only')
  const [isTestMode,     setIsTestMode]     = useState(false)
  const [activeFittings, setActiveFittings] = useState(1)
  const [showQrModal,    setShowQrModal]    = useState(false)
  const [pushStatus,     setPushStatus]     = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setupPush = useCallback(async (storeId: string) => {
    if (typeof window === 'undefined'
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
      || !('Notification' in window)) {
      setPushStatus('unsupported'); return
    }
    try {
      const reg  = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const perm = await (window as any).Notification.requestPermission()
      if (perm !== 'granted') { setPushStatus('denied'); return }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
      await fetch('/api/push-subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, subscription: sub.toJSON() }),
      })
      setPushStatus('granted')
    } catch (e) {
      console.error('[push setup]', e)
      setPushStatus('denied')
    }
  }, [])

  const showToast = useCallback((type: 'ok' | 'err', msg: string, duration = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ type, msg })
    toastTimerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const fetchStoreStatus = useCallback(async () => {
    const { data, error } = await supabase.from('stores')
      .select('is_open, notification_plan, is_test_mode, active_fittings')
      .eq('id', store.id).single()
    if (error || !data) {
      setIsOpen(false)
      return
    }
    setIsOpen(data.is_open ?? false)
    if ((data as any).notification_plan) setNotificationPlan((data as any).notification_plan)
    if ((data as any).is_test_mode != null) setIsTestMode((data as any).is_test_mode)
    if ((data as any).active_fittings != null) setActiveFittings((data as any).active_fittings)
  }, [store.id])

  const fetchQueues = useCallback(async () => {
    setRefreshing(true)
    const { data } = await supabase.from('queues').select('*')
      .eq('store_id', store.id).gte('created_at', getTodayStart())
      .order('ticket_number', { ascending: true })
    if (data) setQueues(data)
    setRefreshing(false)
  }, [store.id])

  useEffect(() => {
    fetchStoreStatus(); fetchQueues()
    if (typeof window !== 'undefined' && 'Notification' in window && (window as any).Notification.permission === 'granted') {
      setupPush(store.id)
    }
    const channel = supabase.channel(`admin-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `store_id=eq.${store.id}` },
        () => fetchQueues())
      .subscribe()
    const pollId = setInterval(() => { fetchQueues() }, 10000)
    return () => { supabase.removeChannel(channel); clearInterval(pollId) }
  }, [store.id, fetchQueues, fetchStoreStatus])

  const handleToggleOpen = async () => {
    if (isOpen === null) return
    const next = !isOpen
    setIsOpen(next)
    const { error } = await supabase.from('stores').update({ is_open: next }).eq('id', store.id)
    if (error) {
      setIsOpen(!next)
      showToast('err', '受付切替失敗: ' + error.message)
    }
  }

  const handleAction = async (id: string, status: QueueStatus) => {
    const { error } = await supabase.from('queues').update({ status }).eq('id', id)
    if (error) { showToast('err', '更新失敗: ' + error.message); return }
    setQueues(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    const labels: Record<QueueStatus, string> = { calling:'呼出', completed:'完了', cancelled:'不在', waiting:'待機に戻しました' }
    showToast('ok', labels[status])
    if (status === 'calling') {
      const { data: freshTicket } = await supabase.from('queues')
        .select('line_user_id, ticket_number, customer_name').eq('id', id).single()
      if (freshTicket?.line_user_id) {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId: freshTicket.line_user_id, ticketNumber: freshTicket.ticket_number, customerName: freshTicket.customer_name, storeName: store.name, storeId: store.id, type: 'calling' }),
        }).then(async r => {
          const j = await r.json()
          if (j.ok && !j.skipped) showToast('ok', '📱 LINE通知を送信しました')
          else if (!j.ok) showToast('err', `LINE通知失敗: ${j.error ?? '不明'}`)
        }).catch(e => showToast('err', `LINE通知エラー: ${e}`))
      } else {
        showToast('err', '📵 LINE未連携のため通知できません')
      }
    }
    if (status === 'completed' || status === 'cancelled') {
      await new Promise(res => setTimeout(res, 800))
      if (notificationPlan !== 'full') return
      try {
        const r = await fetch('/api/notify-threshold', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: store.id, excludeId: id }),
        })
        const j = await r.json()
        if (j.ok && j.notified) {
          showToast('ok', `📲 LINE通知送信: No.${String(j.notified).padStart(3,'0')}`, 5000)
        } else if (j.skipped) {
          showToast('ok', `通知スキップ (${j.reason})`, 4000)
        } else if (!j.ok) {
          showToast('err', `通知APIエラー: ${j.error ?? '不明'}`, 5000)
        }
      } catch (e) {
        showToast('err', `通知API失敗: ${String(e)}`, 5000)
      }
    }
  }

  const handleCheckIn = async (id: string) => {
    const { error } = await supabase.from('queues').update({ checked_in: true }).eq('id', id)
    if (error) { showToast('err', 'チェックイン失敗: ' + error.message); return }
    setQueues(prev => prev.map(q => q.id === id ? { ...q, checked_in: true } : q))
    showToast('ok', '代理チェックイン済みにしました')
  }

  const handleFittingsChange = async (n: number) => {
    setActiveFittings(n)
    await (supabase.from('stores') as any).update({ active_fittings: n }).eq('id', store.id)
  }

  const waitingTickets = queues.filter(q => q.status === 'waiting')
  const callingTickets = queues.filter(q => q.status === 'calling')
  const historyTickets = queues.filter(q => q.status === historyTab)
  const remoteCount    = waitingTickets.filter(q => q.is_remote && !q.checked_in).length
  const completed      = queues.filter(q => q.status === 'completed').length
  const cancelledCount = queues.filter(q => q.status === 'cancelled').length

  const toggleHistory = (tab: HistoryTab) => {
    if (historyVisible && historyTab === tab) {
      setHistoryVisible(false)
    } else {
      setHistoryTab(tab)
      setHistoryVisible(true)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-950 border-b border-white/5 px-4 pt-safe-top pt-4 pb-3">

        {/* 行1: 店舗名 / ボタン群 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-base font-black tracking-tight text-white leading-tight">{store.name}</h1>
            <p className="text-zinc-600 text-[11px]">
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={fetchQueues} disabled={refreshing}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:opacity-60 transition-all disabled:opacity-50">
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-400' : 'text-zinc-400'} />
            </button>
            <button onClick={() => pushStatus !== 'granted' && setupPush(store.id)}
              title={pushStatus === 'granted' ? 'ブラウザ通知: ON' : pushStatus === 'denied' ? '通知がブロック' : pushStatus === 'unsupported' ? '非対応' : '通知を許可'}
              className={`p-2 rounded-xl border active:opacity-60 transition-all ${
                pushStatus === 'granted'     ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                pushStatus === 'denied'      ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                pushStatus === 'unsupported' ? 'bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed' :
                'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
              }`}>
              {pushStatus === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
            </button>
            <button onClick={() => setShowQrModal(true)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:opacity-60 transition-all text-zinc-400">
              <QrCode size={16} />
            </button>
            <a href={groupCode ? `/company/${groupCode}` : '/super-admin'}
              title={groupCode ? '会社管理ダッシュボード' : '総管理ダッシュボード'}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:opacity-60 transition-all text-zinc-400">
              <LayoutDashboard size={16} />
            </a>
          </div>
        </div>

        {/* 行2: 受付切替ボタン（大きく・太字・わかりやすいラベル） */}
        <button onClick={handleToggleOpen} disabled={isOpen === null}
          className={`w-full py-4 rounded-2xl font-black text-lg mb-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 ${
            isOpen === null  ? 'bg-zinc-700 text-zinc-400' :
            isOpen           ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-900/40 text-white'
                             : 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-900/40 text-white'
          }`}>
          {isOpen === null ? '⏳ 読み込み中...' : isOpen ? '✅ 受付中 — タップして停止' : '🚫 受付停止中 — タップして開始'}
        </button>

        {/* テストモードバナー */}
        {isTestMode && (
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300 text-xs font-bold mb-2">
            <span>⚠️</span>
            <span className="flex-1">テストモード中 — LINE・ブラウザ通知は送信されません</span>
          </div>
        )}

        {/* 行3: 状態バッジ 4つ（常時表示）— 完了・不在はタップで履歴展開 */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="flex flex-col items-center gap-0.5 bg-blue-500/15 border border-blue-500/25 rounded-xl px-1 py-2.5">
            <span className="text-blue-300 text-2xl font-black tabular-nums leading-none">{waitingTickets.length}</span>
            <span className="text-blue-500 text-[10px] font-bold mt-0.5">待機</span>
          </div>
          <div className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 ${
            callingTickets.length > 0 ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/4 border border-white/8'
          }`}>
            <span className={`text-2xl font-black tabular-nums leading-none ${callingTickets.length > 0 ? 'text-amber-300 animate-pulse' : 'text-zinc-600'}`}>
              {callingTickets.length}
            </span>
            <span className={`text-[10px] font-bold mt-0.5 ${callingTickets.length > 0 ? 'text-amber-500' : 'text-zinc-600'}`}>呼出中</span>
          </div>
          <button onClick={() => toggleHistory('completed')} style={{ touchAction: 'manipulation' }}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 active:scale-95 transition-all ${
              historyVisible && historyTab === 'completed'
                ? 'bg-emerald-500/20 border border-emerald-500/30'
                : 'bg-white/4 border border-white/8'
            }`}>
            <span className="text-emerald-400 text-2xl font-black tabular-nums leading-none">{completed}</span>
            <span className="text-zinc-600 text-[10px] font-bold mt-0.5">完了 ▾</span>
          </button>
          <button onClick={() => toggleHistory('cancelled')} style={{ touchAction: 'manipulation' }}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 active:scale-95 transition-all ${
              historyVisible && historyTab === 'cancelled'
                ? 'bg-zinc-600/30 border border-zinc-500/30'
                : 'bg-white/4 border border-white/8'
            }`}>
            <span className="text-zinc-400 text-2xl font-black tabular-nums leading-none">{cancelledCount}</span>
            <span className="text-zinc-600 text-[10px] font-bold mt-0.5">不在 ▾</span>
          </button>
        </div>

        {/* 遠隔待ちバッジ（遠隔がいる時のみ） */}
        {remoteCount > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-1.5">
            <MapPin size={12} className="text-zinc-400 shrink-0" />
            <span className="text-zinc-300 text-xs font-black">{remoteCount}</span>
            <span className="text-zinc-500 text-xs">組が遠隔待ち（到着前）</span>
          </div>
        )}

        {/* フィッティング台数（常時表示） */}
        <div className="flex items-center gap-3 mt-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
          <span className="text-zinc-400 text-xs font-bold flex-1">フィッティング稼働台数</span>
          <button
            onClick={() => activeFittings > 1 && handleFittingsChange(activeFittings - 1)}
            disabled={activeFittings <= 1}
            style={{ touchAction: 'manipulation' }}
            className="w-9 h-9 rounded-xl bg-zinc-700 text-white font-black text-xl flex items-center justify-center hover:bg-zinc-600 active:scale-90 disabled:opacity-30 transition-all">
            −
          </button>
          <span className="text-white font-black text-2xl tabular-nums w-10 text-center">{activeFittings}</span>
          <button
            onClick={() => activeFittings < 30 && handleFittingsChange(activeFittings + 1)}
            disabled={activeFittings >= 30}
            style={{ touchAction: 'manipulation' }}
            className="w-9 h-9 rounded-xl bg-zinc-700 text-white font-black text-xl flex items-center justify-center hover:bg-zinc-600 active:scale-90 disabled:opacity-30 transition-all">
            ＋
          </button>
        </div>

      </div>

      {/* トースト */}
      {toast && (
        <div className={`px-4 py-3 flex items-center justify-between text-sm font-bold animate-fade-in ${
          toast.type === 'ok' ? 'bg-emerald-900/80 text-emerald-300 border-b border-emerald-500/30' : 'bg-red-900/80 text-red-300 border-b border-red-500/30'
        }`}>
          <span>{toast.type === 'ok' ? '✓' : '⚠'} {toast.msg}</span>
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* 呼出中 — 最優先・フル幅 */}
          {callingTickets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                  <BellRing size={14} className="text-amber-400 animate-pulse" />
                  <span className="text-amber-300 font-black text-sm">呼出中</span>
                  <span className="bg-amber-400 text-amber-950 text-xs font-black px-1.5 py-0.5 rounded-full">{callingTickets.length}</span>
                </div>
              </div>
              {callingTickets.map(t => <CallingCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} />)}
            </div>
          )}

          {/* 予約管理クイックリンク */}
          <a href={`/${store.id}/admin/reservations`}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-2 px-3 py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl active:opacity-70">
            <CalendarDays size={14} className="text-violet-400 shrink-0" />
            <span className="text-violet-300 text-xs font-bold">予約管理</span>
            <ChevronRight size={12} className="text-violet-600 ml-auto" />
          </a>

          {/* 待ちリスト */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                <Clock size={14} className="text-blue-400" />
                <span className="text-blue-300 font-black text-sm">待ち</span>
                <span className="bg-blue-400 text-blue-950 text-xs font-black px-1.5 py-0.5 rounded-full">{waitingTickets.length}</span>
              </div>
              {callingTickets.length === 0 && (
                <div className="ml-2 flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800/40 border border-zinc-700/40 rounded-xl text-zinc-600 text-xs">
                  <BellRing size={11} />
                  <span>呼出中なし</span>
                </div>
              )}
            </div>
            {waitingTickets.length === 0 ? (
              <div className="text-center py-10 text-zinc-600 bg-white/3 rounded-2xl border border-white/5">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">待ちはいません</p>
              </div>
            ) : waitingTickets.map(t => <WaitingCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} onCheckIn={handleCheckIn} />)}
          </div>

          {/* 履歴（完了・不在バッジのタップで表示） */}
          {historyVisible && (
            <div className="bg-white/3 border border-white/5 rounded-2xl overflow-hidden animate-fade-in">
              <div className="flex border-b border-white/5">
                {([
                  { key: 'completed', label: '完了', color: 'text-emerald-400' },
                  { key: 'cancelled', label: '不在', color: 'text-zinc-400' },
                ] as { key: HistoryTab; label: string; color: string }[]).map(tab => (
                  <button key={tab.key} onClick={() => setHistoryTab(tab.key)}
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${
                      historyTab === tab.key ? `${tab.color} border-b-2 border-current bg-white/5` : 'text-zinc-600 hover:text-zinc-400'
                    }`}>
                    {tab.label} ({queues.filter(q => q.status === tab.key).length})
                  </button>
                ))}
              </div>
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {historyTickets.length === 0
                  ? <div className="text-center py-8 text-zinc-600 text-sm">該当する受付はありません</div>
                  : historyTickets.map(t => <HistoryCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} />)
                }
              </div>
            </div>
          )}

        </div>
      </div>

      {/* QR モーダル */}
      {showQrModal && (() => {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || ''
        const url    = `https://liff.line.me/${liffId}/${store.id}`
        const qrSrc  = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(url)}`
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-xs text-center relative">
              <button onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
              <p className="font-black text-white text-base mb-1">お客様受付 QR</p>
              <p className="text-zinc-500 text-xs mb-4">このQRをお客様のLINEで読み取ってもらってください</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="受付QR" width={240} height={240} className="mx-auto rounded-2xl bg-white p-2" />
              <button onClick={() => { onLogout() }} className="mt-5 text-xs text-zinc-600 hover:text-zinc-400">
                店舗を切り替える
              </button>
            </div>
          </div>
        )
      })()}

      <BottomNav />
    </div>
  )
}

// ============================================================
// ページエントリーポイント
// ============================================================
export default function StoreAdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [view,          setView]          = useState<AdminView>('loading')
  const [stores,        setStores]        = useState<StoreInfo[]>([])
  const [groupStores,   setGroupStores]   = useState<StoreInfo[]>([])
  const [groupCode,     setGroupCode]     = useState<string | null>(null)
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null)
  const [fetchError,    setFetchError]    = useState<string | null>(null)

  const loadGroupCode = useCallback(async (store: StoreInfo) => {
    if (!store.group_id) return
    const { data } = await (supabase as any).from('groups').select('code').eq('id', store.group_id).single()
    if (data?.code) { sessionStorage.setItem('admin_group_code', data.code); setGroupCode(data.code) }
  }, [])

  useEffect(() => {
    supabase.from('stores').select('id, name, pin, group_id').order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setFetchError(error?.message ?? '店舗データが見つかりません'); setView('select_store'); return
        }
        setStores(data as StoreInfo[])
        const saved = sessionStorage.getItem('admin_store_id')
        if (saved && saved === storeId && sessionStorage.getItem('admin_auth') === '1') {
          const match = (data as StoreInfo[]).find(s => s.id === saved)
          if (match) {
            setSelectedStore(match)
            setGroupStores((data as StoreInfo[]).filter(s => s.group_id === match.group_id))
            const gc = sessionStorage.getItem('admin_group_code')
            if (gc) setGroupCode(gc); else loadGroupCode(match)
            setView('dashboard'); return
          }
        }
        if (storeId) {
          const match = (data as StoreInfo[]).find(s => s.id === storeId)
          if (match) {
            setSelectedStore(match)
            setGroupStores((data as StoreInfo[]).filter(s => s.group_id === match.group_id))
            setView('pin'); return
          }
        }
        setView('select_store')
      })
  }, [storeId, loadGroupCode])

  const handleSelectStore = (s: StoreInfo) => { setSelectedStore(s); setView('pin') }
  const handleAuth = () => {
    if (selectedStore) {
      sessionStorage.setItem('admin_store_id', selectedStore.id)
      sessionStorage.setItem('admin_auth', '1')
      loadGroupCode(selectedStore)
    }
    setView('dashboard')
  }
  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth'); sessionStorage.removeItem('admin_store_id')
    setSelectedStore(null); setView('select_store')
  }

  if (view === 'loading') return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-indigo-400" />
    </div>
  )
  if (view === 'select_store') return (
    <>
      {fetchError && (
        <div className="fixed top-4 left-4 right-4 bg-red-900/90 text-red-200 text-sm px-4 py-3 rounded-xl z-50 backdrop-blur-sm border border-red-500/30">
          エラー: {fetchError}
        </div>
      )}
      <StoreSelectScreen stores={groupStores.length > 0 ? groupStores : stores} groupCode={groupCode} onSelect={handleSelectStore} />
    </>
  )
  if (view === 'pin' && selectedStore) return (
    <PinScreen storeName={selectedStore.name} storePin={selectedStore.pin} onAuth={handleAuth} onBack={() => setView('select_store')} />
  )
  if (view === 'dashboard' && selectedStore) return (
    <AdminDashboard store={selectedStore} groupCode={groupCode} onLogout={handleLogout} />
  )
  return null
}
