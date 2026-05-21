'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, MessageCircle, Loader2, Clock,
  ChevronRight, Users, AlertCircle,
} from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, WaitThreshold } from '@/types/database'
import { DEFAULT_THRESHOLDS, getWaitMessage } from '@/types/database'
import { initLiff, getLineProfile, openAddFriend, type LiffProfile } from '@/lib/liff'
import { useStoreTheme } from '@/lib/theme-context'

const LINE_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BASIC_ID || 'cyx2612b'

type View =
  | 'loading'
  | 'add_friend'
  | 'purpose'
  | 'queue_waiting'
  | 'queue_calling'
  | 'queue_completed'
  | 'queue_cancelled'
  | 'queue_self_cancelled'
  | 'repair_speak'
  | 'repair_form'
  | 'repair_done'
  | 'closed'

function toKatakana(s: string) {
  return s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

// ──────────────────────────────────────────────────────────
// 統一会員登録フォーム
// ──────────────────────────────────────────────────────────
function RegistrationForm({
  lineDisplayName,
  onSubmit,
  submitting,
}: {
  lineDisplayName: string
  onSubmit: (d: { parentName: string; parentKana: string; childName: string; childKana: string; tel: string }) => Promise<void>
  submitting: boolean
}) {
  const theme = useStoreTheme()
  const [parentName, setParentName] = useState(lineDisplayName)
  const [parentKana, setParentKana] = useState(toKatakana(lineDisplayName))
  const [childName,  setChildName]  = useState('')
  const [childKana,  setChildKana]  = useState('')
  const [tel,        setTel]        = useState('')
  const [error,      setError]      = useState('')

  const parentKanaEdited  = useRef(false)
  const isComposingParent = useRef(false)
  const kanaBlockParent   = useRef(false)
  const childKanaEdited   = useRef(false)
  const isComposingChild  = useRef(false)
  const kanaBlockChild    = useRef(false)

  const onParentNameChange = (v: string) => {
    setParentName(v)
    if (!parentKanaEdited.current && !isComposingParent.current && !kanaBlockParent.current)
      setParentKana(toKatakana(v))
  }
  const onChildNameChange = (v: string) => {
    setChildName(v)
    if (!childKanaEdited.current && !isComposingChild.current && !kanaBlockChild.current)
      setChildKana(toKatakana(v))
  }

  const handleSubmit = async () => {
    if (!parentName.trim()) { setError('保護者のお名前を入力してください'); return }
    if (!childName.trim())  { setError('お子様のお名前を入力してください'); return }
    setError('')
    await onSubmit({
      parentName: parentName.trim(), parentKana: parentKana.trim(),
      childName:  childName.trim(),  childKana:  childKana.trim(),
      tel:        tel.trim(),
    })
  }

  const base = 'w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50/80 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = '')

  return (
    <div className="space-y-4">
      {/* 保護者名 */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">
          保護者のお名前 <span className="text-red-500">*</span>
        </label>
        <input type="text" value={parentName} placeholder="例：山田 太郎"
          className={base}
          onChange={e => onParentNameChange(e.target.value)}
          onCompositionStart={() => { isComposingParent.current = true }}
          onCompositionEnd={() => { isComposingParent.current = false; kanaBlockParent.current = true }}
          onFocus={focus} onBlur={blur} />
      </div>
      {/* 保護者ふりがな */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">ふりがな（保護者）</label>
        <input type="text" value={parentKana} placeholder="ヤマダ タロウ"
          className={base}
          onChange={e => { parentKanaEdited.current = true; setParentKana(e.target.value) }}
          onFocus={focus} onBlur={blur} />
      </div>
      {/* お子様名 */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">
          お子様のお名前 <span className="text-red-500">*</span>
        </label>
        <input type="text" value={childName} placeholder="例：山田 花子"
          className={base}
          onChange={e => onChildNameChange(e.target.value)}
          onCompositionStart={() => { isComposingChild.current = true }}
          onCompositionEnd={() => { isComposingChild.current = false; kanaBlockChild.current = true }}
          onFocus={focus} onBlur={blur} />
      </div>
      {/* お子様ふりがな */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">ふりがな（お子様）</label>
        <input type="text" value={childKana} placeholder="ヤマダ ハナコ"
          className={base}
          onChange={e => { childKanaEdited.current = true; setChildKana(e.target.value) }}
          onFocus={focus} onBlur={blur} />
      </div>
      {/* 電話番号 */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">電話番号</label>
        <input type="tel" inputMode="tel" value={tel} placeholder="例：090-1234-5678"
          className={base}
          onChange={e => setTel(e.target.value)}
          onFocus={focus} onBlur={blur} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={submitting || !parentName.trim() || !childName.trim()}
        className="w-full text-white text-base font-black py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={{
          background:  `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
          boxShadow:   `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.45)`,
        }}>
        {submitting ? <><Loader2 size={18} className="animate-spin" />登録中...</> : '登録する'}
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────────────────
export default function CustomerPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const theme = useStoreTheme()

  const [view,           setView]           = useState<View>('loading')
  const [lineProfile,    setLineProfile]    = useState<LiffProfile | null>(null)
  const [ticket,         setTicket]         = useState<Queue | null>(null)
  const [waitingAhead,   setWaitingAhead]   = useState(0)
  const [waitingCount,   setWaitingCount]   = useState<number | null>(null)
  const [waitThresholds, setWaitThresholds] = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)
  const [formDone,       setFormDone]       = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [issuing,        setIssuing]        = useState(false)
  const [repairLoading,  setRepairLoading]  = useState(false)
  const [friendChecking, setFriendChecking] = useState(false)
  const [friendFailed,   setFriendFailed]   = useState(false)
  const [cancelModal,    setCancelModal]    = useState(false)
  const [cancelLoading,  setCancelLoading]  = useState(false)

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
    ;(async () => {
      const { data: sd } = await supabase.from('stores')
        .select('is_open, wait_thresholds').eq('id', storeId).single()
      if (sd && Array.isArray(sd.wait_thresholds) && sd.wait_thresholds.length > 0)
        setWaitThresholds(sd.wait_thresholds as WaitThreshold[])

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
          return
        }
      }

      if (!profile) { setView('add_friend'); return }

      // 友達チェック
      try {
        const res = await fetch(`/api/check-friend?userId=${profile.userId}`)
        const { friend } = await res.json()
        if (!friend) { setView('add_friend'); return }
      } catch { /* 失敗しても進む */ }

      if (sd && !sd.is_open) { setView('closed'); return }

      // 待ち人数を取得してから目的選択へ
      const { count } = await supabase.from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).in('status', ['waiting', 'calling'])
        .gte('created_at', getTodayStart())
      setWaitingCount(count ?? 0)
      setView('purpose')
    })()
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
          if (updated.status === 'calling')   setView('queue_calling')
          if (updated.status === 'completed') setView('queue_completed')
          if (updated.status === 'cancelled') setView('queue_cancelled')
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `store_id=eq.${storeId}` },
        () => { if (ticketRef.current) fetchWaitingAhead(ticketRef.current) })
      .subscribe()
    channelRef.current = ch
    return () => { clearInterval(pollId); supabase.removeChannel(ch) }
  }, [ticket?.id, view, storeId, fetchWaitingAhead])

  // ── 友達確認後・次へ ──────────────────────────────────
  const handleFriendProceed = async () => {
    setFriendChecking(true); setFriendFailed(false)
    try {
      if (lineProfile?.userId) {
        const res = await fetch(`/api/check-friend?userId=${lineProfile.userId}`)
        const { friend } = await res.json()
        if (!friend) { setFriendFailed(true); setFriendChecking(false); return }
      }
    } catch { /* 失敗しても進む */ }

    const { data: sd } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
    if (sd && !sd.is_open) { setView('closed'); setFriendChecking(false); return }

    const { count } = await supabase.from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId).in('status', ['waiting', 'calling'])
      .gte('created_at', getTodayStart())
    setWaitingCount(count ?? 0)
    setFriendChecking(false)
    setView('purpose')
  }

  // ── 整理券即時発行（パターンA） ──────────────────────
  const handleIssueTicket = async () => {
    if (issuing) return
    setIssuing(true)
    try {
      const { data: nextNum } = await supabase.rpc('get_next_ticket_number', { p_store_id: storeId })
      const { data: t, error } = await supabase.from('queues').insert({
        store_id:      storeId,
        ticket_number: nextNum as number,
        status:        'waiting',
        customer_name: lineProfile?.displayName ?? '未登録',
        category:      'other',
        gender:        'other',
        line_user_id:  lineProfile?.userId ?? null,
        checked_in:    true,
      }).select().single()
      if (error || !t) throw error
      localStorage.setItem(ticketKey, t.id)
      localStorage.setItem(dateKey, new Date().toDateString())
      setTicket(t)
      if (t.line_user_id) {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUserId: t.line_user_id, ticketNumber: t.ticket_number,
            customerName: t.customer_name, storeName: theme.storeName,
            storeId, type: 'registered',
          }),
        }).catch(console.error)
      }
      setView('queue_waiting')
    } catch { setIssuing(false) }
  }

  // ── お直し選択（パターンB） ───────────────────────────
  const handleRepairSelect = async () => {
    if (!lineProfile?.userId) { setView('repair_form'); return }
    setRepairLoading(true)
    const { data } = await supabase.from('customers')
      .select('id').eq('store_id', storeId).eq('line_user_id', lineProfile.userId).limit(1)
    setRepairLoading(false)
    setView(data && data.length > 0 ? 'repair_speak' : 'repair_form')
  }

  // ── 会員登録（共通） ──────────────────────────────────
  const handleRegister = async (d: {
    parentName: string; parentKana: string
    childName:  string; childKana:  string; tel: string
  }) => {
    if (!lineProfile?.userId) return
    setSubmitting(true)
    try {
      // customers upsert
      const { data: existing } = await supabase.from('customers')
        .select('id').eq('store_id', storeId).eq('line_user_id', lineProfile.userId).maybeSingle()
      if (existing) {
        await supabase.from('customers').update({
          name: d.childName, kana: d.childKana || null,
          parent_name: d.parentName, parent_kana: d.parentKana || null,
          tel: d.tel || null,
        }).eq('id', existing.id)
      } else {
        await supabase.from('customers').insert({
          store_id: storeId, line_user_id: lineProfile.userId,
          name: d.childName, kana: d.childKana || null,
          parent_name: d.parentName, parent_kana: d.parentKana || null,
          tel: d.tel || null,
        })
      }
      // queues に顧客情報を反映（キュー待機中の場合）
      if (ticket) {
        await supabase.from('queues').update({
          customer_name: d.parentName,
          customer_kana: d.parentKana || null,
          child_name:    d.childName,
        }).eq('id', ticket.id)
        setTicket(prev => prev ? { ...prev, customer_name: d.parentName, child_name: d.childName } : null)
        setFormDone(true)
      } else {
        setView('repair_done')
      }
    } catch (e) { console.error(e) }
    setSubmitting(false)
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
    setTicket(null); setWaitingAhead(0); setFormDone(false); setIssuing(false)
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
          お呼び出しや、お直し完了の通知をLINEで確実に受け取るために、まずは友だち追加をお願いします
        </p>
      </div>

      <div className="bg-white/75 backdrop-blur-2xl rounded-3xl p-6 w-full max-w-sm border border-white/60 space-y-4" style={cardStyle}>
        <button onClick={() => openAddFriend(LINE_BASIC_ID)}
          className="w-full bg-[#06C755] text-white text-base font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200">
          <MessageCircle size={20} />① LINEで友だち追加する
        </button>
        <button onClick={handleFriendProceed} disabled={friendChecking}
          className="w-full text-white text-base font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`, boxShadow: `0 8px 24px -8px rgb(${theme.colors.primaryRgb} / 0.45)` }}>
          {friendChecking ? <><Loader2 size={16} className="animate-spin" />確認中...</> : '② 追加済み → 次へ進む'}
        </button>
        {friendFailed && (
          <p className="text-red-500 text-xs text-center">友だち追加が確認できません。①を押してから②をお試しください。</p>
        )}
      </div>
    </main>
  )

  // ── ステップ2：目的選択 ───────────────────────────────
  if (view === 'purpose') return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          {theme.logoEmoji}
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">本日のご用件は？</h1>
        <p className="text-zinc-500 text-sm mt-1">タップして選択してください</p>
      </div>

      <div className="space-y-4">
        {/* カードA：順番待ち */}
        <button onClick={handleIssueTicket} disabled={issuing}
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

        {/* カードB：お直し */}
        <button onClick={handleRepairSelect} disabled={repairLoading}
          className="w-full bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 p-6 text-left active:scale-[0.98] transition-all disabled:opacity-80"
          style={cardStyle}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
              ✂️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-900 text-lg leading-tight">お直しを依頼する</p>
              <p className="text-zinc-500 text-sm mt-0.5">スタッフ対応</p>
            </div>
            <div className="pt-1 shrink-0">
              {repairLoading ? <Loader2 size={20} className="animate-spin text-zinc-400" /> : <ChevronRight size={20} className="text-zinc-300" />}
            </div>
          </div>
        </button>
      </div>
    </main>
  )

  // ── ステップ3A：順番待ち ＋ インライン登録フォーム ────
  if (view === 'queue_waiting' && ticket) {
    const waitMsg = getWaitMessage(waitingAhead, waitThresholds.length > 0 ? waitThresholds : DEFAULT_THRESHOLDS)
    return (
      <div className="min-h-screen">
        {/* 待ち状況カード */}
        <div style={{ background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)` }}
          className="px-5 pt-8 pb-12">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-xs font-medium text-white">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />リアルタイム更新中
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-7 text-center">
              <p className="text-white/60 text-sm font-medium mb-1">整理番号</p>
              <div className="text-[80px] font-black text-white leading-none tracking-tight">
                {String(ticket.ticket_number).padStart(3, '0')}
              </div>
              <div className="mt-5 bg-white/10 rounded-2xl p-4">
                <p className="text-white/60 text-sm mb-1">現在の順番</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-black text-white">{waitingAhead + 1}</span>
                  <span className="text-base font-bold text-white/70 ml-1">番目</span>
                </div>
                {waitMsg && <p className="text-white/80 text-sm mt-2 leading-relaxed">{waitMsg}</p>}
              </div>
              {ticket.line_user_id
                ? <div className="mt-4 inline-flex items-center gap-2 bg-emerald-400/20 border border-emerald-400/30 rounded-full px-4 py-2 text-emerald-300 text-sm font-medium">
                    <MessageCircle size={13} />LINEでお呼び出し通知が届きます
                  </div>
                : <div className="mt-4 inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-2 text-white/70 text-sm">
                    📱 この画面を閉じないでください
                  </div>
              }
            </div>
            <div className="flex items-center justify-between mt-4 px-1">
              <div className="flex items-center gap-1.5 text-white/40 text-xs">
                <Clock size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
                15秒ごとに自動更新
              </div>
              <button onClick={() => setCancelModal(true)} className="text-white/30 text-xs underline">
                並ぶのをやめる
              </button>
            </div>
          </div>
        </div>

        {/* インライン登録フォーム */}
        <div className="px-5 py-8 max-w-md mx-auto -mt-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 p-6" style={cardStyle}>
            {formDone ? (
              <div className="text-center py-4">
                <CheckCircle2 size={44} className="mx-auto mb-3" style={{ color: theme.colors.primary }} />
                <p className="font-black text-zinc-900 text-lg">ご登録ありがとうございます</p>
                <p className="text-zinc-500 text-sm mt-1">お呼び出しまでそのままお待ちください</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-5">
                  <p className="text-[11px] font-bold mb-1" style={{ color: theme.colors.primary }}>任意・後からでも可</p>
                  <h2 className="text-base font-black text-zinc-900">お客様情報のご登録</h2>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    お呼び出しをお待ちの間に、お客様情報のご登録をお願いします
                  </p>
                </div>
                <RegistrationForm
                  lineDisplayName={lineProfile?.displayName ?? ''}
                  onSubmit={handleRegister}
                  submitting={submitting}
                />
              </>
            )}
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

  // ── 対応完了 ──────────────────────────────────────────
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

  // ── 自分でキャンセル ──────────────────────────────────
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

  // ── 不在キャンセル ────────────────────────────────────
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

  // ── ステップ3B：お直し・既存顧客 ─────────────────────
  if (view === 'repair_speak') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.55)` }}>
        <CheckCircle2 size={56} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-3xl font-black text-zinc-900">ご登録を確認しました</h1>
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl px-6 py-5 border border-white/50 max-w-xs w-full" style={cardStyle}>
        <p className="font-black text-zinc-800 text-lg">スタッフにお声がけください</p>
        <p className="text-sm text-zinc-500 mt-1">お直しの受付を行います</p>
      </div>
      <button onClick={() => setView('purpose')} className="text-zinc-400 text-sm underline">← 戻る</button>
    </main>
  )

  // ── ステップ3B：お直し・新規登録フォーム ─────────────
  if (view === 'repair_form') return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          ✂️
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">お客様情報の登録</h1>
        <p className="text-zinc-500 text-xs mt-1">初回のみご入力ください</p>
      </div>
      <div className="bg-white/75 backdrop-blur-2xl rounded-3xl border border-white/60 p-5" style={cardStyle}>
        <RegistrationForm
          lineDisplayName={lineProfile?.displayName ?? ''}
          onSubmit={handleRegister}
          submitting={submitting}
        />
      </div>
    </main>
  )

  // ── ステップ3B：お直し・登録完了 ─────────────────────
  if (view === 'repair_done') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.55)` }}>
        <CheckCircle2 size={56} className="text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-black text-zinc-900 mb-2">ご登録完了！</h1>
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl px-6 py-5 border border-white/50 max-w-xs w-full" style={cardStyle}>
        <p className="font-black text-zinc-800 text-lg">スタッフにお声がけください</p>
        <p className="text-sm text-zinc-500 mt-1">お直しの受付を行います</p>
      </div>
    </main>
  )

  // ── 受付停止中 ────────────────────────────────────────
  if (view === 'closed') return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-7xl mb-5">🚪</div>
      <h1 className="text-3xl font-black text-white mb-2">現在受付を停止しています</h1>
      <p className="text-zinc-400 text-lg">店頭スタッフにお声がけください</p>
    </div>
  )

  return null
}
