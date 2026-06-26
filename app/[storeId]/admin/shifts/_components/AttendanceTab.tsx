'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Clock, Settings2, ExternalLink, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { loadAttendance, type AttendanceRow } from '../_lib/attendance'
import { fmtHM, fmtDateJp, addDays, todayJst, fmtDurationH } from '../_lib/time'

const sb = supabase as any

export function AttendanceTab({ storeId }: { storeId: string }) {
  const [date, setDate] = useState(todayJst())
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCfg, setShowCfg] = useState(false)
  const [requirePin, setRequirePin] = useState(false)
  const [showOnReception, setShowOnReception] = useState(true)

  useEffect(() => {
    setLoading(true)
    loadAttendance(storeId, date).then(r => { setRows(r); setLoading(false) })
  }, [storeId, date])

  useEffect(() => {
    sb.from('stores').select('timecard_settings').eq('id', storeId).maybeSingle().then(({ data }: any) => {
      const t = data?.timecard_settings ?? {}
      setRequirePin(!!t.require_pin)
      setShowOnReception(t.show_on_reception !== false)
    })
  }, [storeId])

  const saveCfg = async (patch: { require_pin?: boolean; show_on_reception?: boolean }) => {
    const next = { require_pin: requirePin, show_on_reception: showOnReception, ...patch }
    setRequirePin(next.require_pin); setShowOnReception(next.show_on_reception)
    await sb.from('stores').update({ timecard_settings: next }).eq('id', storeId)
  }

  const kioskUrl = typeof window !== 'undefined' ? `${window.location.origin}/${storeId}/timecard` : `/${storeId}/timecard`

  const tClock = (ts?: string | null) => ts ? new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div>
      {/* 店頭タイムカード設定 */}
      <div className="mb-3 rounded-2xl border border-gray-200 bg-white">
        <button onClick={() => setShowCfg(v => !v)} className="w-full flex items-center gap-2 px-4 py-3">
          <Settings2 size={16} className="text-gray-500" />
          <span className="text-sm font-bold text-gray-800 flex-1 text-left">店頭タイムカード設定</span>
          <span className="text-xs text-gray-400">{showCfg ? '閉じる' : '開く'}</span>
        </button>
        {showCfg && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
            <Toggle label="PIN確認を必須にする" sub="名前タップ後に本人のPINを確認（なりすまし防止）"
              on={requirePin} onToggle={() => saveCfg({ require_pin: !requirePin })} />
            <Toggle label="受付画面にボタンを表示" sub="受付トップに『タイムカード』ボタンを出す"
              on={showOnReception} onToggle={() => saveCfg({ show_on_reception: !showOnReception })} />
            <div className="flex items-center gap-2 pt-1">
              <a href={`/${storeId}/timecard`} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black active:scale-95">
                <ExternalLink size={15} />店頭タイムカードを開く
              </a>
              <button onClick={() => { navigator.clipboard?.writeText(kioskUrl) }}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
                <Copy size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-400">店頭のタブレットをこのURLに固定しておくと、名前タップで出退勤できます。</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 mb-3">
        <button onClick={() => setDate(d => addDays(d, -1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
        <button onClick={() => setDate(todayJst())} className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50">今日</button>
        <p className="font-black text-gray-900 text-sm w-28 text-center">{fmtDateJp(date)}</p>
        <button onClick={() => setDate(d => addDays(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-gray-400"><Clock size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">この日の予定・打刻はありません</p></div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.staff_id} className={`flex items-center gap-3 p-3 rounded-xl border bg-white ${r.absent ? 'border-red-200' : 'border-gray-200'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500">
                  予定 {r.shift ? `${fmtHM(r.shift.start_time)}-${fmtHM(r.shift.end_time)}` : 'なし'}
                  <span className="mx-1">/</span>
                  実績 {tClock(r.record?.clock_in_at)}-{tClock(r.record?.clock_out_at)}
                </p>
              </div>
              <div className="text-right text-[11px] font-bold space-y-0.5">
                {r.absent && <span className="text-red-500">欠勤</span>}
                {r.lateMin > 0 && <div className="text-amber-600">遅刻 {r.lateMin}分</div>}
                {r.earlyMin > 0 && <div className="text-amber-600">早退 {r.earlyMin}分</div>}
                {r.overtimeMin > 0 && <div className="text-indigo-600">残業 {fmtDurationH(r.overtimeMin)}</div>}
                {!r.absent && r.lateMin === 0 && r.earlyMin === 0 && r.overtimeMin === 0 && r.record && <span className="text-emerald-600">正常</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Toggle({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 text-left">
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-400">{sub}</p>
      </div>
      <div className={`w-11 h-6 rounded-full shrink-0 transition-colors ${on ? 'bg-indigo-500' : 'bg-gray-300'}`}>
        <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}
