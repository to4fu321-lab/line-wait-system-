'use client'

// ============================================================
// 予約受付画面から、その日の予約枠をその場で増やす／減らす
//
//  設定画面（設定 → 予約枠の設定）に行かなくても、
//  「今日は急にスタッフが1人増えた」「1人休んだ」といったときに
//  受付画面のまま枠を動かせるようにするための箱。
//
//  変更は reservation_slot_overrides（日付×時間の上書き）に入れる。
//  既定の枠数そのものは触らないので、翌日以降には影響しない。
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, SlidersHorizontal, AlertTriangle, RotateCcw, CalendarOff, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toJstTimeString } from '@/lib/date'
import { isFitting } from '@/lib/fittingTypes'
import {
  capacityOf, loadCapacityInputs,
  type DayCapacity,
} from '@/lib/reservationCapacity'
import { CapacityStepper, MAX_CAPACITY } from './CapacityStepper'

const sb = supabase as any

interface SlotRow {
  time: string
  capacity: number
  booked: number
  overridden: boolean
}

export function DaySlotEditor({ storeId, date, onToast, onChanged }: {
  storeId: string
  date: string
  onToast: (type: 'ok' | 'err', msg: string) => void
  /** 枠を変えたことを親に伝える（統計の出し直しなどに使う） */
  onChanged?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cap, setCap] = useState<DayCapacity | null>(null)
  const [rows, setRows] = useState<SlotRow[]>([])
  const [busy, setBusy] = useState(false)

  // −／＋の連打を毎回DBに投げると往復と競合が起きるので、少し待ってまとめて保存する
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  useEffect(() => () => { Object.values(saveTimers.current).forEach(clearTimeout) }, [])

  const load = useCallback(async () => {
    if (!storeId || !date) return
    setLoading(true)
    const [inputs, { data: resv }] = await Promise.all([
      loadCapacityInputs(storeId, date, date),
      sb.from('reservations').select('reserved_at, purpose, service_type')
        .eq('store_id', storeId)
        .gte('reserved_at', `${date}T00:00:00+09:00`)
        .lte('reserved_at', `${date}T23:59:59+09:00`)
        .neq('status', 'cancelled'),
    ])

    const bookedAt: Record<string, number> = {}
    for (const r of (resv ?? []) as { reserved_at: string; purpose: string | null; service_type: string | null }[]) {
      if (!isFitting(r.purpose, r.service_type)) continue // 予約不要の用件は枠を使わない
      const t = toJstTimeString(r.reserved_at)
      bookedAt[t] = (bookedAt[t] ?? 0) + 1
    }

    const c = capacityOf(date, inputs)
    setCap(c)
    setRows(c.slots.map(s => ({
      time: s.time, capacity: s.capacity, overridden: s.overridden, booked: bookedAt[s.time] ?? 0,
    })))
    setLoading(false)
  }, [storeId, date])

  useEffect(() => { if (open) load() }, [open, load])

  /** 枠数を1つ保存する。画面は先に動かし、保存は少し待ってからまとめて投げる */
  const writeSlot = async (time: string, capacity: number) => {
    const { error } = await sb.from('reservation_slot_overrides')
      .upsert({ store_id: storeId, date, start_time: time, capacity }, { onConflict: 'store_id,date,start_time' })
    if (error) { onToast('err', `枠の保存に失敗しました: ${error.message}`); load(); return }
    onChanged?.()
  }

  const changeSlot = (time: string, v: number) => {
    setRows(prev => prev.map(r => r.time === time ? { ...r, capacity: v, overridden: true } : r))
    clearTimeout(saveTimers.current[time])
    saveTimers.current[time] = setTimeout(() => writeSlot(time, v), 600)
  }

  /** 全ての枠をまとめて増減する（スタッフが1人増えた／減ったとき用） */
  const shiftAll = async (delta: number) => {
    if (rows.length === 0) return
    setBusy(true)
    const next = rows.map(r => ({
      ...r,
      capacity: Math.min(MAX_CAPACITY, Math.max(0, r.capacity + delta)),
      overridden: true,
    }))
    setRows(next)
    const { error } = await sb.from('reservation_slot_overrides').upsert(
      next.map(r => ({ store_id: storeId, date, start_time: r.time, capacity: r.capacity })),
      { onConflict: 'store_id,date,start_time' },
    )
    setBusy(false)
    if (error) { onToast('err', `枠の保存に失敗しました: ${error.message}`); load(); return }
    onToast('ok', delta > 0 ? `全ての枠を${delta}件増やしました` : `全ての枠を${-delta}件減らしました`)
    onChanged?.()
  }

  /** この日の受付を止める（すでに入っている予約は消さない） */
  const closeDay = async () => {
    setBusy(true)
    const { error } = await sb.from('reservation_date_overrides')
      .upsert({ store_id: storeId, date, max_slots: 0 }, { onConflict: 'store_id,date' })
    setBusy(false)
    if (error) { onToast('err', `保存に失敗しました: ${error.message}`); return }
    onToast('ok', 'この日の受付を止めました')
    load(); onChanged?.()
  }

  /** この日だけの調整を消して、店舗の通常設定に戻す */
  const resetDay = async () => {
    setBusy(true)
    await Promise.all([
      sb.from('reservation_date_overrides').delete().eq('store_id', storeId).eq('date', date),
      sb.from('reservation_slot_overrides').delete().eq('store_id', storeId).eq('date', date),
    ])
    setBusy(false)
    onToast('ok', '通常の枠に戻しました')
    load(); onChanged?.()
  }

  const totalCapacity = rows.reduce((n, r) => n + r.capacity, 0)
  const totalBooked   = rows.reduce((n, r) => n + r.booked, 0)
  const hasOverride   = rows.some(r => r.overridden) || cap?.reason === 'date_closed'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 active:scale-[0.99] transition-all">
        <SlidersHorizontal size={16} className="text-indigo-600 shrink-0" />
        <span className="flex-1 text-left text-sm font-black text-gray-800">この日の予約枠を変える</span>
        {open && cap?.open && (
          <span className="text-[11px] font-bold text-gray-500 tabular-nums">{totalBooked}/{totalCapacity}件</span>
        )}
        <span className="text-xs text-gray-400">{open ? '閉じる' : '開く'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            ここでの変更はこの日だけに効きます。急なスタッフの増減やイレギュラー対応にお使いください。
          </p>

          {loading ? (
            <div className="py-6 grid place-items-center"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
          ) : !cap ? null : !cap.open ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-3 text-center">
                {cap.reason === 'closed_weekday' ? 'この曜日は定休日です' : 'この日は受付を止めています'}
              </p>
              <button onClick={resetDay} disabled={busy}
                className="w-full py-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold disabled:opacity-60">
                この日を受付ありに戻す
              </button>
            </div>
          ) : (
            <>
              {/* まとめて増減。1人増えた／減ったを1タップで反映する */}
              <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400 shrink-0" />
                <span className="text-xs font-bold text-gray-500 flex-1">全ての枠をまとめて</span>
                <button onClick={() => shiftAll(-1)} disabled={busy || totalCapacity === 0}
                  className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black disabled:opacity-40">−1件</button>
                <button onClick={() => shiftAll(1)} disabled={busy}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-40">＋1件</button>
              </div>

              <div className="space-y-1.5">
                {rows.map(r => {
                  const over = r.booked > r.capacity
                  return (
                    <div key={r.time} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                      over ? 'border-red-200 bg-red-50/60'
                        : r.overridden ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-200'
                    }`}>
                      <span className="font-black text-gray-800 text-sm w-14 shrink-0 tabular-nums">{r.time}</span>
                      <CapacityStepper value={r.capacity} disabled={busy} onChange={v => changeSlot(r.time, v)} />
                      <span className="text-xs text-gray-400 shrink-0">件</span>
                      <span className={`ml-auto text-[11px] font-bold tabular-nums shrink-0 ${
                        over ? 'text-red-600' : r.booked >= r.capacity ? 'text-orange-600' : 'text-gray-500'
                      }`}>
                        {over && <AlertTriangle size={11} className="inline mr-0.5 -mt-0.5" />}
                        予約{r.booked}件
                      </span>
                    </div>
                  )
                })}
              </div>

              {rows.some(r => r.booked > r.capacity) && (
                <p className="text-[11px] text-red-600 font-bold flex items-start gap-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  枠数より予約が多い時間帯があります。入っている予約はそのまま残ります。
                </p>
              )}

              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button onClick={closeDay} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold disabled:opacity-60">
                  <CalendarOff size={12} />この日の受付を止める
                </button>
                {hasOverride && (
                  <button onClick={resetDay} disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold disabled:opacity-60">
                    <RotateCcw size={12} />通常に戻す
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
