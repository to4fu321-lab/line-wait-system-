'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogIn, LogOut, Check, X, Delete } from 'lucide-react'
import type { TimeRecord, Shift } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { loadStaff } from '../../admin/shifts/_lib/data'
import { fmtHM, todayJst } from '../../admin/shifts/_lib/time'
import { loadTodayRecords, loadTodayShifts, clockIn, clockOut, phaseOf, verifyStaffPin, type ClockPhase } from '../../admin/shifts/_lib/timecard'

const clockStr = (ts?: string | null) => ts ? new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''

export function TimecardKiosk({ storeId, storeName, requirePin }: {
  storeId: string; storeName: string; requirePin: boolean
}) {
  const today = todayJst()
  const [staff, setStaff] = useState<Staff[]>([])
  const [records, setRecords] = useState<Map<string, TimeRecord>>(new Map())
  const [shifts, setShifts] = useState<Map<string, Shift>>(new Map())
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState('')
  const [pinFor, setPinFor] = useState<Staff | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [recs, shs] = await Promise.all([loadTodayRecords(storeId, today), loadTodayShifts(storeId, today)])
    setRecords(recs); setShifts(shs)
  }, [storeId, today])

  useEffect(() => {
    loadStaff(storeId).then(s => { setStaff(s.filter(x => x.active)); setLoading(false) })
    refresh()
    const poll = setInterval(refresh, 10000)
    return () => clearInterval(poll)
  }, [storeId, refresh])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000)
    return () => clearInterval(t)
  }, [])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500) }

  // 実打刻（PIN確認済 or 不要）
  const doClock = async (s: Staff) => {
    const rec = records.get(s.id)
    const phase = phaseOf(rec)
    if (phase === 'working' && rec) {
      await clockOut(rec.id)
      flash(`${s.name} さん 退勤しました　お疲れさまでした`)
    } else {
      await clockIn(storeId, s.id, today, shifts.get(s.id)?.id ?? null)
      flash(`${s.name} さん 出勤しました`)
    }
    refresh()
  }

  const onTap = (s: Staff) => {
    if (requirePin) setPinFor(s)
    else doClock(s)
  }

  if (loading) return <div className="min-h-[100dvh] grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <div className="px-5 py-4 bg-white border-b border-gray-100 flex items-center gap-3">
        <span className="text-2xl">🕐</span>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-gray-900">タイムカード</h1>
          <p className="text-xs text-gray-400 truncate">{storeName}・{today}</p>
        </div>
        <p className="text-2xl font-black text-gray-800 tabular-nums">{now || '--:--:--'}</p>
      </div>

      <div className="flex-1 p-4">
        {staff.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">スタッフが登録されていません</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {staff.map(s => {
              const rec = records.get(s.id)
              const phase = phaseOf(rec)
              const sh = shifts.get(s.id)
              return (
                <button key={s.id} onClick={() => onTap(s)}
                  className={`relative rounded-2xl border-2 p-4 text-left active:scale-[0.97] transition-all ${
                    phase === 'working' ? 'border-emerald-400 bg-emerald-50'
                    : phase === 'done' ? 'border-gray-200 bg-gray-100'
                    : 'border-indigo-200 bg-white'
                  }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-full grid place-items-center text-white font-black shrink-0" style={{ background: s.color || '#6366f1' }}>
                      {s.name.slice(0, 1)}
                    </span>
                    <span className="font-black text-gray-900 truncate">{s.name}</span>
                  </div>
                  {sh && <p className="text-[11px] text-gray-400 mb-1">予定 {fmtHM(sh.start_time)}-{fmtHM(sh.end_time)}</p>}
                  {phase === 'before' && (
                    <span className="inline-flex items-center gap-1 text-sm font-black text-indigo-600"><LogIn size={16} />出勤する</span>
                  )}
                  {phase === 'working' && (
                    <span className="inline-flex items-center gap-1 text-sm font-black text-emerald-600"><LogOut size={16} />退勤する<span className="text-[11px] text-gray-400 font-normal ml-1">({clockStr(rec?.clock_in_at)}〜)</span></span>
                  )}
                  {phase === 'done' && (
                    <span className="text-sm font-bold text-gray-400">退勤済 {clockStr(rec?.clock_in_at)}-{clockStr(rec?.clock_out_at)}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {pinFor && (
        <PinModal staff={pinFor} storeId={storeId}
          onClose={() => setPinFor(null)}
          onOk={async () => { const s = pinFor; setPinFor(null); await doClock(s) }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 px-4">
          <div className="bg-gray-900 text-white px-5 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2">
            <Check size={18} className="text-emerald-400" />{toast}
          </div>
        </div>
      )}
    </div>
  )
}

// 名前タップ後のPIN確認
function PinModal({ staff, storeId, onClose, onOk }: {
  staff: Staff; storeId: string; onClose: () => void; onOk: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    setBusy(true)
    const ok = await verifyStaffPin(storeId, staff.id, value)
    if (ok) onOk()
    else { setTimeout(() => { setPin(''); setError(true); setBusy(false) }, 250) }
  }
  const press = (d: string) => {
    if (pin.length >= 4 || busy) return
    const next = pin + d; setPin(next); setError(false)
    if (next.length === 4) submit(next)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-gray-900">{staff.name} さんのPIN</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex gap-3 justify-center mb-5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full ${pin.length > i ? error ? 'bg-red-400' : 'bg-indigo-500' : 'bg-gray-200'}`} />
          ))}
        </div>
        {error && <p className="text-center text-red-600 text-sm mb-3 font-bold">PINが違います</p>}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) => (
            <button key={i} disabled={busy} onClick={() => d === '⌫' ? setPin(p => p.slice(0, -1)) : d && press(d)}
              className={`py-4 rounded-2xl text-xl font-bold active:scale-90 transition-all disabled:opacity-50 ${
                d === '' ? 'invisible' : d === '⌫' ? 'bg-gray-100 text-gray-600' : 'bg-white border border-gray-200 hover:border-indigo-400'
              }`}>{d === '⌫' ? <Delete size={18} className="mx-auto" /> : d}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
