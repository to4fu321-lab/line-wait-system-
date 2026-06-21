'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ShiftRequest, ShiftRequestKind } from '@/types/shifts'

const sb = supabase as any
const WEEK = ['日', '月', '火', '水', '木', '金', '土']

// 希望シフト提出：日付タップで 勤務可→休み→未設定 を循環。勤務可は時間帯も指定可。
export function SubmitRequest({ storeId, staffId, onToast }: {
  storeId: string; staffId: string; onToast: (m: string, t?: 'ok' | 'err') => void
}) {
  const t = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const [ym, setYm] = useState({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) })
  const [reqs, setReqs] = useState<Record<string, ShiftRequest>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('18:00')
  const today = t

  const p = (n: number) => String(n).padStart(2, '0')
  const fetch = () => {
    setLoading(true)
    const days = new Date(ym.y, ym.m, 0).getDate()
    sb.from('shift_requests').select('*')
      .eq('store_id', storeId).eq('staff_id', staffId)
      .gte('work_date', `${ym.y}-${p(ym.m)}-01`).lte('work_date', `${ym.y}-${p(ym.m)}-${p(days)}`)
      .then(({ data }: any) => {
        const m: Record<string, ShiftRequest> = {}
        for (const r of (data ?? [])) m[r.work_date] = r
        setReqs(m); setLoading(false)
      })
  }
  useEffect(fetch, [storeId, staffId, ym]) // eslint-disable-line react-hooks/exhaustive-deps

  // 循環: なし → work → off → なし
  const cycle = async (date: string) => {
    const cur = reqs[date]
    setBusy(date)
    if (!cur) {
      await sb.from('shift_requests').insert({ store_id: storeId, staff_id: staffId, work_date: date, kind: 'work', pref_start: start, pref_end: end, status: 'submitted' })
    } else if (cur.kind === 'work') {
      await sb.from('shift_requests').update({ kind: 'off', pref_start: null, pref_end: null, status: 'submitted' }).eq('id', cur.id)
    } else {
      await sb.from('shift_requests').delete().eq('id', cur.id)
    }
    setBusy(null); fetch()
  }

  const first = new Date(`${ym.y}-${p(ym.m)}-01T12:00:00Z`)
  const firstDow = first.getUTCDay()
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym.y}-${p(ym.m)}-${p(d)}`)

  const submittedCount = Object.values(reqs).filter(r => r.status === 'submitted').length

  return (
    <div>
      {/* 勤務可のときに付与する希望時間 */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-xs font-bold text-gray-500">勤務可の希望時間</span>
        <input type="time" value={start} onChange={e => setStart(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
        <span className="text-gray-400">-</span>
        <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setYm(({ y, m }) => m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <p className="font-black text-gray-900">{ym.y}年{ym.m}月</p>
        <button onClick={() => setYm(({ y, m }) => m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK.map((w, i) => <div key={w} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{w}</div>)}
      </div>

      {loading ? (
        <div className="py-12 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={`e${idx}`} />
            const r = reqs[date]
            const isToday = date === today
            const day = Number(date.slice(8))
            const kind: ShiftRequestKind | null = r?.kind ?? null
            return (
              <button key={date} onClick={() => cycle(date)} disabled={busy === date}
                className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center active:scale-95 transition-all ${
                  kind === 'work' ? 'bg-emerald-500 border-emerald-500 text-white'
                  : kind === 'off' ? 'bg-red-400 border-red-400 text-white'
                  : isToday ? 'border-indigo-300 bg-white' : 'border-gray-200 bg-white text-gray-700'
                }`}>
                <span className="text-sm font-black">{day}</span>
                {kind === 'work' && <span className="text-[8px] font-bold leading-none">可</span>}
                {kind === 'off' && <span className="text-[8px] font-bold leading-none">休</span>}
                {busy === date && <Loader2 size={10} className="animate-spin absolute" />}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" />勤務可</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" />休み希望</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-gray-300" />未設定</span>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">
        日付をタップで「勤務可→休み→未設定」と切り替わり、自動で提出されます。
        {submittedCount > 0 && <span className="block mt-1 text-emerald-600 font-bold"><Check size={12} className="inline" /> {submittedCount}件 提出済み</span>}
      </p>
    </div>
  )
}
