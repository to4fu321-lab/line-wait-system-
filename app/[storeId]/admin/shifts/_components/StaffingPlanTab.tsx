'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Settings2, Sparkles, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Shift, StaffingSettings } from '@/types/shifts'
import { loadDemandDay, loadStaffingSettings, saveStaffingSettings, type DemandBlock } from '../_lib/demand'
import { fmtDateJp, addDays, todayJst } from '../_lib/time'

const sb = supabase as any

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

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: dayShifts } = await sb.from('shifts').select('*').eq('store_id', storeId).eq('work_date', date).neq('status', 'cancelled')
    const b = await loadDemandDay(storeId, date, (dayShifts ?? []) as Shift[])
    setBlocks(b); setLoading(false)
  }, [storeId, date])

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => { loadStaffingSettings(storeId).then(setSettings) }, [storeId])

  const saveSettings = async (patch: Partial<StaffingSettings>) => {
    const next = { ...settings!, ...patch }
    setSettings(next)
    await saveStaffingSettings(storeId, patch)
    fetch()
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch_('/api/shift-ai', { action: 'generate', storeId, date })
      if (!res.ok) { onToast(res.error || '生成に失敗しました', 'err') }
      else {
        onToast(res.created ? `${res.created}件の下書きを生成（不足${res.shortage ?? 0}）` : '生成しました')
        fetch(); onShiftsChanged()
      }
    } catch { onToast('生成に失敗しました', 'err') }
    setGenerating(false)
  }

  const totalReq = blocks.reduce((a, b) => a + b.required, 0)
  const totalRes = blocks.reduce((a, b) => a + b.reservations, 0)

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

      {showSettings && settings && (
        <div className="mb-3 p-3 rounded-xl border border-gray-200 bg-gray-50 grid grid-cols-2 gap-2 text-xs">
          <Field label="ブロック(分)" v={settings.time_block_min} onChange={v => saveSettings({ time_block_min: v })} />
          <Field label="試着時間(分)" v={settings.fitting_minutes} onChange={v => saveSettings({ fitting_minutes: v })} />
          <Field label="1人が捌く室数" v={settings.per_person_rooms} step={0.1} onChange={v => saveSettings({ per_person_rooms: v })} />
          <Field label="来店係数" v={settings.visit_factor} step={0.1} onChange={v => saveSettings({ visit_factor: v })} />
          <Field label="成約率" v={settings.conversion_rate} step={0.05} onChange={v => saveSettings({ conversion_rate: v })} />
          <Field label="最大人数" v={settings.max_staff} onChange={v => saveSettings({ max_staff: v })} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Users size={12} />予約計 {totalRes}件・必要のべ {totalReq}名</span>
        {useAi && (
          <button onClick={generate} disabled={generating}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white font-black active:scale-95 disabled:opacity-50">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}AIで自動生成
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : blocks.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">予約・営業時間の設定がありません</p>
      ) : (
        <div className="space-y-1.5">
          {blocks.map(b => {
            const short = b.assigned < b.required
            const over = b.assigned > b.required && b.required > 0
            const ratio = b.required > 0 ? Math.min(100, (b.assigned / b.required) * 100) : (b.assigned > 0 ? 100 : 0)
            return (
              <div key={b.block} className="flex items-center gap-3">
                <span className="w-12 text-xs font-bold text-gray-600 tabular-nums">{b.block}</span>
                <div className="flex-1 h-7 rounded-lg bg-gray-100 relative overflow-hidden">
                  <div className={`h-full ${short ? 'bg-red-400' : over ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{ width: `${ratio}%` }} />
                  <span className="absolute inset-0 flex items-center px-2 text-[11px] font-bold text-gray-700">
                    予約{b.reservations}・必要{b.required}名
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
      <p className="text-[11px] text-gray-400 mt-3 text-center">試着室{''}・予約数・試着時間から必要人員を算出。係数は⚙から調整できます。</p>
    </div>
  )
}

async function fetch_(url: string, body: any) {
  const res = await window.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

function Field({ label, v, step, onChange }: { label: string; v: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-gray-500 font-bold">{label}</span>
      <input type="number" step={step ?? 1} defaultValue={v} onBlur={e => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
    </label>
  )
}
