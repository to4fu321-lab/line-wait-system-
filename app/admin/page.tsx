'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BellRing, CheckCheck, UserX, RefreshCw, Clock,
  Users, AlertTriangle, Loader2
} from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueStatus } from '@/types/database'
import { CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS } from '@/types/database'

// ============================================================
// 設定
// ============================================================
// 簡易PIN認証（実運用ではSupabase Authに変更推奨）
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '1234'

// ============================================================
// 型・定数
// ============================================================
const STATUS_STYLES: Record<QueueStatus, { badge: string; row: string }> = {
  waiting:   { badge: 'bg-blue-100 text-blue-700',   row: 'bg-white hover:bg-blue-50' },
  calling:   { badge: 'bg-yellow-100 text-yellow-700', row: 'bg-yellow-50' },
  completed: { badge: 'bg-green-100 text-green-600',  row: 'bg-gray-50 opacity-60' },
  cancelled: { badge: 'bg-gray-100 text-gray-500',    row: 'bg-gray-50 opacity-50' },
}

// ============================================================
// PIN認証画面
// ============================================================
function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        sessionStorage.setItem('admin_auth', '1')
        onAuth()
      } else {
        setTimeout(() => {
          setPin('')
          setError(true)
        }, 400)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-white">スタッフ専用</h1>
        <p className="text-gray-400 mt-1">PINを入力してください</p>
      </div>

      {/* PINドット */}
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full transition-all ${
              pin.length > i
                ? error ? 'bg-red-500' : 'bg-blue-400'
                : 'bg-gray-600'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4 font-medium">PINが違います</p>}

      {/* テンキー */}
      <div className="grid grid-cols-3 gap-4 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button
            key={i}
            onClick={() => d === '⌫' ? setPin(p => p.slice(0, -1)) : d && handleDigit(d)}
            className={`h-16 rounded-2xl text-2xl font-bold transition-all active:scale-90 ${
              d === '' ? 'invisible' :
              d === '⌫' ? 'bg-gray-700 text-gray-300' :
              'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 統計ヘッダー
// ============================================================
function StatsHeader({
  queues,
  onRefresh,
  refreshing,
}: {
  queues: Queue[]
  onRefresh: () => void
  refreshing: boolean
}) {
  const waiting = queues.filter(q => q.status === 'waiting').length
  const calling = queues.filter(q => q.status === 'calling').length
  const completed = queues.filter(q => q.status === 'completed').length
  const total = queues.length

  return (
    <div className="bg-gray-900 text-white">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black">管理ダッシュボード</h1>
            <p className="text-gray-400 text-xs mt-0.5">
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-gray-700 active:scale-90 transition-transform"
            aria-label="更新"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <StatCard label="本日合計" value={total} color="text-white" />
          <StatCard label="待機中" value={waiting} color="text-blue-400" />
          <StatCard label="呼出中" value={calling} color="text-yellow-400" />
          <StatCard label="完了" value={completed} color="text-green-400" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-3 text-center">
      <div className={`text-3xl font-black ${color} tabular-nums`}>{value}</div>
      <div className="text-gray-400 text-xs mt-0.5">{label}</div>
    </div>
  )
}

// ============================================================
// チケットカード
// ============================================================
function TicketCard({ ticket, onAction }: {
  ticket: Queue
  onAction: (id: string, status: QueueStatus) => Promise<void>
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const styles = STATUS_STYLES[ticket.status]

  const handleAction = async (status: QueueStatus) => {
    setLoading(status)
    await onAction(ticket.id, status)
    setLoading(null)
  }

  const waitMinutes = Math.floor(
    (Date.now() - new Date(ticket.created_at).getTime()) / 60000
  )

  return (
    <div className={`rounded-2xl border border-gray-100 p-4 transition-all ${styles.row}`}>
      <div className="flex items-start justify-between gap-3">
        {/* 番号 */}
        <div className="shrink-0 text-center">
          <div className="text-4xl font-black text-gray-800 tabular-nums leading-none">
            {String(ticket.ticket_number).padStart(3, '0')}
          </div>
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-0.5">
            <Clock size={10} />
            {waitMinutes}分前
          </div>
        </div>

        {/* 情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
              {STATUS_LABELS[ticket.status]}
            </span>
            <span className="text-xs text-gray-500">
              {CATEGORY_ICONS[ticket.category]} {CATEGORY_LABELS[ticket.category]}
            </span>
          </div>
          <p className="font-bold text-gray-800 text-lg mt-1 truncate">{ticket.customer_name} 様</p>
          <p className="text-gray-500 text-sm truncate">{ticket.school_name}</p>
        </div>
      </div>

      {/* アクションボタン（待機中・呼出中のみ表示） */}
      {(ticket.status === 'waiting' || ticket.status === 'calling') && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {ticket.status === 'waiting' && (
            <ActionButton
              label="呼出"
              icon={<BellRing size={16} />}
              color="bg-yellow-500 text-white"
              loading={loading === 'calling'}
              onClick={() => handleAction('calling')}
            />
          )}
          {ticket.status === 'calling' && (
            <ActionButton
              label="完了"
              icon={<CheckCheck size={16} />}
              color="bg-green-500 text-white"
              loading={loading === 'completed'}
              onClick={() => handleAction('completed')}
            />
          )}
          {ticket.status === 'calling' && (
            <ActionButton
              label="再呼出"
              icon={<BellRing size={16} />}
              color="bg-orange-400 text-white"
              loading={false}
              onClick={() => {
                // ステータスを一旦 waitingにして再度 calling にする
                handleAction('waiting').then(() => handleAction('calling'))
              }}
            />
          )}
          <ActionButton
            label="不在"
            icon={<UserX size={16} />}
            color="bg-gray-200 text-gray-600"
            loading={loading === 'cancelled'}
            onClick={() => handleAction('cancelled')}
          />
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label, icon, color, loading, onClick
}: {
  label: string
  icon: React.ReactNode
  color: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-base transition-all active:scale-95 disabled:opacity-50 ${color}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

// ============================================================
// メイン管理画面
// ============================================================
function AdminDashboard() {
  const [queues, setQueues] = useState<Queue[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<QueueStatus | 'active'>('active')
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchQueues = useCallback(async () => {
    setRefreshing(true)
    const { data } = await supabase
      .from('queues')
      .select('*')
      .gte('created_at', getTodayStart())
      .order('ticket_number', { ascending: true })

    if (data) setQueues(data)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchQueues()

    const channel = supabase
      .channel('admin-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, payload => {
        if (payload.eventType === 'INSERT') {
          setQueues(prev => [...prev, payload.new as Queue].sort((a, b) => a.ticket_number - b.ticket_number))
        } else if (payload.eventType === 'UPDATE') {
          setQueues(prev => prev.map(q => q.id === payload.new.id ? payload.new as Queue : q))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchQueues])

  const handleAction = async (id: string, status: QueueStatus) => {
    setActionError(null)

    const { error } = await supabase
      .from('queues')
      .update({ status })
      .eq('id', id)

    if (error) {
      setActionError('更新に失敗しました: ' + error.message)
      return
    }

    // statusが calling のとき LINE通知を叩く
    if (status === 'calling') {
      const target = queues.find(q => q.id === id)
      if (target) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUserId: target.line_user_id,
            ticketNumber: target.ticket_number,
            customerName: target.customer_name,
          }),
        }).catch(console.error)
      }
    }
  }

  const filteredQueues = queues.filter(q => {
    if (filter === 'active') return q.status === 'waiting' || q.status === 'calling'
    return q.status === filter
  })

  const callingTicket = queues.find(q => q.status === 'calling')

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <StatsHeader queues={queues} onRefresh={fetchQueues} refreshing={refreshing} />

      {/* 現在呼出中バナー */}
      {callingTicket && (
        <div className="bg-yellow-400 px-4 py-3 flex items-center gap-3">
          <BellRing size={20} className="text-yellow-800 shrink-0" />
          <span className="font-bold text-yellow-900">
            呼出中：No.{String(callingTicket.ticket_number).padStart(3, '0')} {callingTicket.customer_name} 様
          </span>
        </div>
      )}

      {/* エラー表示 */}
      {actionError && (
        <div className="mx-4 mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          <AlertTriangle size={16} />
          {actionError}
        </div>
      )}

      {/* フィルタータブ */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 bg-white rounded-2xl p-1 shadow-sm">
          {[
            { key: 'active', label: '対応中', icon: <Users size={14} /> },
            { key: 'waiting', label: '待機', icon: <Clock size={14} /> },
            { key: 'calling', label: '呼出', icon: <BellRing size={14} /> },
            { key: 'completed', label: '完了', icon: <CheckCheck size={14} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === tab.key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* チケットリスト */}
      <div className="flex-1 px-4 pb-8 space-y-3 overflow-y-auto">
        {filteredQueues.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">該当する受付がありません</p>
          </div>
        ) : (
          filteredQueues.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// ページエントリーポイント（PIN認証付き）
// ============================================================
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === '1') {
      setAuthed(true)
    }
  }, [])

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />
  return <AdminDashboard />
}
