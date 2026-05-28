'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, MessageCircle, Loader2, Clock,
  ChevronRight, ChevronDown, ChevronUp, Users, AlertCircle, Plus, GraduationCap, Pencil,
} from 'lucide-react'
import ECShopView from './ECShopView'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, WaitThreshold } from '@/types/database'
import { DEFAULT_THRESHOLDS, getWaitMessage } from '@/types/database'
import type { Customer, Child } from '@/types/crm'
import { GRADE_OPTIONS, SCHOOL_OPTIONS } from '@/types/crm'
import { initLiff, getLineProfile, openAddFriend, isInLineApp, checkFriendshipLiff, type LiffProfile } from '@/lib/liff'
import { useStoreTheme } from '@/lib/theme-context'
import { useKanaAutoFill } from '@/lib/useKanaAutoFill'

const LINE_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BASIC_ID || 'cyx2612b'

type View =
  | 'loading' | 'add_friend' | 'welcome' | 'register' | 'purpose' | 'confirm_queue'
  | 'queue_waiting' | 'queue_calling' | 'queue_completed' | 'queue_cancelled'
  | 'queue_self_cancelled' | 'repair_speak' | 'purchase_speak' | 'purchase_ec' | 'closed'

function toKatakana(s: string) {
  return s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

function playAlertSound() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    ;[0, 0.4, 0.8].forEach(delay => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880; osc.type = 'sine'
      gain.gain.setValueAtTime(0.4, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.3)
    })
  } catch { /* unsupported */ }
}

// ── 初回登録フォーム（保護者 + お子様）──────────────────────
function InitialRegistrationForm({
  lineDisplayName,
  onSubmit,
  submitting,
}: {
  lineDisplayName: string
  onSubmit: (d: { parentName: string; parentKana: string; tel: string; childName: string; childKana: string; schoolName: string; grade: string }) => Promise<void>
  submitting: boolean
}) {
  const theme  = useStoreTheme()
  const parent = useKanaAutoFill(lineDisplayName)
  const child  = useKanaAutoFill('')
  const [tel,        setTel]        = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [grade,      setGrade]      = useState('')
  const [error,      setError]      = useState('')

  const handleSubmit = async () => {
    if (!parent.name.trim()) { setError('保護者のお名前を入力してください'); return }
    if (!child.name.trim())  { setError('お子様のお名前を入力してください'); return }
    setError('')
    await onSubmit({
      parentName: parent.name.trim(), parentKana: parent.kana.trim(),
      tel: tel.trim(), childName: child.name.trim(), childKana: child.kana.trim(),
      schoolName: schoolName.trim(), grade,
    })
  }

  const base  = 'w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50/80 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '')

  return (
    <div className="space-y-5">
      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider pt-1">保護者情報</div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">お名前 <span className="text-red-500">*</span></label>
        <input type="text" {...parent.nameProps} placeholder="例：山田 太郎" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">フリガナ</label>
        <input type="text" {...parent.kanaProps} placeholder="ヤマダ タロウ" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">電話番号</label>
        <input type="tel" inputMode="tel" value={tel} placeholder="例：090-1234-5678" className={base}
          onChange={e => setTel(e.target.value)} onFocus={focus} onBlur={blur} />
      </div>

      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider pt-2 border-t border-zinc-100">お子様情報</div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">お名前 <span className="text-red-500">*</span></label>
        <input type="text" {...child.nameProps} placeholder="例：山田 花子" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">フリガナ</label>
        <input type="text" {...child.kanaProps} placeholder="ヤマダ ハナコ" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">学校名</label>
          <select value={schoolName} onChange={e => setSchoolName(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
            <option value="">選択してください</option>
            {SCHOOL_OPTIONS.map(s => <option key={s} value={s === 'その他' ? '' : s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">学年</label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={submitting || !parent.name.trim() || !child.name.trim()}
        className="w-full text-white text-base font-black py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
          boxShadow:  `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.45)`,
        }}>
        {submitting ? <><Loader2 size={18} className="animate-spin" />登録中...</> : '登録して進む'}
      </button>
    </div>
  )
}

// ── お子様追加フォーム ──────────────────────────────────────
function AddChildForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (d: { childName: string; childKana: string; schoolName: string; grade: string }) => Promise<void>
  onCancel: () => void
  submitting: boolean
}) {
  const theme = useStoreTheme()
  const child = useKanaAutoFill('')
  const [schoolName, setSchoolName] = useState('')
  const [grade,      setGrade]      = useState('')
  const [error,      setError]      = useState('')

  const handleSubmit = async () => {
    if (!child.name.trim()) { setError('お名前を入力してください'); return }
    setError('')
    await onSubmit({ childName: child.name.trim(), childKana: child.kana.trim(), schoolName: schoolName.trim(), grade })
  }

  const base  = 'w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50/80 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '')

  return (
    <div className="space-y-3 pt-3 border-t border-zinc-100 mt-3">
      <p className="text-xs font-bold" style={{ color: theme.colors.primary }}>新しいお子様の情報</p>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">お名前 <span className="text-red-500">*</span></label>
        <input type="text" {...child.nameProps} placeholder="例：山田 次郎" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">フリガナ</label>
        <input type="text" {...child.kanaProps} placeholder="ヤマダ ジロウ" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">学校名</label>
          <select value={schoolName} onChange={e => setSchoolName(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
            <option value="">選択してください</option>
            {SCHOOL_OPTIONS.map(s => <option key={s} value={s === 'その他' ? '' : s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">学年</label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-500 font-bold text-sm active:scale-95 transition-transform">
          キャンセル
        </button>
        <button onClick={handleSubmit} disabled={submitting || !child.name.trim()}
          className="flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : '追加する'}
        </button>
      </div>
    </div>
  )
}

// ── 待ち時間中の顧客情報編集フォーム ──────────────────────
function WaitingCustomerEditForm({
  customer, onSaved, onClose,
}: {
  customer: Customer
  onSaved: (c: Customer) => void
  onClose: () => void
}) {
  const theme = useStoreTheme()
  const [name, setName] = useState(customer.name)
  const [tel,  setTel]  = useState(customer.tel ?? '')
  const [saving, setSaving] = useState(false)

  const base = 'w-full text-sm text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('customers') as any)
      .update({ name: name.trim(), tel: tel.trim() || null })
      .eq('id', customer.id).select().single()
    setSaving(false)
    if (!error && data) onSaved(data as Customer)
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
      <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>保護者情報の変更</p>
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="お名前" className={base} />
      <input type="tel" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="電話番号" className={base} />
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-sm font-bold active:scale-95 transition-transform">キャンセル</button>
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}

// ── メインコンポーネント ────────────────────────────────────
export default function CustomerPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const theme = useStoreTheme()

  const [view,           setView]           = useState<View>('loading')
  const [lineProfile,    setLineProfile]    = useState<LiffProfile | null>(null)
  const [customer,       setCustomer]       = useState<Customer | null>(null)
  const [children,       setChildren]       = useState<Child[]>([])
  const [selectedChild,  setSelectedChild]  = useState<Child | null>(null)
  const [showAddChild,   setShowAddChild]   = useState(false)
  const [ticket,         setTicket]         = useState<Queue | null>(null)
  const [waitingAhead,   setWaitingAhead]   = useState(0)
  const [waitingCount,   setWaitingCount]   = useState<number | null>(null)
  const [waitThresholds,    setWaitThresholds]    = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)
  const notificationPlanRef = useRef<'calling_only' | 'full'>('calling_only')
  const [submitting,     setSubmitting]     = useState(false)
  const [issuing,        setIssuing]        = useState(false)
  const [repairLoading,  setRepairLoading]  = useState(false)
  const [friendChecking, setFriendChecking] = useState(false)
  const [urlAction,      setUrlAction]      = useState<'queue' | 'repair' | 'purchase' | null>(null)
  const [pendingAction,  setPendingAction]  = useState<'queue' | null>(null)
  const [cancelModal,    setCancelModal]    = useState(false)
  const [cancelLoading,  setCancelLoading]  = useState(false)
  const [registerError,    setRegisterError]    = useState('')
  const [friendNotYet,     setFriendNotYet]     = useState(false)
  const [showQueueRegister, setShowQueueRegister] = useState(false)
  const [queueRegDone,      setQueueRegDone]      = useState(false)
  const [regExpanded,       setRegExpanded]        = useState(true)
  const [showWaitingEdit,   setShowWaitingEdit]   = useState(false)
  const [waitingEditMode,   setWaitingEditMode]   = useState<'child' | 'info' | null>(null)
  const [detailHeight,  setDetailHeight]  = useState('')
  const [detailWeight,  setDetailWeight]  = useState('')
  const [detailNote,    setDetailNote]    = useState('')
  const [detailSaving,  setDetailSaving]  = useState(false)
  const [detailSaved,   setDetailSaved]   = useState(false)
  const [activeFittings, setActiveFittings] = useState(1)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const ticketRef  = useRef<Queue | null>(null)
  const ticketKey  = `queue_ticket_id_${storeId}`
  const dateKey    = `queue_ticket_date_${storeId}`

  const cardStyle: React.CSSProperties = {
    boxShadow: `0 24px 60px -20px rgb(${theme.colors.primaryRgb} / 0.22), 0 1px 0 0 rgb(255 255 255 / 0.65) inset`,
  }

  // ── 初期化 ────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    ;(async () => { try {
      const { data: sd } = await (supabase.from('stores') as any)
        .select('is_open, wait_thresholds, notification_plan, active_fittings').eq('id', storeId).single()
      if (sd && Array.isArray(sd.wait_thresholds) && sd.wait_thresholds.length > 0)
        setWaitThresholds(sd.wait_thresholds as WaitThreshold[])
      if (sd?.notification_plan) notificationPlanRef.current = sd.notification_plan
      if (sd?.active_fittings != null) setActiveFittings(sd.active_fittings)

      await initLiff()
      const profile = await getLineProfile()
      if (profile) setLineProfile(profile)

      // 本日チケット復元
      const savedId   = localStorage.getItem(ticketKey)
      const savedDate = localStorage.getItem(dateKey)
      if (savedId && savedDate === new Date().toDateString()) {
        const { data: t } = await supabase.from('queues').select('*').eq('id', savedId).single()
        if (t) {
          setTicket(t)
          setView(
            t.status === 'calling'   ? 'queue_calling'
            : t.status === 'completed' ? 'queue_completed'
            : t.status === 'cancelled' ? 'queue_cancelled'
            : 'queue_waiting'
          )
          // チケット復元時も既存顧客を読み込む（二重登録防止）
          if (profile?.userId) {
            try {
              const { data: custRows } = await supabase.from('customers')
                .select('*').eq('store_id', storeId).eq('line_user_id', profile.userId)
                .order('created_at', { ascending: false }).limit(1)
              const cust = custRows?.[0] && !custRows[0].deleted_at ? custRows[0] : null
              if (cust) {
                setCustomer(cust)
                const { data: childList } = await supabase.from('children')
                  .select('*').eq('customer_id', cust.id).order('created_at', { ascending: true })
                const kids = childList ?? []
                setChildren(kids)
                if (kids.length === 1) setSelectedChild(kids[0])
              }
            } catch { /* 顧客情報が取れなくても続行 */ }
          }
          return
        }
      }

      // URLアクションパラメータを先に読み取る（profileチェックより前に必要）
      const urlParams = new URLSearchParams(window.location.search)
      const action = urlParams.get('action') as 'queue' | 'repair' | 'purchase' | null
      if (action) setUrlAction(action)

      // LINEアプリ外または未ログインは友達追加画面へ
      // ※ profileが取れなくてもLINE内ブラウザなら先に進む（リダイレクトループ防止）
      if (!isInLineApp()) { setView('add_friend'); return }
      if (!profile) {
        // LINE内ブラウザだがLIFF未認証（直URLアクセス等）
        // action=queue の場合は待ち人数を取得してから confirm_queue へ直接遷移
        if (action === 'queue') {
          try {
            const { count } = await supabase.from('queues')
              .select('*', { count: 'exact', head: true })
              .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
            setWaitingCount(count ?? 0)
          } catch { /* 取得失敗は無視 */ }
          setView('confirm_queue')
        } else {
          setView('purpose')
        }
        return
      }

      // 友達チェック（LIFF Friendship API優先、失敗時はbot API、両方失敗は通す）
      try {
        const liffFriend = await checkFriendshipLiff()
        if (liffFriend === false) {
          // LIFF APIで明確に「未追加」と確認できた場合のみ add_friend へ
          setView('add_friend'); return
        } else if (liffFriend === null) {
          // LIFF外など確認できない場合はbot APIにフォールバック
          try {
            const friendRes = await fetch(`/api/check-friend?userId=${profile.userId}`)
            const { friend } = await friendRes.json()
            if (friend === false) { setView('add_friend'); return }
          } catch { /* API失敗時は通す */ }
        }
        // liffFriend === true → 友達確認済み、続行
      } catch { /* チェック失敗時は通す（ブロックしない） */ }

      // 既存顧客チェック
      let cust: Customer | null = null
      try {
        const { data: custRows } = await supabase.from('customers')
          .select('*').eq('store_id', storeId).eq('line_user_id', profile.userId)
          .order('created_at', { ascending: false }).limit(1)
        cust = custRows?.[0] && !custRows[0].deleted_at ? custRows[0] : null
        if (cust) {
          setCustomer(cust)
          const { data: childList } = await supabase.from('children')
            .select('*').eq('customer_id', cust.id).order('created_at', { ascending: true })
          const kids = childList ?? []
          setChildren(kids)
          if (kids.length === 1) setSelectedChild(kids[0])
        }
      } catch { /* 顧客情報が取れなくても続行 */ }

      if (sd && !sd.is_open) { setView('closed'); return }
      const { count } = await supabase.from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
      setWaitingCount(count ?? 0)
      if (action === 'repair')   { setView('repair_speak');   return }
      if (action === 'purchase') { setView('purchase_ec');    return }
      if (action === 'queue') {
        setView('confirm_queue'); return
      }
      setView('purpose')
    } catch (e) {
      console.error('[init] error:', e)
      // initエラー時はメニューを表示（add_friendループ防止）
      setView('purpose')
    } })()
  }, [storeId, ticketKey, dateKey])

  // ── チケット購読 ──────────────────────────────────────
  const fetchWaitingAhead = useCallback(async (t: Queue) => {
    const { count } = await supabase.from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId).in('status', ['waiting', 'calling'])
      .lt('ticket_number', t.ticket_number).gte('created_at', getTodayStart())
    setWaitingAhead(count ?? 0)
  }, [storeId])

  useEffect(() => { ticketRef.current = ticket }, [ticket])

  // チケット復元時に既存detailsをフォームに反映
  useEffect(() => {
    if (!ticket?.details) return
    const d = ticket.details as Record<string, string>
    setDetailHeight(d.height ?? '')
    setDetailWeight(d.weight ?? '')
    setDetailNote(d.note ?? '')
    if (d.height || d.weight || d.note) setDetailSaved(true)
  }, [ticket?.id])

  useEffect(() => {
    if (!ticket || !['queue_waiting', 'queue_calling'].includes(view)) return
    fetchWaitingAhead(ticket)
    const pollId = setInterval(() => {
      if (ticketRef.current) fetchWaitingAhead(ticketRef.current)
    }, 15000)
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase.channel(`ticket-${ticket.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queues', filter: `id=eq.${ticket.id}` },
        payload => {
          const updated = payload.new as Queue
          setTicket(updated)
          if (updated.status === 'calling') {
            setView('queue_calling')
            playAlertSound()
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300])
          }
          if (updated.status === 'completed') setView('queue_completed')
          if (updated.status === 'cancelled') setView('queue_cancelled')
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `store_id=eq.${storeId}` },
        () => { if (ticketRef.current) fetchWaitingAhead(ticketRef.current) })
      .subscribe()
    channelRef.current = ch
    return () => { clearInterval(pollId); supabase.removeChannel(ch) }
  }, [ticket?.id, view, storeId, fetchWaitingAhead])

  // ── 友達追加後・再チェックして目的選択へ ────────────
  const handleFriendProceed = async () => {
    if (!lineProfile?.userId) return
    setFriendChecking(true)
    try {
      // 友達追加されたか再確認
      const friendRes = await fetch(`/api/check-friend?userId=${lineProfile.userId}`)
      const { friend } = await friendRes.json()
      if (!friend) {
        setFriendNotYet(true)
        setFriendChecking(false)
        return
      }
      setFriendNotYet(false)

      // 顧客情報を取得（任意）
      try {
        const { data: custRows } = await supabase.from('customers')
          .select('*').eq('store_id', storeId).eq('line_user_id', lineProfile.userId)
          .order('created_at', { ascending: false }).limit(1)
        const cust = custRows?.[0] && !custRows[0].deleted_at ? custRows[0] : null
        if (cust) {
          setCustomer(cust)
          const { data: childList } = await supabase.from('children')
            .select('*').eq('customer_id', cust.id).order('created_at', { ascending: true })
          const kids = childList ?? []
          setChildren(kids)
          if (kids.length === 1) setSelectedChild(kids[0])
        }
      } catch { /* 顧客情報は任意 */ }

      const { data: sd } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
      if (sd?.is_open === false) { setView('closed'); return }
      const { count } = await supabase.from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).in('status', ['waiting', 'calling'])
        .gte('created_at', getTodayStart())
      setWaitingCount(count ?? 0)
      setView('purpose')
    } catch (e) {
      console.error('[friendProceed]', e)
    } finally {
      setFriendChecking(false)
    }
  }

  // ── 初回登録（保護者 + お子様）────────────────────────
  const handleInitialRegister = async (d: {
    parentName: string; parentKana: string; tel: string
    childName: string; childKana: string; schoolName: string; grade: string
  }) => {
    // LIFFプロフィールを確保（初期化時に取れなかった場合は再取得）
    let userId = lineProfile?.userId
    if (!userId) {
      const freshProfile = await getLineProfile()
      if (freshProfile) {
        setLineProfile(freshProfile)
        userId = freshProfile.userId
      }
    }
    if (!userId) {
      setRegisterError('LINE認証に失敗しました。LINEアプリから開き直してください。')
      return
    }
    setSubmitting(true)
    setRegisterError('')
    try {
      const { data: existingRows } = await supabase.from('customers')
        .select('*').eq('store_id', storeId).eq('line_user_id', userId)
        .order('created_at', { ascending: false }).limit(1)
      const existing = existingRows?.[0] && !existingRows[0].deleted_at ? existingRows[0] : null

      let cust
      if (existing) {
        const { data: updated, error: updateErr } = await supabase.from('customers').update({
          name: d.parentName, kana: d.parentKana || null, tel: d.tel || null, deleted_at: null,
        }).eq('id', existing.id).select().single()
        if (updateErr) throw new Error(updateErr.message)
        cust = updated ?? existing
      } else {
        const { data: newCust, error: insertErr } = await supabase.from('customers').insert({
          store_id: storeId, line_user_id: userId,
          name: d.parentName, kana: d.parentKana || null, tel: d.tel || null,
        }).select().single()
        if (insertErr) throw new Error(insertErr.message)
        cust = newCust
      }
      if (!cust) throw new Error('登録に失敗しました（不明なエラー）')
      setCustomer(cust)

      const { data: newChild, error: childErr } = await supabase.from('children').insert({
        customer_id: cust.id, store_id: storeId,
        name: d.childName, kana: d.childKana || null,
        school_name: d.schoolName || null, grade: d.grade || null,
      }).select().single()
      if (childErr) throw new Error(childErr.message)

      const updatedChildren = [...children, ...(newChild ? [newChild] : [])]
      setChildren(updatedChildren)
      if (newChild) setSelectedChild(newChild)

      const { data: sd } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
      if (sd?.is_open === false) { setView('closed'); return }

      // 順番待ち登録から来た場合は待ち人数確認画面へ
      if (pendingAction === 'queue') {
        setPendingAction(null)
        const { count: qCount } = await supabase.from('queues')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
        setWaitingCount(qCount ?? 0)
        setSubmitting(false)
        setView('confirm_queue')
        return
      }

      // 既に待ち画面にいる場合（待ちながら登録）は画面移動しない
      if (ticketRef.current) {
        setQueueRegDone(true)
        return
      }

      const { count } = await supabase.from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
      setWaitingCount(count ?? 0)
      if (urlAction === 'repair')   { setView('repair_speak'); return }
      if (urlAction === 'purchase') { setView('purchase_ec');  return }
      setView('purpose')
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  // ── お子様追加 ────────────────────────────────────────
  const handleAddChild = async (d: { childName: string; childKana: string; schoolName: string; grade: string }) => {
    if (!customer) return
    setSubmitting(true)
    try {
      const { data: newChild } = await supabase.from('children').insert({
        customer_id: customer.id, store_id: storeId,
        name: d.childName, kana: d.childKana || null,
        school_name: d.schoolName || null, grade: d.grade || null,
      }).select().single()
      if (newChild) {
        setChildren(prev => [...prev, newChild])
        setSelectedChild(newChild)
        setShowAddChild(false)
        setShowWaitingEdit(false)
        setWaitingEditMode(null)
        if (ticketRef.current) return   // 待ち中なら画面移動しない
        const { data: sd } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
        const { count } = await supabase.from('queues')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
        setWaitingCount(count ?? 0)
        setView(sd?.is_open === false ? 'closed' : 'purpose')
      }
    } catch (e) { console.error(e) }
    setSubmitting(false)
  }

  // ── 整理券発行（パターンA）────────────────────────────
  const handleIssueTicket = async () => {
    if (issuing) return
    setIssuing(true)
    try {
      const { data: nextNum } = await supabase.rpc('get_next_ticket_number', { p_store_id: storeId })
      const { data: t, error } = await supabase.from('queues').insert({
        store_id:      storeId,
        ticket_number: nextNum as number,
        status:        'waiting',
        customer_name: customer?.name ?? lineProfile?.displayName ?? '未登録',
        child_name:    selectedChild?.name ?? null,
        school_name:   selectedChild?.school_name ?? null,
        category:      'other',
        gender:        'other',
        line_user_id:  lineProfile?.userId ?? null,
        checked_in:    true,
        customer_id:   customer?.id ?? null,
        child_id:      selectedChild?.id ?? null,
      }).select().single()
      if (error || !t) throw error
      localStorage.setItem(ticketKey, t.id)
      localStorage.setItem(dateKey, new Date().toDateString())
      setTicket(t)
      if (t.line_user_id && notificationPlanRef.current === 'full') {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUserId: t.line_user_id, ticketNumber: t.ticket_number,
            customerName: t.customer_name, storeId, type: 'registered',
          }),
        }).catch(console.error)
      }
      // 管理者デバイスへブラウザプッシュ通知
      fetch('/api/push-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          type:  'queue_new',
          title: `🔔 新規受付 No.${String(t.ticket_number).padStart(3, '0')}`,
          body:  `${t.customer_name} 様が受付しました`,
          url:   `/${storeId}/admin`,
        }),
      }).catch(console.error)
      setView('queue_waiting')

      // queue_waiting 移行時に customer が未設定なら再検索（初期ロード失敗のリトライ）
      if (!customer && lineProfile?.userId) {
        try {
          const { data: rows } = await supabase.from('customers')
            .select('*').eq('store_id', storeId).eq('line_user_id', lineProfile.userId)
            .order('created_at', { ascending: false }).limit(1)
          const found = rows?.[0] && !(rows[0] as Customer).deleted_at ? rows[0] as Customer : null
          if (found) {
            setCustomer(found)
            const { data: childList } = await supabase.from('children')
              .select('*').eq('customer_id', found.id).order('created_at', { ascending: true })
            const kids = (childList ?? []) as Child[]
            setChildren(kids)
            if (kids.length === 1) setSelectedChild(kids[0])
          }
        } catch { /* 取得失敗は無視 */ }
      }
    } catch (e) { console.error(e) }
    setIssuing(false)
  }

  // ── お直し選択（パターンB）────────────────────────────
  const handleRepairSelect = async () => {
    setRepairLoading(true)
    // 顧客は登録済みのはず（welcome/register経由）
    setRepairLoading(false)
    setView('repair_speak')
  }

  // ── 伝達事項保存 ──────────────────────────────────────
  const handleSaveDetails = async () => {
    if (!ticket) return
    setDetailSaving(true)
    const details: Record<string, string> = {}
    if (detailHeight.trim()) details.height = detailHeight.trim()
    if (detailWeight.trim()) details.weight = detailWeight.trim()
    if (detailNote.trim())   details.note   = detailNote.trim()
    await supabase.from('queues').update({ details }).eq('id', ticket.id)
    setDetailSaving(false)
    setDetailSaved(true)
  }

  // ── キャンセル ────────────────────────────────────────
  const handleCancel = async () => {
    if (!ticketRef.current) return
    setCancelLoading(true)
    await supabase.from('queues').update({ status: 'cancelled' }).eq('id', ticketRef.current.id)
    localStorage.removeItem(ticketKey); localStorage.removeItem(dateKey)
    setCancelModal(false); setCancelLoading(false)
    setView('queue_self_cancelled')
  }

  const handleReset = async () => {
    localStorage.removeItem(ticketKey); localStorage.removeItem(dateKey)
    setTicket(null); setWaitingAhead(0); setIssuing(false); setSelectedChild(null)
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const { data: sd } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
    if (sd && !sd.is_open) { setView('closed'); return }
    const { count } = await supabase.from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
    setWaitingCount(count ?? 0)
    setView('purpose')
  }

  // ══════════════════════════════════════════════════════════
  // ビュー
  // ══════════════════════════════════════════════════════════

  if (view === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderTopColor: theme.colors.primary }} />
        <p className="text-sm text-zinc-500">読み込み中…</p>
      </div>
    </div>
  )

  // ── ステップ1：友だち追加 ─────────────────────────────
  if (view === 'add_friend') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 gap-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 16px 40px -12px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          <MessageCircle size={32} className="text-white" />
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black mb-3 text-zinc-900">友だち追加のお願い</h1>
        <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">
          お呼び出しや完了通知をLINEで確実に受け取るために友だち追加をお願いします
        </p>
      </div>
      <div className="bg-white/75 backdrop-blur-2xl rounded-3xl p-6 w-full max-w-sm border border-white/60 space-y-3" style={cardStyle}>
        <button onClick={() => openAddFriend(LINE_BASIC_ID)}
          className="w-full bg-[#06C755] text-white text-base font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200">
          <MessageCircle size={20} />LINEで友だち追加する
        </button>
        <button onClick={handleFriendProceed} disabled={friendChecking}
          className="w-full py-3.5 rounded-2xl border-2 border-zinc-200 text-zinc-600 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
          {friendChecking
            ? <><Loader2 size={14} className="animate-spin" />確認中...</>
            : '追加しました → メニューへ'}
        </button>
        {friendNotYet && (
          <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-xl px-3 py-2">
            <AlertCircle size={13} className="shrink-0" />
            まだ友だち追加が確認できません。上のボタンから追加してください。
          </div>
        )}
      </div>
    </main>
  )

  // ── ウェルカム：既存顧客・子供選択 ───────────────────
  if (view === 'welcome') return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          {theme.logoEmoji}
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">
          ようこそ、{customer?.name ?? ''} 様
        </h1>
        <p className="text-zinc-500 text-sm mt-1">ご来店のお子様をお選びください</p>
      </div>

      <div className="space-y-3">
        {children.map(child => (
          <button key={child.id}
            onClick={async () => {
              setSelectedChild(child)
              const { data: sd } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
              if (sd && !sd.is_open) { setView('closed'); return }
              const { count } = await supabase.from('queues')
                .select('*', { count: 'exact', head: true })
                .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
              setWaitingCount(count ?? 0)
              if (urlAction === 'repair')   { setView('repair_speak'); return }
              if (urlAction === 'purchase') { setView('purchase_ec');  return }
              setView('purpose')
            }}
            className="w-full bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 p-4 text-left active:scale-[0.98] transition-all"
            style={cardStyle}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
                <GraduationCap size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-zinc-900 text-base">{child.name}</p>
                <p className="text-zinc-500 text-sm mt-0.5">
                  {[child.school_name, child.grade].filter(Boolean).join(' · ') || 'お子様'}
                </p>
              </div>
              <ChevronRight size={18} className="text-zinc-300 shrink-0" />
            </div>
          </button>
        ))}

        {showAddChild ? (
          <div className="bg-white/75 backdrop-blur-2xl rounded-2xl border border-white/60 p-5" style={cardStyle}>
            <AddChildForm
              onSubmit={handleAddChild}
              onCancel={() => setShowAddChild(false)}
              submitting={submitting}
            />
          </div>
        ) : (
          <button onClick={() => setShowAddChild(true)}
            className="w-full py-4 rounded-2xl border-2 border-dashed text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={{ borderColor: `rgb(${theme.colors.primaryRgb} / 0.3)`, color: theme.colors.primary }}>
            <Plus size={16} />新しいお子様を追加
          </button>
        )}
      </div>
    </main>
  )

  // ── 初回登録 ─────────────────────────────────────────
  if (view === 'register') return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          {theme.logoEmoji}
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">お客様情報の登録</h1>
        <p className="text-zinc-500 text-xs mt-1">初回のみご入力ください。次回は自動で認識します</p>
      </div>
      <div className="bg-white/75 backdrop-blur-2xl rounded-3xl border border-white/60 p-5" style={cardStyle}>
        {registerError && (
          <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2 mb-4">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">登録エラー</p>
              <p className="mt-0.5">{registerError}</p>
            </div>
          </div>
        )}
        <InitialRegistrationForm
          lineDisplayName={lineProfile?.displayName ?? ''}
          onSubmit={handleInitialRegister}
          submitting={submitting}
        />
      </div>
    </main>
  )

  // ── 目的選択 ─────────────────────────────────────────
  if (view === 'purpose') return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          {theme.logoEmoji}
        </div>
        {selectedChild && (
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold mb-2"
            style={{ background: `rgb(${theme.colors.primaryRgb} / 0.1)`, color: theme.colors.primary }}>
            <GraduationCap size={14} />{selectedChild.name}
            {selectedChild.grade && ` · ${selectedChild.grade}`}
          </div>
        )}
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">本日のご用件は？</h1>
        <p className="text-zinc-500 text-sm mt-1">タップして選択してください</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={async () => {
            if (waitingCount === null) {
              try {
                const { count } = await supabase.from('queues')
                  .select('*', { count: 'exact', head: true })
                  .eq('store_id', storeId).in('status', ['waiting', 'calling']).gte('created_at', getTodayStart())
                setWaitingCount(count ?? 0)
              } catch { /* 取得失敗は無視 */ }
            }
            setView('confirm_queue')
          }}
          disabled={issuing}
          className="w-full bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 p-6 text-left active:scale-[0.98] transition-all disabled:opacity-80"
          style={cardStyle}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
              📋
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-900 text-lg leading-tight">採寸・ご購入</p>
              <p className="text-zinc-500 text-sm mt-0.5">順番待ちに並ぶ</p>
              {waitingCount !== null && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
                  style={{ background: `rgb(${theme.colors.primaryRgb} / 0.1)`, color: theme.colors.primary }}>
                  <Users size={13} />現在 {waitingCount}組 待ち
                </div>
              )}
            </div>
            <div className="pt-1 shrink-0">
              {issuing ? <Loader2 size={20} className="animate-spin text-zinc-400" /> : <ChevronRight size={20} className="text-zinc-300" />}
            </div>
          </div>
          <div className="mt-4 py-2 rounded-xl text-center text-xs font-bold"
            style={{ background: `rgb(${theme.colors.primaryRgb} / 0.08)`, color: theme.colors.primary }}>
            タップした瞬間、整理券を発行します
          </div>
        </button>

        <button onClick={() => setView('repair_speak')}
          className="w-full bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 p-6 text-left active:scale-[0.98] transition-all"
          style={cardStyle}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
              ✂️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-900 text-lg leading-tight">お直しの受付・ご相談</p>
              <p className="text-zinc-500 text-sm mt-0.5">制服のお持ち込みはこちら</p>
            </div>
            <div className="pt-1 shrink-0">
              <ChevronRight size={20} className="text-zinc-300" />
            </div>
          </div>
        </button>

        <button onClick={() => setView('purchase_ec')}
          className="w-full bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 p-6 text-left active:scale-[0.98] transition-all"
          style={cardStyle}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
              🛍️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-900 text-lg leading-tight">お家でかんたんネット注文</p>
              <p className="text-zinc-500 text-sm mt-0.5">在庫確認・取り置き</p>
            </div>
            <div className="pt-1 shrink-0">
              <ChevronRight size={20} className="text-zinc-300" />
            </div>
          </div>
        </button>

        {customer && (
          <button onClick={() => setView('welcome')}
            className="w-full py-3 text-zinc-400 text-sm text-center active:opacity-60 transition-opacity">
            ← お子様を選び直す
          </button>
        )}
      </div>
    </main>
  )

  // ── 整理券発行確認（リッチメニュー左ボタン経由）──────
  if (view === 'confirm_queue') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 max-w-md mx-auto gap-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-3xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
            boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          📋
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900 mb-1">採寸・ご購入</h1>
        <p className="text-zinc-500 text-sm">順番待ちリストに追加します</p>
      </div>

      <div className="bg-white/75 backdrop-blur-2xl rounded-3xl p-6 w-full border border-white/60 text-center" style={cardStyle}>
        {waitingCount !== null && (
          <div className="mb-4">
            <p className="text-zinc-400 text-xs font-bold mb-1">現在の待ち人数</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-6xl font-black" style={{ color: theme.colors.primary }}>{waitingCount}</span>
              <span className="text-lg font-bold text-zinc-500">組</span>
            </div>
          </div>
        )}
        <button onClick={handleIssueTicket} disabled={issuing}
          className="w-full py-5 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
            boxShadow: `0 8px 24px -6px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          {issuing ? <><Loader2 size={20} className="animate-spin" />発行中...</> : '今すぐ並ぶ →'}
        </button>
      </div>

      <button onClick={() => setView('purpose')} className="text-zinc-400 text-sm underline active:opacity-60">
        ← やめる
      </button>
    </main>
  )

  // ── 順番待ち ─────────────────────────────────────────
  if (view === 'queue_waiting' && ticket) {
    const waitMsg = getWaitMessage(waitingAhead, waitThresholds.length > 0 ? waitThresholds : DEFAULT_THRESHOLDS)
    const [pr, pg, pb] = theme.colors.primaryRgb.split(' ').map(Number)
    const isLightBg = (0.299 * pr + 0.587 * pg + 0.114 * pb) > 140
    const ct = isLightBg
      ? { text: 'text-gray-900', muted: 'text-gray-700', faint: 'text-gray-500',
          card: 'bg-white/90 border-white/70 shadow-md',
          innerCard: 'bg-gray-100/80 border-gray-300/60',
          pill: 'bg-white/80 border-white/60 text-gray-700',
          lineNotif: 'bg-green-50 border-green-300 text-green-800',
          noLine: 'bg-gray-100/80 border-gray-300/60 text-gray-700', bottom: 'text-gray-600' }
      : { text: 'text-white', muted: 'text-white/70', faint: 'text-white/60',
          card: 'bg-white/10 border-white/20',
          innerCard: 'bg-white/10 border-white/15',
          pill: 'bg-white/15 border-white/20 text-white',
          lineNotif: 'bg-emerald-400/20 border-emerald-400/30 text-emerald-300',
          noLine: 'bg-white/15 border-white/20 text-white/70', bottom: 'text-white/40' }
    return (
      <div className="min-h-screen">
        <div style={{ background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)` }}
          className="px-5 pt-8 pb-12">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-4">
              <div className={`inline-flex items-center gap-2 backdrop-blur-sm border rounded-full px-4 py-1.5 text-xs font-medium ${ct.pill}`}>
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />リアルタイム更新中
              </div>
            </div>
            <div className={`backdrop-blur-xl border rounded-3xl p-7 text-center ${ct.card}`}>
              <p className={`text-sm font-medium mb-1 ${ct.faint}`}>現在の順番</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-[80px] font-black leading-none tracking-tight ${ct.text}`}>{waitingAhead + 1}</span>
                <span className={`text-2xl font-bold ml-1 ${ct.muted}`}>番目</span>
              </div>
              {waitingAhead >= 0 && (
                <p className={`text-sm mt-1 font-semibold ${ct.muted}`}>
                  あと約{Math.ceil((waitingAhead + 1) / activeFittings) * 35}分
                </p>
              )}
              {waitMsg && <p className={`text-sm mt-2 leading-relaxed ${ct.muted}`}>{waitMsg}</p>}
              <div className={`mt-5 border rounded-2xl p-3 ${ct.innerCard}`}>
                <p className={`text-xs font-medium mb-0.5 ${ct.faint}`}>整理番号</p>
                <div className={`text-4xl font-black tracking-wide ${ct.text}`}>
                  {String(ticket.ticket_number).padStart(3, '0')}
                </div>
                {ticket.customer_name && ticket.customer_name !== '未登録' && (
                  <p className={`text-sm mt-1 font-medium ${ct.muted}`}>
                    {ticket.customer_name} 様{ticket.child_name && ` · ${ticket.child_name}`}
                  </p>
                )}
              </div>
              {ticket.line_user_id
                ? <div className={`mt-4 inline-flex items-center gap-2 border rounded-full px-4 py-2 text-sm font-medium ${ct.lineNotif}`}>
                    <MessageCircle size={13} />LINEでお呼び出し通知が届きます
                  </div>
                : <div className={`mt-4 inline-flex items-center gap-2 border rounded-full px-4 py-2 text-sm ${ct.noLine}`}>
                    📱 この画面を閉じないでください
                  </div>
              }
            </div>
            <div className="flex items-center justify-between mt-4 px-1">
              <div className={`flex items-center gap-1.5 text-xs ${ct.bottom}`}>
                <Clock size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
                15秒ごとに自動更新
              </div>
              <button onClick={() => setCancelModal(true)} className={`text-xs underline ${ct.bottom}`}>
                並ぶのをやめる
              </button>
            </div>
          </div>
        </div>

        {/* 待ち時間に会員情報ご登録（任意）*/}
        <div className="px-5 pt-5 pb-4 max-w-md mx-auto">
          {customer ? (
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <CheckCircle2 size={18} style={{ color: theme.colors.primary }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-800 text-sm">{customer.name} 様</p>
                  {selectedChild && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {selectedChild.name}{selectedChild.grade ? ` · ${selectedChild.grade}` : ''}
                    </p>
                  )}
                </div>
                <button onClick={() => { setShowWaitingEdit(v => !v); setWaitingEditMode(null) }}
                  className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-500 font-bold active:scale-95 transition-transform">
                  <Pencil size={11} />{showWaitingEdit ? '閉じる' : '編集'}
                </button>
              </div>
              {showWaitingEdit && (
                <div className="px-4 pb-4 border-t border-zinc-100">
                  <div className="flex gap-2 pt-3 mb-3">
                    <button onClick={() => setWaitingEditMode(m => m === 'child' ? null : 'child')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${waitingEditMode === 'child' ? 'border-transparent text-white' : 'border-zinc-200 text-zinc-500'}`}
                      style={waitingEditMode === 'child' ? { background: theme.colors.primary } : {}}>
                      お子様を追加
                    </button>
                    <button onClick={() => setWaitingEditMode(m => m === 'info' ? null : 'info')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${waitingEditMode === 'info' ? 'border-transparent text-white' : 'border-zinc-200 text-zinc-500'}`}
                      style={waitingEditMode === 'info' ? { background: theme.colors.primary } : {}}>
                      情報を変更
                    </button>
                  </div>
                  {waitingEditMode === 'child' && (
                    <AddChildForm
                      onSubmit={handleAddChild}
                      onCancel={() => setWaitingEditMode(null)}
                      submitting={submitting}
                    />
                  )}
                  {waitingEditMode === 'info' && (
                    <WaitingCustomerEditForm
                      customer={customer}
                      onSaved={updated => { setCustomer(updated); setWaitingEditMode(null) }}
                      onClose={() => setWaitingEditMode(null)}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border-2 border-red-400"
              style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)', boxShadow: '0 8px 32px -8px rgba(239,68,68,0.35)' }}>
              <button
                onClick={() => setRegExpanded(v => !v)}
                className="w-full px-4 pt-4 pb-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
                <div className="w-11 h-11 rounded-xl bg-red-500 flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white text-xl">📋</span>
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-black text-red-900 text-base">入力のお願い</p>
                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">必須</span>
                  </div>
                  <p className="text-red-600/80 text-xs">お名前でお呼びするためにご登録ください</p>
                </div>
                <ChevronDown size={20} className={`text-red-400 transition-transform shrink-0 ${regExpanded ? 'rotate-180' : ''}`} />
              </button>
              {regExpanded && (
                <div className="px-4 pb-5 border-t border-red-200/60">
                  {queueRegDone ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-bold py-5">
                      <CheckCircle2 size={16} />ご登録ありがとうございます！
                    </div>
                  ) : (
                    <>
                      {registerError && (
                        <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2 mt-3 mb-1">
                          <AlertCircle size={13} className="shrink-0 mt-0.5" />
                          <div><p className="font-bold">登録エラー</p><p className="mt-0.5">{registerError}</p></div>
                        </div>
                      )}
                      <div className="mt-3">
                        <InitialRegistrationForm
                          lineDisplayName={lineProfile?.displayName ?? ''}
                          onSubmit={handleInitialRegister}
                          submitting={submitting}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* スタッフへの伝達事項 */}
        <div className="px-5 pb-6 max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-zinc-100">
              <p className="font-bold text-zinc-800 text-sm">📝 スタッフへの伝達事項（任意）</p>
              <p className="text-xs text-zinc-400 mt-0.5">待ち時間にご記入ください。お呼びした際にスタッフが確認します</p>
            </div>
            <div className="px-4 pt-3 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">身長</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" inputMode="numeric" value={detailHeight}
                      onChange={e => { setDetailHeight(e.target.value); setDetailSaved(false) }}
                      placeholder="165"
                      className="w-full text-sm text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all" />
                    <span className="text-xs text-zinc-400 shrink-0">cm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">体重</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" inputMode="numeric" value={detailWeight}
                      onChange={e => { setDetailWeight(e.target.value); setDetailSaved(false) }}
                      placeholder="52"
                      className="w-full text-sm text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all" />
                    <span className="text-xs text-zinc-400 shrink-0">kg</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">ご相談・お伝えしたいこと</label>
                <textarea value={detailNote}
                  onChange={e => { setDetailNote(e.target.value); setDetailSaved(false) }}
                  placeholder={'例：去年165Aを購入しました。\n今年サイズアップを検討中です'}
                  rows={3}
                  className="w-full text-sm text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all resize-none" />
              </div>
              {detailSaved ? (
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 rounded-xl px-3 py-2.5">
                  <CheckCircle2 size={14} />保存しました！スタッフが確認します
                </div>
              ) : (
                <button onClick={handleSaveDetails}
                  disabled={detailSaving || (!detailHeight.trim() && !detailWeight.trim() && !detailNote.trim())}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
                  {detailSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* キャンセルモーダル */}
        {cancelModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
            <div className="bg-zinc-900 border border-white/10 rounded-t-3xl p-6 w-full max-w-md">
              <h3 className="text-white font-black text-xl mb-2 text-center">並ぶのをやめますか？</h3>
              <p className="text-zinc-400 text-sm text-center mb-6">再度並ぶ場合は最後尾からとなります。この操作は取り消せません。</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setCancelModal(false)} className="py-4 rounded-xl bg-zinc-800 text-white font-bold active:scale-95 transition-transform">戻る</button>
                <button onClick={handleCancel} disabled={cancelLoading}
                  className="py-4 rounded-xl bg-red-600 text-white font-black disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all">
                  {cancelLoading && <Loader2 size={18} className="animate-spin" />}キャンセルする
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 呼出中 ────────────────────────────────────────────
  if (view === 'queue_calling' && ticket) return (
    <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-300 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-8xl mb-3">🔔</div>
        <h2 className="text-4xl font-black text-orange-900 leading-tight mb-2">お呼びしています！</h2>
        <p className="text-lg font-bold text-orange-800 mb-6">カウンターへお越しください</p>
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
          <p className="text-sm text-gray-400 mb-1">整理番号</p>
          <div className="text-[88px] font-black leading-none" style={{ color: theme.colors.primary }}>
            {String(ticket.ticket_number).padStart(3, '0')}
          </div>
          {ticket.customer_name && ticket.customer_name !== '未登録' && (
            <p className="text-xl font-bold text-gray-700 mt-3">{ticket.customer_name} 様</p>
          )}
          <p className="text-xs text-gray-300 mt-4 border-t pt-3">📱 この画面をスタッフに見せてください</p>
        </div>
      </div>
      <div className="px-6 pb-10">
        <button onClick={async () => {
          await supabase.from('queues').update({ status: 'completed' }).eq('id', ticket.id)
          setView('queue_completed')
        }} className="w-full bg-emerald-500 text-white text-xl font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all">
          ✅ スタッフから案内を受けました
        </button>
      </div>
    </div>
  )

  if (view === 'queue_completed') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.55)` }}>
        <CheckCircle2 size={60} className="text-white" />
      </div>
      <div>
        <h2 className="text-3xl font-black text-zinc-900 mb-2">ご対応完了</h2>
        <p className="text-zinc-500 text-base">ありがとうございました！</p>
      </div>
      <button onClick={handleReset}
        className="px-8 py-4 rounded-2xl text-white font-black active:scale-95 transition-transform"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.45)` }}>
        最初に戻る
      </button>
    </div>
  )

  if (view === 'queue_self_cancelled') return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="text-7xl">👋</div>
      <div>
        <h2 className="text-3xl font-black text-white mb-2">キャンセルしました</h2>
        <p className="text-zinc-400">再度並ぶ場合は最後尾からとなります</p>
      </div>
      <button onClick={handleReset}
        className="px-8 py-4 rounded-2xl text-white font-black active:scale-95 transition-transform"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
        最初に戻る
      </button>
    </div>
  )

  if (view === 'queue_cancelled') return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="text-7xl">😔</div>
      <div>
        <h2 className="text-3xl font-black text-white mb-2">お呼びしましたが</h2>
        <p className="text-zinc-400">ご不在のためキャンセルされました</p>
        <p className="text-zinc-500 text-sm mt-1">再度受付が必要な場合はもう一度並び直してください</p>
      </div>
      <button onClick={handleReset}
        className="px-8 py-4 rounded-2xl text-white font-black active:scale-95 transition-transform"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
        もう一度並ぶ
      </button>
    </div>
  )

  if (view === 'purchase_speak') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.55)` }}>
        <CheckCircle2 size={56} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-3xl font-black text-zinc-900">取り置き注文</h1>
        {selectedChild && (
          <p className="text-zinc-500 text-sm mt-1">{customer?.name} 様 · {selectedChild.name}</p>
        )}
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl px-6 py-5 border border-white/50 max-w-xs w-full" style={cardStyle}>
        <p className="font-black text-zinc-800 text-lg">スタッフにお声がけください</p>
        <p className="text-sm text-zinc-500 mt-1">取り置き注文の受付を行います</p>
      </div>
      <button onClick={() => setView('purpose')} className="text-zinc-400 text-sm underline">← 戻る</button>
    </main>
  )

  if (view === 'repair_speak') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.55)` }}>
        <CheckCircle2 size={56} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-3xl font-black text-zinc-900">お直しの受付・ご相談</h1>
        {selectedChild && (
          <p className="text-zinc-500 text-sm mt-1">{customer?.name} 様 · {selectedChild.name}</p>
        )}
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl px-6 py-5 border border-white/50 max-w-xs w-full" style={cardStyle}>
        <p className="font-black text-zinc-800 text-lg">制服のお持ち込みはこちら</p>
        <p className="text-sm text-zinc-500 mt-1">スタッフにお声がけください</p>
      </div>
      <button onClick={() => setView('purpose')} className="text-zinc-400 text-sm underline">← 戻る</button>
    </main>
  )

  if (view === 'closed') return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-7xl mb-5">🚪</div>
      <h1 className="text-3xl font-black text-white mb-2">現在受付を停止しています</h1>
      <p className="text-zinc-400 text-lg">店頭スタッフにお声がけください</p>
    </div>
  )

  if (view === 'purchase_ec') return (
    <ECShopView
      lineProfile={lineProfile}
      storeId={storeId}
      storeName={theme.storeName}
      customerId={customer?.id ?? null}
      childId={selectedChild?.id ?? null}
      onBack={() => setView('purpose')}
    />
  )

  return null
}
