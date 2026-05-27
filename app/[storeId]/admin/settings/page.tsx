'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  Settings, Loader2, Plus, Trash2, GraduationCap, AlertCircle, Save,
  CalendarDays, Clock, CheckCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { WaitThreshold } from '@/types/database'
import { DEFAULT_THRESHOLDS } from '@/types/database'
import { BottomNav } from '../_components/BottomNav'

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
  const [isTestMode,        setIsTestMode]        = useState(false)
  const [repairNotes,       setRepairNotes]       = useState('')

  const [saveError, setSaveError] = useState<string | null>(null)

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
  const [resvSettings, setResvSettings]   = useState<ResvSetting[]>(DEFAULT_RESV)
  const [resvLoading,  setResvLoading]    = useState(false)
  const [resvSaved,    setResvSaved]      = useState(false)
  const [resvError,    setResvError]      = useState<string | null>(null)
  const [resvTableOk,  setResvTableOk]   = useState<boolean | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data } = await (supabase as any)
      .from('stores')
      .select('name, notice_threshold, wait_thresholds, allow_remote, notification_plan, push_settings, alert_days_repair, alert_days_purchase, school_names, is_test_mode, repair_notes')
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
      if (data.is_test_mode != null) setIsTestMode(data.is_test_mode)
      if (data.repair_notes != null) setRepairNotes(data.repair_notes)
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  // 予約設定フェッチ（テーブルが存在しない場合は graceful に処理）
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
        notice_threshold:    noticeThreshold,
        wait_thresholds:     waitThresholds,
        allow_remote:        allowRemote,
        notification_plan:   notificationPlan,
        push_settings:       { queue_new: pushQueueNew, purchase_new: true },
        alert_days_repair:   alertDaysRepair,
        alert_days_purchase: alertDaysPurchase,
        school_names:        schoolNames.filter((s: string) => s.trim()),
        repair_notes:        repairNotes || null,
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
          <div className="flex flex-col items-end gap-1">
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'}`}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? '保存済み' : '保存'}
            </button>
            <span className="text-[9px] text-zinc-700">v2026-05-27c</span>
          </div>
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

        {/* 予約設定 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Section title="採寸予約設定" />
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
              {resvSettings.map((s, idx) => (
                <div key={s.service_type} className={`rounded-2xl border p-4 space-y-3 transition-all ${
                  s.is_active ? 'bg-indigo-950/30 border-indigo-500/20' : 'bg-zinc-900/40 border-zinc-800/40'
                }`}>
                  {/* ヘッダー */}
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
                      {/* 所要時間 */}
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

                      {/* 受付時間 */}
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

                      {/* 曜日別最大枠数 */}
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
                  resvSaved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
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

        {/* お直し持込 注意事項 */}
        <div className="space-y-2">
          <Section title="お直し持込 注意事項（顧客向けページ）" />
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

        {/* Save button (bottom) */}
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
          {saving ? <><Loader2 size={16} className="animate-spin inline mr-2" />保存中...</> : '設定を保存'}
        </button>

        {/* テストモード */}
        <div className="space-y-2 border-t border-zinc-800/60 pt-4">
          <Section title="テストモード（開発・確認用）" />
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
