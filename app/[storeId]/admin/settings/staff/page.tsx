'use client'

import React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Bell, BellOff, Store, Clock, Loader2, Check, GraduationCap, Users, ChevronRight, ChevronDown, Scissors, CalendarDays, Monitor, HelpCircle, BookOpen, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../../_components/BottomNav'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { useDeviceMode } from '@/lib/useDeviceMode'
import { useUiSettings, type UiSettings } from '@/lib/useSimpleMode'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BAmZx5b8ScrgrqWa822FdQhtfHV2CSyqvxNeQX-Ds1KsqztPPRtZRyBP_LaQZmCLejg8Ivd7Gu4cBxKtNwodb3o'

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)))
}

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type DayHours = { open: string; close: string; closed: boolean }
type BusinessHours = { hours: Partial<Record<DayKey, DayHours>> }

const DAY_LABELS: { key: DayKey; label: string; color: string }[] = [
  { key: 'mon', label: '月', color: 'text-gray-700' },
  { key: 'tue', label: '火', color: 'text-gray-700' },
  { key: 'wed', label: '水', color: 'text-gray-700' },
  { key: 'thu', label: '木', color: 'text-gray-700' },
  { key: 'fri', label: '金', color: 'text-gray-700' },
  { key: 'sat', label: '土', color: 'text-blue-600'  },
  { key: 'sun', label: '日', color: 'text-red-600'   },
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
  color: 'indigo' | 'amber' | 'teal'
}) {
  const active = {
    indigo: 'border-indigo-500 bg-indigo-500/10',
    amber:  'border-amber-500 bg-amber-500/10',
    teal:   'border-teal-500 bg-teal-500/10',
  }[color]
  const textActive = { indigo: 'text-indigo-700', amber: 'text-amber-600', teal: 'text-teal-700' }[color]
  const trackActive = { indigo: 'bg-indigo-500', amber: 'bg-amber-500', teal: 'bg-teal-500' }[color]
  const iconBg = { indigo: 'bg-indigo-500/20', amber: 'bg-amber-500/20', teal: 'bg-teal-500/20' }[color]
  return (
    <button type="button" onClick={onToggle} style={{ touchAction: 'manipulation' }}
      className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
        on ? active : 'border-gray-300 bg-gray-100'
      }`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl ${on ? iconBg : 'bg-gray-100'}`}>
        {emoji}
      </div>
      <div className="text-left flex-1">
        <p className={`font-black text-lg leading-tight ${on ? textActive : 'text-gray-600'}`}>
          {label}&nbsp;&nbsp;{on ? 'オン' : 'オフ'}
        </p>
        <p className="text-gray-500 text-sm mt-0.5">{sub}</p>
      </div>
      <div className={`w-14 h-7 rounded-full transition-colors shrink-0 ${on ? trackActive : 'bg-gray-300'}`}>
        <div className={`w-6 h-6 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${on ? 'translate-x-7' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

function Section({ emoji, title, open, onToggle, children }: {
  emoji: string; title: string; open: boolean
  onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-gray-50 transition-colors">
        <span className="text-xl leading-none">{emoji}</span>
        <span className="flex-1 text-base font-bold text-gray-800">{title}</span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

export default function StaffSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const { hasFeature } = useStoreFeatures(storeId)
  const isSimpleMode = !hasFeature('repairs_tab_purchase') && !hasFeature('repairs_tab_arrival')
  const { setMode } = useDeviceMode()
  const { settings: uiSettings, save: saveUiSettings } = useUiSettings(storeId)

  const [storeName,     setStoreName]     = useState('')
  const [loading,       setLoading]       = useState(true)
  const [allowRemote,   setAllowRemote]   = useState(false)
  const [isTestMode,    setIsTestMode]    = useState(false)
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [pushStatus,    setPushStatus]    = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [openSections,  setOpenSections]  = useState<Set<string>>(new Set())
  // 初期設定ウィザードを済ませたか。未了なら設定画面の先頭で目立たせる
  const [setupDone, setSetupDone] = useState<boolean | null>(null)

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
      .select('name, allow_remote, is_test_mode, business_hours, setup')
      .eq('id', storeId).single()
    if (data) {
      setStoreName(data.name ?? '')
      setSetupDone(!!(data.setup as { done_at?: string } | null)?.done_at)
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

  // 画面設定（かんたん画面・大きい文字）— stores.ui_settings に保存（全端末共通）
  const handleUiToggle = async (patch: UiSettings) => {
    setSaveError(null)
    const ok = await saveUiSettings(patch)
    if (!ok) setSaveError('画面設定の保存に失敗しました。通信環境を確認してもう一度お試しください。')
  }

  const handleTestModeToggle = async () => {
    const next = !isTestMode
    setIsTestMode(next)
    const storePin = sessionStorage.getItem(`admin_pin_${storeId}`) ?? ''
    await fetch('/api/test/mode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, enabled: next, storePin }),
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    )
  }

  // ── シンプルモード用設定画面 ─────────────────────────────────
  if (isSimpleMode) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-4">
            <h1 className="text-xl font-black text-gray-900">設定</h1>
            {storeName && <p className="text-sm text-gray-500 mt-0.5">{storeName}</p>}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-32">

          {saveError && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{saveError}</p>
          )}

          {/* 🍀 かんたん画面 */}
          <BigToggle
            on={uiSettings.simple_mode === true}
            onToggle={() => handleUiToggle({ simple_mode: !(uiSettings.simple_mode === true) })}
            label="かんたん画面"
            sub={uiSettings.simple_mode ? 'タブを減らして大きなボタンで表示中（全端末共通）' : 'オフ — 通常の表示です'}
            emoji="🍀"
            color="teal"
          />

          {/* 🔍 大きい文字 */}
          <BigToggle
            on={uiSettings.large_text === true}
            onToggle={() => handleUiToggle({ large_text: !(uiSettings.large_text === true) })}
            label="大きい文字"
            sub={uiSettings.large_text ? '管理画面の文字を大きく表示中（全端末共通）' : 'オフ — 標準の文字サイズです'}
            emoji="🔍"
            color="indigo"
          />

          {/* 🪄 かんたん初期設定 — 未了なら目立たせ、済んだら控えめに置いておく */}
          <Link href={`/${storeId}/admin/setup`}
            className={`flex items-center gap-4 px-5 py-5 rounded-2xl border-2 active:scale-[0.98] transition-all shadow-sm ${
              setupDone === false
                ? 'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-400'
                : 'bg-white border-gray-200 hover:border-indigo-300'
            }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              setupDone === false ? 'bg-indigo-600' : 'bg-gray-100'
            }`}>
              <Wand2 size={28} className={setupDone === false ? 'text-white' : 'text-gray-500'} />
            </div>
            <div className="flex-1 text-left">
              <p className={`font-black text-lg ${setupDone === false ? 'text-indigo-700' : 'text-gray-700'}`}>
                かんたん初期設定
                {setupDone === false && <span className="ml-1.5 align-middle text-[10px] font-black text-white bg-red-500 rounded-full px-1.5 py-0.5">未設定</span>}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {setupDone === false
                  ? '質問に答えるだけで、必要なマスタが揃います'
                  : '業種・外注の設定をやり直す'}
              </p>
            </div>
            <ChevronRight size={20} className="text-gray-400 shrink-0" />
          </Link>

          {/* ✂️ お直し項目・料金 */}
          {hasFeature('repairs_master') && (
            <Link href={`/${storeId}/admin/master/repair`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-indigo-200 hover:border-indigo-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <Scissors size={28} className="text-indigo-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-indigo-700">お直し項目・料金</p>
                <p className="text-sm text-gray-500 mt-0.5">お直しの種類・料金プリセットを管理</p>
              </div>
              <ChevronRight size={20} className="text-indigo-400 shrink-0" />
            </Link>
          )}

          {/* 👥 スタッフ（PIN確認・追加） */}
          <Link href={`/${storeId}/admin/master?tab=staff`}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-400 active:scale-[0.98] transition-all shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Users size={28} className="text-emerald-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black text-lg text-emerald-700">スタッフ</p>
              <p className="text-sm text-gray-500 mt-0.5">スタッフの登録・PIN（個人番号）の確認</p>
            </div>
            <ChevronRight size={20} className="text-emerald-400 shrink-0" />
          </Link>

          {/* 🧵 お直し加工業者 */}
          {hasFeature('repairs_master') && (
            <Link href={`/${storeId}/admin/master/repair-vendors`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-rose-200 hover:border-rose-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 text-3xl">
                🧵
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-rose-700">お直し加工業者</p>
                <p className="text-sm text-gray-500 mt-0.5">外注先の登録（受付でワンタップ選択）</p>
              </div>
              <ChevronRight size={20} className="text-rose-400 shrink-0" />
            </Link>
          )}

          {/* 🧾 伝票OCRテンプレート */}
          {hasFeature('repairs_ocr') && (
            <Link href={`/${storeId}/admin/master/ocr-templates`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-violet-200 hover:border-violet-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0 text-3xl">
                🧾
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-violet-700">伝票OCRテンプレート</p>
                <p className="text-sm text-gray-500 mt-0.5">伝票種別ごとの読み取り項目・サンプル撮影でAI提案</p>
              </div>
              <ChevronRight size={20} className="text-violet-400 shrink-0" />
            </Link>
          )}

          {/* 📅 シフト管理 */}
          {hasFeature('shift_management') && (
            <Link href={`/${storeId}/admin/shifts`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-blue-200 hover:border-blue-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
                <CalendarDays size={28} className="text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-blue-700">シフト管理</p>
                <p className="text-sm text-gray-500 mt-0.5">スタッフのシフト・出勤管理</p>
              </div>
              <ChevronRight size={20} className="text-blue-400 shrink-0" />
            </Link>
          )}

          {/* 🏫 学校・商品マスタ（productsフィーチャーが有効な場合） */}
          {hasFeature('products') && (
            <Link href={`/${storeId}/admin/master/manage`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-indigo-200 hover:border-indigo-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <GraduationCap size={28} className="text-indigo-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-indigo-700">学校・商品マスタ</p>
                <p className="text-sm text-gray-500 mt-0.5">学校・商品・サイズ・価格を管理</p>
              </div>
              <ChevronRight size={20} className="text-indigo-400 shrink-0" />
            </Link>
          )}

          {/* 📖 使い方ガイド */}
          <Link href={`/${storeId}/admin/guide`}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-indigo-200 hover:border-indigo-400 active:scale-[0.98] transition-all shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
              <BookOpen size={28} className="text-indigo-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black text-lg text-indigo-700">使い方ガイド</p>
              <p className="text-sm text-gray-500 mt-0.5">はじめての方はこちら</p>
            </div>
            <ChevronRight size={20} className="text-indigo-400 shrink-0" />
          </Link>

          {/* ❓ Q&A */}
          <Link href={`/${storeId}/admin/qa`}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-violet-200 hover:border-violet-400 active:scale-[0.98] transition-all shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
              <HelpCircle size={28} className="text-violet-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black text-lg text-violet-700">Q&A・よくある質問</p>
              <p className="text-sm text-gray-500 mt-0.5">操作に困ったときはこちら</p>
            </div>
            <ChevronRight size={20} className="text-violet-400 shrink-0" />
          </Link>

          {/* 🎁 友だち登録POP */}
          <Link href={`/${storeId}/admin/settings/pop`}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-green-200 hover:border-green-400 active:scale-[0.98] transition-all shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center shrink-0 text-3xl">
              🎁
            </div>
            <div className="flex-1 text-left">
              <p className="font-black text-lg text-green-700">友だち登録POP</p>
              <p className="text-sm text-gray-500 mt-0.5">お店の機能に合わせた店頭POPを自動作成</p>
            </div>
            <ChevronRight size={20} className="text-green-400 shrink-0" />
          </Link>

          {/* 📋 順番待ちQR POP */}
          {hasFeature('tab_queue') && (
            <Link href={`/${storeId}/admin/settings/queue-pop`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-indigo-200 hover:border-indigo-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 text-3xl">
                📋
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-indigo-700">順番待ちQR POP</p>
                <p className="text-sm text-gray-500 mt-0.5">チラシ・店頭・GoogleマップやHP掲載用。未登録でも即並べるQR</p>
              </div>
              <ChevronRight size={20} className="text-indigo-400 shrink-0" />
            </Link>
          )}

          {/* 💻 PCモード */}
          <button
            onClick={() => setMode('tablet')}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-gray-200 hover:border-gray-400 active:scale-[0.98] transition-all shadow-sm w-full">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
              <Monitor size={28} className="text-gray-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black text-lg text-gray-700">PCモードに切替</p>
              <p className="text-sm text-gray-500 mt-0.5">タブレット・PCでの大画面表示に切替</p>
            </div>
          </button>

          {/* 🍀 かんたんLINEモード */}
          {hasFeature('kantan_line') && (
            <Link href={`/${storeId}/admin/settings/kantan`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-teal-200 hover:border-teal-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center shrink-0 text-3xl">
                🍀
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-teal-700">かんたんLINEモード</p>
                <p className="text-sm text-gray-500 mt-0.5">スタッフ登録コード・やることリスト配信</p>
              </div>
              <ChevronRight size={20} className="text-teal-400 shrink-0" />
            </Link>
          )}

          {/* 📥 置くだけスキャン */}
          {hasFeature('tray_scan') && (
            <Link href={`/${storeId}/admin/tray-scan`}
              className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-400 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 text-3xl">
                📥
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-lg text-emerald-700">置くだけスキャン</p>
                <p className="text-sm text-gray-500 mt-0.5">伝票を置くと自動で読み取り・振り分け</p>
              </div>
              <ChevronRight size={20} className="text-emerald-400 shrink-0" />
            </Link>
          )}

          {/* 🧪 練習モード */}
          <BigToggle
            on={isTestMode}
            onToggle={handleTestModeToggle}
            label="練習モード"
            sub={isTestMode ? '練習中 — LINE・通知は送信されません' : 'オフ — 本番として動作します'}
            emoji="🧪"
            color="amber"
          />

          {/* 🏪 店舗を切り替え */}
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              sessionStorage.removeItem('admin_store_id')
              window.location.href = `/${storeId}/admin`
            }}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.98] transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
              <Store size={28} className="text-gray-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-lg text-gray-700">店舗を切り替える</p>
              <p className="text-gray-500 text-sm mt-1">別の店舗に切り替えます（再ログインが必要）</p>
            </div>
          </button>

        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-black text-gray-900">設定</h1>
          {storeName && <p className="text-sm text-gray-500 mt-0.5">{storeName}</p>}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-32">

        {/* 📋 マスタ管理 */}
        <Section emoji="📋" title="マスタ管理" open={openSections.has('master')} onToggle={() => toggleSection('master')}>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/${storeId}/admin/master/manage`}
              className="flex flex-col gap-3 px-4 py-4 rounded-2xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 active:scale-[0.98] transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                  <GraduationCap size={20} className="text-indigo-600" />
                </div>
                <ChevronRight size={14} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-black text-indigo-700">学校・商品</p>
                <p className="text-xs text-indigo-500 mt-0.5 leading-relaxed">学校ごとの商品・サイズ・価格</p>
              </div>
            </Link>
            <Link href={`/${storeId}/admin/master?tab=staff`}
              className="flex flex-col gap-3 px-4 py-4 rounded-2xl bg-violet-50 border border-violet-200 hover:bg-violet-100 active:scale-[0.98] transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
                  <Users size={20} className="text-violet-600" />
                </div>
                <ChevronRight size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-black text-violet-700">スタッフ</p>
                <p className="text-xs text-violet-500 mt-0.5 leading-relaxed">スタッフ情報・役職・カラー</p>
              </div>
            </Link>
            {hasFeature('repairs_master') && (
              <Link href={`/${storeId}/admin/master/repair`}
                className="flex flex-col gap-3 px-4 py-4 rounded-2xl bg-rose-50 border border-rose-200 hover:bg-rose-100 active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center">
                    <Scissors size={20} className="text-rose-600" />
                  </div>
                  <ChevronRight size={14} className="text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-rose-700">お直しマスタ</p>
                  <p className="text-xs text-rose-500 mt-0.5 leading-relaxed">お直しの種類・料金・サイズ段階</p>
                </div>
              </Link>
            )}
            {hasFeature('repairs_master') && (
              <Link href={`/${storeId}/admin/master/repair-vendors`}
                className="flex flex-col gap-3 px-4 py-4 rounded-2xl bg-pink-50 border border-pink-200 hover:bg-pink-100 active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-pink-100 border border-pink-200 flex items-center justify-center text-xl">
                    🧵
                  </div>
                  <ChevronRight size={14} className="text-pink-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-pink-700">お直し加工業者</p>
                  <p className="text-xs text-pink-500 mt-0.5 leading-relaxed">外注先の登録（受付で選択）</p>
                </div>
              </Link>
            )}
            {hasFeature('repairs_ocr') && (
              <Link href={`/${storeId}/admin/master/ocr-templates`}
                className="flex flex-col gap-3 px-4 py-4 rounded-2xl bg-violet-50 border border-violet-200 hover:bg-violet-100 active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-xl">
                    🧾
                  </div>
                  <ChevronRight size={14} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-violet-700">伝票OCRテンプレート</p>
                  <p className="text-xs text-violet-500 mt-0.5 leading-relaxed">伝票種別ごとの読み取り項目・サンプル撮影でAI提案</p>
                </div>
              </Link>
            )}
            <Link href={`/${storeId}/admin/reception-slip`}
              className="flex flex-col gap-3 px-4 py-4 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98] transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-xl">
                  🧾
                </div>
                <ChevronRight size={14} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-700">伝票受付（撮影→保存）</p>
                <p className="text-xs text-emerald-500 mt-0.5 leading-relaxed">テンプレを選んで伝票を撮影し受付を登録</p>
              </div>
            </Link>
          </div>
        </Section>

        {/* 🔔 通知・受付設定 */}
        <Section emoji="🔔" title="通知・受付設定" open={openSections.has('notify')} onToggle={() => toggleSection('notify')}>
          <button
            onClick={() => { if (pushStatus !== 'granted' && pushStatus !== 'unsupported') setupPush() }}
            disabled={pushStatus === 'granted' || pushStatus === 'unsupported'}
            style={{ touchAction: 'manipulation' }}
            className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
              pushStatus === 'granted'     ? 'border-emerald-500/60 bg-emerald-500/10 cursor-default' :
              pushStatus === 'denied'      ? 'border-red-500/40 bg-red-500/10' :
              pushStatus === 'unsupported' ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60' :
              'border-indigo-500/50 bg-indigo-500/10 hover:border-indigo-400'
            }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              pushStatus === 'granted' ? 'bg-emerald-500/20' :
              pushStatus === 'denied'  ? 'bg-red-500/20' : 'bg-indigo-500/20'
            }`}>
              {pushStatus === 'denied'
                ? <BellOff size={28} className="text-red-600" />
                : <Bell size={28} className={pushStatus === 'granted' ? 'text-emerald-600' : 'text-indigo-600'} />}
            </div>
            <div className="text-left flex-1">
              <p className={`font-black text-lg leading-tight ${
                pushStatus === 'granted' ? 'text-emerald-700' :
                pushStatus === 'denied' ? 'text-red-600' : 'text-gray-900'
              }`}>
                {pushStatus === 'granted'     ? '受付通知　オン' :
                 pushStatus === 'denied'      ? '通知がブロック中' :
                 pushStatus === 'unsupported' ? '通知非対応' :
                 '受付通知をオンにする'}
              </p>
              <p className="text-gray-500 text-sm mt-1">
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

          <BigToggle
            on={allowRemote}
            onToggle={() => setAllowRemote(v => !v)}
            label="遠隔チェックイン"
            sub={allowRemote ? '来店前の順番取りを許可しています' : '現地受付のみです'}
            emoji="🏠"
            color="indigo"
          />
        </Section>

        {/* 🖥️ 画面表示 */}
        <Section emoji="🖥️" title="画面表示" open={openSections.has('display')} onToggle={() => toggleSection('display')}>
          <BigToggle
            on={uiSettings.simple_mode === true}
            onToggle={() => handleUiToggle({ simple_mode: !(uiSettings.simple_mode === true) })}
            label="かんたん画面"
            sub={uiSettings.simple_mode ? 'タブを減らして大きなボタンで表示中（全端末共通）' : 'オフ — 通常の表示です'}
            emoji="🍀"
            color="teal"
          />
          <BigToggle
            on={uiSettings.large_text === true}
            onToggle={() => handleUiToggle({ large_text: !(uiSettings.large_text === true) })}
            label="大きい文字"
            sub={uiSettings.large_text ? '管理画面の文字を大きく表示中（全端末共通）' : 'オフ — 標準の文字サイズです'}
            emoji="🔍"
            color="indigo"
          />
        </Section>

        {/* 🏪 店舗・アカウント */}
        <Section emoji="🏪" title="店舗・アカウント" open={openSections.has('store')} onToggle={() => toggleSection('store')}>
          <Link href={`/${storeId}/admin/settings/pop`}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-green-200 bg-green-50 hover:bg-green-100 active:scale-[0.98] transition-all">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center shrink-0 text-2xl">
              🎁
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-lg text-green-700">友だち登録POP</p>
              <p className="text-green-500 text-sm mt-0.5">店頭POPを自動作成・印刷</p>
            </div>
            <ChevronRight size={18} className="text-green-400 shrink-0" />
          </Link>

          {hasFeature('tab_queue') && (
            <Link href={`/${storeId}/admin/settings/queue-pop`}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 active:scale-[0.98] transition-all">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 text-2xl">
                📋
              </div>
              <div className="text-left flex-1">
                <p className="font-black text-lg text-indigo-700">順番待ちQR POP</p>
                <p className="text-indigo-500 text-sm mt-0.5">チラシ・店頭・マップ/HP掲載用を自動作成・印刷</p>
              </div>
              <ChevronRight size={18} className="text-indigo-400 shrink-0" />
            </Link>
          )}
          <Link href={`/${storeId}/admin/guide`}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 active:scale-[0.98] transition-all">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
              <BookOpen size={26} className="text-indigo-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-lg text-indigo-700">使い方ガイド</p>
              <p className="text-indigo-500 text-sm mt-0.5">はじめての方はこちら</p>
            </div>
            <ChevronRight size={18} className="text-indigo-400 shrink-0" />
          </Link>
          <Link href={`/${storeId}/admin/qa`}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-violet-200 bg-violet-50 hover:bg-violet-100 active:scale-[0.98] transition-all">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
              <HelpCircle size={26} className="text-violet-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-lg text-violet-700">Q&A・よくある質問</p>
              <p className="text-violet-500 text-sm mt-0.5">操作に困ったときはこちら</p>
            </div>
            <ChevronRight size={18} className="text-violet-400 shrink-0" />
          </Link>
          {hasFeature('shift_management') && (
            <Link href={`/${storeId}/admin/shifts`}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <CalendarDays size={26} className="text-blue-600" />
              </div>
              <div className="text-left flex-1">
                <p className="font-black text-lg text-gray-700">シフト管理</p>
                <p className="text-gray-500 text-sm mt-0.5">スタッフのシフト・出勤管理</p>
              </div>
              <ChevronRight size={18} className="text-gray-400 shrink-0" />
            </Link>
          )}
          <button
            onClick={() => setMode('tablet')}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
              <Monitor size={26} className="text-gray-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-lg text-gray-700">PCモードに切替</p>
              <p className="text-gray-500 text-sm mt-0.5">タブレット・PCでの大画面表示に切替</p>
            </div>
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              sessionStorage.removeItem('admin_store_id')
              window.location.href = `/${storeId}/admin`
            }}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
              <Store size={28} className="text-gray-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-lg text-gray-700">店舗を切り替える</p>
              <p className="text-gray-500 text-sm mt-1">別の店舗に切り替えます（再ログインが必要）</p>
            </div>
          </button>
        </Section>

        {/* 🕐 営業時間 */}
        <Section emoji="🕐" title="営業時間" open={openSections.has('hours')} onToggle={() => toggleSection('hours')}>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-4 pb-3">
              <Clock size={20} className="text-gray-600" />
              <p className="font-black text-lg text-gray-900">営業時間</p>
            </div>
            {DAY_LABELS.map(({ key, label, color }) => {
              const h = businessHours.hours[key] ?? DEFAULT_HOURS.hours[key]!
              const update = (patch: Partial<DayHours>) =>
                setBusinessHours(prev => ({ hours: { ...prev.hours, [key]: { ...h, ...patch } } }))
              return (
                <div key={key} className={`flex items-center gap-3 px-4 py-3 border-t border-gray-100 ${h.closed ? 'opacity-40' : ''}`}>
                  <span className={`w-7 text-base font-black text-center ${color}`}>{label}</span>
                  {h.closed ? (
                    <span className="flex-1 text-gray-500 text-base">定休日</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={h.open} onChange={e => update({ open: e.target.value })}
                        className="bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-base text-gray-900 focus:border-indigo-500 focus:outline-none w-28" />
                      <span className="text-gray-400">〜</span>
                      <input type="time" value={h.close} onChange={e => update({ close: e.target.value })}
                        className="bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-base text-gray-900 focus:border-indigo-500 focus:outline-none w-28" />
                    </div>
                  )}
                  <button onClick={() => update({ closed: !h.closed })}
                    className={`shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                      h.closed ? 'bg-gray-200 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700' : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}>
                    {h.closed ? '開店' : '定休'}
                  </button>
                </div>
              )
            })}
          </div>

          <BigToggle
            on={isTestMode}
            onToggle={handleTestModeToggle}
            label="練習モード"
            sub={isTestMode ? '練習中 — LINE・通知は送信されません' : 'オフ — 本番として動作します'}
            emoji="🧪"
            color="amber"
          />
        </Section>

        {/* 保存 */}
        {saveError && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{saveError}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${
            saved ? 'bg-emerald-600 text-white shadow-emerald-200/60' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200/60'
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
