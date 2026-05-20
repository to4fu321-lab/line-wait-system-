'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  BellRing, CheckCheck, UserX, RefreshCw, Clock, Users,
  Loader2, Store, Settings, Plus, Trash2,
  ChevronRight, LayoutDashboard, X, MapPin,
} from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueStatus, WaitThreshold } from '@/types/database'
import {
  CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS,
  GENDER_LABELS, GENDER_STYLES, DEFAULT_THRESHOLDS,
} from '@/types/database'

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
// 待ちカード
// ============================================================
function WaitingCard({ ticket, onAction }: { ticket: Queue; onAction: (id: string, s: QueueStatus) => Promise<void> }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [open, setOpen]       = useState(false)
  const waitMin   = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000)
  const details   = (ticket.details ?? {}) as Record<string, string>
  const hasDetail = !!(details.address || details.phone || details.postalCode || details.notes)
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
          <p className={`font-bold text-base leading-tight truncate ${isRemoteUnchecked ? 'text-zinc-400' : 'text-white'}`}>
            {ticket.customer_name} 様
          </p>
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
          {details.postalCode && <DetailRow label="〒" value={details.postalCode} />}
          {details.address    && <DetailRow label="住所" value={details.address} />}
          {details.phone      && <DetailRow label="TEL" value={details.phone} />}
          {details.notes      && <DetailRow label="備考" value={details.notes} />}
        </div>
      )}

      {isRemoteUnchecked ? (
        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
          <span className="text-zinc-500 text-xs">🏠 遠隔チェックイン待ち — 顧客が到着次第チェックインします</span>
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
function CallingCard({ ticket, onAction }: { ticket: Queue; onAction: (id: string, s: QueueStatus) => Promise<void> }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [open, setOpen]       = useState(false)
  const waitMin   = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000)
  const details   = (ticket.details ?? {}) as Record<string, string>
  const hasDetail = !!(details.address || details.phone || details.postalCode || details.notes)

  const act = async (s: QueueStatus) => { setLoading(s); await onAction(ticket.id, s); setLoading(null) }
  const recall = async () => {
    setLoading('recalling'); await onAction(ticket.id, 'waiting'); await onAction(ticket.id, 'calling'); setLoading(null)
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
          <p className="font-bold text-white text-base leading-tight truncate">{ticket.customer_name} 様</p>
          {ticket.child_name && <p className="text-zinc-400 text-xs truncate">お子様: {ticket.child_name}</p>}
          <p className="text-zinc-500 text-xs truncate mt-0.5">{ticket.school_name}</p>
        </div>
        <button onClick={() => setOpen(v => !v)}
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
            hasDetail ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800/80 text-zinc-600'
          }`}>{open ? '閉' : '詳'}</button>
      </div>

      {open && hasDetail && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
          {details.postalCode && <DetailRow label="〒" value={details.postalCode} />}
          {details.address    && <DetailRow label="住所" value={details.address} />}
          {details.phone      && <DetailRow label="TEL" value={details.phone} />}
          {details.notes      && <DetailRow label="備考" value={details.notes} />}
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
function HistoryCard({ ticket, onAction }: { ticket: Queue; onAction: (id: string, s: QueueStatus) => Promise<void> }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [open, setOpen]       = useState(false)
  const details   = (ticket.details ?? {}) as Record<string, string>
  const hasDetail = !!(details.address || details.phone || details.postalCode || details.notes)
  const isDone    = ticket.status === 'completed'
  const act = async (s: QueueStatus) => { setLoading(s); await onAction(ticket.id, s); setLoading(null) }

  return (
    <div className={`backdrop-blur-sm border rounded-xl p-3 transition-all opacity-70 hover:opacity-100 ${
      isDone ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-zinc-900/60 border-zinc-700/50'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`ticket-number text-2xl font-black tabular-nums leading-none shrink-0 ${isDone ? 'text-emerald-400/70' : 'text-zinc-500'}`}>
          {String(ticket.ticket_number).padStart(3,'0')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}>{STATUS_LABELS[ticket.status]}</span>
            {ticket.is_remote && <span className="text-xs text-zinc-500">🏠</span>}
            <span className="text-xs text-zinc-500">{CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}</span>
          </div>
          <p className="font-bold text-zinc-300 text-sm truncate mt-0.5">{ticket.customer_name} 様</p>
          <p className="text-zinc-500 text-xs truncate">{ticket.school_name}</p>
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
      {open && hasDetail && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
          {details.postalCode && <DetailRow label="〒" value={details.postalCode} />}
          {details.address    && <DetailRow label="住所" value={details.address} />}
          {details.phone      && <DetailRow label="TEL" value={details.phone} />}
          {details.notes      && <DetailRow label="備考" value={details.notes} />}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 設定パネル
// ============================================================
function SettingsPanel({
  noticeThreshold, waitThresholds, allowRemote,
  onNoticeChange, onThresholdsChange, onRemoteChange, onSave, saving,
}: {
  noticeThreshold: number; waitThresholds: WaitThreshold[]; allowRemote: boolean
  onNoticeChange: (v: number) => void
  onThresholdsChange: (v: WaitThreshold[]) => void
  onRemoteChange: (v: boolean) => void
  onSave: () => void; saving: boolean
}) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-6">
      <h3 className="font-black text-white flex items-center gap-2 text-base">
        <Settings size={16} className="text-indigo-400" />
        通知・メッセージ設定
      </h3>

      {/* 遠隔チェックイン許可 */}
      <div>
        <label className="text-sm font-bold text-zinc-300 mb-3 block">遠隔チェックイン（来店前の順番待ち）</label>
        <button type="button" onClick={() => onRemoteChange(!allowRemote)}
          className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all ${
            allowRemote ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/50'
          }`}>
          <div className="text-left">
            <p className={`font-bold text-base ${allowRemote ? 'text-indigo-300' : 'text-zinc-400'}`}>
              🏠 遠隔チェックインを許可する
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {allowRemote ? 'OFFにすると現地受付のみになります' : '顧客が自宅から順番取りできるようになります'}
            </p>
          </div>
          <div className={`w-14 h-7 rounded-full transition-colors shrink-0 ${allowRemote ? 'bg-indigo-500' : 'bg-zinc-600'}`}>
            <div className={`w-6 h-6 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${allowRemote ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>

      {/* 通知閾値 */}
      <div>
        <label className="text-sm font-bold text-zinc-300 mb-3 block">残り待ち通知（名以下になったら先頭の人にLINE通知）</label>
        <div className="flex items-center gap-3">
          <input type="number" min={1} max={20} value={noticeThreshold}
            onChange={e => onNoticeChange(Number(e.target.value))}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-center font-black text-xl text-white focus:border-indigo-500 focus:outline-none" />
          <span className="text-zinc-400 text-sm">名以下で通知</span>
        </div>
      </div>

      {/* 待ちメッセージ */}
      <div>
        <label className="text-sm font-bold text-zinc-300 mb-3 block">待ち案内メッセージ（顧客画面に表示）</label>
        <div className="space-y-2">
          {waitThresholds.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <input type="number" min={1} max={99} placeholder="∞" value={t.max_wait ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    const up = [...waitThresholds]; up[i] = { ...up[i], max_wait: val }; onThresholdsChange(up)
                  }}
                  className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-center text-sm text-white focus:border-indigo-500 focus:outline-none" />
                <span className="text-zinc-500 text-xs">組↓</span>
              </div>
              <input type="text" value={t.text}
                onChange={e => {
                  const up = [...waitThresholds]; up[i] = { ...up[i], text: e.target.value }; onThresholdsChange(up)
                }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                placeholder="表示するメッセージ" />
              <button onClick={() => onThresholdsChange(waitThresholds.filter((_,j) => j !== i))}
                className="shrink-0 p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={() => onThresholdsChange([...waitThresholds, { max_wait: null, text: '' }])}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-sm">
            <Plus size={13} />行を追加
          </button>
        </div>
      </div>

      <button onClick={onSave} disabled={saving}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/40">
        {saving ? <><Loader2 size={16} className="animate-spin inline mr-2" />保存中...</> : '設定を保存'}
      </button>
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
  const [toast,           setToast]           = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [isOpen,          setIsOpen]          = useState<boolean | null>(null)
  const [noticeThreshold, setNoticeThreshold] = useState(3)
  const [waitThresholds,  setWaitThresholds]  = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)
  const [allowRemote,     setAllowRemote]     = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 2500)
  }

  const fetchStoreStatus = useCallback(async () => {
    const { data } = await supabase.from('stores')
      .select('is_open, notice_threshold, wait_thresholds, allow_remote')
      .eq('id', store.id).single()
    if (data) {
      setIsOpen(data.is_open ?? false)
      if (data.notice_threshold != null) setNoticeThreshold(data.notice_threshold)
      if (Array.isArray(data.wait_thresholds) && data.wait_thresholds.length > 0)
        setWaitThresholds(data.wait_thresholds as WaitThreshold[])
      if (data.allow_remote != null) setAllowRemote(data.allow_remote)
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

  useEffect(() => {
    fetchStoreStatus(); fetchQueues()
    const channel = supabase.channel(`admin-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `store_id=eq.${store.id}` },
        payload => {
          if (payload.eventType === 'INSERT')
            setQueues(prev => [...prev, payload.new as Queue].sort((a,b) => a.ticket_number - b.ticket_number))
          else if (payload.eventType === 'UPDATE')
            setQueues(prev => prev.map(q => q.id === payload.new.id ? payload.new as Queue : q))
          fetchQueues()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [store.id, fetchQueues, fetchStoreStatus])

  const handleToggleOpen = async () => {
    if (isOpen === null) return
    const next = !isOpen; setIsOpen(next)
    await supabase.from('stores').update({ is_open: next }).eq('id', store.id)
  }

  const handleAction = async (id: string, status: QueueStatus) => {
    setQueues(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    const { error } = await supabase.from('queues').update({ status }).eq('id', id)
    if (error) { fetchQueues(); showToast('err', '更新失敗: ' + error.message); return }
    const labels: Record<QueueStatus, string> = { calling:'呼出', completed:'完了', cancelled:'不在', waiting:'待機に戻しました' }
    showToast('ok', labels[status])
    if (status === 'calling') {
      const target = queues.find(q => q.id === id)
      if (target?.line_user_id) {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId: target.line_user_id, ticketNumber: target.ticket_number, customerName: target.customer_name, storeName: store.name, storeId: store.id }),
        }).then(async r => { const j = await r.json(); if (!j.ok && !j.skipped) showToast('err', 'LINE通知失敗') }).catch(console.error)
      }
      fetch('/api/notify-threshold', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store.id, calledTicketId: id }),
      }).catch(console.error)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    const { error } = await supabase.from('stores').update({
      notice_threshold: noticeThreshold,
      wait_thresholds:  waitThresholds,
      allow_remote:     allowRemote,
    }).eq('id', store.id)
    setSaving(false)
    showToast(error ? 'err' : 'ok', error ? '保存失敗: ' + error.message : '設定を保存しました')
  }

  const waitingTickets = queues.filter(q => q.status === 'waiting')
  const callingTickets = queues.filter(q => q.status === 'calling')
  const historyTickets = queues.filter(q => q.status === historyTab)
  const remoteCount    = waitingTickets.filter(q => q.is_remote && !q.checked_in).length
  const total          = queues.length
  const completed      = queues.filter(q => q.status === 'completed').length

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-950 border-b border-white/5 px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">{store.name}</h1>
            <p className="text-zinc-500 text-xs">
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchQueues} disabled={refreshing}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-90 transition-all disabled:opacity-50">
              <RefreshCw size={18} className={refreshing ? 'animate-spin text-indigo-400' : 'text-zinc-400'} />
            </button>
            <button onClick={() => setShowSettings(v => !v)}
              className={`p-2 rounded-xl border active:scale-90 transition-all ${showSettings ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>
              <Settings size={18} />
            </button>
            <button onClick={onLogout}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-90 transition-all text-zinc-400 text-xs font-bold px-3">
              切替
            </button>
          </div>
        </div>

        <button onClick={handleToggleOpen} disabled={isOpen === null}
          className={`w-full py-4 rounded-2xl text-base font-black mb-3 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 ${
            isOpen === null  ? 'bg-zinc-700 text-zinc-400' :
            isOpen           ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-900/40 text-white'
                             : 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-900/40 text-white'
          }`}>
          {isOpen === null ? '⏳ 読み込み中...' : isOpen ? '✅ 受付中 — タップして停止' : '🚫 受付停止中 — タップして開始'}
        </button>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '本日合計', value: total,                 color: 'text-white' },
            { label: '待機',     value: waitingTickets.length, color: 'text-blue-400' },
            { label: '呼出中',   value: callingTickets.length, color: 'text-amber-400' },
            { label: '完了',     value: completed,             color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-xl p-2.5 text-center">
              <div className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {remoteCount > 0 && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl">
            <span className="text-zinc-400 text-xs">🏠 遠隔チェックイン待ち:</span>
            <span className="text-white font-black text-sm">{remoteCount}組</span>
            <span className="text-zinc-500 text-xs">（顧客到着後に呼出可）</span>
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
                onNoticeChange={setNoticeThreshold} onThresholdsChange={setWaitThresholds} onRemoteChange={setAllowRemote}
                onSave={handleSaveSettings} saving={saving}
              />
            </div>
          )}

          {/* 待ち ＋ 呼出中 — 2カラム */}
          <div className="flex flex-col md:flex-row gap-4">

            {/* 呼出中: モバイル上、デスクトップ右 */}
            <div className="order-1 md:order-2 md:w-1/2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                  <BellRing size={14} className="text-amber-400 animate-pulse" />
                  <span className="text-amber-300 font-black text-sm">呼出中</span>
                  <span className="bg-amber-400 text-amber-950 text-xs font-black px-1.5 py-0.5 rounded-full">{callingTickets.length}</span>
                </div>
              </div>
              {callingTickets.length === 0 ? (
                <div className="text-center py-10 text-zinc-600 bg-white/3 rounded-2xl border border-white/5">
                  <BellRing size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">呼出中はいません</p>
                </div>
              ) : callingTickets.map(t => <CallingCard key={t.id} ticket={t} onAction={handleAction} />)}
            </div>

            {/* 待ち: モバイル下、デスクトップ左 */}
            <div className="order-2 md:order-1 md:w-1/2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                  <Clock size={14} className="text-blue-400" />
                  <span className="text-blue-300 font-black text-sm">待ち</span>
                  <span className="bg-blue-400 text-blue-950 text-xs font-black px-1.5 py-0.5 rounded-full">{waitingTickets.length}</span>
                </div>
              </div>
              {waitingTickets.length === 0 ? (
                <div className="text-center py-10 text-zinc-600 bg-white/3 rounded-2xl border border-white/5">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">待ちはいません</p>
                </div>
              ) : waitingTickets.map(t => <WaitingCard key={t.id} ticket={t} onAction={handleAction} />)}
            </div>
          </div>

          {/* 履歴 */}
          <div className="bg-white/3 border border-white/5 rounded-2xl overflow-hidden">
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
                : historyTickets.map(t => <HistoryCard key={t.id} ticket={t} onAction={handleAction} />)
              }
            </div>
          </div>

        </div>
      </div>
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
