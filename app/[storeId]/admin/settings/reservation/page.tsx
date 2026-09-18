'use client'

// ============================================================
// 予約枠の設定
//
//  店舗が触るのは次の5つ。
//    ① 枠の長さ（例: 1時間）と、1枠あたりの既定の受付数（例: 30）
//    ② カレンダーで日を選び、その日の時間ごとの枠数を変える／休業にする
//    ③ 期間をまとめて指定して一括設定
//    ④ 予約の来店理由（採寸の種類など）の追加・削除
//    ⑤ 予約を受け付けるシーズンと、シーズン外の案内文
//  受付する時間帯は営業時間（設定 → 営業時間）から自動で決まる。
// ============================================================
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, CalendarClock, Info, CalendarRange, Check, Plus,
  Trash2, ListChecks, Sun, RotateCcw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FeatureGuard } from '@/app/_components/FeatureGuard'
import { Toast } from '@/app/_components/Toast'
import { MonthCalendar } from '../../reservations/_components/MonthCalendar'
import { CapacityStepper } from '../../reservations/_components/CapacityStepper'
import {
  DEFAULT_RESERVABLE_PURPOSES, WALK_IN_PURPOSES, makePurpose, normalizePurposes,
  type VisitPurpose,
} from '../../reservations/_lib/purposes'
import {
  DEFAULT_SEASON, defaultOffSeasonMessage, seasonFromRow, seasonRangeLabel,
  isWrappingSeason, daysInMonth, clampDay, type SeasonSettings,
} from '../../reservations/_lib/season'
import {
  capacityOf, loadCapacityInputs, generateSlotTimes,
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

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const daysOf = (month: number) => Array.from({ length: daysInMonth(month) }, (_, i) => i + 1)

function ReservationSettingsPage() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  const router  = useRouter()

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ① 基本設定
  const [slotMin, setSlotMin] = useState(60)
  const [defaultCapacity, setDefaultCapacity] = useState(0)

  // ② 日ごと
  const [date, setDate] = useState(todayJst())
  const [inputs, setInputs] = useState<CapacityInputs | null>(null)
  const [cap, setCap] = useState<DayCapacity | null>(null)
  const [calKey, setCalKey] = useState(0)

  // ④ 来店理由
  const [purposes, setPurposes] = useState<VisitPurpose[]>(DEFAULT_RESERVABLE_PURPOSES)
  const [newPurposeLabel, setNewPurposeLabel] = useState('')

  // ⑤ シーズン
  const [season, setSeason] = useState<SeasonSettings>(DEFAULT_SEASON)

  // ③ 一括設定
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFrom, setBulkFrom] = useState(todayJst())
  const [bulkTo, setBulkTo] = useState(addDays(todayJst(), 30))
  const [bulkDows, setBulkDows] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  // シーズンを開けるときに使う欄なので、初期値は実運用に近い5件から始める
  const [bulkCapacity, setBulkCapacity] = useState(5)
  const [bulkRunning, setBulkRunning] = useState(false)

  // −／＋の連打を毎回DBに投げると往復と競合が起きるので、少し待ってまとめて保存する
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const debounce = (key: string, fn: () => void) => {
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(fn, 600)
  }
  useEffect(() => () => { Object.values(saveTimers.current).forEach(clearTimeout) }, [])

  const loadBase = useCallback(async () => {
    const { data } = await sb.from('stores')
      .select([
        'reservation_slot_min', 'reservation_slot_capacity', 'reservation_purposes',
        'reservation_season_enabled',
        'reservation_season_from_month', 'reservation_season_from_day',
        'reservation_season_to_month', 'reservation_season_to_day',
        'reservation_offseason_message',
      ].join(', '))
      .eq('id', storeId).maybeSingle()
    setSlotMin(Number(data?.reservation_slot_min ?? 60) || 60)
    setDefaultCapacity(Math.max(0, Number(data?.reservation_slot_capacity ?? 0) || 0))
    setPurposes(normalizePurposes(data?.reservation_purposes) ?? DEFAULT_RESERVABLE_PURPOSES)
    setSeason(seasonFromRow(data))
    setLoading(false)
  }, [storeId])

  const loadDay = useCallback(async () => {
    const i = await loadCapacityInputs(storeId, date, date)
    setInputs(i)
    setCap(capacityOf(date, i))
  }, [storeId, date])

  useEffect(() => { if (storeId) loadBase() }, [storeId, loadBase])
  useEffect(() => { if (storeId) loadDay() }, [storeId, loadDay, calKey])

  // ── stores への保存（基本設定・来店理由・シーズンで共用） ──────────
  const saveStore = async (patch: Record<string, unknown>, opts?: { silent?: boolean }) => {
    setSaving(true)
    const { error } = await sb.from('stores').update(patch).eq('id', storeId)
    setSaving(false)
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return false }
    if (!opts?.silent) setToast({ type: 'ok', msg: '保存しました' })
    return true
  }

  // ── ① 基本設定の保存 ──────────────────────────────────────
  const saveBase = async (patch: { reservation_slot_min?: number; reservation_slot_capacity?: number }) => {
    if (await saveStore(patch)) setCalKey(k => k + 1)
  }

  // ── ④ 来店理由 ───────────────────────────────────────────
  // 保存できたときだけ画面を更新する（失敗したまま追加済みに見えると事故る）
  const savePurposes = async (next: VisitPurpose[]) => {
    if (await saveStore({ reservation_purposes: next })) setPurposes(next)
  }

  const addPurpose = async () => {
    const label = newPurposeLabel.trim()
    if (!label) return
    if (purposes.some(p => p.label === label)) {
      setToast({ type: 'err', msg: 'その来店理由はすでにあります' }); return
    }
    await savePurposes([...purposes, makePurpose(label, '📌', purposes)])
    setNewPurposeLabel('')
  }

  const removePurpose = async (key: string) => {
    if (purposes.length <= 1) {
      setToast({ type: 'err', msg: '来店理由は1つ以上必要です' }); return
    }
    await savePurposes(purposes.filter(p => p.key !== key))
  }

  // 既定の3つ（制服採寸／制服＋ジャージ採寸／ジャージ採寸）に戻す
  const resetPurposes = async () => {
    if (await saveStore({ reservation_purposes: null })) setPurposes(DEFAULT_RESERVABLE_PURPOSES)
  }

  // ── ⑤ シーズン ───────────────────────────────────────────
  const saveSeason = (next: SeasonSettings) => {
    setSeason(next)
    debounce('season', () => {
      saveStore({
        reservation_season_enabled:     next.enabled,
        reservation_season_from_month:  next.fromMonth,
        reservation_season_from_day:    next.fromDay,
        reservation_season_to_month:    next.toMonth,
        reservation_season_to_day:      next.toDay,
        reservation_offseason_message:  next.message.trim() || null,
      }, { silent: true })
    })
  }

  // ── ② その日の枠 ─────────────────────────────────────────
  const setSlotCapacity = async (time: string, capacity: number) => {
    const { error } = await sb.from('reservation_slot_overrides')
      .upsert({ store_id: storeId, date, start_time: time, capacity }, { onConflict: 'store_id,date,start_time' })
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return }
    setCalKey(k => k + 1)
  }

  // タップ中は画面だけ先に動かし、保存は少し待ってからまとめて投げる
  const changeSlotCapacity = (time: string, v: number) => {
    setCap(prev => prev && {
      ...prev,
      slots: prev.slots.map(s => s.time === time ? { ...s, capacity: v, overridden: true } : s),
    })
    debounce(`slot:${time}`, () => setSlotCapacity(time, v))
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
                <CapacityStepper value={defaultCapacity} disabled={saving}
                  onChange={v => {
                    setDefaultCapacity(v)
                    debounce('base', () => saveBase({ reservation_slot_capacity: v }))
                  }} />
                <span className="text-xs text-gray-400">{defaultCapacity === 0 ? '受付なし' : '件まで'}</span>
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

        {/* ④ 来店理由 */}
        <section className="space-y-2">
          <h2 className="text-sm font-black text-gray-800 px-1 flex items-center gap-1.5">
            <ListChecks size={14} className="text-indigo-600" />予約の来店理由
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              お客様の予約画面に、ここで作った順に並びます。
            </p>

            <div className="space-y-1.5">
              {purposes.map(p => (
                <div key={p.key} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200">
                  <span className="text-base shrink-0">{p.emoji}</span>
                  <span className="flex-1 font-bold text-gray-800 text-sm truncate">{p.label}</span>
                  <button onClick={() => removePurpose(p.key)} disabled={saving || purposes.length <= 1}
                    aria-label={`${p.label}を削除`}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input type="text" value={newPurposeLabel}
                onChange={e => setNewPurposeLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addPurpose() }}
                placeholder="例：体操服採寸"
                className={`${INPUT} flex-1 min-w-0`} />
              <button onClick={addPurpose} disabled={saving || !newPurposeLabel.trim()}
                className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-40">
                <Plus size={14} />追加
              </button>
            </div>

            <button onClick={resetPurposes} disabled={saving}
              className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold disabled:opacity-60">
              <RotateCcw size={12} />既定の3つに戻す
            </button>

            <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-2.5">
              {WALK_IN_PURPOSES.map(p => p.label).join('・')}は予約不要の用件として、
              お客様の予約画面に「そのままご来店ください」と案内が出ます。
            </p>
          </div>
        </section>

        {/* ⑤ 予約シーズン */}
        <section className="space-y-2">
          <h2 className="text-sm font-black text-gray-800 px-1 flex items-center gap-1.5">
            <Sun size={14} className="text-amber-500" />予約を受け付ける時期
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={season.enabled}
                onChange={e => saveSeason({ ...season, enabled: e.target.checked })}
                className="w-5 h-5 accent-indigo-600" />
              <span className="text-sm font-bold text-gray-800">シーズン外は予約を受け付けない</span>
            </label>

            {season.enabled && (
              <>
                {/* 月を変えると日がその月からはみ出すことがあるので、そのつど丸める
                    （例: 3月31日 → 4月にすると4月30日） */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500 w-10 shrink-0">開始</span>
                    <select value={season.fromMonth}
                      onChange={e => {
                        const m = Number(e.target.value)
                        saveSeason({ ...season, fromMonth: m, fromDay: clampDay(season.fromDay, m, 1) })
                      }}
                      className={`${INPUT} flex-1 min-w-0`}>
                      {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                    </select>
                    <select value={season.fromDay}
                      onChange={e => saveSeason({ ...season, fromDay: Number(e.target.value) })}
                      className={`${INPUT} flex-1 min-w-0`}>
                      {daysOf(season.fromMonth).map(d => <option key={d} value={d}>{d}日</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500 w-10 shrink-0">終了</span>
                    <select value={season.toMonth}
                      onChange={e => {
                        const m = Number(e.target.value)
                        saveSeason({ ...season, toMonth: m, toDay: clampDay(season.toDay, m, daysInMonth(m)) })
                      }}
                      className={`${INPUT} flex-1 min-w-0`}>
                      {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
                    </select>
                    <select value={season.toDay}
                      onChange={e => saveSeason({ ...season, toDay: Number(e.target.value) })}
                      className={`${INPUT} flex-1 min-w-0`}>
                      {daysOf(season.toMonth).map(d => <option key={d} value={d}>{d}日</option>)}
                    </select>
                  </div>
                </div>

                <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                  {seasonRangeLabel(season)} が予約期間
                  {isWrappingSeason(season) && <span className="font-normal text-gray-500">（年をまたぐ期間として扱います）</span>}
                </p>

                {season.toMonth === 2 && season.toDay === 29 && (
                  <p className="text-[11px] text-gray-500">
                    2月29日は閏年だけの日付です。毎年同じ日で区切るなら2月28日か3月1日をお選びください。
                  </p>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">シーズン外に出す案内文</label>
                  <textarea value={season.message} rows={3}
                    onChange={e => saveSeason({ ...season, message: e.target.value })}
                    placeholder={defaultOffSeasonMessage(season)}
                    className={`${INPUT} w-full resize-none leading-relaxed`} />
                  <p className="text-[11px] text-gray-400 mt-1">
                    空欄のままだと、上の文がそのまま表示されます。
                  </p>
                </div>

                <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-1 border-t border-gray-100 pt-2.5">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  シーズン外の日は、お客様の予約画面で日時を選べなくなり、この案内文だけが出ます。
                  管理画面からの代理予約はいつでもできます。
                </p>
              </>
            )}
          </div>
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
                <CapacityStepper value={bulkCapacity} onChange={setBulkCapacity} />
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
                      <CapacityStepper value={s.capacity} onChange={v => changeSlotCapacity(s.time, v)} />
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
