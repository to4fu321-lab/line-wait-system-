'use client'

// ============================================================
// 予約枠の設定
//
//  店舗が触るのは次の3つだけ。
//    ① 枠の長さ（例: 1時間）と、1枠あたりの既定の受付数（例: 30）
//    ② カレンダーで日を選び、その日の時間ごとの枠数を変える／休業にする
//    ③ 期間をまとめて指定して一括設定
//  受付する時間帯は営業時間（設定 → 営業時間）から自動で決まる。
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, CalendarClock, Info, CalendarRange, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FeatureGuard } from '@/app/_components/FeatureGuard'
import { Toast } from '@/app/_components/Toast'
import { MonthCalendar } from '../../reservations/_components/MonthCalendar'
import {
  capacityOf, loadCapacityInputs, generateSlotTimes, slotKey,
  SLOT_MIN_OPTIONS, type DayCapacity, type CapacityInputs,
} from '@/lib/reservationCapacity'
import { holidayName } from '@/lib/japaneseHolidays'
import { todayJst } from '@/lib/date'

const sb = supabase as any

const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function fmtDate(d: string): string {
  const x = new Date(d + 'T12:00:00Z')
  return `${x.getUTCMonth() + 1}月${x.getUTCDate()}日（${WEEK_LABELS[x.getUTCDay()]}）`
}
function addDays(d: string, n: number): string {
  const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

function ReservationSettingsPage() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  const router  = useRouter()

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ① 基本設定
  const [slotMin, setSlotMin] = useState(60)
  const [defaultCapacity, setDefaultCapacity] = useState(1)

  // ② 日ごと
  const [date, setDate] = useState(todayJst())
  const [inputs, setInputs] = useState<CapacityInputs | null>(null)
  const [cap, setCap] = useState<DayCapacity | null>(null)
  const [calKey, setCalKey] = useState(0)

  // ③ 一括設定
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFrom, setBulkFrom] = useState(todayJst())
  const [bulkTo, setBulkTo] = useState(addDays(todayJst(), 30))
  const [bulkDows, setBulkDows] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [bulkCapacity, setBulkCapacity] = useState('1')
  const [bulkRunning, setBulkRunning] = useState(false)

  const loadBase = useCallback(async () => {
    const { data } = await sb.from('stores')
      .select('reservation_slot_min, reservation_slot_capacity').eq('id', storeId).maybeSingle()
    setSlotMin(Number(data?.reservation_slot_min ?? 60) || 60)
    setDefaultCapacity(Number(data?.reservation_slot_capacity ?? 1) || 1)
    setLoading(false)
  }, [storeId])

  const loadDay = useCallback(async () => {
    const i = await loadCapacityInputs(storeId, date, date)
    setInputs(i)
    setCap(capacityOf(date, i))
  }, [storeId, date])

  useEffect(() => { if (storeId) loadBase() }, [storeId, loadBase])
  useEffect(() => { if (storeId) loadDay() }, [storeId, loadDay, calKey])

  // ── ① 基本設定の保存 ──────────────────────────────────────
  const saveBase = async (patch: { reservation_slot_min?: number; reservation_slot_capacity?: number }) => {
    setSaving(true)
    const { error } = await sb.from('stores').update(patch).eq('id', storeId)
    setSaving(false)
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return }
    setToast({ type: 'ok', msg: '保存しました' })
    setCalKey(k => k + 1)
  }

  // ── ② その日の枠 ─────────────────────────────────────────
  const setSlotCapacity = async (time: string, capacity: number) => {
    const { error } = await sb.from('reservation_slot_overrides')
      .upsert({ store_id: storeId, date, start_time: time, capacity }, { onConflict: 'store_id,date,start_time' })
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return }
    setCalKey(k => k + 1)
  }

  const closeDay = async () => {
    const { error } = await sb.from('reservation_date_overrides')
      .upsert({ store_id: storeId, date, max_slots: 0 }, { onConflict: 'store_id,date' })
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return }
    setToast({ type: 'ok', msg: `${fmtDate(date)}を休業にしました` })
    setCalKey(k => k + 1)
  }

  const resetDay = async () => {
    await Promise.all([
      sb.from('reservation_date_overrides').delete().eq('store_id', storeId).eq('date', date),
      sb.from('reservation_slot_overrides').delete().eq('store_id', storeId).eq('date', date),
    ])
    setToast({ type: 'ok', msg: '通常の設定に戻しました' })
    setCalKey(k => k + 1)
  }

  // ── ③ 期間の一括設定 ─────────────────────────────────────
  const runBulk = async () => {
    const capacity = Number(bulkCapacity)
    if (!Number.isFinite(capacity) || capacity < 0) { setToast({ type: 'err', msg: '枠数は0以上の数値で入力してください' }); return }
    if (bulkFrom > bulkTo) { setToast({ type: 'err', msg: '開始日は終了日より前にしてください' }); return }
    if (bulkDows.length === 0) { setToast({ type: 'err', msg: '曜日を1つ以上選んでください' }); return }

    setBulkRunning(true)
    try {
      // 対象日を洗い出す（範囲が長くなりすぎないよう上限を設ける）
      const dates: string[] = []
      for (let d = bulkFrom; d <= bulkTo && dates.length < 400; d = addDays(d, 1)) {
        const dow = new Date(d + 'T12:00:00Z').getUTCDay()
        if (bulkDows.includes(dow)) dates.push(d)
      }
      if (dates.length === 0) { setToast({ type: 'err', msg: '対象の日がありません' }); return }

      // 営業時間は曜日で変わるので、日ごとに枠の時間を出して行を作る
      const range = await loadCapacityInputs(storeId, bulkFrom, bulkTo)
      const rows: { store_id: string; date: string; start_time: string; capacity: number }[] = []
      for (const d of dates) {
        const c = capacityOf(d, { ...range, slotOverrides: {}, dateOverrides: {} })
        for (const t of generateSlotTimes(c.startTime, c.endTime, slotMin)) {
          rows.push({ store_id: storeId, date: d, start_time: t, capacity })
        }
      }

      // 休業指定が残っていると枠を入れても閉じたままなので、範囲内は解除する
      await sb.from('reservation_date_overrides')
        .delete().eq('store_id', storeId).gte('date', bulkFrom).lte('date', bulkTo)

      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from('reservation_slot_overrides')
          .upsert(rows.slice(i, i + 500), { onConflict: 'store_id,date,start_time' })
        if (error) throw new Error(error.message)
      }
      setToast({ type: 'ok', msg: `${dates.length}日ぶんを${capacity}枠に設定しました` })
      setBulkOpen(false)
      setCalKey(k => k + 1)
    } catch (e) {
      setToast({ type: 'err', msg: `一括設定に失敗しました: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBulkRunning(false)
    }
  }

  const clearBulk = async () => {
    setBulkRunning(true)
    await Promise.all([
      sb.from('reservation_slot_overrides').delete().eq('store_id', storeId).gte('date', bulkFrom).lte('date', bulkTo),
      sb.from('reservation_date_overrides').delete().eq('store_id', storeId).gte('date', bulkFrom).lte('date', bulkTo),
    ])
    setBulkRunning(false)
    setToast({ type: 'ok', msg: '期間内の個別設定を消して通常に戻しました' })
    setCalKey(k => k + 1)
  }

  const holiday = holidayName(date)
  const hasDayOverride = !!inputs && (
    date in inputs.dateOverrides ||
    Object.keys(inputs.slotOverrides).some(k => k.startsWith(date + ' '))
  )

  const INPUT = 'border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-700 to-violet-700">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-white font-black text-base flex items-center gap-1.5">
            <CalendarClock size={18} />予約枠の設定
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-5">

        {/* ① 基本設定 */}
        <section className="space-y-2">
          <h2 className="text-sm font-black text-gray-800 px-1">基本の枠</h2>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-gray-500 w-24 shrink-0">枠の長さ</label>
                <select value={slotMin} disabled={saving}
                  onChange={e => { const v = Number(e.target.value); setSlotMin(v); saveBase({ reservation_slot_min: v }) }}
                  className={INPUT}>
                  {SLOT_MIN_OPTIONS.map(m => <option key={m} value={m}>{m}分</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-gray-500 w-24 shrink-0">1枠の受付数</label>
                <input type="text" inputMode="numeric" value={defaultCapacity}
                  onChange={e => setDefaultCapacity(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                  onBlur={() => saveBase({ reservation_slot_capacity: defaultCapacity })}
                  className={`${INPUT} w-24 text-center`} />
                <span className="text-xs text-gray-400">件まで</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-1">
                <Info size={12} className="shrink-0 mt-0.5" />
                受付する時間帯は営業時間から自動で決まります。
                <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
                  className="underline font-bold">設定 → 営業時間</button>
              </p>
            </div>
          )}
        </section>

        {/* ③ 期間の一括設定 */}
        <section className="space-y-2">
          <button onClick={() => setBulkOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-gray-200 active:scale-[0.99] transition-all">
            <CalendarRange size={16} className="text-indigo-600" />
            <span className="flex-1 text-left text-sm font-black text-gray-800">期間をまとめて設定</span>
            <span className="text-xs text-gray-400">{bulkOpen ? '閉じる' : '開く'}</span>
          </button>

          {bulkOpen && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input type="date" value={bulkFrom} onChange={e => setBulkFrom(e.target.value)} className={`${INPUT} flex-1`} />
                <span className="text-gray-400 text-sm">〜</span>
                <input type="date" value={bulkTo} onChange={e => setBulkTo(e.target.value)} className={`${INPUT} flex-1`} />
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5">対象の曜日</p>
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_LABELS.map((w, i) => {
                    const on = bulkDows.includes(i)
                    return (
                      <button key={w} onClick={() => setBulkDows(prev => on ? prev.filter(x => x !== i) : [...prev, i])}
                        className={`py-2 rounded-lg text-xs font-black border ${
                          on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200'
                        }`}>{w}</button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-gray-500 shrink-0">1枠の受付数</label>
                <input type="text" inputMode="numeric" value={bulkCapacity}
                  onChange={e => setBulkCapacity(e.target.value.replace(/[^0-9]/g, ''))}
                  className={`${INPUT} w-24 text-center`} />
                <span className="text-xs text-gray-400">0で受付停止</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={runBulk} disabled={bulkRunning}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-60">
                  {bulkRunning ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  この期間に適用
                </button>
                <button onClick={clearBulk} disabled={bulkRunning}
                  className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-xs disabled:opacity-60">
                  個別設定を消す
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ② 日ごとの枠 */}
        <section className="space-y-2">
          <h2 className="text-sm font-black text-gray-800 px-1">日ごとの調整</h2>
          <MonthCalendar key={calKey} storeId={storeId} value={date} onChange={setDate} />

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-gray-900">{fmtDate(date)}</p>
              {holiday && <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold border border-red-200">{holiday}</span>}
              {cap?.staffOnDuty !== null && cap?.staffOnDuty !== undefined && (
                <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold">出勤 {cap.staffOnDuty}名</span>
              )}
            </div>

            {!cap ? (
              <div className="py-4 grid place-items-center"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
            ) : !cap.open ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-3 text-center">
                  {cap.reason === 'closed_weekday' ? 'この曜日は定休日です' : 'この日は休業に設定されています'}
                </p>
                <button onClick={resetDay}
                  className="w-full py-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold">
                  この日を受付ありに戻す
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {cap.slots.map(s => (
                    <div key={s.time} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                      s.overridden ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-200'
                    }`}>
                      <span className="font-black text-gray-800 text-sm w-14 shrink-0 tabular-nums">{s.time}</span>
                      <input type="text" inputMode="numeric" defaultValue={s.capacity}
                        onBlur={e => {
                          const v = Number(e.target.value.replace(/[^0-9]/g, '')) || 0
                          if (v !== s.capacity) setSlotCapacity(s.time, v)
                        }}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center" />
                      <span className="text-xs text-gray-400">件</span>
                      {s.overridden && <span className="ml-auto text-[10px] font-bold text-indigo-600">個別</span>}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button onClick={closeDay}
                    className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold">
                    この日を休業にする
                  </button>
                  {hasDayOverride && (
                    <button onClick={resetDay}
                      className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">
                      通常に戻す
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function Page() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  return (
    <FeatureGuard storeId={storeId} feature="reservation">
      <ReservationSettingsPage />
    </FeatureGuard>
  )
}
