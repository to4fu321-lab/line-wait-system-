'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, RefreshCw, ShieldCheck, Scissors, Package,
  ShoppingBag, CreditCard, Users, ExternalLink, Store,
} from 'lucide-react'

// ── 型 ────────────────────────────────────────────────────────
interface StoreStats {
  store: { id: string; name: string; is_open: boolean }
  repairReceived:     number
  repairCompleted:    number
  purchaseInProgress: number
  purchaseArrived:    number
  unpaidCount:        number
  queueWaiting:       number
  queueCalling:       number
}
interface CompanyData {
  company: { id: string; name: string; code: string }
  stores:  StoreStats[]
}

// ── PIN認証画面 ────────────────────────────────────────────────
function PinScreen({
  companyName, companyId, onAuth,
}: { companyName?: string; companyId: string; onAuth: (data: CompanyData) => void }) {
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDigit = async (d: string) => {
    if (loading) return
    if (d === '⌫') { setPin(p => p.slice(0, -1)); setError(null); return }
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError(null)
    if (next.length === 4) {
      setLoading(true)
      try {
        const res = await fetch(`/api/company/${companyId}/stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: next }),
        })
        const json = await res.json()
        if (!res.ok) {
          setTimeout(() => { setPin(''); setError(json.error ?? '認証失敗'); setLoading(false) }, 400)
          return
        }
        sessionStorage.setItem(`company_auth_${companyId}`, next)
        onAuth(json)
      } catch {
        setTimeout(() => { setPin(''); setError('通信エラー'); setLoading(false) }, 400)
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">🏢</span>
        </div>
        <h1 className="text-2xl font-black text-white">
          {companyName ?? '会社管理画面'}
        </h1>
        <p className="text-zinc-400 text-sm mt-1">PINを入力してください</p>
      </div>

      <div className="flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full transition-all ${
            pin.length > i
              ? error ? 'bg-red-500' : loading ? 'bg-indigo-300 animate-pulse' : 'bg-indigo-400'
              : 'bg-zinc-700'
          }`} />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4 font-medium">{error}</p>}

      <div className="grid grid-cols-3 gap-4 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i}
            onClick={() => d === '⌫' ? handleDigit('⌫') : d && handleDigit(d)}
            disabled={loading}
            className={`h-16 rounded-2xl text-2xl font-bold transition-all active:scale-90 disabled:opacity-40 ${
              d === '' ? 'invisible' :
              d === '⌫' ? 'bg-zinc-800 text-zinc-300' :
              'bg-zinc-800 text-white hover:bg-zinc-700'
            }`}>
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 店舗カード ─────────────────────────────────────────────────
function StoreCard({ s }: { s: StoreStats }) {
  const totalPending = s.repairReceived + s.repairCompleted + s.purchaseInProgress + s.purchaseArrived
  const hasQueue     = s.queueWaiting > 0 || s.queueCalling > 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
      {/* 店舗ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Store size={16} className="text-indigo-400" />
          </div>
          <div>
            <p className="font-black text-white text-sm">{s.store.name}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              s.store.is_open
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-700 text-zinc-500 border border-zinc-600'
            }`}>
              {s.store.is_open ? '受付中' : '停止中'}
            </span>
          </div>
        </div>
        {totalPending > 0 && (
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black px-2.5 py-1 rounded-full">
            未対応 {totalPending}件
          </span>
        )}
      </div>

      {/* 統計グリッド */}
      <div className="grid grid-cols-2 gap-2">
        <StatCell icon={<Scissors size={12} className="text-amber-400" />}
          label="お直し預かり" value={s.repairReceived} accent="amber" />
        <StatCell icon={<Scissors size={12} className="text-emerald-400" />}
          label="お直し完了待ち" value={s.repairCompleted} accent="emerald" />
        <StatCell icon={<ShoppingBag size={12} className="text-blue-400" />}
          label="発注・入荷待ち" value={s.purchaseInProgress} accent="blue" />
        <StatCell icon={<Package size={12} className="text-teal-400" />}
          label="お渡し待ち" value={s.purchaseArrived} accent="teal" />
      </div>

      {/* 未払い・順番待ち */}
      <div className="flex gap-2">
        {s.unpaidCount > 0 && (
          <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/20 rounded-xl px-3 py-2 flex-1">
            <CreditCard size={12} className="text-red-400" />
            <span className="text-red-400 text-xs font-bold">未払い {s.unpaidCount}件</span>
          </div>
        )}
        {hasQueue && (
          <div className="flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-500/20 rounded-xl px-3 py-2 flex-1">
            <Users size={12} className="text-indigo-400" />
            <span className="text-indigo-400 text-xs font-bold">
              待機{s.queueWaiting} / 呼出{s.queueCalling}
            </span>
          </div>
        )}
      </div>

      {/* 管理画面リンク */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <a href={`/${s.store.id}/admin/repairs`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold active:scale-95 transition-all">
          <Scissors size={12} />お直し管理
        </a>
        <a href={`/${s.store.id}/admin/crm`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-700/50 border border-zinc-600/50 text-zinc-300 text-xs font-bold active:scale-95 transition-all">
          <ExternalLink size={12} />顧客管理
        </a>
      </div>
      <a href={`/${s.store.id}/admin`} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold active:scale-95 transition-all w-full">
        <ShieldCheck size={12} />店舗管理（全機能）
      </a>
    </div>
  )
}

function StatCell({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number
  accent: 'amber' | 'emerald' | 'blue' | 'teal'
}) {
  const bg = {
    amber:   'bg-amber-950/30 border-amber-500/15',
    emerald: 'bg-emerald-950/30 border-emerald-500/15',
    blue:    'bg-blue-950/30 border-blue-500/15',
    teal:    'bg-teal-950/30 border-teal-500/15',
  }[accent]

  return (
    <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${bg}`}>
      {icon}
      <div className="min-w-0">
        <p className="text-zinc-500 text-[10px] leading-tight truncate">{label}</p>
        <p className="text-white font-black text-lg leading-tight">{value}</p>
      </div>
    </div>
  )
}

// ── 会社ダッシュボード ──────────────────────────────────────────
function CompanyDashboard({
  companyId, initialData,
}: { companyId: string; initialData: CompanyData }) {
  const [data,       setData]       = useState<CompanyData>(initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated,setLastUpdated]= useState(new Date())

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const pin = sessionStorage.getItem(`company_auth_${companyId}`) ?? ''
    try {
      const res  = await fetch(`/api/company/${companyId}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const json = await res.json()
      if (res.ok) { setData(json); setLastUpdated(new Date()) }
    } finally {
      setRefreshing(false)
    }
  }, [companyId])

  useEffect(() => {
    const id = setInterval(refresh, 60000)
    return () => clearInterval(id)
  }, [refresh])

  const totalPending = data.stores.reduce((s, x) =>
    s + x.repairReceived + x.repairCompleted + x.purchaseInProgress + x.purchaseArrived, 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ヘッダー */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              🏢 {data.company.name}
            </h1>
            <p className="text-zinc-500 text-xs">
              {lastUpdated.toLocaleTimeString('ja-JP')} 時点
            </p>
          </div>
          <button onClick={refresh} disabled={refreshing}
            className="p-2 rounded-xl bg-zinc-800 active:scale-90 transition-transform disabled:opacity-50">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 合計サマリー */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">
            {data.stores.length}店舗 合計
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-3xl font-black text-white">{totalPending}</p>
              <p className="text-zinc-500 text-xs mt-0.5">未対応</p>
            </div>
            <div>
              <p className="text-3xl font-black text-amber-400">
                {data.stores.reduce((s, x) => s + x.repairReceived, 0)}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">お直し預かり</p>
            </div>
            <div>
              <p className="text-3xl font-black text-red-400">
                {data.stores.reduce((s, x) => s + x.unpaidCount, 0)}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">未払い</p>
            </div>
          </div>
        </div>

        {/* 店舗カード */}
        {data.stores.map(s => <StoreCard key={s.store.id} s={s} />)}

        {data.stores.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Store size={40} className="mx-auto mb-3 opacity-30" />
            <p>この会社に店舗が登録されていません</p>
          </div>
        )}

        <div className="flex justify-center pt-2">
          <a href="/super-admin" className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
            総管理ダッシュボードへ
          </a>
        </div>
      </div>
    </div>
  )
}

// ── ページエントリーポイント ────────────────────────────────────
export default function CompanyAdminPage() {
  const params    = useParams<{ companyId: string }>()
  const companyId = params?.companyId ?? ''

  const [checked, setChecked]   = useState(false)
  const [data,    setData]      = useState<CompanyData | null>(null)

  useEffect(() => {
    const savedPin = sessionStorage.getItem(`company_auth_${companyId}`)
    if (!savedPin) { setChecked(true); return }

    // 保存済みPINで自動認証
    fetch(`/api/company/${companyId}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: savedPin }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json) setData(json) })
      .finally(() => setChecked(true))
  }, [companyId])

  if (!checked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-zinc-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <PinScreen
        companyId={companyId}
        companyName={
          companyId === 'tanaka' ? '学生服のタナカ' :
          companyId === 'himonoya' ? 'ひものや' : undefined
        }
        onAuth={json => setData(json)}
      />
    )
  }

  return <CompanyDashboard companyId={companyId} initialData={data} />
}
