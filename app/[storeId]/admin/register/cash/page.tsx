'use client'

// ============================================================================
//  レジ管理・現金管理 ハブ
//   レジオープン → 営業中（理論残高・入出金）→ レジ締め（精算）を一元管理。
//   会計(sales) は register 画面でオープン中セッションへ自動紐付けされる。
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, Coins, ArrowDownCircle, ArrowUpCircle,
  Lock, Unlock, History, Wallet, TrendingUp, Plus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { fetchOpenSession, computeSessionSummary } from '@/lib/registerSession'
import {
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, type PaymentMethod,
} from '@/types/sales'
import {
  CASH_IN_REASONS, CASH_OUT_REASONS,
  type RegisterSession, type SessionSummary, type DenominationCounts, type CashMovement,
} from '@/types/register'
import { BottomNav } from '../../_components/BottomNav'
import { DenominationGrid } from '../_components/DenominationGrid'
import { CloseSheet } from '../_components/CloseSheet'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
type StaffRow = { id: string; name: string }

export default function CashManagementPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const { hasFeature, loaded: featLoaded } = useStoreFeatures(storeId)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<RegisterSession | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [screen, setScreen] = useState<'hub' | 'close'>('hub')

  // ── オープンフォーム ──────────────────────────────
  const [openDenoms, setOpenDenoms] = useState<DenominationCounts>({})
  const [openStaffId, setOpenStaffId] = useState('')
  const [opening, setOpening] = useState(false)

  // ── 入出金フォーム ────────────────────────────────
  const [mvDir, setMvDir] = useState<'in' | 'out'>('out')
  const [mvAmount, setMvAmount] = useState('')
  const [mvReason, setMvReason] = useState('')
  const [mvMemo, setMvMemo] = useState('')
  const [mvSaving, setMvSaving] = useState(false)

  const [closing, setClosing] = useState(false)

  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (ok: boolean, text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ ok, text })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  // ── データ取得 ───────────────────────────────────
  const refresh = useCallback(async () => {
    if (!storeId) return
    const db = supabase as any
    const s = await fetchOpenSession(db, storeId)
    setSession(s)
    if (s) setSummary(await computeSessionSummary(db, s))
    else setSummary(null)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const db = supabase as any
      const { data: st } = await db.from('staff').select('id, name')
        .eq('store_id', storeId).eq('active', true).order('sort_order')
      setStaff((st ?? []) as StaffRow[])
      await refresh()
      setLoading(false)
    })()
  }, [storeId, refresh])

  // 会計・入出金の変化をリアルタイム反映
  useEffect(() => {
    if (!storeId) return
    const ch = supabase
      .channel(`cash_${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `store_id=eq.${storeId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'register_cash_movements', filter: `store_id=eq.${storeId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'register_sessions', filter: `store_id=eq.${storeId}` }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, refresh])

  const staffName = (id: string) => staff.find(s => s.id === id)?.name ?? null

  // ── レジオープン ─────────────────────────────────
  const openRegister = async () => {
    setOpening(true)
    try {
      const res = await fetch('/api/register-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          openingDenominations: openDenoms,
          staffId: openStaffId || null,
          staffName: openStaffId ? staffName(openStaffId) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'オープンに失敗しました')
      setOpenDenoms({}); setOpenStaffId('')
      await refresh()
      showToast(true, 'レジをオープンしました')
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : String(e))
    } finally {
      setOpening(false)
    }
  }

  // ── 入出金 ───────────────────────────────────────
  const addMovement = async () => {
    if (!session) return
    const amt = Number(mvAmount)
    if (!(amt > 0)) return showToast(false, '金額を入力してください')
    setMvSaving(true)
    try {
      const res = await fetch('/api/register-session/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, sessionId: session.id, direction: mvDir, amount: amt,
          reason: mvReason || null, memo: mvMemo || null,
          staffId: openStaffId || null, staffName: openStaffId ? staffName(openStaffId) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '記録に失敗しました')
      setMvAmount(''); setMvReason(''); setMvMemo('')
      await refresh()
      showToast(true, mvDir === 'in' ? '入金を記録しました' : '出金を記録しました')
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : String(e))
    } finally {
      setMvSaving(false)
    }
  }

  // ── レジ締め ─────────────────────────────────────
  const confirmClose = async (payload: {
    closingDenominations: DenominationCounts
    cashActual: number
    actuals: Record<PaymentMethod, number>
    note: string
  }) => {
    if (!session) return
    setClosing(true)
    try {
      const res = await fetch('/api/register-session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, sessionId: session.id,
          closingDenominations: payload.closingDenominations,
          cashActual: payload.cashActual,
          actuals: payload.actuals,
          note: payload.note || null,
          staffId: openStaffId || null, staffName: openStaffId ? staffName(openStaffId) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '締めに失敗しました')
      setScreen('hub')
      await refresh()
      showToast(true, 'レジを締めました')
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : String(e))
    } finally {
      setClosing(false)
    }
  }

  // ── 機能ガード ───────────────────────────────────
  if (featLoaded && !hasFeature('pos')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Wallet size={36} className="text-gray-300" />
        <p className="text-gray-500 font-bold">レジ機能は無効です</p>
        <Link href={`/${storeId}/admin`} className="mt-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold">管理画面へ戻る</Link>
      </div>
    )
  }
  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-300" /></div>
  }

  // ── レジ締め画面 ─────────────────────────────────
  if (screen === 'close' && session && summary) {
    return <CloseSheet summary={summary} saving={closing} onBack={() => setScreen('hub')} onConfirm={confirmClose} />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl whitespace-nowrap ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.text}
        </div>
      )}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <Link href={`/${storeId}/admin/register`} className="p-1 -ml-1 text-gray-400"><ChevronLeft size={22} /></Link>
        <Coins size={18} className="text-indigo-500" />
        <h1 className="font-black text-base flex-1 text-gray-900">レジ管理</h1>
        <Link href={`/${storeId}/admin/register/cash/history`} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-bold text-gray-600">
          <History size={14} />履歴
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-3">

          {/* ══════════ 未オープン: レジオープン ══════════ */}
          {!session && (
            <>
              <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                  <Unlock size={26} className="text-indigo-500" />
                </div>
                <p className="font-black text-gray-900">レジは締まっています</p>
                <p className="text-xs text-gray-400 mt-1">釣銭準備金を入力してオープンしてください</p>
              </div>

              {staff.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">担当者</p>
                  <select value={openStaffId} onChange={e => setOpenStaffId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 bg-white">
                    <option value="">未選択</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">釣銭準備金（金種）</p>
                <DenominationGrid value={openDenoms} onChange={setOpenDenoms} />
              </div>

              <button onClick={openRegister} disabled={opening}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/30">
                {opening ? <Loader2 size={22} className="animate-spin" /> : <Unlock size={22} />}
                レジをオープンする
              </button>
            </>
          )}

          {/* ══════════ オープン中 ══════════ */}
          {session && summary && (
            <>
              {/* ステータス */}
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 shadow-lg shadow-indigo-600/20 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />オープン中
                  </span>
                  <span className="text-xs text-indigo-100">{session.session_number}</span>
                  <span className="flex-1" />
                  <Link href={`/${storeId}/admin/register`} className="text-[11px] font-bold bg-white/15 px-2.5 py-1 rounded-lg">会計へ</Link>
                </div>
                <p className="text-xs text-indigo-100">現金 理論残高</p>
                <p className="text-3xl font-black tabular-nums">{yen(summary.cashExpected)}</p>
                <div className="flex gap-4 mt-2 text-[11px] text-indigo-100">
                  <span>釣銭 {yen(session.opening_float)}</span>
                  <span>開始 {new Date(session.opened_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                  {session.opened_by_name && <span>{session.opened_by_name}</span>}
                </div>
              </div>

              {/* 決済種別ごとの売上 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp size={15} className="text-indigo-500" />
                  <p className="text-sm font-black text-gray-800">決済別 売上（{summary.saleCount}件）</p>
                  <span className="flex-1" />
                  <span className="text-sm font-black text-gray-900">{yen(summary.totalSales)}</span>
                </div>
                <div className="space-y-1.5">
                  {PAYMENT_METHODS.map(m => (
                    <div key={m} className="flex items-center gap-2 text-sm">
                      <span className="w-6 text-center">{PAYMENT_METHOD_ICONS[m]}</span>
                      <span className="text-gray-600 flex-1">{PAYMENT_METHOD_LABELS[m]}</span>
                      <span className="font-bold text-gray-900 tabular-nums">{yen(summary.salesByMethod[m] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 入出金 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-black text-gray-800 mb-3">入出金の記録</p>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setMvDir('in')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${mvDir === 'in' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <ArrowDownCircle size={15} />入金・補給
                  </button>
                  <button onClick={() => setMvDir('out')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${mvDir === 'out' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <ArrowUpCircle size={15} />出金・支出
                  </button>
                </div>
                <div className="space-y-2">
                  <input type="number" inputMode="numeric" value={mvAmount} onChange={e => setMvAmount(e.target.value)}
                    placeholder="金額" className="w-full text-right text-xl font-black border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500" />
                  <select value={mvReason} onChange={e => setMvReason(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 bg-white">
                    <option value="">理由を選択</option>
                    {(mvDir === 'in' ? CASH_IN_REASONS : CASH_OUT_REASONS).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input value={mvMemo} onChange={e => setMvMemo(e.target.value)} placeholder="メモ（任意）"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
                  <button onClick={addMovement} disabled={mvSaving}
                    className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98]">
                    {mvSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}記録する
                  </button>
                </div>

                {/* 入出金リスト */}
                {summary.movements.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-400 font-bold">
                      <span>入金計 {yen(summary.cashIn)}</span>
                      <span>出金計 {yen(summary.cashOut)}</span>
                    </div>
                    {summary.movements.slice().reverse().map((mv: CashMovement) => (
                      <div key={mv.id} className="flex items-center gap-2 text-sm py-1">
                        {mv.direction === 'in'
                          ? <ArrowDownCircle size={15} className="text-emerald-500 shrink-0" />
                          : <ArrowUpCircle size={15} className="text-red-500 shrink-0" />}
                        <span className="text-gray-600 truncate flex-1">{mv.reason || (mv.direction === 'in' ? '入金' : '出金')}{mv.memo ? ` / ${mv.memo}` : ''}</span>
                        <span className={`font-bold tabular-nums ${mv.direction === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {mv.direction === 'in' ? '+' : '−'}{yen(mv.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* レジ締め */}
              <button onClick={() => setScreen('close')}
                className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <Lock size={20} />レジを締める（精算）
              </button>
            </>
          )}

        </div>
      </div>

      <BottomNav />
    </div>
  )
}
