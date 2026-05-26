'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  Settings, Loader2, Plus, Trash2, GraduationCap, AlertCircle, Save,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import type { WaitThreshold } from '@/types/database'
import { DEFAULT_THRESHOLDS } from '@/types/database'
import { BottomNav } from '../_components/BottomNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ffbixfbddxguhdhayqqy.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYml4ZmJkZHhndWhkaGF5cXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0NTI3NjgsImV4cCI6MjA1ODAyODc2OH0.nicSHNjMlnqDapnlKJ1y9fqbGfR7SfJ5-vdONzDR9sA'
)

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

function Section({ title }: { title: string }) {
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

  // auth guard
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase.from('stores') as any)
      .select('name, notice_threshold, wait_thresholds, allow_remote, notification_plan, push_settings, alert_days_repair, alert_days_purchase, school_names')
      .eq('id', storeId)
      .single()
    if (data) {
      setStoreName(data.name ?? '')
      if (data.notice_threshold != null) setNoticeThreshold(data.notice_threshold)
      if (Array.isArray(data.wait_thresholds) && data.wait_thresholds.length > 0)
        setWaitThresholds(data.wait_thresholds as WaitThreshold[])
      if (data.allow_remote != null) setAllowRemote(data.allow_remote)
      if (data.notification_plan) setNotificationPlan(data.notification_plan)
      if (data.push_settings?.queue_new != null) setPushQueueNew(data.push_settings.queue_new)
      if (data.alert_days_repair != null) setAlertDaysRepair(data.alert_days_repair)
      if (data.alert_days_purchase != null) setAlertDaysPurchase(data.alert_days_purchase)
      if (Array.isArray(data.school_names)) setSchoolNames(data.school_names)
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function handleSave() {
    setSaving(true)
    await (supabase.from('stores') as any).update({
      notice_threshold:    noticeThreshold,
      wait_thresholds:     waitThresholds,
      allow_remote:        allowRemote,
      notification_plan:   notificationPlan,
      push_settings:       { queue_new: pushQueueNew, purchase_new: true },
      alert_days_repair:   alertDaysRepair,
      alert_days_purchase: alertDaysPurchase,
      school_names:        schoolNames.filter(s => s.trim()),
      updated_at:          new Date().toISOString(),
    }).eq('id', storeId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? '保存済み' : '保存'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

        {/* LINE通知プラン */}
        <div className="space-y-2">
          <Section title="LINE通知プラン" />
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

        {/* ブラウザ通知 */}
        <div className="space-y-2">
          <Section title="ブラウザ通知（端末）" />
          <Toggle
            on={pushQueueNew}
            onToggle={() => setPushQueueNew(v => !v)}
            label="🔔 新規受付"
            sub="お客様が受付した時に端末へ通知"
          />
          <p className="text-xs text-zinc-600">ヘッダーの🔔ボタンで端末通知を許可してください</p>
        </div>

        {/* 遠隔チェックイン */}
        <div className="space-y-2">
          <Section title="遠隔チェックイン" />
          <Toggle
            on={allowRemote}
            onToggle={() => setAllowRemote(v => !v)}
            label="🏠 来店前の順番取りを許可"
            sub={allowRemote ? 'OFFにすると現地受付のみになります' : '顧客が自宅から順番取りできるようになります'}
          />
        </div>

        {/* 待ち案内メッセージ */}
        <div className="space-y-2">
          <Section title="待ち案内メッセージ（顧客画面表示）" />
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
          <Section title="未お渡しアラート（完了・入荷からN日後に警告）" />
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

        {/* 学校名マスタ */}
        <div className="space-y-2">
          <Section title="学校名マスタ" />
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

        {/* Save button (bottom) */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/40"
        >
          {saving ? <><Loader2 size={16} className="animate-spin inline mr-2" />保存中...</> : '設定を保存'}
        </button>

        {/* 店舗切替 */}
        <div className="border-t border-zinc-800/60 pt-4">
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              sessionStorage.removeItem('admin_store_id')
              window.location.href = `/${storeId}/admin`
            }}
            style={{ touchAction: 'manipulation' }}
            className="w-full py-2.5 rounded-xl border border-zinc-700/50 text-zinc-500 text-sm hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            店舗を切り替える
          </button>
        </div>

      </div>

      <BottomNav />
    </div>
  )
}
