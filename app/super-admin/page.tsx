'use client'

// 事前にSupabaseで以下を実行してください：
// ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_open boolean DEFAULT false;
// CREATE POLICY "stores_anon_update" ON stores FOR UPDATE TO anon USING (true) WITH CHECK (true);

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, ExternalLink, ShieldCheck } from 'lucide-react'
import type { Store } from '@/types/database'

const SUPER_ADMIN_PIN = process.env.NEXT_PUBLIC_SUPER_ADMIN_PIN || '9999'

interface StoreStats {
  store: Store
  waiting: number
  calling: number
  completed: number
  total: number
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
      if (next === SUPER_ADMIN_PIN) {
        sessionStorage.setItem('super_admin_auth', '1')
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
        <div className="text-5xl mb-4">🏢</div>
        <h1 className="text-2xl font-bold text-white">総管理ダッシュボード</h1>
        <p className="text-gray-400 text-sm mt-1">PINを入力してください</p>
      </div>

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
// 総管理ダッシュボード
// ============================================================
function SuperDashboard() {
  const [storeStats, setStoreStats] = useState<StoreStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/super-admin/stats')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFetchError(`サーバーエラー: ${body.error ?? res.statusText}`)
        return
      }
      const body = await res.json()
      if (!body.stats || body.stats.length === 0) {
        setFetchError('storesテーブルにデータがありません（RLSポリシーまたはデータ未挿入）')
      }
      setStoreStats(body.stats ?? [])
      setLastUpdated(new Date())
    } catch (e) {
      setFetchError(`ネットワークエラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30000)
    return () => clearInterval(id)
  }, [fetchAll])

  const totalWaiting   = storeStats.reduce((s, x) => s + x.waiting, 0)
  const totalCompleted = storeStats.reduce((s, x) => s + x.completed, 0)
  const totalAll       = storeStats.reduce((s, x) => s + x.total, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="px-4 py-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-black">🏢 総管理ダッシュボード</h1>
            {lastUpdated && (
              <p className="text-gray-500 text-xs mt-0.5">
                最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
              </p>
            )}
          </div>
          <button
            onClick={fetchAll}
            disabled={refreshing}
            className="p-2 rounded-xl bg-gray-700 active:scale-90 transition-transform disabled:opacity-50"
            aria-label="手動更新"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {fetchError && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 mb-4 text-sm text-red-300 break-all">
            ⚠️ {fetchError}
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl p-4 mb-6 mt-4">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">全店合計</p>
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="合計受付" value={totalAll}       color="text-white" />
            <SummaryCard label="全待機数" value={totalWaiting}   color="text-blue-400" />
            <SummaryCard label="全完了数" value={totalCompleted} color="text-green-400" />
          </div>
        </div>

        <div className="space-y-3">
          {storeStats.map(({ store, waiting, calling, completed, total }) => (
            <div key={store.id} className="bg-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-black">{store.name}</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  store.is_open
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {store.is_open ? '受付中' : '停止'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                <MiniStatCard label="合計" value={total}     color="text-white" />
                <MiniStatCard label="待機" value={waiting}   color="text-blue-400" />
                <MiniStatCard label="呼出" value={calling}   color="text-yellow-400" />
                <MiniStatCard label="完了" value={completed} color="text-green-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/${store.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors text-sm font-bold"
                >
                  <ExternalLink size={13} />顧客受付ページ
                </a>
                <button
                  onClick={() => {
                    sessionStorage.setItem('admin_auth', '1')
                    sessionStorage.setItem('admin_store_id', store.id)
                    window.open(`/${store.id}/admin`, '_blank')
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 transition-colors text-sm font-bold"
                >
                  <ShieldCheck size={13} />店舗管理画面
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">30秒ごとに自動更新</p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-4xl font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-gray-400 text-xs mt-0.5">{label}</div>
    </div>
  )
}

function MiniStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-700 rounded-xl py-2">
      <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-gray-400 text-xs">{label}</div>
    </div>
  )
}

// ============================================================
// ページエントリーポイント
// ============================================================
export default function SuperAdminPage() {
  const [authed, setAuthed] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('super_admin_auth') === '1') {
      setAuthed(true)
    }
    setChecked(true)
  }, [])

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />

  return <SuperDashboard />
}
