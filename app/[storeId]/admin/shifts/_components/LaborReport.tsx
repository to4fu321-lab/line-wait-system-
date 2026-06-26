'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Wallet, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Shift } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { workedMinutes, laborCost, wageOf, yen, fmtDurationH, fmtDateJp, dowOf } from '../_lib/time'

const sb = supabase as any

export function LaborReport({
  ym, shifts, staffMap, loading, onPrev, onNext, storeId, onToast,
}: {
  ym: { y: number; m: number }
  shifts: Shift[]
  staffMap: Record<string, Staff>
  loading: boolean
  onPrev: () => void
  onNext: () => void
  storeId: string
  onToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const yearMonth = `${ym.y}-${String(ym.m).padStart(2, '0')}`
  const [budget, setBudget] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    sb.from('shift_budgets').select('budget_amount').eq('store_id', storeId).eq('year_month', yearMonth).maybeSingle()
      .then(({ data }: any) => setBudget(data?.budget_amount ?? null))
  }, [storeId, yearMonth])

  const saveBudget = async () => {
    const amount = draft.trim() ? Number(draft) : null
    await sb.from('shift_budgets').upsert({ store_id: storeId, year_month: yearMonth, budget_amount: amount }, { onConflict: 'store_id,year_month' })
    setBudget(amount); setEditing(false)
    onToast('予算を保存しました')
  }

  // 集計
  const stats = useMemo(() => {
    let totalCost = 0, totalMin = 0
    const perStaff: Record<string, { name: string; color: string; min: number; cost: number; days: number }> = {}
    const perWeek: Record<number, { cost: number; min: number }> = {}
    const perDay: Record<string, { cost: number; count: number }> = {}
    for (const s of shifts) {
      const min = workedMinutes(s.start_time, s.end_time, s.break_minutes)
      const cost = laborCost(s, staffMap)
      totalCost += cost; totalMin += min
      const st = perStaff[s.staff_id] ||= {
        name: s.staff?.name ?? staffMap[s.staff_id]?.name ?? 'スタッフ',
        color: (s.is_help ? '#0d9488' : s.staff?.color) ?? staffMap[s.staff_id]?.color ?? '#94a3b8',
        min: 0, cost: 0, days: 0,
      }
      st.min += min; st.cost += cost; st.days += 1
      // 週番号（その月の何週目か：1日からの週）
      const day = Number(s.work_date.slice(8))
      const wk = Math.ceil((day + dowOf(`${yearMonth}-01`)) / 7)
      const w = perWeek[wk] ||= { cost: 0, min: 0 }; w.cost += cost; w.min += min
      const pd = perDay[s.work_date] ||= { cost: 0, count: 0 }; pd.cost += cost; pd.count += 1
    }
    return { totalCost, totalMin, perStaff, perWeek, perDay }
  }, [shifts, staffMap, yearMonth])

  const overBudget = budget != null && stats.totalCost > budget
  const ratio = budget && budget > 0 ? Math.min(100, Math.round((stats.totalCost / budget) * 100)) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <p className="font-black text-gray-900 text-sm w-28 text-center">{ym.y}年{ym.m}月</p>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : (
        <>
          {/* サマリ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-[11px] text-gray-400 font-bold mb-1">月間人件費</p>
              <p className="text-2xl font-black text-gray-900">{yen(stats.totalCost)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">実働 {fmtDurationH(stats.totalMin)}・{shifts.length}コマ</p>
            </div>
            <div className={`rounded-2xl border p-4 ${overBudget ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1"><Wallet size={12} />予算</p>
                <button onClick={() => { setEditing(true); setDraft(budget != null ? String(budget) : '') }}
                  className="text-gray-300 hover:text-gray-500"><Pencil size={12} /></button>
              </div>
              {editing ? (
                <div className="flex items-center gap-1">
                  <input type="number" autoFocus className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm" value={draft}
                    onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBudget()} placeholder="未設定" />
                  <button onClick={saveBudget} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">保存</button>
                </div>
              ) : budget == null ? (
                <p className="text-sm text-gray-400">未設定</p>
              ) : (
                <>
                  <p className={`text-2xl font-black ${overBudget ? 'text-red-600' : 'text-emerald-700'}`}>{yen(budget)}</p>
                  <p className={`text-[11px] mt-0.5 font-bold ${overBudget ? 'text-red-500' : 'text-emerald-600'}`}>
                    {overBudget ? `${yen(stats.totalCost - budget)} 超過` : `残り ${yen(budget - stats.totalCost)}`}
                  </p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/70 overflow-hidden">
                    <div className={`h-full rounded-full ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${ratio}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* スタッフ別 */}
          <div>
            <p className="text-xs font-black text-gray-500 mb-2">スタッフ別</p>
            <div className="space-y-1.5">
              {Object.entries(stats.perStaff).sort((a, b) => b[1].cost - a[1].cost).map(([id, s]) => (
                <div key={id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-white">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-sm font-bold text-gray-800 flex-1 truncate">{s.name}</span>
                  <span className="text-xs text-gray-400">{s.days}日・{fmtDurationH(s.min)}</span>
                  <span className="text-sm font-black text-gray-900 w-20 text-right">{yen(s.cost)}</span>
                </div>
              ))}
              {Object.keys(stats.perStaff).length === 0 && <p className="text-sm text-gray-400 text-center py-6">この月のシフトはありません</p>}
            </div>
          </div>

          {/* 週別 */}
          {Object.keys(stats.perWeek).length > 0 && (
            <div>
              <p className="text-xs font-black text-gray-500 mb-2">週別</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(stats.perWeek).sort((a, b) => Number(a[0]) - Number(b[0])).map(([wk, w]) => (
                  <div key={wk} className="rounded-xl border border-gray-100 bg-white p-2.5">
                    <p className="text-[11px] text-gray-400 font-bold">第{wk}週</p>
                    <p className="text-sm font-black text-gray-900">{yen(w.cost)}</p>
                    <p className="text-[10px] text-gray-400">{fmtDurationH(w.min)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <p className="text-[11px] text-gray-400 text-center">時給はスタッフマスタの既定値、または各シフトの上書きを使用します。</p>
    </div>
  )
}
