'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  BellRing, CheckCheck, UserX, RefreshCw, Clock, Users,
  Loader2, Store, Phone, User, GraduationCap, Package,
  ChevronRight, LayoutDashboard, X, MapPin, BellOff, Bell,
  CalendarDays, QrCode, ShoppingCart,
} from 'lucide-react'
import { BottomNav } from './_components/BottomNav'
import { QrRegistrationModal } from './_components/QrRegistrationModal'
import { StoreSelectScreen } from './_components/StoreSelectScreen'
import type { StoreInfo } from './_components/StoreSelectScreen'
import { resolveFeature } from '@/lib/features'
import { SeasonDashboard } from './_components/SeasonDashboard'
import { SchoolDeadlineAlert } from './_components/SchoolDeadlineAlert'
import { PinScreen } from './_components/PinScreen'
import { WaitingCard, CallingCard, HistoryCard } from './_components/QueueCards'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueStatus } from '@/types/database'
import {
  CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS,
  GENDER_LABELS, GENDER_STYLES,
} from '@/types/database'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BAmZx5b8ScrgrqWa822FdQhtfHV2CSyqvxNeQX-Ds1KsqztPPRtZRyBP_LaQZmCLejg8Ivd7Gu4cBxKtNwodb3o'

// サンプルグループ（本店/支店A）。総管理への導線はこのサンプル店舗からのみ残す
const SAMPLE_GROUP_ID = '00000000-0000-0000-0000-000000000001'

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type AdminView  = 'loading' | 'select_store' | 'pin' | 'dashboard'
type HistoryTab = 'completed' | 'cancelled'

// ============================================================
// ダッシュボード
// ============================================================
function AdminDashboard({ store, groupCode, onLogout }: { store: StoreInfo; groupCode: string | null; onLogout: () => void }) {
  const router = useRouter()
  const [queues,         setQueues]         = useState<Queue[]>([])
  const [refreshing,     setRefreshing]     = useState(false)
  const [historyTab,     setHistoryTab]     = useState<HistoryTab>('completed')
  const [historyVisible, setHistoryVisible] = useState(false)
  const [toast,          setToast]          = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [isOpen,         setIsOpen]         = useState<boolean | null>(null)
  const [notificationPlan, setNotificationPlan] = useState<'calling_only' | 'full'>('calling_only')
  const [isTestMode,     setIsTestMode]     = useState(false)
  const [tcShowReception, setTcShowReception] = useState(false)
  const [showQrModal,    setShowQrModal]    = useState(false)
  const [pushStatus,     setPushStatus]     = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [testLoading,    setTestLoading]    = useState(false)
  const [openCloseModal, setOpenCloseModal] = useState<'opening' | 'closing' | null>(null)
  const [briefing,       setBriefing]       = useState<string | null>(null)
  const [briefingLoading,setBriefingLoading]= useState(false)
  const [closingChecklist,setClosingChecklist] = useState<{ label: string; checked: boolean }[]>([])
  const [closingSummary, setClosingSummary] = useState<string | null>(null)
  const [closingLoading, setClosingLoading] = useState(false)
  const [handoverNote,   setHandoverNote]   = useState('')
  const [confirmingOC,   setConfirmingOC]   = useState(false)
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
    // is_open を必ず取得（別列の有無に影響されないよう独立クエリ）
    const { data, error } = await supabase.from('stores')
      .select('is_open')
      .eq('id', store.id).single()
    if (!error && data != null) {
      setIsOpen((data as any).is_open ?? false)
    }
    // オプション列は別途取得（存在しない列でエラーになっても is_open に影響させない）
    const { data: opts } = await (supabase as any).from('stores')
      .select('notification_plan, is_test_mode, timecard_settings')
      .eq('id', store.id).single()
    if (opts) {
      if (opts.notification_plan) setNotificationPlan(opts.notification_plan)
      if (opts.is_test_mode != null) setIsTestMode(opts.is_test_mode)
      setTcShowReception(opts.timecard_settings?.show_on_reception !== false)
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

  const callBriefingApi = async (mode: 'open' | 'close', note?: string) => {
    const res = await fetch('/api/stores/briefing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: store.id, mode, handoverNote: note ?? '' }),
    })
    return res.ok ? res.json() : null
  }

  const openOpenModal = async () => {
    setOpenCloseModal('opening'); setBriefing(null); setBriefingLoading(true)
    const savedNote = typeof window !== 'undefined' ? (localStorage.getItem(`handover-${store.id}`) ?? '') : ''
    const data = await callBriefingApi('open', savedNote).catch(() => null)
    if (data?.ok) setBriefing(data.briefing)
    setBriefingLoading(false)
  }

  const openClosingModal = async () => {
    setOpenCloseModal('closing'); setClosingSummary(null); setClosingLoading(true)
    setHandoverNote(''); setClosingChecklist([])
    const data = await callBriefingApi('close').catch(() => null)
    if (data?.ok) {
      setClosingSummary(data.summary)
      setClosingChecklist((data.checklist ?? []).map((c: { label: string }) => ({ label: c.label, checked: false })))
    }
    setClosingLoading(false)
  }

  const confirmOpen = async () => {
    setConfirmingOC(true)
    await handleToggleOpen()
    setOpenCloseModal(null); setConfirmingOC(false)
  }

  const confirmClose = async () => {
    setConfirmingOC(true)
    if (typeof window !== 'undefined') {
      handoverNote.trim()
        ? localStorage.setItem(`handover-${store.id}`, handoverNote.trim())
        : localStorage.removeItem(`handover-${store.id}`)
    }
    await handleToggleOpen()
    setOpenCloseModal(null); setConfirmingOC(false)
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

  const handleStartFitting = useCallback((ticket: Queue) => {
    router.push(`/${store.id}/admin/fitting?queueId=${ticket.id}`)
  }, [store.id, router])

  const handleCheckIn = async (id: string) => {
    const { error } = await supabase.from('queues').update({ checked_in: true }).eq('id', id)
    if (error) { showToast('err', 'チェックイン失敗: ' + error.message); return }
    setQueues(prev => prev.map(q => q.id === id ? { ...q, checked_in: true } : q))
    showToast('ok', '代理チェックイン済みにしました')
  }

  const addTestPerson = useCallback(async () => {
    setTestLoading(true)
    const names = ['田中 花子', '鈴木 太郎', '佐藤 明', '高橋 結衣', '伊藤 大輔', '渡辺 さくら', '山本 健', '中村 愛']
    const schools = ['○○中学校', '△△高校', '□□学園', '◇◇学院', '星川中学校', '南高等学校']
    const genders = ['male', 'female', 'other'] as const
    const categories = ['fitting', 'pickup', 'other'] as const
    const { data: last } = await supabase.from('queues')
      .select('ticket_number').eq('store_id', store.id)
      .gte('created_at', getTodayStart())
      .order('ticket_number', { ascending: false }).limit(1).maybeSingle()
    const nextNum = (last?.ticket_number ?? 0) + 1
    const name     = names[Math.floor(Math.random() * names.length)]
    const school   = schools[Math.floor(Math.random() * schools.length)]
    const gender   = genders[Math.floor(Math.random() * genders.length)]
    const category = categories[Math.floor(Math.random() * categories.length)]
    const { error } = await supabase.from('queues').insert({
      store_id: store.id, ticket_number: nextNum, status: 'waiting',
      customer_name: name, school_name: school, child_name: null,
      category, gender, is_remote: false, checked_in: false,
    })
    setTestLoading(false)
    if (error) showToast('err', 'テスト追加失敗: ' + error.message)
    else { showToast('ok', `テスト: ${name} (#${nextNum})を追加`); fetchQueues() }
  }, [store.id, fetchQueues, showToast])

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
      <div className="bg-white border-b border-gray-200 shadow-sm px-4 pb-3" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>

        {/* 行1: 店舗名 / ボタン群 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-base font-black tracking-tight text-gray-900 leading-tight">{store.name}</h1>
            <p className="text-gray-500 text-[11px]">
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* 開店/閉店ボタン → モーダルを開く */}
            <button
              onClick={() => isOpen ? openClosingModal() : openOpenModal()}
              disabled={isOpen === null}
              style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs active:opacity-60 transition-all disabled:opacity-40 ${
                isOpen === null ? 'bg-gray-200 text-gray-500' :
                isOpen ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50' :
                'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
              }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                isOpen === null ? 'bg-gray-400' : isOpen ? 'bg-white animate-pulse' : 'bg-indigo-200'
              }`} />
              {isOpen === null ? '...' : isOpen ? '営業中' : '開店する'}
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
            {resolveFeature('takeout', store.features ?? {}) && (
              <a href={`/${store.id}/takeout-admin`}
                title="テイクアウト管理"
                className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all text-gray-500 text-base leading-none flex items-center justify-center">
                🥡
              </a>
            )}
            {resolveFeature('shift_attendance', store.features ?? {}) && tcShowReception && (
              <a href={`/${store.id}/timecard`} target="_blank" rel="noopener noreferrer"
                title="タイムカード"
                className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all text-gray-500 text-base leading-none flex items-center justify-center">
                🕐
              </a>
            )}
            {groupCode ? (
              <a href={`/company/${groupCode}`} title="会社管理ダッシュボード"
                className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all text-gray-500">
                <LayoutDashboard size={16} />
              </a>
            ) : store.group_id === SAMPLE_GROUP_ID ? (
              <a href="/super-admin" title="総管理ダッシュボード"
                className="p-2 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 active:opacity-60 transition-all text-gray-500">
                <LayoutDashboard size={16} />
              </a>
            ) : null}
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

          {/* 繁忙期シーズンダッシュボード */}
          <SeasonDashboard storeId={store.id} />

          {/* 学校別締切アラート */}
          <SchoolDeadlineAlert storeId={store.id} />

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
              {callingTickets.map(t => <CallingCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} onGoToFitting={t.category === 'fitting' ? handleStartFitting : undefined} />)}
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

          {/* 在校生フォロー通知リンク */}
          <a href={`/${store.id}/admin/followup`}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-2 px-3 py-2.5 bg-teal-50 border border-teal-200 rounded-xl active:opacity-70">
            <GraduationCap size={14} className="text-teal-600 shrink-0" />
            <span className="text-teal-700 text-xs font-bold">在校生フォロー通知</span>
            <ChevronRight size={12} className="text-teal-500 ml-auto" />
          </a>

          {/* 発注数量集計リンク */}
          <a href={`/${store.id}/admin/order-summary`}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl active:opacity-70">
            <Package size={14} className="text-orange-600 shrink-0" />
            <span className="text-orange-700 text-xs font-bold">発注数量集計</span>
            <ChevronRight size={12} className="text-orange-500 ml-auto" />
          </a>

          {/* レジ（会計）クイックリンク — pos 機能ON時のみ */}
          {resolveFeature('pos', store.features ?? {}) && (
            <a href={`/${store.id}/admin/register`}
              style={{ touchAction: 'manipulation' }}
              className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl active:opacity-70">
              <ShoppingCart size={14} className="text-emerald-600 shrink-0" />
              <span className="text-emerald-700 text-xs font-bold">🧾 レジ（会計）</span>
              <ChevronRight size={12} className="text-emerald-500 ml-auto" />
            </a>
          )}

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
              <button onClick={addTestPerson} disabled={testLoading}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-400 text-[10px] font-bold transition-colors disabled:opacity-50"
                title="テスト用の人を追加">
                {testLoading ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />}
                テスト追加
              </button>
            </div>
            {waitingTickets.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-gray-200">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">待ちはいません</p>
              </div>
            ) : waitingTickets.map(t => <WaitingCard key={t.id} ticket={t} storeId={store.id} onAction={handleAction} onCheckIn={handleCheckIn} onStartFitting={t.category === 'fitting' ? handleStartFitting : undefined} />)}
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

      {/* 開店ブリーフィングモーダル */}
      {openCloseModal === 'opening' && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌅</span>
                <div>
                  <h2 className="text-white font-black text-lg">開店ブリーフィング</h2>
                  <p className="text-amber-100 text-xs">今日のポイントをお伝えします</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {briefingLoading ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={32} className="animate-spin text-amber-400" />
                  <p className="text-gray-400 text-sm">AIが今日の情報を確認しています…</p>
                </div>
              ) : briefing ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{briefing}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center text-gray-400 text-sm">
                  情報を取得できませんでした
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setOpenCloseModal(null)}
                  className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm active:opacity-70"
                  style={{ touchAction: 'manipulation' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmOpen}
                  disabled={confirmingOC}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-black text-sm shadow-lg active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ touchAction: 'manipulation' }}
                >
                  {confirmingOC ? <Loader2 size={16} className="animate-spin" /> : <span>🌅</span>}
                  開店する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 閉店チェックモーダル */}
      {openCloseModal === 'closing' && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌙</span>
                <div>
                  <h2 className="text-white font-black text-lg">閉店チェック</h2>
                  <p className="text-indigo-100 text-xs">今日の締めをしっかり確認</p>
                </div>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {closingLoading ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={32} className="animate-spin text-indigo-400" />
                  <p className="text-gray-400 text-sm">AIが今日のサマリーを生成しています…</p>
                </div>
              ) : (
                <>
                  {closingSummary && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                      <p className="text-gray-800 text-sm leading-relaxed">{closingSummary}</p>
                    </div>
                  )}
                  {closingChecklist.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">チェックリスト</p>
                      {closingChecklist.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => setClosingChecklist(prev =>
                            prev.map((c, j) => j === i ? { ...c, checked: !c.checked } : c)
                          )}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:opacity-70 ${
                            item.checked
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-white border-gray-200'
                          }`}
                          style={{ touchAction: 'manipulation' }}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                          }`}>
                            {item.checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm font-medium ${item.checked ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                      明日への引継ぎメモ
                    </label>
                    <textarea
                      value={handoverNote}
                      onChange={e => setHandoverNote(e.target.value)}
                      placeholder="明日のスタッフへ伝えることがあれば…（任意）"
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-6 pb-6 pt-2 flex gap-3 shrink-0 border-t border-gray-100">
              <button
                onClick={() => setOpenCloseModal(null)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm active:opacity-70"
                style={{ touchAction: 'manipulation' }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmClose}
                disabled={confirmingOC}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-black text-sm shadow-lg active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ touchAction: 'manipulation' }}
              >
                {confirmingOC ? <Loader2 size={16} className="animate-spin" /> : <span>🌙</span>}
                閉店する
              </button>
            </div>
          </div>
        </div>
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
    supabase.from('stores').select('id, name, pin, group_id, business_type, features').order('name', { ascending: true })
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
            if (!resolveFeature('tab_queue', match.features ?? {})) { router.replace(`/${match.id}/admin/repairs`); return }
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
      if (!resolveFeature('tab_queue', selectedStore.features ?? {})) {
        router.replace(`/${selectedStore.id}/admin/repairs`)
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
    <PinScreen storeName={selectedStore.name} storePin={selectedStore.pin} storeId={selectedStore.id} onAuth={handleAuth} onBack={() => setView('select_store')} />
  )
  if (view === 'dashboard' && selectedStore) return (
    <AdminDashboard store={selectedStore} groupCode={groupCode} onLogout={handleLogout} />
  )
  return null
}
