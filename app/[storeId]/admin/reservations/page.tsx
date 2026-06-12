'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BottomNav } from '../_components/BottomNav'
import {
  ArrowLeft, Plus, Loader2, X, CalendarDays, Clock,
  User, Phone, GraduationCap, CheckCheck, BellRing,
  ChevronLeft, ChevronRight, AlertCircle, Search, UserX, Ruler,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Customer, Child } from '@/types/crm'
import {
  RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS,
  type Reservation, type ReservationStatus,
} from '@/types/reservations'

// ============================================================
// ユーティリティ
// ============================================================
function todayJst() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function fmtTime(isoStr: string) {
  return new Date(new Date(isoStr).getTime() + 9 * 3600000)
    .toISOString().slice(11, 16)
}
function fmtDateJp(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

// ============================================================
// 型
// ============================================================
type ReservationFull = Reservation & {
  customer: { name: string; kana: string | null; tel: string | null } | null
  child:    { name: string; school_name: string | null; grade: string | null } | null
}

type QueueRef = {
  id: string; ticket_number: number; customer_name: string
  child_name: string | null; school_name: string
  status: string; created_at: string; category: string
}

type TimelineItem =
  | { kind: 'reservation'; sortTime: string; data: ReservationFull }
  | { kind: 'queue';       sortTime: string; data: QueueRef }

// ============================================================
// Toast
// ============================================================
function Toast({ msg, type, onUndo, onClose }: {
  msg: string; type: 'ok' | 'err'; onUndo?: () => Promise<void>; onClose?: () => void
}) {
  const [undoing, setUndoing] = useState(false)
  useEffect(() => {
    if (!onClose) return
    const t = setTimeout(onClose, onUndo ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [onClose, onUndo])
  const handleUndo = async () => {
    if (!onUndo || undoing) return
    setUndoing(true)
    await onUndo()
    onClose?.()
  }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl max-w-xs ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-800 border border-gray-600'
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

// ============================================================
// 予約カード
// ============================================================
function ReservationCard({ res, storeId, onUpdate, onDelete }: {
  res: ReservationFull
  storeId: string
  onUpdate: (id: string, status: ReservationStatus, prevStatus: ReservationStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [loading,        setLoading]        = useState<string | null>(null)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  const act = async (s: ReservationStatus) => {
    setLoading(s); await onUpdate(res.id, s, res.status); setLoading(null)
  }
  const inactive = res.status === 'completed' || res.status === 'cancelled' || res.status === 'no_show'
  // 採寸系の予約か（LINE予約は service_type=uniform/jersey、手動予約は目的に「採寸」）
  const isFitting = (res.purpose ?? '').includes('採寸')
    || ['uniform', 'jersey', 'fitting'].includes(res.service_type ?? '')

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      inactive
        ? 'bg-gray-100 border-gray-200'
        : res.status === 'called'
        ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-200'
        : res.status === 'arrived'
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-3">
        {/* 時刻バッジ */}
        <div className="shrink-0 text-center w-12">
          <p className={`text-xl font-black tabular-nums leading-tight ${
            inactive ? 'text-gray-500'
            : res.status === 'called' ? 'text-amber-600 animate-pulse'
            : res.status === 'arrived' ? 'text-emerald-600'
            : 'text-indigo-600'
          }`}>{fmtTime(res.reserved_at)}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">予約</p>
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              RESERVATION_STATUS_COLORS[res.status]
            }`}>{RESERVATION_STATUS_LABELS[res.status]}</span>
          </div>
          {res.child?.school_name && (
            <p className="text-sm font-black text-amber-600 truncate leading-tight">
              {res.child.school_name}{res.child.grade && ` ${res.child.grade}`}
            </p>
          )}
          <p className={`font-black text-xl leading-tight truncate mt-0.5 ${inactive ? 'text-gray-500' : 'text-gray-900'}`}>
            {res.child?.name ?? res.customer?.name ?? '（顧客未登録）'} 様
          </p>
          {res.child && (
            <p className="text-xs text-gray-500 truncate">
              保護者: {res.customer?.name ?? '（未登録）'}
            </p>
          )}
          {res.customer?.tel && (
            <a href={`tel:${res.customer.tel}`}
              className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
              <Phone size={10} />{res.customer.tel}
            </a>
          )}
          {res.purpose && <p className="text-xs text-gray-600 mt-1">📋 {res.purpose}</p>}
          {res.notes   && <p className="text-xs text-gray-500 mt-0.5 italic">📝 {res.notes}</p>}
        </div>

        {/* 削除ボタン（確定前のみ） */}
        {res.status === 'confirmed' && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-500/10 transition-all shrink-0">
            <X size={13} />
          </button>
        )}
      </div>

      {/* 採寸へ進む（採寸系予約のみ・採寸ページで来店チェックインも実行） */}
      {!inactive && isFitting && (
        <a href={`/${storeId}/admin/fitting?reservationId=${res.id}`}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-teal-600 hover:bg-teal-500 text-white active:scale-95 transition-all">
          <Ruler size={15} />採寸へ進む
        </a>
      )}

      {/* アクションボタン */}
      {!inactive && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {res.status === 'confirmed' && (
            <>
              <button onClick={() => act('arrived')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'arrived' ? <Loader2 size={12} className="animate-spin" /> : '✅ 来店チェックイン'}
              </button>
              <button onClick={() => act('no_show')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-gray-300/80 hover:bg-gray-400 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                <UserX size={12} />無断欠席
              </button>
            </>
          )}
          {res.status === 'arrived' && (
            <>
              <button onClick={() => act('called')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-amber-500/80 hover:bg-amber-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'called' ? <Loader2 size={12} className="animate-spin" /> : <><BellRing size={12} />呼出す</>}
              </button>
              <button onClick={() => act('completed')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-gray-300/80 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                <CheckCheck size={12} />対応完了
              </button>
            </>
          )}
          {res.status === 'called' && (
            <>
              <button onClick={() => act('completed')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'completed' ? <Loader2 size={12} className="animate-spin" /> : <><CheckCheck size={12} />対応完了</>}
              </button>
              <button onClick={() => act('arrived')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-gray-300/80 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                呼出に戻す
              </button>
            </>
          )}
        </div>
      )}

      {/* 完了済みを戻す */}
      {(res.status === 'no_show' || res.status === 'cancelled') && (
        <button onClick={() => act('confirmed')} disabled={!!loading}
          className="mt-3 w-full py-2 rounded-xl font-bold text-xs border border-indigo-300 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400 transition-all flex items-center justify-center gap-1">
          予約確定に戻す
        </button>
      )}

      {/* 削除確認 */}
      {confirmDelete && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-center text-red-700 font-bold">この予約を削除しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-gray-300 text-gray-700 active:scale-95">
              キャンセル
            </button>
            <button onClick={async () => { await onDelete(res.id); setConfirmDelete(false) }} disabled={!!loading}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-red-600 text-white active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
              {loading === 'delete' ? <Loader2 size={12} className="animate-spin" /> : '削除する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 当日ウォークインの参照カード（読み取り専用）
// ============================================================
function QueueRefCard({ q, storeId }: { q: QueueRef; storeId: string }) {
  const statusLabel = {
    waiting: '待機中', calling: '呼出中', completed: '完了', cancelled: '不在',
  }[q.status] ?? q.status
  const statusColor = q.status === 'waiting' ? 'text-blue-600'
    : q.status === 'calling' ? 'text-amber-600'
    : 'text-gray-500'
  return (
    <div className="rounded-2xl border bg-gray-50 border-gray-200 p-4 flex items-center gap-3 opacity-70">
      <div className="shrink-0 text-center w-12">
        <p className="text-xl font-black tabular-nums text-gray-500 leading-tight">
          {fmtTime(q.created_at)}
        </p>
        <p className="text-[9px] text-gray-600 mt-0.5">受付</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-gray-500 font-mono">
            No.{String(q.ticket_number).padStart(3, '0')}
          </span>
          <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
        </div>
        <p className={`font-black text-base truncate ${q.child_name ? 'text-gray-700' : 'text-gray-500'}`}>
          {q.child_name ?? q.customer_name} 様
        </p>
        {q.child_name && <p className="text-xs text-gray-500 truncate">保護者: {q.customer_name}</p>}
      </div>
      <a href={`/${storeId}/admin`}
        className="text-xs text-gray-400 hover:text-gray-600 shrink-0 transition-colors">
        <ChevronRight size={14} />
      </a>
    </div>
  )
}

// ============================================================
// 新規予約フォーム
// ============================================================
function NewReservationForm({ storeId, onSaved, onCancel }: {
  storeId: string; onSaved: () => void; onCancel: () => void
}) {
  const today = todayJst()
  const [reservedDate,     setReservedDate]     = useState(today)
  const [reservedTime,     setReservedTime]     = useState('10:00')
  const [purpose,          setPurpose]          = useState('')
  const [notes,            setNotes]            = useState('')
  const [customerQuery,    setCustomerQuery]    = useState('')
  const [customerResults,  setCustomerResults]  = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [children,         setChildren]         = useState<Child[]>([])
  const [selectedChild,    setSelectedChild]    = useState<Child | null>(null)
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('*')
        .eq('store_id', storeId).is('deleted_at', null)
        .or(`name.ilike.%${customerQuery}%,kana.ilike.%${customerQuery}%,tel.ilike.%${customerQuery}%`)
        .limit(5)
      setCustomerResults(data ?? [])
    }, 300)
  }, [customerQuery, storeId])

  useEffect(() => {
    if (!selectedCustomer) { setChildren([]); setSelectedChild(null); return }
    supabase.from('children').select('*').eq('customer_id', selectedCustomer.id)
      .then(({ data }) => {
        setChildren(data ?? [])
        if (data?.length === 1) setSelectedChild(data[0])
      })
  }, [selectedCustomer])

  const handleSave = async () => {
    setLoading(true); setError(null)
    const reserved_at = `${reservedDate}T${reservedTime}:00+09:00`
    const { error: err } = await (supabase.from('reservations') as any).insert({
      store_id:    storeId,
      customer_id: selectedCustomer?.id ?? null,
      child_id:    selectedChild?.id    ?? null,
      reserved_at,
      purpose:     purpose.trim() || null,
      notes:       notes.trim()   || null,
      status:      'confirmed',
    })
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    onSaved()
  }

  return (
    <div className="bg-white border border-indigo-300 rounded-2xl p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="font-black text-gray-900 text-sm flex items-center gap-2">
          <CalendarDays size={14} className="text-indigo-600" />新規予約登録
        </p>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
      </div>

      {/* 日時 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">日付 <span className="text-red-600">*</span></label>
          <input type="date" value={reservedDate} onChange={e => setReservedDate(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">時刻 <span className="text-red-600">*</span></label>
          <input type="time" value={reservedTime} onChange={e => setReservedTime(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
      </div>

      {/* 顧客検索 */}
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">顧客（任意）</label>
        {selectedCustomer ? (
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2.5">
            <User size={13} className="text-indigo-600 shrink-0" />
            <span className="text-gray-900 text-sm flex-1 font-bold">{selectedCustomer.name}</span>
            <button onClick={() => { setSelectedCustomer(null); setSelectedChild(null); setCustomerQuery('') }}
              className="text-gray-500 hover:text-gray-900"><X size={13} /></button>
          </div>
        ) : (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)}
              placeholder="保護者名・電話番号で検索"
              className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:border-indigo-500 focus:outline-none" />
            {customerResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl overflow-hidden z-10 shadow-xl">
                {customerResults.map(c => (
                  <button key={c.id}
                    onClick={() => { setSelectedCustomer(c); setCustomerQuery(''); setCustomerResults([]) }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-100 border-b border-gray-200 last:border-0 transition-colors">
                    <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                    {c.kana && <p className="text-xs text-gray-500">{c.kana}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* お子様 */}
      {children.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">お子様</label>
          <div className="flex gap-2 flex-wrap">
            {children.map(ch => (
              <button key={ch.id}
                onClick={() => setSelectedChild(prev => prev?.id === ch.id ? null : ch)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  selectedChild?.id === ch.id
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-600 hover:border-gray-400'
                }`}>
                <GraduationCap size={10} className="inline mr-1" />{ch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 来店目的 */}
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">来店目的</label>
        <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)}
          placeholder="例：ブレザー採寸、お直し受取"
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>

      {/* メモ */}
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">メモ</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="スタッフへの申し送り等"
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '予約を登録する'}
      </button>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function ReservationsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()

  const [storeName,    setStoreName]    = useState('')
  const [selectedDate, setSelectedDate] = useState(todayJst())
  const [timeline,     setTimeline]     = useState<TimelineItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string; onUndo?: () => Promise<void> } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => {
    setToast({ type, msg, onUndo })
  }, [])

  useEffect(() => {
    if (!storeId) return
    supabase.from('stores').select('name').eq('id', storeId).single()
      .then(({ data }) => { if (data) setStoreName(data.name ?? '') })
  }, [storeId])

  const fetchTimeline = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const dayStart = `${selectedDate}T00:00:00+09:00`
    const dayEnd   = `${selectedDate}T23:59:59+09:00`

    const [{ data: resData }, { data: queueData }] = await Promise.all([
      (supabase.from('reservations') as any)
        .select('*, customer:customers(name, kana, tel), child:children(name, school_name, grade)')
        .eq('store_id', storeId)
        .gte('reserved_at', dayStart)
        .lte('reserved_at', dayEnd)
        .order('reserved_at'),
      supabase.from('queues').select('*')
        .eq('store_id', storeId)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at'),
    ])

    const items: TimelineItem[] = [
      ...(resData  ?? []).map((r: ReservationFull) => ({ kind: 'reservation' as const, sortTime: r.reserved_at, data: r })),
      ...(queueData ?? []).map((q: QueueRef)        => ({ kind: 'queue'        as const, sortTime: q.created_at,  data: q })),
    ].sort((a, b) => a.sortTime.localeCompare(b.sortTime))

    setTimeline(items)
    setLoading(false)
  }, [storeId, selectedDate])

  useEffect(() => { fetchTimeline() }, [fetchTimeline])

  const handleUpdateStatus = useCallback(async (id: string, status: ReservationStatus, prevStatus: ReservationStatus) => {
    const { error } = await (supabase.from('reservations') as any)
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    fetchTimeline()
    showToast('ok', `${RESERVATION_STATUS_LABELS[status]}にしました`, async () => {
      await (supabase.from('reservations') as any)
        .update({ status: prevStatus, updated_at: new Date().toISOString() }).eq('id', id)
      fetchTimeline()
    })
  }, [fetchTimeline, showToast])

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await (supabase.from('reservations') as any).delete().eq('id', id)
    if (error) { showToast('err', `削除失敗: ${error.message}`); return }
    showToast('ok', '予約を削除しました')
    fetchTimeline()
  }, [fetchTimeline, showToast])

  const today = todayJst()
  const reservations = timeline.filter(t => t.kind === 'reservation').map(t => t.data as ReservationFull)
  const confirmed = reservations.filter(r => r.status === 'confirmed').length
  const active    = reservations.filter(r => r.status === 'arrived' || r.status === 'called').length
  const completed = reservations.filter(r => r.status === 'completed').length

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} onClose={() => setToast(null)} />}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin`)}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-90 transition-all">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-gray-900 text-base">予約管理</h1>
            {storeName && <p className="text-gray-500 text-xs">{storeName}</p>}
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
              showForm
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/40'
            }`}>
            {showForm ? <><X size={14} />閉じる</> : <><Plus size={14} />新規予約</>}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* 新規予約フォーム */}
        {showForm && (
          <NewReservationForm
            storeId={storeId}
            onSaved={() => { setShowForm(false); showToast('ok', '予約を登録しました'); fetchTimeline() }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* 日付ナビゲーター */}
        <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3">
          <button onClick={() => setSelectedDate(d => addDays(d, -1))}
            className="p-1.5 rounded-xl hover:bg-gray-200 active:scale-90 transition-all">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-black text-gray-900 text-base">
              {selectedDate === today ? '今日' : fmtDateJp(selectedDate)}
            </p>
            <p className="text-gray-500 text-xs">{selectedDate}</p>
          </div>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="p-1.5 rounded-xl hover:bg-gray-200 active:scale-90 transition-all">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
          {selectedDate !== today && (
            <button onClick={() => setSelectedDate(today)}
              className="ml-1 px-2.5 py-1.5 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-600 text-xs font-bold active:scale-90 transition-all">
              今日
            </button>
          )}
        </div>

        {/* 統計バー */}
        {reservations.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '予約確定',   value: confirmed, color: 'text-indigo-600' },
              { label: '来店・対応中', value: active,    color: 'text-amber-600' },
              { label: '完了',       value: completed, color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-center">
                <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* タイムライン */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="text-center py-14 text-gray-500">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">この日の予約・受付はありません</p>
            <button onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-600 text-sm font-bold active:scale-95 transition-all">
              予約を追加する
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {timeline.map(item =>
              item.kind === 'reservation' ? (
                <ReservationCard
                  key={item.data.id}
                  res={item.data as ReservationFull}
                  storeId={storeId}
                  onUpdate={handleUpdateStatus}
                  onDelete={handleDelete}
                />
              ) : (
                <QueueRefCard
                  key={item.data.id}
                  q={item.data as QueueRef}
                  storeId={storeId}
                />
              )
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
