'use client'

import { useEffect, useState } from 'react'
import { LogIn, LogOut, Loader2, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { TimeRecord, Shift } from '@/types/shifts'
import { fmtHM, todayJst } from '../../admin/shifts/_lib/time'

const sb = supabase as any

// 出退勤打刻（当日）。当日の公開シフトと突合して表示。
export function ClockPanel({ storeId, staffId }: { storeId: string; staffId: string }) {
  const today = todayJst()
  const [rec, setRec] = useState<TimeRecord | null>(null)
  const [todayShift, setTodayShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000)
    return () => clearInterval(t)
  }, [])

  const fetch = async () => {
    const [{ data: recs }, { data: shifts }] = await Promise.all([
      sb.from('time_records').select('*').eq('staff_id', staffId).eq('work_date', today).order('created_at', { ascending: false }).limit(1),
      sb.from('shifts').select('*').eq('staff_id', staffId).eq('work_date', today).eq('status', 'published').limit(1),
    ])
    setRec((recs ?? [])[0] ?? null)
    setTodayShift((shifts ?? [])[0] ?? null)
    setLoading(false)
  }
  useEffect(() => { fetch() }, [storeId, staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  const clockIn = async () => {
    setBusy(true)
    let lat: number | null = null, lng: number | null = null
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }))
      lat = pos.coords.latitude; lng = pos.coords.longitude
    } catch { /* GPSは任意 */ }
    await sb.from('time_records').insert({
      store_id: storeId, staff_id: staffId, shift_id: todayShift?.id ?? null,
      work_date: today, clock_in_at: new Date().toISOString(),
      clock_in_lat: lat, clock_in_lng: lng, status: 'working',
    })
    setBusy(false); fetch()
  }

  const clockOut = async () => {
    if (!rec) return
    setBusy(true)
    await sb.from('time_records').update({ clock_out_at: new Date().toISOString(), status: 'done' }).eq('id', rec.id)
    setBusy(false); fetch()
  }

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>

  const inAt = rec?.clock_in_at ? new Date(rec.clock_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
  const outAt = rec?.clock_out_at ? new Date(rec.clock_out_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null
  const phase: 'before' | 'working' | 'done' = !rec ? 'before' : rec.status === 'done' ? 'done' : 'working'

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <Clock size={20} className="text-gray-300 mx-auto mb-1" />
        <p className="text-3xl font-black text-gray-900 tabular-nums">{now || '--:--:--'}</p>
        <p className="text-xs text-gray-400 mt-1">{today}</p>
      </div>

      {todayShift ? (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-center">
          <p className="text-xs text-indigo-400 font-bold">本日の予定</p>
          <p className="text-lg font-black text-indigo-700">{fmtHM(todayShift.start_time)} - {fmtHM(todayShift.end_time)}</p>
        </div>
      ) : (
        <p className="text-center text-xs text-gray-400">本日の公開シフトはありません（打刻は可能です）</p>
      )}

      <div className="flex items-center justify-center gap-4 text-sm">
        <span className={inAt ? 'text-emerald-600 font-bold' : 'text-gray-300'}>出勤 {inAt ?? '--:--'}</span>
        <span className="text-gray-300">→</span>
        <span className={outAt ? 'text-indigo-600 font-bold' : 'text-gray-300'}>退勤 {outAt ?? '--:--'}</span>
      </div>

      {phase === 'before' && (
        <button onClick={clockIn} disabled={busy}
          className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-black text-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="animate-spin" /> : <LogIn size={22} />}出勤する
        </button>
      )}
      {phase === 'working' && (
        <button onClick={clockOut} disabled={busy}
          className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="animate-spin" /> : <LogOut size={22} />}退勤する
        </button>
      )}
      {phase === 'done' && (
        <div className="w-full py-5 rounded-2xl bg-gray-100 text-gray-500 font-black text-center">本日の勤務お疲れさまでした 🎉</div>
      )}
    </div>
  )
}
