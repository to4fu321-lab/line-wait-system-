'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Bell, BellOff, Store, Clock, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../../_components/BottomNav'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BAmZx5b8ScrgrqWa822FdQhtfHV2CSyqvxNeQX-Ds1KsqztPPRtZRyBP_LaQZmCLejg8Ivd7Gu4cBxKtNwodb3o'

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type DayHours = { open: string; close: string; closed: boolean }
type BusinessHours = { hours: Partial<Record<DayKey, DayHours>> }

const DAY_LABELS: { key: DayKey; label: string; color: string }[] = [
  { key: 'mon', label: '月', color: 'text-zinc-300' },
  { key: 'tue', label: '火', color: 'text-zinc-300' },
  { key: 'wed', label: '水', color: 'text-zinc-300' },
  { key: 'thu', label: '木', color: 'text-zinc-300' },
  { key: 'fri', label: '金', color: 'text-zinc-300' },
  { key: 'sat', label: '土', color: 'text-blue-400'  },
  { key: 'sun', label: '日', color: 'text-red-400'   },
]

const DEFAULT_HOURS: BusinessHours = {
  hours: {
    mon: { open: '10:00', close: '19:00', closed: false },
    tue: { open: '10:00', close: '19:00', closed: false },
    wed: { open: '10:00', close: '19:00', closed: false },
    thu: { open: '10:00', close: '19:00', closed: false },
    fri: { open: '10:00', close: '19:00', closed: false },
    sat: { open: '10:00', close: '18:00', closed: false },
    sun: { open: '10:00', close: '18:00', closed: true  },
  },
}

function BigToggle({ on, onToggle, label, sub, emoji, color }: {
  on: boolean; onToggle: () => void; label: string; sub: string; emoji: string
  color: 'indigo' | 'amber'
}) {
  const active = {
    indigo: 'border-indigo-500 bg-indigo-500/10',
    amber:  'border-amber-500 bg-amber-500/10',
  }[color]
  const textActive = { indigo: 'text-indigo-300', amber: 'text-amber-300' }[color]
  const trackActive = { indigo: 'bg-indigo-500', amber: 'bg-amber-500' }[color]
  const iconBg = { indigo: 'bg-indigo-500/20', amber: 'bg-amber-500/20' }[color]
  return (
    <button type="button" onClick={onToggle} style={{ touchAction: 'manipulation' }}
      className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
        on ? active : 'border-zinc-700 bg-zinc-800/50'
      }`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl ${on ? iconBg : 'bg-zinc-800'}`}>
        {emoji}
      </div>
      <div className="text-left flex-1">
        <p className={`font-black text-lg leading-tight ${on ? textActive : 'text-zinc-400'}`}>
          {label}&nbsp;&nbsp;{on ? 'オン' : 'オフ'}
        </p>
        <p className="text-zinc-500 text-sm mt-0.5">{sub}</p>
      </div>
      <div className={`w-14 h-7 rounded-full transition-colors shrink-0 ${on ? trackActive : 'bg-zinc-600'}`}>
        <div className={`w-6 h-6 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${on ? 'translate-x-7' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

export default function StaffSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [storeName,     setStoreName]     = useState('')
  const [loading,       setLoading]       = useState(true)
  const [allowRemote,   setAllowRemote]   = useState(false)
  const [isTestMode,    setIsTestMode]    = useState(false)
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [pushStatus,    setPushStatus]    = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('PushManager' in window)) {
      setPushStatus('unsupported'); return
    }
    const perm = (window as any).Notification.permission
    if (perm === 'granted') setPushStatus('granted')
    else if (perm === 'denied') setPushStatus('denied')
  }, [])

  const fetchSettings = useCallback(async () => {
    if (!storeId) return
    const { data } = await (supabase as any)
      .from('stores')
      .select('name, allow_remote, is_test_mode, business_hours')
      .eq('id', storeId).single()
    if (data) {
      setStoreName(data.name ?? '')
      if (data.allow_remote != null) setAllowRemote(data.allow_remote)
      if (data.is_test_mode != null) setIsTestMode(data.is_test_mode)
      if (data.business_hours?.hours) setBusinessHours(data.business_hours)
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const setupPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
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
  }

  const handleTestModeToggle = async () => {
    const next = !isTestMode
    setIsTestMode(next)
    await fetch('/api/test/mode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, enabled: next }),
    })
  }

  const handleSave = async () => {
    if (!storeId) return
    setSaving(true); setSaveError(null)
    const { error } = await (supabase as any).from('stores')
      .update({ allow_remote: allowRemote, business_hours: businessHours })
      .eq('id', storeId)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-zinc-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-black text-white">設定</h1>
          {storeName && <p className="text-sm text-zinc-500 mt-0.5">{storeName}</p>}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-32">

        {/* ① 受付通知 */}
        <button
          onClick={() => { if (pushStatus !== 'granted' && pushStatus !== 'unsupported') setupPush() }}
          disabled={pushStatus === 'granted' || pushStatus === 'unsupported'}
          style={{ touchAction: 'manipulation' }}
          className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
            pushStatus === 'granted'     ? 'border-emerald-500/60 bg-emerald-500/10 cursor-default' :
            pushStatus === 'denied'      ? 'border-red-500/40 bg-red-500/10' :
            pushStatus === 'unsupported' ? 'border-zinc-700 bg-zinc-800/40 cursor-not-allowed opacity-60' :
            'border-indigo-500/50 bg-indigo-500/10 hover:border-indigo-400'
          }`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
            pushStatus === 'granted' ? 'bg-emerald-500/20' :
            pushStatus === 'denied'  ? 'bg-red-500/20' : 'bg-indigo-500/20'
          }`}>
            {pushStatus === 'denied'
              ? <BellOff size={28} className="text-red-400" />
              : <Bell size={28} className={pushStatus === 'granted' ? 'text-emerald-400' : 'text-indigo-400'} />}
          </div>
          <div className="text-left flex-1">
            <p className={`font-black text-lg leading-tight ${
              pushStatus === 'granted' ? 'text-emerald-300' :
              pushStatus === 'denied'  ? 'text-red-300' : 'text-white'
            }`}>
              {pushStatus === 'granted'     ? '受付通知　オン' :
               pushStatus === 'denied'      ? '通知がブロック中' :
               pushStatus === 'unsupported' ? '通知非対応' :
               '受付通知をオンにする'}
            </p>
            <p className="text-zinc-500 text-sm mt-1">
              {pushStatus === 'granted'     ? 'お客様が受付したとき通知が届きます' :
               pushStatus === 'denied'      ? 'ブラウザの設定から通知を許可してください' :
               pushStatus === 'unsupported' ? 'このブラウザは通知に対応していません' :
               'タップしてこの端末で通知を受け取る'}
            </p>
          </div>
          {pushStatus === 'granted' && (
            <div className="shrink-0 w-4 h-4 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
          )}
        </button>

        {/* ② 店舗を切り替える */}
        <button
          onClick={() => {
            sessionStorage.removeItem('admin_auth')
            sessionStorage.removeItem('admin_store_id')
            window.location.href = `/${storeId}/admin`
          }}
          style={{ touchAction: 'manipulation' }}
          className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-zinc-700/50 bg-zinc-900/60 hover:bg-zinc-800/60 active:scale-[0.98] transition-all">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Store size={28} className="text-zinc-400" />
          </div>
          <div className="text-left flex-1">
            <p className="font-black text-lg text-zinc-200">店舗を切り替える</p>
            <p className="text-zinc-500 text-sm mt-1">別の店舗に切り替えます（再ログインが必要）</p>
          </div>
        </button>

        {/* ③ 営業時間 */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3">
            <Clock size={20} className="text-zinc-400" />
            <p className="font-black text-lg text-zinc-100">営業時間</p>
          </div>
          {DAY_LABELS.map(({ key, label, color }) => {
            const h = businessHours.hours[key] ?? DEFAULT_HOURS.hours[key]!
            const update = (patch: Partial<DayHours>) =>
              setBusinessHours(prev => ({ hours: { ...prev.hours, [key]: { ...h, ...patch } } }))
            return (
              <div key={key} className={`flex items-center gap-3 px-4 py-3 border-t border-zinc-800/60 ${h.closed ? 'opacity-40' : ''}`}>
                <span className={`w-7 text-base font-black text-center ${color}`}>{label}</span>
                {h.closed ? (
                  <span className="flex-1 text-zinc-500 text-base">定休日</span>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="time" value={h.open} onChange={e => update({ open: e.target.value })}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-base text-white focus:border-indigo-500 focus:outline-none w-28" />
                    <span className="text-zinc-600">〜</span>
                    <input type="time" value={h.close} onChange={e => update({ close: e.target.value })}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-base text-white focus:border-indigo-500 focus:outline-none w-28" />
                  </div>
                )}
                <button onClick={() => update({ closed: !h.closed })}
                  className={`shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                    h.closed ? 'bg-zinc-700 text-zinc-400 hover:bg-emerald-900/40 hover:text-emerald-300' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                  }`}>
                  {h.closed ? '開店' : '定休'}
                </button>
              </div>
            )
          })}
        </div>

        {/* ④ 遠隔チェックイン */}
        <BigToggle
          on={allowRemote}
          onToggle={() => setAllowRemote(v => !v)}
          label="遠隔チェックイン"
          sub={allowRemote ? '来店前の順番取りを許可しています' : '現地受付のみです'}
          emoji="🏠"
          color="indigo"
        />

        {/* ⑤ 練習モード */}
        <BigToggle
          on={isTestMode}
          onToggle={handleTestModeToggle}
          label="練習モード"
          sub={isTestMode ? '練習中 — LINE・通知は送信されません' : 'オフ — 本番として動作します'}
          emoji="🧪"
          color="amber"
        />

        {/* 保存 */}
        {saveError && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">{saveError}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${
            saved ? 'bg-emerald-600 text-white shadow-emerald-900/40' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40'
          }`}>
          {saved
            ? <><Check size={20} />保存しました</>
            : saving
            ? <><Loader2 size={20} className="animate-spin" />保存中...</>
            : '設定を保存'}
        </button>

      </div>

      <BottomNav />
    </div>
  )
}
