'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { loadMetrics, type ShiftMetrics } from '../_lib/metrics'
import { yen, todayJst } from '../_lib/time'

const pct = (n: number) => `${Math.round(n * 100)}%`

export function Dashboard({ storeId }: { storeId: string }) {
  const t = todayJst()
  const [ym, setYm] = useState({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) })
  const [m, setM] = useState<ShiftMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loadMetrics(storeId, ym.y, ym.m).then(r => { setM(r); setLoading(false) })
  }, [storeId, ym])

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-4">
        <button onClick={() => setYm(({ y, m }) => m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <p className="font-black text-gray-900 text-sm w-28 text-center">{ym.y}年{ym.m}月</p>
        <button onClick={() => setYm(({ y, m }) => m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      {loading || !m ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Card label="出勤率" value={pct(m.attendanceRate)} sub={`${m.attended}/${m.plannedShifts}コマ`} tone={m.attendanceRate >= 0.95 ? 'good' : 'warn'} />
          <Card label="欠勤率" value={pct(m.absenceRate)} sub={`${m.absent}件`} tone={m.absenceRate <= 0.05 ? 'good' : 'bad'} />
          <Card label="遅刻率" value={pct(m.lateRate)} sub={`${m.late}回`} tone={m.lateRate <= 0.1 ? 'good' : 'warn'} />
          <Card label="シフト充足率" value={pct(m.fulfillRate)} sub={`配置${m.assignedTotal}/必要${m.requiredTotal}`} tone={m.fulfillRate >= 0.9 ? 'good' : 'warn'} />
          <Card label="人件費" value={yen(m.laborCost)} sub="今月の見込" tone="neutral" wide />
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-3 text-center">出勤/欠勤/遅刻は打刻と公開シフトの突合、充足率は人員設計の必要人員との比較です。</p>
    </div>
  )
}

function Card({ label, value, sub, tone, wide }: {
  label: string; value: string; sub: string; tone: 'good' | 'warn' | 'bad' | 'neutral'; wide?: boolean
}) {
  const c = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    bad: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-gray-200 bg-white text-gray-900',
  }[tone]
  return (
    <div className={`rounded-2xl border p-4 ${c} ${wide ? 'col-span-2' : ''}`}>
      <p className="text-[11px] font-bold opacity-70">{label}</p>
      <p className="text-2xl font-black mt-0.5">{value}</p>
      <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>
    </div>
  )
}
