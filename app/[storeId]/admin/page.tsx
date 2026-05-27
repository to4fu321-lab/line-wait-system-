'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  BellRing, CheckCheck, UserX, RefreshCw, Clock, Users,
  Loader2, Store, Settings, Plus, Trash2, Phone, User, GraduationCap,
  ChevronRight, ChevronDown, ChevronUp, LayoutDashboard, X, MapPin, BellOff, Bell, AlertCircle,
  CalendarDays, ShoppingBag, QrCode,
} from 'lucide-react'
import { BottomNav } from './_components/BottomNav'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueStatus, WaitThreshold } from '@/types/database'
import {
  CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS,
  GENDER_LABELS, GENDER_STYLES, DEFAULT_THRESHOLDS,
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

interface StoreInfo { id: string; name: string; pin: string }

// ============================================================
// 店舗選択画面
// ============================================================
function StoreSelectScreen({ stores, onSelect }: { stores: StoreInfo[]; onSelect: (s: StoreInfo) => void }) {
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
          <a href="/super-admin" className="flex items-center gap-3 text-zinc-500 hover:text-zinc-300 transition-colors py-2 px-1 text-sm">
            <LayoutDashboard size={15} /><span>総管理ダッシュボード</span>
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
            {/* 遠隔バッジ */}
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
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-900/40">
          {loading === 'calling' ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
          呼出
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
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-900/40 transition-all">
          {loading === 'completed' ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}完了
        </button>
        <button onClick={recall} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm bg-orange-500/30 hover:bg-orange-500/50 text-orange-300 border border-orange-500/30 active:scale-95 disabled:opacity-50 transition-all">
          {loading === 'recalling' ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}再呼出
        </button>
        <button onClick={() => act('cancelled')} disabled={!!loading}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 active:scale-95 disabled:opacity-50 transition-all">
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
            {/* 受付時刻 + 待ち時間 */}
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
// 設定パネル
// ============================================================
function SettingsPanel({
  noticeThreshold, waitThresholds, allowRemote, notificationPlan, pushSettings,
  onNoticeChange, onThresholdsChange, onRemoteChange, onPlanChange, onPushSettingsChange,
  onSave, saving, isTestMode, testLoading, onTestModeToggle, onTestSeed, onTestClear,
  alertDaysRepair, alertDaysPurchase, onAlertRepairChange, onAlertPurchaseChange,
  schoolNames, onSchoolNamesChange,
}: {
  noticeThreshold: number; waitThresholds: WaitThreshold[]; allowRemote: boolean
  notificationPlan: 'calling_only' | 'full'
  pushSettings: { queue_new: boolean; purchase_new: boolean }
  onNoticeChange: (v: number) => void
  onThresholdsChange: (v: WaitThreshold[]) => void
  onRemoteChange: (v: boolean) => void
  onPlanChange: (v: 'calling_only' | 'full') => void
  onPushSettingsChange: (v: { queue_new: boolean; purchase_new: boolean }) => void
  onSave: () => void; saving: boolean
  isTestMode: boolean; testLoading: string | null
  onTestModeToggle: () => void; onTestSeed: () => void; onTestClear: () => void
  alertDaysRepair: number
  alertDaysPurchase: number
  onAlertRepairChange: (v: number) => void
  onAlertPurchaseChange: (v: number) => void
  schoolNames: string[]
  onSchoolNamesChange: (v: string[]) => void
}) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-5">
      <h3 className="font-black text-white flex items-center gap-2 text-base">
        <Settings size={16} className="text-indigo-400" />設定
      </h3>

      {/* ① LINE通知プラン */}
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">LINE通知</label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {([
            { value: 'calling_only', label: '呼出のみ', desc: '1通/人 — 呼出時のみ', icon: '🔔' },
            { value: 'full',         label: '全通知',   desc: '3通/人 — 受付・もうすぐ・呼出', icon: '📲' },
          ] as const).map(opt => (
            <button key={opt.value} type="button" onClick={() => onPlanChange(opt.value)}
              className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                notificationPlan === opt.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/50'
              }`}>
              <span className="text-sm font-bold mb-0.5">
                {opt.icon} <span className={notificationPlan === opt.value ? 'text-indigo-300' : 'text-zinc-400'}>{opt.label}</span>
              </span>
              <span className="text-[11px] text-zinc-500">{opt.desc}</span>
            </button>
          ))}
        </div>
        {/* まもなく通知: 全通知プランのみ表示 */}
        {notificationPlan === 'full' && (
          <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5 flex items-center gap-3">
            <span className="text-xs text-zinc-400 flex-1">もうすぐ通知 — 残り</span>
            <input type="number" min={1} max={20} value={noticeThreshold}
              onChange={e => onNoticeChange(Number(e.target.value))}
              className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-center font-black text-base text-white focus:border-indigo-500 focus:outline-none" />
            <span className="text-xs text-zinc-500">番目で通知</span>
          </div>
        )}
      </div>

      {/* ② ブラウザ通知（新規受付のみ — 実装済み） */}
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">ブラウザ通知（端末）</label>
        <button type="button"
          onClick={() => onPushSettingsChange({ ...pushSettings, queue_new: !pushSettings.queue_new })}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
            pushSettings.queue_new ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/50'
          }`}>
          <div className="text-left">
            <p className={`font-bold text-sm ${pushSettings.queue_new ? 'text-indigo-300' : 'text-zinc-400'}`}>🔔 新規受付</p>
            <p className="text-xs text-zinc-500 mt-0.5">お客様が受付した時に端末へ通知</p>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${pushSettings.queue_new ? 'bg-indigo-500' : 'bg-zinc-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-transform ${pushSettings.queue_new ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </button>
        <p className="text-xs text-zinc-600 mt-1.5">ヘッダーの🔔ボタンで端末通知を許可してください</p>
      </div>

      {/* ③ 遠隔チェックイン */}
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">遠隔チェックイン</label>
        <button type="button" onClick={() => onRemoteChange(!allowRemote)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
            allowRemote ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/50'
          }`}>
          <div className="text-left">
            <p className={`font-bold text-sm ${allowRemote ? 'text-indigo-300' : 'text-zinc-400'}`}>
              🏠 来店前の順番取りを許可
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {allowRemote ? 'OFFにすると現地受付のみになります' : '顧客が自宅から順番取りできるようになります'}
            </p>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${allowRemote ? 'bg-indigo-500' : 'bg-zinc-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${allowRemote ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>

      {/* ④ 待ち案内メッセージ */}
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">待ち案内メッセージ（顧客画面表示）</label>
        <div className="space-y-2">
          {waitThresholds.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <input type="number" min={1} max={99} placeholder="∞" value={t.max_wait ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    const up = [...waitThresholds]; up[i] = { ...up[i], max_wait: val }; onThresholdsChange(up)
                  }}
                  className="w-12 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-center text-xs text-white focus:border-indigo-500 focus:outline-none" />
                <span className="text-zinc-500 text-[10px]">組↓</span>
              </div>
              <input type="text" value={t.text}
                onChange={e => {
                  const up = [...waitThresholds]; up[i] = { ...up[i], text: e.target.value }; onThresholdsChange(up)
                }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                placeholder="表示するメッセージ" />
              <button onClick={() => onThresholdsChange(waitThresholds.filter((_,j) => j !== i))}
                className="shrink-0 p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button onClick={() => onThresholdsChange([...waitThresholds, { max_wait: null, text: '' }])}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-xs">
            <Plus size={12} />行を追加
          </button>
        </div>
      </div>

      {/* ⑤ 未お渡しアラート */}
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
          <AlertCircle size={11} className="text-amber-400" />未お渡しアラート（入荷・完了から N日後に警告）
        </label>
        {[
          { label: 'お直し完了', value: alertDaysRepair,   onChange: onAlertRepairChange },
          { label: '取置き入荷', value: alertDaysPurchase, onChange: onAlertPurchaseChange },
        ].map(({ label, value, onChange }) => (
          <div key={label} className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-zinc-400 w-20 shrink-0">{label}</span>
            <div className="flex items-center gap-1">
              {[3, 5, 7, 14, 30].map(d => (
                <button key={d} onClick={() => onChange(d)}
                  className={`w-9 h-7 rounded-lg text-xs font-bold transition-all ${
                    value === d ? 'bg-amber-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                  }`}>{d}</button>
              ))}
              <span className="text-xs text-zinc-600 ml-1">日</span>
            </div>
          </div>
        ))}
      </div>

      {/* ⑥ 学校名マスタ */}
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
          <GraduationCap size={11} className="text-indigo-400" />学校名マスタ（CRM・受付フォームで使用）
        </label>
        <div className="space-y-1.5 mb-2">
          {schoolNames.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={s}
                onChange={e => {
                  const up = [...schoolNames]; up[i] = e.target.value; onSchoolNamesChange(up)
                }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none" />
              <button onClick={() => onSchoolNamesChange(schoolNames.filter((_, j) => j !== i))}
                className="shrink-0 p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => onSchoolNamesChange([...schoolNames, ''])}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-xs">
          <Plus size={12} />学校を追加
        </button>
      </div>

      <button onClick={onSave} disabled={saving}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/40">
        {saving ? <><Loader2 size={16} className="animate-spin inline mr-2" />保存中...</> : '設定を保存'}
      </button>

      {/* ⑥ テストモード */}
      <div className="border-t border-white/10 pt-4">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">🧪 テストモード</label>
        <button type="button" onClick={onTestModeToggle} disabled={testLoading === 'toggle'}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all mb-2 ${
            isTestMode ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 bg-zinc-800/50'
          }`}>
          <div className="text-left">
            <p className={`font-bold text-sm ${isTestMode ? 'text-amber-300' : 'text-zinc-400'}`}>
              ⚠️ テストモード {isTestMode ? 'ON' : 'OFF'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isTestMode ? 'LINE・ブラウザ通知をすべてスキップ中' : 'ONにすると通知が送信されません'}
            </p>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${isTestMode ? 'bg-amber-500' : 'bg-zinc-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${isTestMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onTestSeed} disabled={!!testLoading}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-500/20 active:scale-95 disabled:opacity-40 transition-all">
            {testLoading === 'seed' ? <Loader2 size={16} className="animate-spin" /> : <span className="text-lg">📥</span>}
            <span>テストデータ投入</span>
            <span className="text-zinc-500 font-normal text-[10px]">顧客5人・待ち3件・取置き&お直し各5件</span>
          </button>
          <button type="button" onClick={onTestClear} disabled={!!testLoading}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/20 active:scale-95 disabled:opacity-40 transition-all">
            {testLoading === 'clear' ? <Loader2 size={16} className="animate-spin" /> : <span className="text-lg">🗑</span>}
            <span>テストデータ削除</span>
            <span className="text-zinc-500 font-normal text-[10px]">【テスト】タグを全消去</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ダッシュボード
// ============================================================
function AdminDashboard({ store, onLogout }: { store: StoreInfo; onLogout: () => void }) {
  const [queues,          setQueues]          = useState<Queue[]>([])
  const [refreshing,      setRefreshing]      = useState(false)
  const [historyTab,      setHistoryTab]      = useState<HistoryTab>('completed')
  const [historyVisible,  setHistoryVisible]  = useState(false)
  const [toast,           setToast]           = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [isOpen,            setIsOpen]            = useState<boolean | null>(null)
  const [noticeThreshold,   setNoticeThreshold]   = useState(3)
  const [waitThresholds,    setWaitThresholds]    = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)
  const [allowRemote,       setAllowRemote]       = useState(false)
  const [notificationPlan,  setNotificationPlan]  = useState<'calling_only' | 'full'>('calling_only')
  const [pushSettings,      setPushSettings]      = useState({ queue_new: true, purchase_new: true })
  const [isTestMode,        setIsTestMode]        = useState(false)
  const [activeFittings,    setActiveFittings]    = useState(1)
  const [alertDaysRepair,     setAlertDaysRepair]     = useState(7)
  const [alertDaysPurchase,   setAlertDaysPurchase]   = useState(7)
  const [schoolNames,         setSchoolNames]         = useState<string[]>([])
  const [pendingRepairCount,  setPendingRepairCount]  = useState(0)
  const [pendingPurchaseCount,setPendingPurchaseCount]= useState(0)
  const [testLoading,         setTestLoading]         = useState<'seed'|'clear'|'toggle'|null>(null)
  const [saving,            setSaving]            = useState(false)
  const [showSettings,        setShowSettings]        = useState(false)
  const [showDetails,         setShowDetails]         = useState(false)
  const [showQrModal,         setShowQrModal]         = useState(false)
  const [pushStatus,          setPushStatus]          = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
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
    const { data } = await supabase.from('stores')
      .select('is_open, notice_threshold, wait_thresholds, allow_remote, notification_plan, push_settings, is_test_mode, active_fittings, alert_days_repair, alert_days_purchase, school_names')
      .eq('id', store.id).single()
    if (data) {
      setIsOpen(data.is_open ?? false)
      if (data.notice_threshold != null) setNoticeThreshold(data.notice_threshold)
      if (Array.isArray(data.wait_thresholds) && data.wait_thresholds.length > 0)
        setWaitThresholds(data.wait_thresholds as WaitThreshold[])
      if (data.allow_remote != null) setAllowRemote(data.allow_remote)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((data as any).notification_plan) setNotificationPlan((data as any).notification_plan)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((data as any).push_settings) setPushSettings((data as any).push_settings)
      if ((data as any).is_test_mode != null) setIsTestMode((data as any).is_test_mode)
      if ((data as any).active_fittings != null) setActiveFittings((data as any).active_fittings)
      if ((data as any).alert_days_repair   != null) setAlertDaysRepair((data as any).alert_days_repair)
      if ((data as any).alert_days_purchase != null) setAlertDaysPurchase((data as any).alert_days_purchase)
      if (Array.isArray((data as any).school_names)) setSchoolNames((data as any).school_names)
    }
  }, [store.id])

  const fetchQueues = useCallback(async () => {
    setRefreshing(true)
    const { data } = await supabase.from('queues').select('*')
      .eq('store_id', store.id).gte('created_at', getTodayStart())
      .order('ticket_number', { ascending: true })
    if (data) setQueues(data)
    setRefreshing(false)
  }, [store.id])

  const fetchPendingCounts = useCallback(async () => {
    const [repairRes, purchaseRes] = await Promise.all([
      supabase.from('repair_histories').select('id', { count: 'exact', head: true })
        .eq('store_id', store.id).in('status', ['received', 'completed']),
      (supabase.from('purchase_orders') as any).select('id', { count: 'exact', head: true })
        .eq('store_id', store.id).in('status', ['ordered', 'on_order', 'arrived']),
    ])
    setPendingRepairCount(repairRes.count ?? 0)
    setPendingPurchaseCount(purchaseRes.count ?? 0)
  }, [store.id])

  useEffect(() => {
    fetchStoreStatus(); fetchQueues(); fetchPendingCounts()
    // 通知が既に許可済みなら自動サブスクリプション（ユーザー操作不要で再登録）
    if (typeof window !== 'undefined' && 'Notification' in window && (window as any).Notification.permission === 'granted') {
      setupPush(store.id)
    }
    const channel = supabase.channel(`admin-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `store_id=eq.${store.id}` },
        () => fetchQueues())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_histories', filter: `store_id=eq.${store.id}` },
        () => fetchPendingCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders', filter: `store_id=eq.${store.id}` },
        () => fetchPendingCounts())
      .subscribe()
    // Realtime が動かない環境向けのポーリングフォールバック
    const pollId = setInterval(() => { fetchQueues(); fetchPendingCounts() }, 10000)
    return () => { supabase.removeChannel(channel); clearInterval(pollId) }
  }, [store.id, fetchQueues, fetchStoreStatus, fetchPendingCounts])

  const handleToggleOpen = async () => {
    if (isOpen === null) return
    const next = !isOpen; setIsOpen(next)
    await supabase.from('stores').update({ is_open: next }).eq('id', store.id)
  }

  const handleAction = async (id: string, status: QueueStatus) => {
    const { error } = await supabase.from('queues').update({ status }).eq('id', id)
    if (error) { showToast('err', '更新失敗: ' + error.message); return }
    setQueues(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    const labels: Record<QueueStatus, string> = { calling:'呼出', completed:'完了', cancelled:'不在', waiting:'待機に戻しました' }
    showToast('ok', labels[status])
    if (status === 'calling') {
      // 呼出通知を本人に送る（DBから最新データを取得してクロージャの古い値を避ける）
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
      // 呼出中は waiting+calling 両方でカウントするため位置は変わらない → threshold通知不要
    }
    if (status === 'completed' || status === 'cancelled') {
      // 少し待ってからトースト表示（直前の「完了」トーストと競合しないよう）
      await new Promise(res => setTimeout(res, 800))
      if (notificationPlan !== 'full') return  // 呼出のみプランは threshold 通知しない
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

  const handleTestModeToggle = async () => {
    setTestLoading('toggle')
    const next = !isTestMode
    const r = await fetch('/api/test/mode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: store.id, enabled: next }),
    })
    const j = await r.json()
    if (j.ok) { setIsTestMode(next); showToast('ok', next ? '⚠️ テストモードON — 通知は送信されません' : '✅ テストモードOFF — 通常運用に戻りました', 4000) }
    else showToast('err', '切替失敗: ' + j.error)
    setTestLoading(null)
  }

  const handleTestSeed = async () => {
    if (!confirm('テストデータを投入します。よろしいですか？')) return
    setTestLoading('seed')
    const r = await fetch('/api/test/seed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: store.id }),
    })
    const j = await r.json()
    if (j.ok) { showToast('ok', `✅ 投入完了 (${j.created?.length ?? 0}件)`, 4000); fetchQueues(); fetchPendingCounts() }
    else showToast('err', '投入失敗: ' + j.error)
    setTestLoading(null)
  }

  const handleTestClear = async () => {
    if (!confirm('【テスト】タグのデータをすべて削除します。よろしいですか？')) return
    setTestLoading('clear')
    const r = await fetch('/api/test/clear', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: store.id }),
    })
    const j = await r.json()
    if (j.ok) { showToast('ok', `🗑 削除完了 (${j.deleted?.join('・') ?? '0件'})`, 4000); fetchQueues(); fetchPendingCounts() }
    else showToast('err', '削除失敗: ' + j.error)
    setTestLoading(null)
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    const { error } = await (supabase.from('stores') as any).update({
      notice_threshold:   noticeThreshold,
      wait_thresholds:    waitThresholds,
      allow_remote:       allowRemote,
      notification_plan:  notificationPlan,
      push_settings:      pushSettings,
      alert_days_repair:  alertDaysRepair,
      alert_days_purchase: alertDaysPurchase,
      school_names: schoolNames.filter(s => s.trim()),
    }).eq('id', store.id)
    setSaving(false)
    showToast(error ? 'err' : 'ok', error ? '保存失敗: ' + error.message : '設定を保存しました')
  }

  const waitingTickets  = queues.filter(q => q.status === 'waiting')
  const callingTickets  = queues.filter(q => q.status === 'calling')
  const historyTickets  = queues.filter(q => q.status === historyTab)
  const remoteCount     = waitingTickets.filter(q => q.is_remote && !q.checked_in).length
  const total           = queues.length
  const completed       = queues.filter(q => q.status === 'completed').length
  const cancelledCount  = queues.filter(q => q.status === 'cancelled').length

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

      {/* ヘッダー — コンパクト化 */}
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
            <a href="/super-admin"
              title="総管理ダッシュボード"
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:opacity-60 transition-all text-zinc-400">
              <LayoutDashboard size={16} />
            </a>
          </div>
        </div>

        {/* 行2: 受付切替ボタン */}
        <button onClick={handleToggleOpen} disabled={isOpen === null}
          className={`w-full py-3 rounded-2xl text-sm font-black mb-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 ${
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

        {/* 行3: ステータスバー + 詳細トグル */}
        <div className="flex items-center gap-2">
          {/* 待機バッジ */}
          <div className="flex items-center gap-1 bg-blue-500/15 border border-blue-500/25 rounded-xl px-2.5 py-1.5">
            <Clock size={12} className="text-blue-400 shrink-0" />
            <span className="text-blue-300 text-xs font-black tabular-nums">{waitingTickets.length}</span>
            <span className="text-blue-500 text-[10px] font-bold">待機</span>
          </div>
          {/* 呼出中バッジ */}
          <div className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 ${callingTickets.length > 0 ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/4 border border-white/8'}`}>
            <BellRing size={12} className={callingTickets.length > 0 ? 'text-amber-400 animate-pulse shrink-0' : 'text-zinc-600 shrink-0'} />
            <span className={`text-xs font-black tabular-nums ${callingTickets.length > 0 ? 'text-amber-300' : 'text-zinc-500'}`}>{callingTickets.length}</span>
            <span className={`text-[10px] font-bold ${callingTickets.length > 0 ? 'text-amber-500' : 'text-zinc-600'}`}>呼出中</span>
          </div>
          {/* 遠隔バッジ（条件付き） */}
          {remoteCount > 0 && (
            <div className="flex items-center gap-1 bg-zinc-700/50 border border-zinc-600/40 rounded-xl px-2.5 py-1.5">
              <MapPin size={12} className="text-zinc-400 shrink-0" />
              <span className="text-zinc-300 text-xs font-black tabular-nums">{remoteCount}</span>
              <span className="text-zinc-500 text-[10px] font-bold">遠隔</span>
            </div>
          )}
          {/* 詳細トグル */}
          <button onClick={() => setShowDetails(v => !v)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-500 text-xs font-bold hover:bg-white/10 active:scale-95 transition-all">
            詳細{showDetails ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
        </div>

        {/* 折りたたみ詳細（本日合計・完了・不在・フィッティング台数） */}
        {showDetails && (
          <div className="mt-2 space-y-1.5 animate-fade-in">
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-white/4 border border-white/5 rounded-xl px-2 py-1.5 text-center">
                <div className="text-base font-black tabular-nums text-zinc-300">{total}</div>
                <div className="text-zinc-600 text-[10px]">本日合計</div>
              </div>
              {([
                { key: 'completed' as HistoryTab, label: '完了', value: completed,      color: 'text-emerald-400', activeBg: 'bg-emerald-500/10 border-emerald-500/30' },
                { key: 'cancelled' as HistoryTab, label: '不在', value: cancelledCount, color: 'text-zinc-400',    activeBg: 'bg-zinc-500/10 border-zinc-500/30' },
              ]).map(s => (
                <button key={s.key} onClick={() => toggleHistory(s.key)}
                  className={`border rounded-xl px-2 py-1.5 text-center transition-all active:scale-95 ${
                    historyVisible && historyTab === s.key ? s.activeBg : 'bg-white/4 border-white/5'
                  }`}>
                  <div className={`text-base font-black tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-zinc-600 text-[10px] flex items-center justify-center gap-0.5">
                    {s.label}{historyVisible && historyTab === s.key ? <ChevronUp size={9}/> : <ChevronDown size={9}/>}
                  </div>
                </button>
              ))}
            </div>
            {/* フィッティング台数 ± ステッパー */}
            <div className="flex items-center gap-2 bg-white/4 border border-white/5 rounded-xl px-3 py-2">
              <span className="text-zinc-500 text-xs font-bold flex-1">稼働フィッティング台数</span>
              <div className="flex items-center gap-2">
                <button onClick={() => activeFittings > 1 && handleFittingsChange(activeFittings - 1)}
                  disabled={activeFittings <= 1}
                  className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 font-black text-lg flex items-center justify-center hover:bg-zinc-700 active:scale-90 disabled:opacity-30 transition-all">
                  −
                </button>
                <span className="text-white font-black text-lg tabular-nums w-8 text-center">{activeFittings}</span>
                <button onClick={() => activeFittings < 30 && handleFittingsChange(activeFittings + 1)}
                  disabled={activeFittings >= 30}
                  className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 font-black text-lg flex items-center justify-center hover:bg-zinc-700 active:scale-90 disabled:opacity-30 transition-all">
                  ＋
                </button>
              </div>
            </div>
          </div>
        )}

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

          {showSettings && (
            <div className="animate-fade-in">
              <SettingsPanel
                noticeThreshold={noticeThreshold} waitThresholds={waitThresholds} allowRemote={allowRemote}
                notificationPlan={notificationPlan} pushSettings={pushSettings}
                onNoticeChange={setNoticeThreshold} onThresholdsChange={setWaitThresholds} onRemoteChange={setAllowRemote}
                onPlanChange={setNotificationPlan} onPushSettingsChange={setPushSettings}
                onSave={handleSaveSettings} saving={saving}
                isTestMode={isTestMode} testLoading={testLoading}
                onTestModeToggle={handleTestModeToggle}
                onTestSeed={handleTestSeed} onTestClear={handleTestClear}
                alertDaysRepair={alertDaysRepair}
                alertDaysPurchase={alertDaysPurchase}
                onAlertRepairChange={setAlertDaysRepair}
                onAlertPurchaseChange={setAlertDaysPurchase}
                schoolNames={schoolNames}
                onSchoolNamesChange={setSchoolNames}
              />
            </div>
          )}

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

          {/* クイックリンク */}
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

          {/* 履歴（詳細から完了/不在タップで表示） */}
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
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2010126882-aUahQStD'
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
  useParams<{ storeId: string }>()
  const [view,          setView]          = useState<AdminView>('loading')
  const [stores,        setStores]        = useState<StoreInfo[]>([])
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null)
  const [fetchError,    setFetchError]    = useState<string | null>(null)

  useEffect(() => {
    supabase.from('stores').select('id, name, pin').order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setFetchError(error?.message ?? '店舗データが見つかりません'); setView('select_store'); return
        }
        setStores(data as StoreInfo[])
        const saved = sessionStorage.getItem('admin_store_id')
        if (saved && sessionStorage.getItem('admin_auth') === '1') {
          const match = (data as StoreInfo[]).find(s => s.id === saved)
          if (match) { setSelectedStore(match); setView('dashboard'); return }
        }
        setView('select_store')
      })
  }, [])

  const handleSelectStore = (s: StoreInfo) => { setSelectedStore(s); setView('pin') }
  const handleAuth = () => {
    if (selectedStore) { sessionStorage.setItem('admin_store_id', selectedStore.id); sessionStorage.setItem('admin_auth', '1') }
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
      <StoreSelectScreen stores={stores} onSelect={handleSelectStore} />
    </>
  )
  if (view === 'pin' && selectedStore) return (
    <PinScreen storeName={selectedStore.name} storePin={selectedStore.pin} onAuth={handleAuth} onBack={() => setView('select_store')} />
  )
  if (view === 'dashboard' && selectedStore) return (
    <AdminDashboard store={selectedStore} onLogout={handleLogout} />
  )
  return null
}
