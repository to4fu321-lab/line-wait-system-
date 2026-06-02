'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  BellRing, CheckCheck, UserX, RefreshCw, Clock, Users,
  Loader2, Store, Phone, User, GraduationCap,
  ChevronRight, LayoutDashboard, X, MapPin, BellOff, Bell,
  CalendarDays, QrCode,
} from 'lucide-react'
import { BottomNav } from './_components/BottomNav'
import { QrRegistrationModal } from './_components/QrRegistrationModal'
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

interface StoreInfo { id: string; name: string; pin: string; group_id?: string | null; business_type?: string }

// ============================================================
// 店舗選択画面
// ============================================================
function StoreSelectScreen({ stores, groupCode, onSelect }: { stores: StoreInfo[]; groupCode: string | null; onSelect: (s: StoreInfo) => void }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="relative text-center mb-10 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-100 border border-indigo-200 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
          <span className="text-4xl">🏪</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">管理画面</h1>
        <p className="text-gray-500 mt-2 text-sm">店舗を選択してください</p>
      </div>
      <div className="relative w-full max-w-sm space-y-3 animate-fade-in">
        {stores.map(store => (
          <button key={store.id} onClick={() => onSelect(store)}
            className="w-full flex items-center gap-4 bg-white hover:bg-gray-50 border border-gray-200 hover:border-indigo-400 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
              <Store size={18} className="text-indigo-600" />
            </div>
            <span className="text-gray-900 text-lg font-bold flex-1">{store.name}</span>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        ))}
        <div className="pt-4 border-t border-gray-200 space-y-1">
          {groupCode && (
            <a href={`/company/${groupCode}`} className="flex items-center gap-3 text-indigo-600 hover:text-indigo-700 transition-colors py-2 px-1 text-sm font-bold">
              <LayoutDashboard size={15} /><span>会社管理ダッシュボード</span>
              <ChevronRight size={13} className="ml-auto" />
            </a>
          )}
          <a href="/super-admin" className="flex items-center gap-3 text-gray-400 hover:text-gray-600 transition-colors py-2 px-1 text-sm">
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
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="relative text-center mb-8 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-100 border border-indigo-200 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
          <span className="text-4xl">🔒</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900">スタッフ専用</h1>
        <p className="text-indigo-600 font-bold mt-1 text-lg">{storeName}</p>
        <p className="text-gray-400 text-sm mt-1">PINを入力してください</p>
      </div>
      <div className="relative flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
            pin.length > i ? error ? 'bg-red-400 scale-110' : 'bg-indigo-500 scale-110 shadow-lg shadow-indigo-500/50' : 'bg-gray-200'
          }`} />
        ))}
      </div>
      {error && <p className="relative text-red-600 text-sm mb-4 font-medium animate-pulse">PINが違います</p>}
      <div className="relative grid grid-cols-3 gap-3 w-60">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
            className={`h-15 py-4 rounded-2xl text-xl font-bold transition-all active:scale-90 ${
              d === '' ? 'invisible' : d === '⌫' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
              'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-indigo-400'
            }`}>{d}</button>
        ))}
      </div>
      <button onClick={onBack} className="relative mt-8 text-gray-400 text-sm hover:text-gray-600 transition-colors">
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

function CustomerInfoPanel({ customerId, storeId }: { customerId: string; storeId: string }) {
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
function WaitingCard({ ticket, storeId, onAction, onCheckIn }: {
  ticket: Queue; storeId: string
  onAction: (id: string, s: QueueStatus) => Promise<void>
  onCheckIn: (id: string) => Promise<void>
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
      .select('is_open, notification_plan, is_test_mode')
      .eq('id', store.id).single()
    if (error || !data) {
      setIsOpen(false)
      return
    }
    setIsOpen(data.is_open ?? false)
    if ((data as any).notification_plan) setNotificationPlan((data as any).notification_plan)
    if ((data as any).is_test_mode != null) setIsTestMode((data as any).is_test_mode)
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
    try {
      const res = await fetch('/api/stores/open', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store.id, isOpen: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        setIsOpen(!next)
        showToast('err', '受付切替失敗: ' + (json.error ?? 'エラー'))
        return
      }
      // APIが返した実際のDB値で確定
      if (typeof json.is_open === 'boolean') setIsOpen(json.is_open)
    } catch {
      setIsOpen(!next)
      showToast('err', '受付切替失敗: 通信エラー')
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
    <div className="min-h-[100dvh] bg-gray-50 text-gray-900 flex flex-col">

      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-4 pt-safe-top pt-4 pb-3">

        {/* 行1: 店舗名 / ボタン群 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-base font-black tracking-tight text-gray-900 leading-tight">{store.name}</h1>
            <p className="text-gray-500 text-[11px]">
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* 受付切替（コンパクト・右上） */}
            <button onClick={handleToggleOpen} disabled={isOpen === null}
              style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs active:opacity-60 transition-all disabled:opacity-40 ${
                isOpen === null ? 'bg-gray-200 text-gray-500' :
                isOpen ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50' :
                'bg-red-700 text-white shadow-sm shadow-red-900/50'
              }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                isOpen === null ? 'bg-gray-400' : isOpen ? 'bg-white animate-pulse' : 'bg-red-200'
              }`} />
              {isOpen === null ? '...' : isOpen ? '受付中' : '停止中'}
            </button>
            <button onClick={fetchQueues} disabled={refreshing}
              className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all disabled:opacity-50">
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-600' : 'text-gray-500'} />
            </button>
            <button onClick={() => pushStatus !== 'granted' && setupPush(store.id)}
              title={pushStatus === 'granted' ? 'ブラウザ通知: ON' : pushStatus === 'denied' ? '通知がブロック' : pushStatus === 'unsupported' ? '非対応' : '通知を許可'}
              className={`p-2 rounded-xl border active:opacity-60 transition-all ${
                pushStatus === 'granted'     ? 'bg-emerald-100 border-emerald-300 text-emerald-600' :
                pushStatus === 'denied'      ? 'bg-red-100 border-red-300 text-red-600' :
                pushStatus === 'unsupported' ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' :
                'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
              }`}>
              {pushStatus === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
            </button>
            <button onClick={() => setShowQrModal(true)}
              className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all text-gray-500">
              <QrCode size={16} />
            </button>
            <a href={`/${store.id}/takeout-admin`}
              title="テイクアウト管理"
              className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all text-gray-500 text-base leading-none flex items-center justify-center">
              🥡
            </a>
            <a href={groupCode ? `/company/${groupCode}` : '/super-admin'}
              title={groupCode ? '会社管理ダッシュボード' : '総管理ダッシュボード'}
              className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all text-gray-500">
              <LayoutDashboard size={16} />
            </a>
          </div>
        </div>

        {/* テストモードバナー */}
        {isTestMode && (
          <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-xl px-3 py-2 text-amber-700 text-xs font-bold mb-2">
            <span>⚠️</span>
            <span className="flex-1">テストモード中 — LINE・ブラウザ通知は送信されません</span>
          </div>
        )}

        {/* 行3: 状態バッジ 4つ（常時表示）— 完了・不在はタップで履歴展開 */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="flex flex-col items-center gap-0.5 bg-blue-50 border border-blue-200 rounded-xl px-1 py-2.5">
            <span className="text-blue-600 text-2xl font-black tabular-nums leading-none">{waitingTickets.length}</span>
            <span className="text-blue-500 text-[10px] font-bold mt-0.5">待機</span>
          </div>
          <div className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 ${
            callingTickets.length > 0 ? 'bg-amber-50 border border-amber-300' : 'bg-gray-50 border border-gray-200'
          }`}>
            <span className={`text-2xl font-black tabular-nums leading-none ${callingTickets.length > 0 ? 'text-amber-600 animate-pulse' : 'text-gray-400'}`}>
              {callingTickets.length}
            </span>
            <span className={`text-[10px] font-bold mt-0.5 ${callingTickets.length > 0 ? 'text-amber-500' : 'text-gray-400'}`}>呼出中</span>
          </div>
          <button onClick={() => toggleHistory('completed')} style={{ touchAction: 'manipulation' }}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 active:scale-95 transition-all ${
              historyVisible && historyTab === 'completed'
                ? 'bg-emerald-100 border border-emerald-300'
                : 'bg-gray-50 border border-gray-200'
            }`}>
            <span className="text-emerald-600 text-2xl font-black tabular-nums leading-none">{completed}</span>
            <span className="text-gray-400 text-[10px] font-bold mt-0.5">完了 ▾</span>
          </button>
          <button onClick={() => toggleHistory('cancelled')} style={{ touchAction: 'manipulation' }}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 active:scale-95 transition-all ${
              historyVisible && historyTab === 'cancelled'
                ? 'bg-gray-100 border border-gray-300'
                : 'bg-gray-50 border border-gray-200'
            }`}>
            <span className="text-gray-500 text-2xl font-black tabular-nums leading-none">{cancelledCount}</span>
            <span className="text-gray-400 text-[10px] font-bold mt-0.5">不在 ▾</span>
          </button>
        </div>

        {/* 遠隔待ちバッジ（遠隔がいる時のみ） */}
        {remoteCount > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 bg-gray-100 border border-gray-300 rounded-xl px-3 py-1.5">
            <MapPin size={12} className="text-gray-500 shrink-0" />
            <span className="text-gray-700 text-xs font-black">{remoteCount}</span>
            <span className="text-gray-500 text-xs">組が遠隔待ち（到着前）</span>
          </div>
        )}

      </div>

      {/* トースト */}
      {toast && (
        <div className={`px-4 py-3 flex items-center justify-between text-sm font-bold animate-fade-in ${
          toast.type === 'ok' ? 'bg-emerald-600 text-white border-b border-emerald-700' : 'bg-red-600 text-white border-b border-red-700'
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
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-xl">
                  <BellRing size={14} className="text-amber-600 animate-pulse" />
                  <span className="text-amber-700 font-black text-sm">呼出中</span>
                  <span className="bg-amber-400 text-amber-950 text-xs font-black px-1.5 py-0.5 rounded-full">{callingTickets.length}</span>
                </div>
              </div>
              {callingTickets.map(t => <CallingCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} />)}
            </div>
          )}

          {/* 予約管理クイックリンク */}
          <a href={`/${store.id}/admin/reservations`}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-xl active:opacity-70">
            <CalendarDays size={14} className="text-violet-600 shrink-0" />
            <span className="text-violet-700 text-xs font-bold">予約管理</span>
            <ChevronRight size={12} className="text-violet-500 ml-auto" />
          </a>

          {/* 待ちリスト */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-xl">
                <Clock size={14} className="text-blue-600" />
                <span className="text-blue-700 font-black text-sm">待ち</span>
                <span className="bg-blue-400 text-blue-950 text-xs font-black px-1.5 py-0.5 rounded-full">{waitingTickets.length}</span>
              </div>
              {callingTickets.length === 0 && (
                <div className="ml-2 flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-400 text-xs">
                  <BellRing size={11} />
                  <span>呼出中なし</span>
                </div>
              )}
            </div>
            {waitingTickets.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-gray-200">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">待ちはいません</p>
              </div>
            ) : waitingTickets.map(t => <WaitingCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} onCheckIn={handleCheckIn} />)}
          </div>

          {/* 履歴（完了・不在バッジのタップで表示） */}
          {historyVisible && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-fade-in">
              <div className="flex border-b border-gray-200">
                {([
                  { key: 'completed', label: '完了', color: 'text-emerald-600' },
                  { key: 'cancelled', label: '不在', color: 'text-gray-500' },
                ] as { key: HistoryTab; label: string; color: string }[]).map(tab => (
                  <button key={tab.key} onClick={() => setHistoryTab(tab.key)}
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${
                      historyTab === tab.key ? `${tab.color} border-b-2 border-current bg-gray-50` : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    {tab.label} ({queues.filter(q => q.status === tab.key).length})
                  </button>
                ))}
              </div>
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {historyTickets.length === 0
                  ? <div className="text-center py-8 text-gray-400 text-sm">該当する受付はありません</div>
                  : historyTickets.map(t => <HistoryCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} />)
                }
              </div>
            </div>
          )}

        </div>
      </div>

      {/* QR モーダル */}
      {showQrModal && (
        <QrRegistrationModal
          storeId={store.id}
          onClose={() => setShowQrModal(false)}
          onSwitchStore={() => { setShowQrModal(false); onLogout() }}
        />
      )}

      <BottomNav />
    </div>
  )
}

// ============================================================
// ページエントリーポイント
// ============================================================
export default function StoreAdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const [view,          setView]          = useState<AdminView>('loading')
  const [stores,        setStores]        = useState<StoreInfo[]>([])
  const [groupStores,   setGroupStores]   = useState<StoreInfo[]>([])
  const [groupCode,     setGroupCode]     = useState<string | null>(() => sessionStorage.getItem('admin_group_code'))
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null)
  const [fetchError,    setFetchError]    = useState<string | null>(null)

  const loadGroupCode = useCallback(async (store: StoreInfo) => {
    if (!store.group_id) return
    const { data } = await (supabase as any).from('groups').select('code').eq('id', store.group_id).single()
    if (data?.code) { sessionStorage.setItem('admin_group_code', data.code); setGroupCode(data.code) }
  }, [])

  useEffect(() => {
    supabase.from('stores').select('id, name, pin, group_id, business_type').order('name', { ascending: true })
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
            if (match.business_type === 'takeout') { router.replace(`/${match.id}/kitchen`); return }
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
      if (selectedStore.business_type === 'takeout') {
        router.replace(`/${selectedStore.id}/kitchen`)
        return
      }
    }
    setView('dashboard')
  }
  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth'); sessionStorage.removeItem('admin_store_id')
    setSelectedStore(null); setView('select_store')
  }

  if (view === 'loading') return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-indigo-600" />
    </div>
  )
  if (view === 'select_store') return (
    <>
      {fetchError && (
        <div className="fixed top-4 left-4 right-4 bg-red-600 text-white text-sm px-4 py-3 rounded-xl z-50 backdrop-blur-sm border border-red-700">
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
