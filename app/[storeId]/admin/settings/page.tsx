'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  Settings, Loader2, Plus, Trash2, GraduationCap, AlertCircle, Save,
  CalendarDays, Clock, CheckCheck, LayoutDashboard, Store, Key, Bell, BellOff,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { WaitThreshold } from '@/types/database'
import { DEFAULT_THRESHOLDS } from '@/types/database'
import { BottomNav } from '../_components/BottomNav'
import ColorPicker from '@/app/_components/ColorPicker'

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

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
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

function Toggle({ on, onToggle, label, sub }: { on: boolean; onToggle: () => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={onToggle}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${on ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/50'}`}>
      <div className="text-left">
        <p className={`font-bold text-sm ${on ? 'text-indigo-300' : 'text-zinc-400'}`}>{label}</p>
        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-indigo-500' : 'bg-zinc-600'}`}>
        <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${on ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

function SectionLabel({ title }: { title: string }) {
  return <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</p>
}

export default function SettingsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [loading,           setLoading]           = useState(true)
  const [saving,            setSaving]            = useState(false)
  const [saved,             setSaved]             = useState(false)
  const [noticeThreshold,   setNoticeThreshold]   = useState(3)
  const [waitThresholds,    setWaitThresholds]    = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)
  const [allowRemote,       setAllowRemote]       = useState(false)
  const [notificationPlan,  setNotificationPlan]  = useState<'calling_only' | 'full'>('calling_only')
  const [pushQueueNew,      setPushQueueNew]      = useState(true)
  const [alertDaysRepair,   setAlertDaysRepair]   = useState(7)
  const [alertDaysPurchase, setAlertDaysPurchase] = useState(7)
  const [schoolNames,       setSchoolNames]       = useState<string[]>([])
  const [storeName,         setStoreName]         = useState('')
  const [isTestMode,        setIsTestMode]        = useState(false)
  const [repairNotes,       setRepairNotes]       = useState('')

  const [storePin,          setStorePin]          = useState('')
  const [themeColor,        setThemeColor]        = useState<string | null>(null)
  const [basicSaving,       setBasicSaving]       = useState(false)
  const [basicSaved,        setBasicSaved]        = useState(false)
  const [basicError,        setBasicError]        = useState<string | null>(null)
  const [showColorPicker,   setShowColorPicker]   = useState(false)

  const [welcomeMessage,    setWelcomeMessage]    = useState('')
  const [noticeText,        setNoticeText]        = useState('')
  const [businessHours,     setBusinessHours]     = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS)
  const [saveError,         setSaveError]         = useState<string | null>(null)

  // プッシュ通知ステータス
  const [pushStatus, setPushStatus] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')

  // ── 予約設定 ──────────────────────────────────────────────
  type ResvSetting = {
    service_type: string; label: string; duration_min: number
    start_time: string; end_time: string; is_active: boolean
    slots_sun: number; slots_mon: number; slots_tue: number; slots_wed: number
    slots_thu: number; slots_fri: number; slots_sat: number
  }
  const DEFAULT_RESV: ResvSetting[] = [
    { service_type: 'uniform', label: '制服採寸', duration_min: 60, start_time: '10:00', end_time: '17:00',
      is_active: true, slots_sun: 0, slots_mon: 2, slots_tue: 2, slots_wed: 2, slots_thu: 2, slots_fri: 2, slots_sat: 3 },
    { service_type: 'jersey', label: 'ジャージ採寸', duration_min: 30, start_time: '10:00', end_time: '17:00',
      is_active: true, slots_sun: 0, slots_mon: 2, slots_tue: 2, slots_wed: 2, slots_thu: 2, slots_fri: 2, slots_sat: 3 },
  ]
  const [resvSettings,      setResvSettings]      = useState<ResvSetting[]>(DEFAULT_RESV)
  const [resvLoading,       setResvLoading]       = useState(false)
  const [resvSaved,         setResvSaved]         = useState(false)
  const [resvError,         setResvError]         = useState<string | null>(null)
  const [resvTableOk,       setResvTableOk]       = useState<boolean | null>(null)
  const [richmenuApplying,  setRichmenuApplying]  = useState(false)
  const [richmenuMsg,       setRichmenuMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data } = await (supabase as any)
      .from('stores')
      .select('name, pin, theme_color, notice_threshold, wait_thresholds, allow_remote, notification_plan, push_settings, alert_days_repair, alert_days_purchase, school_names, is_test_mode, repair_notes, welcome_message, notice_text, business_hours')
      .eq('id', storeId)
      .single()
    if (data) {
      setStoreName(data.name ?? '')
      setStorePin(data.pin ?? '')
      setThemeColor(data.theme_color ?? null)
      if (data.notice_threshold != null) setNoticeThreshold(data.notice_threshold)
      if (Array.isArray(data.wait_thresholds) && data.wait_thresholds.length > 0)
        setWaitThresholds(data.wait_thresholds as WaitThreshold[])
      if (data.allow_remote != null) setAllowRemote(data.allow_remote)
      if (data.notification_plan) setNotificationPlan(data.notification_plan)
      if (data.push_settings?.queue_new != null) setPushQueueNew(data.push_settings.queue_new)
      if (data.alert_days_repair != null) setAlertDaysRepair(data.alert_days_repair)
      if (data.alert_days_purchase != null) setAlertDaysPurchase(data.alert_days_purchase)
      if (Array.isArray(data.school_names)) setSchoolNames(data.school_names)
      if (data.is_test_mode != null) setIsTestMode(data.is_test_mode)
      if (data.repair_notes != null) setRepairNotes(data.repair_notes)
      if (data.welcome_message != null) setWelcomeMessage(data.welcome_message)
      if (data.notice_text != null) setNoticeText(data.notice_text)
      if (data.business_hours?.hours) setBusinessHours(data.business_hours)
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const fetchResvSettings = useCallback(async () => {
    if (!storeId) return
    const { data, error } = await (supabase as any)
      .from('reservation_settings').select('*').eq('store_id', storeId)
    if (error) { setResvTableOk(false); return }
    setResvTableOk(true)
    if (data && data.length > 0) {
      setResvSettings(prev => prev.map(s => {
        const row = data.find((d: ResvSetting & { store_id: string }) => d.service_type === s.service_type)
        return row ? { ...s, ...row } : s
      }))
    }
  }, [storeId])

  useEffect(() => { fetchResvSettings() }, [fetchResvSettings])

  // プッシュ通知の現在の権限状態をチェック
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('PushManager' in window)) {
      setPushStatus('unsupported'); return
    }
    const perm = (window as any).Notification.permission
    if (perm === 'granted') setPushStatus('granted')
    else if (perm === 'denied') setPushStatus('denied')
  }, [])

  const setupPush = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
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

  const handleResvSave = async () => {
    if (!storeId || !resvTableOk) return
    setResvLoading(true); setResvError(null)
    for (const s of resvSettings) {
      const { error } = await (supabase as any).from('reservation_settings').upsert({
        store_id: storeId, ...s,
      }, { onConflict: 'store_id,service_type' })
      if (error) { setResvError(error.message); setResvLoading(false); return }
    }
    setResvLoading(false); setResvSaved(true)
    setTimeout(() => setResvSaved(false), 2000)
  }

  const updateResv = (idx: number, patch: Partial<ResvSetting>) =>
    setResvSettings(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))

  async function handleBasicSave() {
    setBasicSaving(true); setBasicError(null)
    const { error } = await (supabase as any)
      .from('stores')
      .update({ name: storeName.trim(), pin: storePin, welcome_message: welcomeMessage || null, notice_text: noticeText || null })
      .eq('id', storeId)
    setBasicSaving(false)
    if (error) { setBasicError(error.message); return }
    setBasicSaved(true)
    setTimeout(() => setBasicSaved(false), 2000)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const { error } = await (supabase as any)
      .from('stores')
      .update({
        notice_threshold:    noticeThreshold,
        wait_thresholds:     waitThresholds,
        allow_remote:        allowRemote,
        notification_plan:   notificationPlan,
        push_settings:       { queue_new: pushQueueNew, purchase_new: true },
        alert_days_repair:   alertDaysRepair,
        alert_days_purchase: alertDaysPurchase,
        school_names:        schoolNames.filter((s: string) => s.trim()),
        repair_notes:        repairNotes || null,
        business_hours:      businessHours,
      })
      .eq('id', storeId)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function applyRichmenu() {
    setRichmenuApplying(true)
    setRichmenuMsg(null)
    try {
      const res = await fetch('/api/richmenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, storeName }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setRichmenuMsg({ ok: true, text: `登録完了 (ID: ${data.richMenuId?.slice(0, 12)}...)` })
    } catch (e) {
      setRichmenuMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setRichmenuApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-600">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-700/60 border border-zinc-600/50 flex items-center justify-center">
            <Settings size={17} className="text-zinc-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-zinc-100">設定</h1>
            {storeName && <p className="text-xs text-zinc-500 truncate">{storeName}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const gc = sessionStorage.getItem('admin_group_code')
              window.location.href = gc ? `/company/${gc}` : '/super-admin'
            }} title="会社管理ダッシュボード"
              className="p-2 rounded-xl bg-zinc-700/60 border border-zinc-600/50 hover:bg-zinc-600/60 active:opacity-60 transition-all text-zinc-400">
              <LayoutDashboard size={16} />
            </button>
            <div className="flex flex-col items-end gap-1">
              <button onClick={handleSave} disabled={saving}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'}`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saved ? '保存済み' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

        {/* ========================================================
            スタッフ操作（BottomNav設定タブから来るスタッフ向け）
            ======================================================== */}
        <div className="space-y-3">
          <SectionLabel title="スタッフ操作" />

          {/* ブラウザ通知 */}
          <button
            onClick={() => { if (pushStatus !== 'granted' && pushStatus !== 'unsupported') setupPush() }}
            disabled={pushStatus === 'granted' || pushStatus === 'unsupported'}
            style={{ touchAction: 'manipulation' }}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
              pushStatus === 'granted'     ? 'border-emerald-500/60 bg-emerald-500/10 cursor-default' :
              pushStatus === 'denied'      ? 'border-red-500/40 bg-red-500/10' :
              pushStatus === 'unsupported' ? 'border-zinc-700 bg-zinc-800/40 cursor-not-allowed opacity-60' :
              'border-indigo-500/50 bg-indigo-500/10 hover:border-indigo-400'
            }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              pushStatus === 'granted' ? 'bg-emerald-500/20' :
              pushStatus === 'denied'  ? 'bg-red-500/20' :
              'bg-indigo-500/20'
            }`}>
              {pushStatus === 'denied'
                ? <BellOff size={22} className="text-red-400" />
                : <Bell size={22} className={pushStatus === 'granted' ? 'text-emerald-400' : 'text-indigo-400'} />}
            </div>
            <div className="text-left flex-1">
              <p className={`font-bold text-base leading-tight ${
                pushStatus === 'granted' ? 'text-emerald-300' :
                pushStatus === 'denied'  ? 'text-red-300' : 'text-white'
              }`}>
                {pushStatus === 'granted'     ? '受付通知 ON' :
                 pushStatus === 'denied'      ? '通知がブロックされています' :
                 pushStatus === 'unsupported' ? '通知非対応の端末' :
                 '受付通知を有効にする'}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {pushStatus === 'granted'     ? 'お客様が受付したとき、この端末に通知が届きます' :
                 pushStatus === 'denied'      ? 'ブラウザの設定から通知を許可してください' :
                 pushStatus === 'unsupported' ? 'このブラウザは通知に対応していません' :
                 'タップしてこの端末で通知を受け取る'}
              </p>
            </div>
            {pushStatus === 'granted' && (
              <div className="shrink-0 w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
            )}
          </button>

          {/* 店舗を切り替える */}
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              sessionStorage.removeItem('admin_store_id')
              window.location.href = `/${storeId}/admin`
            }}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-zinc-700/50 bg-zinc-900/60 hover:bg-zinc-800/60 active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Store size={22} className="text-zinc-400" />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-base text-zinc-200">店舗を切り替える</p>
              <p className="text-zinc-500 text-xs mt-0.5">別の店舗に切り替えます（再ログインが必要）</p>
            </div>
          </button>
        </div>

        {/* ========================================================
            管理者設定セクション区切り
            ======================================================== */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-600 text-[11px] font-bold tracking-widest px-1">管理者設定</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <p className="text-xs text-zinc-700 -mt-3">以下はオーナー・管理者が設定する項目です</p>

        {/* 店舗基本情報 */}
        <div className="space-y-3">
          <SectionLabel title="店舗基本情報" />
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Store size={11} />店舗名
              </label>
              <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Key size={11} />管理PIN (4桁)
              </label>
              <input type="text" inputMode="numeric" maxLength={4} value={storePin} onChange={e => setStorePin(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">テーマカラー</label>
              <button onClick={() => setShowColorPicker(v => !v)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-300 hover:border-zinc-500 transition-colors w-full">
                <div className="w-4 h-4 rounded-full border border-zinc-600 shrink-0"
                  style={{ backgroundColor: themeColor?.startsWith('custom:') ? themeColor.slice(7) : undefined }} />
                <span>{themeColor ?? 'デフォルト（インディゴ）'}</span>
              </button>
              {showColorPicker && (
                <div className="mt-2">
                  <ColorPicker storeId={storeId} currentColor={themeColor}
                    onSaved={c => { setThemeColor(c); setShowColorPicker(false) }} />
                </div>
              )}
            </div>
            {basicError && <p className="text-xs text-red-400">{basicError}</p>}
            <button onClick={handleBasicSave} disabled={basicSaving}
              className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                basicSaved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
              }`}>
              {basicSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {basicSaved ? '保存しました' : '店舗情報を保存'}
            </button>
          </div>
        </div>

        {/* 受付ページ設定 */}
        <div className="space-y-2">
          <SectionLabel title="受付ページ設定" />
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">ウェルカムメッセージ</label>
              <p className="text-[11px] text-zinc-600 mb-1.5">受付ページ上部に表示されるメッセージ</p>
              <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={3}
                placeholder="例: ご来店ありがとうございます。受付番号をお取りください。"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">注意事項</label>
              <textarea value={noticeText} onChange={e => setNoticeText(e.target.value)} rows={4}
                placeholder="例: 混雑状況により、お時間をいただく場合がございます。&#10;ご了承のうえ、受付をお取りください。"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none resize-none" />
            </div>
            <p className="text-[11px] text-zinc-600">※「店舗情報を保存」で保存されます</p>
          </div>
        </div>

        {/* 営業時間設定 */}
        <div className="space-y-2">
          <SectionLabel title="営業時間設定" />
          <p className="text-xs text-zinc-600">受付ページや管理画面での参照用です。自動開閉は管理画面の受付ボタンで手動設定してください。</p>
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
            {DAY_LABELS.map(({ key, label, color }) => {
              const h = businessHours.hours[key] ?? { open: '10:00', close: '19:00', closed: false }
              const update = (patch: Partial<DayHours>) =>
                setBusinessHours(prev => ({ hours: { ...prev.hours, [key]: { ...h, ...patch } } }))
              return (
                <div key={key} className={`flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/60 last:border-0 ${h.closed ? 'opacity-50' : ''}`}>
                  <span className={`w-5 text-xs font-bold text-center ${color}`}>{label}</span>
                  {h.closed ? (
                    <span className="flex-1 text-xs text-zinc-500">定休日</span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input type="time" value={h.open} onChange={e => update({ open: e.target.value })}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none" />
                      <span className="text-zinc-600 text-xs">〜</span>
                      <input type="time" value={h.close} onChange={e => update({ close: e.target.value })}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none" />
                    </div>
                  )}
                  <button onClick={() => update({ closed: !h.closed })}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      h.closed ? 'bg-zinc-700 text-zinc-400 hover:bg-red-900/40 hover:text-red-300' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                    }`}>
                    {h.closed ? '開店' : '定休'}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-zinc-600">※「保存」ボタンで保存されます</p>
        </div>

        {/* LINEリッチメニュー */}
        <div className="space-y-2">
          <SectionLabel title="LINEリッチメニュー" />
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-4 space-y-3">
            <p className="text-xs text-zinc-400">顧客のLINEトーク画面下部に表示されるメニューを登録します。変更後は再度ボタンを押してください。</p>
            <button
              onClick={applyRichmenu}
              disabled={richmenuApplying}
              className="w-full py-3 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
              {richmenuApplying ? <Loader2 size={15} className="animate-spin" /> : <span>📲</span>}
              {richmenuApplying ? '登録中...' : 'リッチメニューを登録・更新する'}
            </button>
            {richmenuMsg && (
              <p className={`text-xs text-center font-medium ${richmenuMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {richmenuMsg.ok ? '✅ ' : '❌ '}{richmenuMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* LINE通知プラン */}
        <div className="space-y-2">
          <SectionLabel title="LINE通知プラン" />
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'calling_only', label: '呼出のみ', desc: '1通/人 — 呼出時のみ', icon: '🔔' },
              { value: 'full',         label: '全通知',   desc: '3通/人 — 受付・もうすぐ・呼出', icon: '📲' },
            ] as const).map(opt => (
              <button key={opt.value} type="button" onClick={() => setNotificationPlan(opt.value)}
                className={`flex flex-col items-start px-3 py-3 rounded-xl border-2 transition-all text-left ${
                  notificationPlan === opt.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/50'
                }`}>
                <span className="text-sm font-bold mb-0.5">
                  {opt.icon} <span className={notificationPlan === opt.value ? 'text-indigo-300' : 'text-zinc-400'}>{opt.label}</span>
                </span>
                <span className="text-[11px] text-zinc-500">{opt.desc}</span>
              </button>
            ))}
          </div>
          {notificationPlan === 'full' && (
            <div className="bg-zinc-800/60 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xs text-zinc-400 flex-1">もうすぐ通知 — 残り</span>
              <input type="number" min={1} max={20} value={noticeThreshold}
                onChange={e => setNoticeThreshold(Number(e.target.value))}
                className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-center font-black text-base text-white focus:border-indigo-500 focus:outline-none" />
              <span className="text-xs text-zinc-500">番目で通知</span>
            </div>
          )}
        </div>

        {/* 遠隔チェックイン */}
        <div className="space-y-2">
          <SectionLabel title="遠隔チェックイン" />
          <Toggle
            on={allowRemote}
            onToggle={() => setAllowRemote(v => !v)}
            label="🏠 来店前の順番取りを許可"
            sub={allowRemote ? 'OFFにすると現地受付のみになります' : '顧客が自宅から順番取りできるようになります'}
          />
        </div>

        {/* 待ち案内メッセージ */}
        <div className="space-y-2">
          <SectionLabel title="待ち案内メッセージ（顧客画面表示）" />
          <div className="space-y-2">
            {waitThresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" min={1} max={99} placeholder="∞" value={t.max_wait ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? null : Number(e.target.value)
                      const up = [...waitThresholds]; up[i] = { ...up[i], max_wait: val }; setWaitThresholds(up)
                    }}
                    className="w-12 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-center text-xs text-white focus:border-indigo-500 focus:outline-none" />
                  <span className="text-zinc-500 text-[10px]">組↓</span>
                </div>
                <input type="text" value={t.text}
                  onChange={e => {
                    const up = [...waitThresholds]; up[i] = { ...up[i], text: e.target.value }; setWaitThresholds(up)
                  }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                  placeholder="表示するメッセージ" />
                <button onClick={() => setWaitThresholds(waitThresholds.filter((_, j) => j !== i))}
                  className="shrink-0 p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button onClick={() => setWaitThresholds([...waitThresholds, { max_wait: null, text: '' }])}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-xs">
              <Plus size={12} />行を追加
            </button>
          </div>
        </div>

        {/* 未お渡しアラート */}
        <div className="space-y-2">
          <SectionLabel title="未お渡しアラート（完了・入荷からN日後に警告）" />
          {[
            { label: 'お直し完了', value: alertDaysRepair,   set: setAlertDaysRepair },
            { label: '取置き入荷', value: alertDaysPurchase, set: setAlertDaysPurchase },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-3 py-2.5">
              <AlertCircle size={13} className="text-amber-400 shrink-0" />
              <span className="text-xs text-zinc-400 flex-1">{label}</span>
              <div className="flex items-center gap-1">
                {[3, 5, 7, 14, 30].map(d => (
                  <button key={d} onClick={() => set(d)}
                    className={`w-9 h-7 rounded-lg text-xs font-bold transition-all ${
                      value === d ? 'bg-amber-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                    }`}>{d}</button>
                ))}
                <span className="text-xs text-zinc-600 ml-1">日</span>
              </div>
            </div>
          ))}
        </div>

        {/* 採寸予約設定 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel title="採寸予約設定（共有枠）" />
            {resvTableOk === false && (
              <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                SQLマイグレーション要
              </span>
            )}
          </div>
          {resvTableOk === false ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-500">
              <p className="font-bold text-zinc-400 mb-1">予約設定テーブルが見つかりません</p>
              <p>Supabase SQLEditorで予約テーブルのマイグレーションを実行してください。</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                ジャージ（30分）と制服（60分）が同じ枠を共有します。<br />
                各曜日の枠数は「同時に採寸できる組数」です。スロットは重複チェックで空き判定します。
              </p>
              {resvSettings.map((s, idx) => (
                <div key={s.service_type} className={`rounded-2xl border p-4 space-y-3 transition-all ${
                  s.is_active ? 'bg-indigo-950/30 border-indigo-500/20' : 'bg-zinc-900/40 border-zinc-800/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className={s.is_active ? 'text-indigo-400' : 'text-zinc-600'} />
                      <span className={`font-bold text-sm ${s.is_active ? 'text-white' : 'text-zinc-500'}`}>{s.label}</span>
                    </div>
                    <button onClick={() => updateResv(idx, { is_active: !s.is_active })}
                      className={`w-10 h-5 rounded-full transition-colors shrink-0 ${s.is_active ? 'bg-indigo-500' : 'bg-zinc-600'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full mt-0.5 shadow transition-transform mx-0.5 ${s.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {s.is_active && (
                    <>
                      <div>
                        <p className="text-[11px] text-zinc-500 mb-1.5">所要時間（分）</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {[30, 45, 60, 90, 120].map(d => (
                            <button key={d} onClick={() => updateResv(idx, { duration_min: d })}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                s.duration_min === d ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              }`}>{d}分</button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[11px] text-zinc-500 mb-1.5 flex items-center gap-1">
                            <Clock size={10} />受付開始
                          </p>
                          <input type="time" value={s.start_time}
                            onChange={e => updateResv(idx, { start_time: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                          <p className="text-[11px] text-zinc-500 mb-1.5 flex items-center gap-1">
                            <Clock size={10} />受付終了
                          </p>
                          <input type="time" value={s.end_time}
                            onChange={e => updateResv(idx, { end_time: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-zinc-500 mb-1.5">曜日別 最大予約枠数</p>
                        <div className="grid grid-cols-7 gap-1">
                          {(
                            [
                              ['日', 'slots_sun', 'text-red-400'],
                              ['月', 'slots_mon', 'text-zinc-300'],
                              ['火', 'slots_tue', 'text-zinc-300'],
                              ['水', 'slots_wed', 'text-zinc-300'],
                              ['木', 'slots_thu', 'text-zinc-300'],
                              ['金', 'slots_fri', 'text-zinc-300'],
                              ['土', 'slots_sat', 'text-blue-400'],
                            ] as [string, keyof ResvSetting, string][]
                          ).map(([label, key, color]) => (
                            <div key={key} className="flex flex-col items-center gap-1">
                              <span className={`text-[10px] font-bold ${color}`}>{label}</span>
                              <input
                                type="number" min={0} max={20}
                                value={s[key] as number}
                                onChange={e => updateResv(idx, { [key]: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-center text-sm text-white py-1.5 focus:border-indigo-500 focus:outline-none" />
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-700 mt-1">0 = その曜日は受付停止</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {resvError && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">{resvError}</p>
              )}
              <button onClick={handleResvSave} disabled={resvLoading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  resvSaved ? 'bg-emerald-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                }`}>
                {resvLoading ? <><Loader2 size={14} className="animate-spin" />保存中...</>
                  : resvSaved ? <><CheckCheck size={14} />保存済み</>
                  : '予約設定を保存'}
              </button>
            </div>
          )}
        </div>

        {/* 学校名マスタ */}
        <div className="space-y-2">
          <SectionLabel title="学校名マスタ" />
          <p className="text-xs text-zinc-600">CRM・受付フォームの学校選択に表示されます</p>
          <div className="space-y-1.5">
            {schoolNames.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <GraduationCap size={14} className="text-indigo-400 shrink-0" />
                <input type="text" value={s}
                  onChange={e => { const up = [...schoolNames]; up[i] = e.target.value; setSchoolNames(up) }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none" />
                <button onClick={() => setSchoolNames(schoolNames.filter((_, j) => j !== i))}
                  className="shrink-0 p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setSchoolNames([...schoolNames, ''])}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-xs">
            <Plus size={12} />学校を追加
          </button>
        </div>

        {/* お直し持込 注意事項 */}
        <div className="space-y-2">
          <SectionLabel title="お直し持込 注意事項（顧客向けページ）" />
          <p className="text-xs text-zinc-600">
            リッチメニュー「依頼」から開くページに表示されます。空欄の場合はデフォルトの案内文が表示されます。
          </p>
          <textarea
            value={repairNotes}
            onChange={e => setRepairNotes(e.target.value)}
            rows={8}
            placeholder={'【お持ち込みの際のお願い】\n・お直しの内容をできるだけ具体的にお知らせください\n・お名前とご連絡先をご記入いただく場合があります\n\n【お預かりについて】\n・お預かり後、仕上がり日をご連絡します'}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* 保存ボタン */}
        {saveError && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 text-xs text-red-400">
            保存エラー: {saveError}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/40"
        >
          {saving ? <><Loader2 size={16} className="animate-spin inline mr-2" />保存中...</> : '管理者設定を保存'}
        </button>

        {/* テストモード */}
        <div className="space-y-2 border-t border-zinc-800/60 pt-4">
          <SectionLabel title="テストモード（開発・確認用）" />
          <Toggle
            on={isTestMode}
            onToggle={async () => {
              const next = !isTestMode
              setIsTestMode(next)
              await fetch('/api/test/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeId, enabled: next }),
              })
            }}
            label="🧪 テストモード"
            sub={isTestMode ? 'テスト中 — ダミーデータが混在します' : 'OFFの場合は本番データのみ'}
          />
          {isTestMode && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const res = await fetch('/api/test/seed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeId }),
                  })
                  const j = await res.json()
                  if (j.ok) alert(`✅ ${j.created?.length ?? 0}件挿入完了`)
                  else alert(`❌ 挿入失敗: ${j.error}`)
                }}
                className="py-2.5 rounded-xl bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 text-xs font-bold hover:bg-indigo-900/70 transition-colors"
              >
                📥 テストデータ挿入
              </button>
              <button
                onClick={async () => {
                  if (!confirm('テストデータをすべて削除しますか？')) return
                  const res = await fetch('/api/test/clear', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeId }),
                  })
                  const j = await res.json()
                  if (j.ok) alert(`🗑️ 削除完了: ${j.deleted?.join(', ') || '対象なし'}`)
                  else alert(`❌ 削除失敗: ${j.error}`)
                }}
                className="py-2.5 rounded-xl bg-red-900/40 border border-red-700/40 text-red-400 text-xs font-bold hover:bg-red-900/60 transition-colors"
              >
                🗑️ テストデータ削除
              </button>
            </div>
          )}
          <p className="text-xs text-zinc-600">「【テスト】」で始まる顧客データをまとめて操作します</p>
        </div>

      </div>

      <BottomNav />
    </div>
  )
}
