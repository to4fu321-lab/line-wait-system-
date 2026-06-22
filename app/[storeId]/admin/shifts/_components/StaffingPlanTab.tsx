'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Settings2, Sparkles, Users, Save, Calculator } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Shift, StaffingSettings } from '@/types/shifts'
import { loadDemandDay, loadStaffingSettings, saveStaffingSettings, requiredFor, type DemandBlock } from '../_lib/demand'
import { fmtDateJp, addDays, todayJst } from '../_lib/time'

const sb = supabase as any
type Source = 'actual' | 'sim'
type SimMode = 'simple' | 'detail'

export function StaffingPlanTab({ storeId, useAi, onToast, onShiftsChanged }: {
  storeId: string
  shifts: Shift[]
  ym: { y: number; m: number }
  useAi: boolean
  onToast: (m: string, t?: 'ok' | 'err') => void
  onPrev: () => void
  onNext: () => void
  onShiftsChanged: () => void
}) {
  const [date, setDate] = useState(todayJst())
  const [blocks, setBlocks] = useState<DemandBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<StaffingSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [generating, setGenerating] = useState(false)
  // シミュレーター
  const [source, setSource] = useState<Source>('actual')
  const [simMode, setSimMode] = useState<SimMode>('simple')
  const [simRooms, setSimRooms] = useState(4)
  const [simPeak, setSimPeak] = useState(12)
  const [simCounts, setSimCounts] = useState<Record<string, number>>({})

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: dayShifts } = await sb.from('shifts').select('*').eq('store_id', storeId).eq('work_date', date).neq('status', 'cancelled')
    const b = await loadDemandDay(storeId, date, (dayShifts ?? []) as Shift[])
    setBlocks(b); setLoading(false)
  }, [storeId, date])

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => { loadStaffingSettings(storeId).then(setSettings) }, [storeId])
  useEffect(() => {
    sb.from('stores').select('active_fittings').eq('id', storeId).maybeSingle()
      .then(({ data }: any) => { if (data?.active_fittings) setSimRooms(Number(data.active_fittings)) })
  }, [storeId])

  const saveSettings = async (patch: Partial<StaffingSettings>) => {
    const next = { ...settings!, ...patch }
    setSettings(next)
    await saveStaffingSettings(storeId, patch)
    fetch()
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await postJson('/api/shift-ai', { action: 'generate', storeId, date })
      if (!res.ok) { onToast(res.error || '生成に失敗しました', 'err') }
      else {
        onToast(res.created ? `${res.created}件の下書きを生成（不足${res.shortage ?? 0}）` : '生成しました')
        fetch(); onShiftsChanged()
      }
    } catch { onToast('生成に失敗しました', 'err') }
    setGenerating(false)
  }

  // シミュレーション結果を必要人員(staffing_requirements)として保存
  const saveSimulation = async () => {
    if (!settings) return
    const rows = blocks.map(b => {
      const count = simCounts[b.block] ?? b.reservations
      return { store_id: storeId, work_date: date, time_block: b.block, required: requiredFor(count, settings, simRooms), reservations: count, source: 'manual' }
    })
    for (const r of rows) await sb.from('staffing_requirements').upsert(r, { onConflict: 'store_id,work_date,time_block' })
    onToast('想定を必要人員として保存しました'); onShiftsChanged()
  }

  // 表示用ブロック（実績 or シミュレーション）
  const viewBlocks = blocks.map(b => {
    if (source === 'actual' || !settings) return b
    const count = simCounts[b.block] ?? b.reservations
    return { ...b, reservations: count, required: requiredFor(count, settings, simRooms) }
  })

  const totalReq = viewBlocks.reduce((a, b) => a + b.required, 0)
  const totalRes = viewBlocks.reduce((a, b) => a + b.reservations, 0)
  const peakRequired = settings ? requiredFor(simPeak, settings, simRooms) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setDate(d => addDays(d, -1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
          <button onClick={() => setDate(todayJst())} className="px-2 py-1 rounded-lg text-xs font-bold text-indigo-600">今日</button>
          <button onClick={() => setDate(d => addDays(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
          <p className="font-black text-gray-900 text-sm ml-1">{fmtDateJp(date)}</p>
        </div>
        <button onClick={() => setShowSettings(v => !v)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><Settings2 size={18} /></button>
      </div>

      {/* データソース切替 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3">
        <button onClick={() => setSource('actual')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${source === 'actual' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>実績予約から</button>
        <button onClick={() => setSource('sim')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${source === 'sim' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>シミュレーション</button>
      </div>

      {showSettings && settings && (
        <div className="mb-3 p-3 rounded-xl border border-gray-200 bg-gray-50 grid grid-cols-2 gap-2 text-xs">
          <NumField label="ブロック(分)" v={settings.time_block_min} onChange={v => saveSettings({ time_block_min: v })} />
          <NumField label="試着時間(分)" v={settings.fitting_minutes} onChange={v => saveSettings({ fitting_minutes: v })} />
          <NumField label="1人が捌く室数" v={settings.per_person_rooms} step={0.1} onChange={v => saveSettings({ per_person_rooms: v })} />
          <NumField label="来店係数" v={settings.visit_factor} step={0.1} onChange={v => saveSettings({ visit_factor: v })} />
          <NumField label="成約率" v={settings.conversion_rate} step={0.05} onChange={v => saveSettings({ conversion_rate: v })} />
          <NumField label="最大人数" v={settings.max_staff} onChange={v => saveSettings({ max_staff: v })} />
        </div>
      )}

      {/* シミュレーション入力 */}
      {source === 'sim' && (
        <div className="mb-3 p-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator size={15} className="text-indigo-600" />
            <div className="flex gap-1 bg-white rounded-lg p-0.5 border border-indigo-100">
              <button onClick={() => setSimMode('simple')} className={`px-3 py-1 rounded-md text-xs font-bold ${simMode === 'simple' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>簡単</button>
              <button onClick={() => setSimMode('detail')} className={`px-3 py-1 rounded-md text-xs font-bold ${simMode === 'detail' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>詳細</button>
            </div>
            <label className="ml-auto flex items-center gap-1.5 text-xs font-bold text-gray-600">
              稼働ﾌｨｯﾃｨﾝｸﾞ数
              <input type="number" min={1} value={simRooms} onChange={e => setSimRooms(Number(e.target.value) || 1)}
                className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
            </label>
          </div>

          {simMode === 'simple' ? (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                最繁時の想定来客数
                <input type="number" min={0} value={simPeak} onChange={e => setSimPeak(Number(e.target.value) || 0)}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              </label>
              <div className="ml-auto text-right">
                <p className="text-[11px] text-gray-400 font-bold">ピーク必要人員</p>
                <p className="text-3xl font-black text-indigo-700 leading-none">{peakRequired}<span className="text-base ml-0.5">名</span></p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">各時間帯の想定来客数を入力すると、下のバーに必要人員が反映されます。</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Users size={12} />{source === 'sim' ? '想定' : '予約'}計 {totalRes}件・必要のべ {totalReq}名</span>
        {source === 'sim' && (
          <button onClick={saveSimulation} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-50">
            <Save size={12} />必要人員に保存
          </button>
        )}
        {useAi && source === 'actual' && (
          <button onClick={generate} disabled={generating}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white font-black active:scale-95 disabled:opacity-50">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}AIで自動生成
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : viewBlocks.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">営業時間・試着設定がありません</p>
      ) : (
        <div className="space-y-1.5">
          {viewBlocks.map(b => {
            const short = b.assigned < b.required
            const over = b.assigned > b.required && b.required > 0
            const ratio = b.required > 0 ? Math.min(100, (b.assigned / b.required) * 100) : (b.assigned > 0 ? 100 : 0)
            return (
              <div key={b.block} className="flex items-center gap-2">
                <span className="w-12 text-xs font-bold text-gray-600 tabular-nums">{b.block}</span>
                {source === 'sim' && simMode === 'detail' && (
                  <input type="number" min={0} value={simCounts[b.block] ?? b.reservations}
                    onChange={e => setSimCounts(prev => ({ ...prev, [b.block]: Number(e.target.value) || 0 }))}
                    className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-sm shrink-0" />
                )}
                <div className="flex-1 h-7 rounded-lg bg-gray-100 relative overflow-hidden">
                  <div className={`h-full ${short ? 'bg-red-400' : over ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{ width: `${ratio}%` }} />
                  <span className="absolute inset-0 flex items-center px-2 text-[11px] font-bold text-gray-700">
                    {source === 'sim' ? '想定' : '予約'}{b.reservations}・必要{b.required}名
                  </span>
                </div>
                <span className={`w-16 text-right text-xs font-black ${short ? 'text-red-600' : over ? 'text-amber-600' : 'text-emerald-600'}`}>
                  配置{b.assigned}{short ? `(不足${b.required - b.assigned})` : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-3 text-center">
        {source === 'sim' ? '想定来客数と稼働フィッティング数から必要人員を試算します。' : '試着室・予約数・試着時間から必要人員を算出。'}係数は⚙から調整できます。
      </p>
    </div>
  )
}

async function postJson(url: string, body: any) {
  const res = await window.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

function NumField({ label, v, step, onChange }: { label: string; v: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-gray-500 font-bold">{label}</span>
      <input type="number" step={step ?? 1} defaultValue={v} onBlur={e => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
    </label>
  )
}
