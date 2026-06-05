'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  Settings, Loader2, Plus, Trash2, AlertCircle,
  CalendarDays, Clock, CheckCheck, LayoutDashboard, ChevronRight, Users,
  PackageSearch, GraduationCap, ChevronDown,
} from 'lucide-react'
import type { OrderSchedule, ScheduleType } from '../_components/OrderReminderBanner'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { WaitThreshold } from '@/types/database'
import { DEFAULT_THRESHOLDS } from '@/types/database'
import { BottomNav } from '../_components/BottomNav'

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
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${on ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-200 bg-gray-50'}`}>
      <div className="text-left">
        <p className={`font-bold text-sm ${on ? 'text-indigo-700' : 'text-gray-600'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-indigo-500' : 'bg-gray-300'}`}>
        <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${on ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

function Section({ id, emoji, title, open, onToggle, children }: {
  id: string; emoji: string; title: string; open: boolean
  onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors">
        <span className="text-xl leading-none">{emoji}</span>
        <span className="flex-1 text-sm font-bold text-gray-800">{title}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-5 border-t border-gray-100 space-y-4 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [loading,           setLoading]           = useState(true)
  const [saving,            setSaving]            = useState(false)
  const [saved,             setSaved]             = useState(false)
  const [saveError,         setSaveError]         = useState<string | null>(null)
  const [storeName,         setStoreName]         = useState('')

  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setOpenSections(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // 受付ページ設定
  const [noticeText,        setNoticeText]        = useState('')
  const [businessHours,     setBusinessHours]     = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS)
  const [allowRemote,       setAllowRemote]       = useState(false)

  // 通知設定
  const [notificationPlan,  setNotificationPlan]  = useState<'calling_only' | 'full'>('calling_only')
  const [noticeThreshold,   setNoticeThreshold]   = useState(3)
  const [waitThresholds,    setWaitThresholds]    = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)

  // 案件管理設定
  const [alertDaysRepair,   setAlertDaysRepair]   = useState(7)
  const [alertDaysPurchase, setAlertDaysPurchase] = useState(7)
  const [orderSchedule,     setOrderSchedule]     = useState<OrderSchedule | null>(null)
  const [orderScheduleOn,   setOrderScheduleOn]   = useState(false)
  const [repairNotes,       setRepairNotes]       = useState('')

  // 採寸予約設定
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
  const [resvSettings,  setResvSettings]  = useState<ResvSetting[]>(DEFAULT_RESV)
  const [resvLoading,   setResvLoading]   = useState(false)
  const [resvSaved,     setResvSaved]     = useState(false)
  const [resvError,     setResvError]     = useState<string | null>(null)
  const [resvTableOk,   setResvTableOk]   = useState<boolean | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data } = await (supabase as any)
      .from('stores')
      .select('name, notice_threshold, wait_thresholds, allow_remote, notification_plan, push_settings, alert_days_repair, alert_days_purchase, repair_notes, notice_text, business_hours, order_schedule')
      .eq('id', storeId)
      .single()
    if (data) {
      setStoreName(data.name ?? '')
      if (data.notice_threshold   != null) setNoticeThreshold(data.notice_threshold)
      if (Array.isArray(data.wait_thresholds) && data.wait_thresholds.length > 0)
        setWaitThresholds(data.wait_thresholds as WaitThreshold[])
      if (data.allow_remote       != null) setAllowRemote(data.allow_remote)
      if (data.notification_plan)          setNotificationPlan(data.notification_plan)
      if (data.alert_days_repair  != null) setAlertDaysRepair(data.alert_days_repair)
      if (data.alert_days_purchase != null) setAlertDaysPurchase(data.alert_days_purchase)
      if (data.repair_notes       != null) setRepairNotes(data.repair_notes)
      if (data.notice_text        != null) setNoticeText(data.notice_text)
      if (data.business_hours?.hours)      setBusinessHours(data.business_hours)
      if (data.order_schedule) {
        setOrderScheduleOn(true)
        setOrderSchedule(data.order_schedule as OrderSchedule)
      }
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

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const { error } = await (supabase as any)
      .from('stores')
      .update({
        notice_text:         noticeText || null,
        notice_threshold:    noticeThreshold,
        wait_thresholds:     waitThresholds,
        allow_remote:        allowRemote,
        notification_plan:   notificationPlan,
        push_settings:       { queue_new: true, purchase_new: true },
        alert_days_repair:   alertDaysRepair,
        alert_days_purchase: alertDaysPurchase,
        repair_notes:        repairNotes || null,
        business_hours:      businessHours,
        order_schedule:      orderScheduleOn && orderSchedule ? orderSchedule : null,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-200/60 border border-gray-300/50 flex items-center justify-center">
            <Settings size={17} className="text-gray-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900">設定</h1>
            {storeName && <p className="text-xs text-gray-500 truncate">{storeName}</p>}
          </div>
          <button onClick={() => {
            const gc = sessionStorage.getItem('admin_group_code')
            window.location.href = gc ? `/company/${gc}` : '/super-admin'
          }} title="総管理ダッシュボード"
            className="p-2 rounded-xl bg-gray-200/60 border border-gray-300/50 hover:bg-gray-300/60 active:opacity-60 transition-all text-gray-600">
            <LayoutDashboard size={16} />
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'}`}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCheck size={14} /> : null}
            {saved ? '保存済み' : '保存'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-28">

        {/* ① 受付ページ設定 */}
        <Section id="reception" emoji="🔢" title="受付ページ設定" open={openSections.has('reception')} onToggle={() => toggle('reception')}>
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">注意事項</label>
            <p className="text-[11px] text-gray-400 mb-1.5">受付ページに表示される注意文（空欄でデフォルト表示）</p>
            <textarea value={noticeText} onChange={e => setNoticeText(e.target.value)} rows={3}
              placeholder="例: 混雑状況により、お時間をいただく場合がございます。&#10;ご了承のうえ、受付をお取りください。"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none resize-none" />
          </div>

          {/* 営業時間 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">営業時間</p>
            <p className="text-[10px] text-gray-400 mb-2">受付ページ・管理画面での参照用</p>
            <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
              {DAY_LABELS.map(({ key, label, color }) => {
                const h = businessHours.hours[key] ?? { open: '10:00', close: '19:00', closed: false }
                const update = (patch: Partial<DayHours>) =>
                  setBusinessHours(prev => ({ hours: { ...prev.hours, [key]: { ...h, ...patch } } }))
                return (
                  <div key={key} className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 ${h.closed ? 'opacity-50' : ''}`}>
                    <span className={`w-5 text-xs font-bold text-center ${color}`}>{label}</span>
                    {h.closed ? (
                      <span className="flex-1 text-xs text-gray-500">定休日</span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input type="time" value={h.open} onChange={e => update({ open: e.target.value })}
                          className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none" />
                        <span className="text-gray-400 text-xs">〜</span>
                        <input type="time" value={h.close} onChange={e => update({ close: e.target.value })}
                          className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none" />
                      </div>
                    )}
                    <button onClick={() => update({ closed: !h.closed })}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                        h.closed ? 'bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}>
                      {h.closed ? '開店' : '定休'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <Toggle
            on={allowRemote} onToggle={() => setAllowRemote(v => !v)}
            label="🏠 来店前の順番取りを許可"
            sub={allowRemote ? 'OFFにすると現地受付のみになります' : '顧客が自宅から順番取りできるようになります'}
          />
        </Section>

        {/* ② 通知設定 */}
        <Section id="notifications" emoji="🔔" title="通知設定" open={openSections.has('notifications')} onToggle={() => toggle('notifications')}>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'calling_only', label: '呼出のみ', desc: '1通/人 — 呼出時のみ', icon: '🔔' },
              { value: 'full',         label: '全通知',   desc: '3通/人 — 受付・もうすぐ・呼出', icon: '📲' },
            ] as const).map(opt => (
              <button key={opt.value} type="button" onClick={() => setNotificationPlan(opt.value)}
                className={`flex flex-col items-start px-3 py-3 rounded-xl border-2 transition-all text-left ${
                  notificationPlan === opt.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-200 bg-gray-50'
                }`}>
                <span className="text-sm font-bold mb-0.5">
                  {opt.icon} <span className={notificationPlan === opt.value ? 'text-indigo-700' : 'text-gray-600'}>{opt.label}</span>
                </span>
                <span className="text-[11px] text-gray-500">{opt.desc}</span>
              </button>
            ))}
          </div>

          {notificationPlan === 'full' && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-100">
              <span className="text-xs text-gray-600 flex-1">もうすぐ通知 — 残り</span>
              <input type="number" min={1} max={20} value={noticeThreshold}
                onChange={e => setNoticeThreshold(Number(e.target.value))}
                className="w-14 bg-white border border-gray-200 rounded-lg px-2 py-1 text-center font-black text-base text-gray-900 focus:border-indigo-500 focus:outline-none" />
              <span className="text-xs text-gray-500">番目で通知</span>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-bold text-gray-600">待ち案内メッセージ</p>
            <p className="text-[10px] text-gray-400">顧客の受付画面に表示されます</p>
            {waitThresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" min={1} max={99} placeholder="∞" value={t.max_wait ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? null : Number(e.target.value)
                      const up = [...waitThresholds]; up[i] = { ...up[i], max_wait: val }; setWaitThresholds(up)
                    }}
                    className="w-12 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-xs text-gray-900 focus:border-indigo-500 focus:outline-none" />
                  <span className="text-gray-500 text-[10px]">組↓</span>
                </div>
                <input type="text" value={t.text}
                  onChange={e => {
                    const up = [...waitThresholds]; up[i] = { ...up[i], text: e.target.value }; setWaitThresholds(up)
                  }}
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
                  placeholder="表示するメッセージ" />
                <button onClick={() => setWaitThresholds(waitThresholds.filter((_, j) => j !== i))}
                  className="shrink-0 p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button onClick={() => setWaitThresholds([...waitThresholds, { max_wait: null, text: '' }])}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors text-xs">
              <Plus size={12} />行を追加
            </button>
          </div>
        </Section>

        {/* ③ 案件管理設定 */}
        <Section id="cases" emoji="✂️" title="案件管理設定" open={openSections.has('cases')} onToggle={() => toggle('cases')}>
          {/* 未お渡しアラート */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-600">未お渡しアラート</p>
            <p className="text-[10px] text-gray-400">完了・入荷からN日後に警告表示します</p>
            {[
              { label: 'お直し完了', value: alertDaysRepair,   set: setAlertDaysRepair },
              { label: '取置き入荷', value: alertDaysPurchase, set: setAlertDaysPurchase },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="text-amber-600 shrink-0" />
                <span className="text-xs text-gray-600 flex-1">{label}</span>
                <div className="flex items-center gap-1">
                  {[3, 5, 7, 14, 30].map(d => (
                    <button key={d} onClick={() => set(d)}
                      className={`w-9 h-7 rounded-lg text-xs font-bold transition-all ${
                        value === d ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}>{d}</button>
                  ))}
                  <span className="text-xs text-gray-400 ml-1">日</span>
                </div>
              </div>
            ))}
          </div>

          {/* 発注促進スケジュール */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-600">発注促進スケジュール</p>
            <p className="text-[10px] text-gray-400">条件を満たすと管理画面上部にバナーが表示されます</p>
            <Toggle
              on={orderScheduleOn}
              onToggle={() => {
                const next = !orderScheduleOn
                setOrderScheduleOn(next)
                if (next && !orderSchedule) setOrderSchedule({ type: 'daily', time: '21:00' })
              }}
              label="📦 発注リマインダーを使う"
              sub={orderScheduleOn ? 'スケジュールに従ってバナーを表示します' : 'OFFの場合はバナーを表示しません'}
            />
            {orderScheduleOn && orderSchedule && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: 'immediate', label: '即時',    desc: '未発注が1件でもあれば常に表示' },
                      { value: 'daily',     label: '毎日',    desc: '指定時刻以降に表示' },
                      { value: 'interval',  label: 'N日ごと', desc: '前回消したN日後に表示' },
                      { value: 'weekly',    label: '週1回',   desc: '指定曜日・時刻以降に表示' },
                    ] as { value: ScheduleType; label: string; desc: string }[]
                  ).map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setOrderSchedule(prev => ({ ...(prev ?? {}), type: opt.value } as OrderSchedule))}
                      className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                        orderSchedule.type === opt.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'
                      }`}>
                      <span className={`text-xs font-bold ${orderSchedule.type === opt.value ? 'text-amber-700' : 'text-gray-600'}`}>{opt.label}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                {(orderSchedule.type === 'daily' || orderSchedule.type === 'weekly') && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={11} />表示開始時刻</p>
                    <input type="time" value={orderSchedule.time ?? '21:00'}
                      onChange={e => setOrderSchedule(prev => ({ ...prev!, time: e.target.value }))}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none" />
                  </div>
                )}
                {orderSchedule.type === 'weekly' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">発注曜日</p>
                    <div className="flex gap-1.5">
                      {(['日','月','火','水','木','金','土'] as const).map((label, i) => (
                        <button key={i} type="button"
                          onClick={() => setOrderSchedule(prev => ({ ...prev!, day_of_week: i }))}
                          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                            orderSchedule.day_of_week === i
                              ? 'bg-amber-500 text-white'
                              : i === 0 ? 'bg-red-50 text-red-500 hover:bg-red-100'
                              : i === 6 ? 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {orderSchedule.type === 'interval' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">発注間隔</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        {[1, 3, 7, 14, 30].map(d => (
                          <button key={d} type="button"
                            onClick={() => setOrderSchedule(prev => ({ ...prev!, interval_days: d }))}
                            className={`w-11 h-9 rounded-xl text-xs font-bold transition-all ${
                              orderSchedule.interval_days === d ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                            }`}>{d}</button>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">日ごと</span>
                    </div>
                  </div>
                )}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <PackageSearch size={13} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    バナーは「×」か「発注画面へ」で消えます。次の発注タイミングが来ると再表示されます。
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* お直し持込注意事項 */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-gray-600">お直し持込 注意事項（顧客向けページ）</p>
            <p className="text-[10px] text-gray-400">リッチメニュー「依頼」から開くページに表示されます</p>
            <textarea
              value={repairNotes}
              onChange={e => setRepairNotes(e.target.value)}
              rows={5}
              placeholder={'【お持ち込みの際のお願い】\n・お直しの内容をできるだけ具体的にお知らせください\n\n【お預かりについて】\n・お預かり後、仕上がり日をご連絡します'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        </Section>

        {/* ④ 採寸予約設定 */}
        <Section id="reservations" emoji="📅" title="採寸予約設定" open={openSections.has('reservations')} onToggle={() => toggle('reservations')}>
          {resvTableOk === false ? (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500">
              <p className="font-bold text-gray-600 mb-1">予約設定テーブルが見つかりません</p>
              <p>Supabase SQLEditorで予約テーブルのマイグレーションを実行してください。</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                ジャージ（30分）と制服（60分）が同じ枠を共有します。<br />
                各曜日の枠数は「同時に採寸できる組数」です。
              </p>
              {resvSettings.map((s, idx) => (
                <div key={s.service_type} className={`rounded-2xl border p-4 space-y-3 transition-all ${
                  s.is_active ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className={s.is_active ? 'text-indigo-600' : 'text-gray-400'} />
                      <span className={`font-bold text-sm ${s.is_active ? 'text-gray-900' : 'text-gray-500'}`}>{s.label}</span>
                    </div>
                    <button onClick={() => updateResv(idx, { is_active: !s.is_active })}
                      className={`w-10 h-5 rounded-full transition-colors shrink-0 ${s.is_active ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full mt-0.5 shadow transition-transform mx-0.5 ${s.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {s.is_active && (
                    <>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1.5">所要時間（分）</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {[30, 45, 60, 90, 120].map(d => (
                            <button key={d} onClick={() => updateResv(idx, { duration_min: d })}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                s.duration_min === d ? 'bg-indigo-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}>{d}分</button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[11px] text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={10} />受付開始</p>
                          <input type="time" value={s.start_time}
                            onChange={e => updateResv(idx, { start_time: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={10} />受付終了</p>
                          <input type="time" value={s.end_time}
                            onChange={e => updateResv(idx, { end_time: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1.5">曜日別 最大予約枠数</p>
                        <div className="grid grid-cols-7 gap-1">
                          {(
                            [
                              ['日', 'slots_sun', 'text-red-600'],
                              ['月', 'slots_mon', 'text-gray-700'],
                              ['火', 'slots_tue', 'text-gray-700'],
                              ['水', 'slots_wed', 'text-gray-700'],
                              ['木', 'slots_thu', 'text-gray-700'],
                              ['金', 'slots_fri', 'text-gray-700'],
                              ['土', 'slots_sat', 'text-blue-600'],
                            ] as [string, keyof ResvSetting, string][]
                          ).map(([label, key, color]) => (
                            <div key={key} className="flex flex-col items-center gap-1">
                              <span className={`text-[10px] font-bold ${color}`}>{label}</span>
                              <input
                                type="number" min={0} max={20}
                                value={s[key] as number}
                                onChange={e => updateResv(idx, { [key]: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-full bg-white border border-gray-200 rounded-lg text-center text-sm text-gray-900 py-1.5 focus:border-indigo-500 focus:outline-none" />
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-300 mt-1">0 = その曜日は受付停止</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {resvError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{resvError}</p>
              )}
              <button onClick={handleResvSave} disabled={resvLoading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  resvSaved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}>
                {resvLoading ? <><Loader2 size={14} className="animate-spin" />保存中...</>
                  : resvSaved ? <><CheckCheck size={14} />保存済み</>
                  : '予約設定を保存'}
              </button>
            </div>
          )}
        </Section>

        {/* ⑤ マスタ管理 */}
        <Section id="master" emoji="📋" title="マスタ管理" open={openSections.has('master')} onToggle={() => toggle('master')}>
          <p className="text-xs text-gray-400">学校・商品・スタッフなどの基本データを管理します</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/${storeId}/admin/master`}
              className="flex flex-col gap-2 px-3 py-3.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 active:opacity-70 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                  <GraduationCap size={15} className="text-indigo-600" />
                </div>
                <ChevronRight size={13} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-700">学校・商品マスタ</p>
                <p className="text-[10px] text-indigo-500 mt-0.5 leading-relaxed">学校ごとの商品・サイズ・価格を管理</p>
              </div>
            </Link>
            <Link href={`/${storeId}/admin/master?tab=staff`}
              className="flex flex-col gap-2 px-3 py-3.5 rounded-xl bg-violet-50 border border-violet-200 hover:bg-violet-100 active:opacity-70 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center">
                  <Users size={15} className="text-violet-600" />
                </div>
                <ChevronRight size={13} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-violet-700">スタッフマスタ</p>
                <p className="text-[10px] text-violet-500 mt-0.5 leading-relaxed">スタッフ情報・役職・カラーを管理</p>
              </div>
            </Link>
          </div>
        </Section>

        {/* 保存エラー */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
            保存エラー: {saveError}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200/60"
        >
          {saving ? <><Loader2 size={16} className="animate-spin inline mr-2" />保存中...</> : '設定を保存'}
        </button>

      </div>

      <BottomNav />
    </div>
  )
}
