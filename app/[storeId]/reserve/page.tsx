'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  CalendarDays, Clock, User, FileText, Check,
  Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ============================================================
// ユーティリティ
// ============================================================
function todayJst(): string {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDateJp(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${weekdays[d.getUTCDay()]}）`
}

// 曜日インデックス（0=日〜6=土）をスロットキーに変換
const WEEKDAY_KEYS = ['slots_sun', 'slots_mon', 'slots_tue', 'slots_wed', 'slots_thu', 'slots_fri', 'slots_sat'] as const
type WeekdayKey = typeof WEEKDAY_KEYS[number]

// HH:MM スロット配列を生成
function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
  const slots: string[] = []
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let current = sh * 60 + sm
  const end   = eh * 60 + em
  while (current < end) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += durationMin
  }
  return slots
}

// ============================================================
// 型
// ============================================================
type ReservationSetting = {
  id: string
  service_type: string
  label: string
  duration_min: number
  start_time: string
  end_time: string
  is_active: boolean
  slots_sun: number; slots_mon: number; slots_tue: number; slots_wed: number
  slots_thu: number; slots_fri: number; slots_sat: number
}

type SlotInfo = {
  time: string
  maxSlots: number
  booked: number
  remaining: number
  available: boolean
}

// ============================================================
// シンプルフォールバックフォーム（reservation_settings 未対応時）
// ============================================================
function FallbackForm({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const minDate = todayJst()
  const maxDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

  if (step === 'done') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center bg-zinc-950">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-5">
          <Check size={28} className="text-emerald-400" />
        </div>
        <h1 className="text-xl font-black text-white mb-2">予約を受け付けました</h1>
        <p className="text-zinc-400 text-sm">ご来店予約を承りました。</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] pb-10 bg-zinc-950">
      <div className="px-5 pt-8 pb-6">
        <p className="text-indigo-400 text-xs font-bold mb-1">{storeName}</p>
        <h1 className="text-2xl font-black text-white">来店予約</h1>
      </div>
      <div className="px-5 space-y-5">
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
            <CalendarDays size={13} className="text-indigo-400" />来店日 <span className="text-red-400">*</span>
          </label>
          <input type="date" value={date} min={minDate} max={maxDate}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3.5 text-white text-base focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
            <User size={13} className="text-indigo-400" />お名前
          </label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="山田 花子"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
            <FileText size={13} className="text-indigo-400" />備考（任意）
          </label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="ご質問やご要望があればお書きください" rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:border-indigo-500 focus:outline-none resize-none" />
        </div>
        {errorMsg && <p className="text-red-400 text-sm text-center">{errorMsg}</p>}
        <button
          disabled={!date || submitting}
          onClick={async () => {
            setSubmitting(true)
            setErrorMsg('')
            const { error } = await (supabase as any).from('reservations').insert({
              store_id: storeId,
              reserved_at: new Date(`${date}T12:00:00+09:00`).toISOString(),
              status: 'confirmed',
              notes: [name ? `お名前: ${name}` : null, note || null].filter(Boolean).join('\n') || null,
            })
            setSubmitting(false)
            if (error) setErrorMsg('予約の送信に失敗しました。もう一度お試しください。')
            else setStep('done')
          }}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base transition-colors flex items-center justify-center gap-2">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
          {submitting ? '送信中...' : '予約を申し込む'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function ReservePage() {
  const { storeId } = useParams<{ storeId: string }>()

  // 全体の状態
  const [pageState, setPageState] = useState<'loading' | 'slot' | 'fallback' | 'done' | 'error'>('loading')
  const [storeName, setStoreName] = useState('')
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [settings, setSettings] = useState<ReservationSetting[]>([])

  // ステップ内の状態
  // step: 'service' | 'datetime' | 'info' | 'confirm'
  const [step, setStep] = useState<'service' | 'datetime' | 'info' | 'confirm'>('service')

  // フォーム値
  const [selectedService, setSelectedService] = useState<ReservationSetting | null>(null)
  const [selectedDate, setSelectedDate]       = useState(todayJst())
  const [selectedTime, setSelectedTime]       = useState<string | null>(null)
  const [name, setName]                       = useState('')
  const [note, setNote]                       = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [errorMsg, setErrorMsg]               = useState('')

  // スロット可用性
  const [slots, setSlots]           = useState<SlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [dayUnavailable, setDayUnavailable] = useState(false)

  const minDate = todayJst()
  const maxDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

  // ============================================================
  // 初期化
  // ============================================================
  useEffect(() => {
    const init = async () => {
      // ストア名
      try {
        const { data: store } = await (supabase as any)
          .from('stores').select('name').eq('id', storeId).single()
        if (store) setStoreName(store.name ?? '')
      } catch { /* ignore */ }

      // reservation_settings を取得（失敗したらフォールバック）
      let fetchedSettings: ReservationSetting[] = []
      try {
        const { data, error } = await (supabase as any)
          .from('reservation_settings')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('label')
        if (error) throw error
        fetchedSettings = data ?? []
      } catch {
        setPageState('fallback')
        return
      }

      if (fetchedSettings.length === 0) {
        // 設定なし → フォールバック
        setPageState('fallback')
        return
      }

      setSettings(fetchedSettings)

      // LIFF
      try {
        const liffModule = await import('@line/liff')
        const liff = liffModule.default
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? ''
        if (liffId) {
          await liff.init({ liffId })
          if (!liff.isLoggedIn()) { liff.login(); return }
          const profile = await liff.getProfile()
          setLineUserId(profile.userId)
          setName(profile.displayName ?? '')
        }
      } catch { /* LIFF not available */ }

      setPageState('slot')
    }
    init()
  }, [storeId])

  // ============================================================
  // スロット可用性の計算
  // ============================================================
  const fetchSlots = useCallback(async () => {
    if (!selectedService || !selectedDate) return
    setSlotsLoading(true)
    setSlots([])
    setDayUnavailable(false)
    setSelectedTime(null)

    try {
      // 1. 曜日に対応する max_slots を取得（共有枠：全サービス共通の最小値）
      const d = new Date(selectedDate + 'T12:00:00Z')
      const dow = d.getUTCDay()
      const weekdayKey = WEEKDAY_KEYS[dow] as WeekdayKey
      // 全設定のスロット数の最小値を共有枠として使用
      let maxSlots: number = Math.min(...settings.map(s => (s as any)[weekdayKey] ?? 0))

      // 2. reservation_date_overrides で上書き（サービス不問で最初にヒットしたもの）
      try {
        const { data: override } = await (supabase as any)
          .from('reservation_date_overrides')
          .select('max_slots')
          .eq('store_id', storeId)
          .eq('date', selectedDate)
          .limit(1)
          .maybeSingle()
        if (override != null) maxSlots = override.max_slots
      } catch { /* テーブルなければ無視 */ }

      if (maxSlots === 0) {
        setDayUnavailable(true)
        setSlotsLoading(false)
        return
      }

      // 3. スロット文字列を30分間隔で生成（最短サービス単位）
      const slotTimes = generateSlots(
        selectedService.start_time,
        selectedService.end_time,
        30,  // 30分間隔（最短ジャージ採寸と同じ）
      )

      // 4. 対象日の全予約をまとめて取得（サービス種別問わず）
      const dayStart = `${selectedDate}T00:00:00+09:00`
      const dayEnd   = `${selectedDate}T23:59:59+09:00`
      const { data: reservations } = await (supabase as any)
        .from('reservations')
        .select('reserved_at, service_type')
        .eq('store_id', storeId)
        .gte('reserved_at', dayStart)
        .lte('reserved_at', dayEnd)
        .neq('status', 'cancelled')

      // サービスタイプ→所要時間のマップを構築
      const durationMap: Record<string, number> = {}
      for (const s of settings) durationMap[s.service_type] = s.duration_min

      // 5. 重複チェックで各スロットの可用性を計算
      const slotInfos: SlotInfo[] = slotTimes.map(time => {
        const [th, tm] = time.split(':').map(Number)
        const tStart = th * 60 + tm
        const tEnd   = tStart + selectedService.duration_min

        // この枠の終了時刻が営業終了を超える場合はスキップ
        const [eh, em] = selectedService.end_time.split(':').map(Number)
        const endOfDay = eh * 60 + em
        if (tEnd > endOfDay) return { time, maxSlots: 0, booked: 0, remaining: 0, available: false }

        let overlapCount = 0
        for (const r of (reservations ?? [])) {
          const jstTime = new Date(new Date(r.reserved_at).getTime() + 9 * 3600000)
            .toISOString().slice(11, 16)
          const [rh, rm] = jstTime.split(':').map(Number)
          const rStart    = rh * 60 + rm
          const rDuration = durationMap[r.service_type] ?? selectedService.duration_min
          const rEnd      = rStart + rDuration
          // 重複判定: [tStart, tEnd) と [rStart, rEnd) が重なる
          if (tStart < rEnd && tEnd > rStart) overlapCount++
        }

        const remaining = maxSlots - overlapCount
        return { time, maxSlots, booked: overlapCount, remaining, available: remaining > 0 }
      })

      setSlots(slotInfos.filter(s => s.maxSlots > 0))
    } catch (e) {
      console.error('fetchSlots error', e)
    }

    setSlotsLoading(false)
  }, [selectedService, selectedDate, storeId])

  useEffect(() => {
    if (step === 'datetime' && selectedService) {
      fetchSlots()
    }
  }, [step, selectedService, selectedDate, fetchSlots])

  // ============================================================
  // 送信
  // ============================================================
  async function handleSubmit() {
    if (!selectedService || !selectedDate || !selectedTime) return
    setSubmitting(true)
    setErrorMsg('')

    const reservedAt = `${selectedDate}T${selectedTime}:00+09:00`

    // LINE ユーザーから顧客 ID を取得
    let customerId: string | null = null
    if (lineUserId) {
      try {
        const { data: customer } = await (supabase as any)
          .from('customers').select('id')
          .eq('store_id', storeId).eq('line_user_id', lineUserId)
          .single()
        if (customer) customerId = customer.id
      } catch { /* ignore */ }
    }

    const { error } = await (supabase as any).from('reservations').insert({
      store_id:     storeId,
      customer_id:  customerId,
      line_user_id: lineUserId,
      reserved_at:  reservedAt,
      service_type: selectedService.service_type,
      purpose:      selectedService.label,
      status:       'confirmed',
      notes:        [name ? `お名前: ${name}` : null, note || null].filter(Boolean).join('\n') || null,
    })

    setSubmitting(false)
    if (error) {
      setErrorMsg('予約の送信に失敗しました。もう一度お試しください。')
    } else {
      setPageState('done')
    }
  }

  // ============================================================
  // レンダリング
  // ============================================================
  if (pageState === 'loading') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-950">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (pageState === 'fallback') {
    return <FallbackForm storeId={storeId} storeName={storeName} />
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-zinc-950">
        <p className="text-red-400 text-sm text-center">エラーが発生しました。ページを再読み込みしてください。</p>
      </div>
    )
  }

  if (pageState === 'done') {
    const dateLabel = selectedDate
      ? new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
        })
      : ''
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center bg-zinc-950">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-5">
          <Check size={28} className="text-emerald-400" />
        </div>
        <h1 className="text-xl font-black text-white mb-2">予約を受け付けました</h1>
        <p className="text-zinc-400 text-sm mb-1">
          {storeName && `${storeName}への`}ご来店予約を承りました。
        </p>
        {selectedService && (
          <p className="text-indigo-300 text-sm font-bold mb-1">{selectedService.label}</p>
        )}
        <p className="text-zinc-500 text-xs">
          {dateLabel}{selectedTime && ` ${selectedTime}〜`}
        </p>
        <p className="text-zinc-600 text-xs mt-4">※ 確認のご連絡をお送りする場合があります</p>
      </div>
    )
  }

  // ============================================================
  // スロット制フォーム
  // ============================================================
  return (
    <div className="min-h-[100dvh] pb-12 bg-zinc-950">
      {/* ヘッダー */}
      <div className="px-5 pt-8 pb-5">
        <p className="text-indigo-400 text-xs font-bold mb-1">{storeName}</p>
        <h1 className="text-2xl font-black text-white">来店予約</h1>
        <p className="text-zinc-500 text-sm mt-1">ご希望のサービスと日時をお選びください</p>
      </div>

      <div className="px-5 space-y-6">

        {/* ============ STEP 1: サービス選択 ============ */}
        <section>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-3">
            <FileText size={13} className="text-indigo-400" />サービスを選択
          </label>
          <div className="grid grid-cols-1 gap-3">
            {settings.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedService(s)
                  setSelectedTime(null)
                  setStep('datetime')
                }}
                className={`w-full text-left rounded-2xl border px-4 py-4 transition-all ${
                  selectedService?.id === s.id
                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <p className="font-black text-white text-base">{s.label}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{s.duration_min}分枠</p>
              </button>
            ))}
          </div>
        </section>

        {/* ============ STEP 2: 日付・時間帯選択 ============ */}
        {(step === 'datetime' || step === 'info' || step === 'confirm') && selectedService && (
          <section>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-3">
              <CalendarDays size={13} className="text-indigo-400" />日付を選択
            </label>

            {/* 日付ナビゲーター */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 mb-4">
              <button
                onClick={() => {
                  const prev = addDays(selectedDate, -1)
                  if (prev >= minDate) setSelectedDate(prev)
                }}
                disabled={selectedDate <= minDate}
                className="p-1.5 rounded-xl hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"
              >
                <ChevronLeft size={18} className="text-zinc-400" />
              </button>
              <div className="flex-1 text-center">
                <p className="font-black text-white text-sm">{fmtDateJp(selectedDate)}</p>
              </div>
              <button
                onClick={() => {
                  const next = addDays(selectedDate, 1)
                  if (next <= maxDate) setSelectedDate(next)
                }}
                disabled={selectedDate >= maxDate}
                className="p-1.5 rounded-xl hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"
              >
                <ChevronRight size={18} className="text-zinc-400" />
              </button>
            </div>

            {/* 日付入力（補助） */}
            <input
              type="date"
              value={selectedDate}
              min={minDate}
              max={maxDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none mb-4"
            />

            {/* 時間帯スロット */}
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-3">
              <Clock size={13} className="text-indigo-400" />時間帯を選択 <span className="text-red-400">*</span>
            </label>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : dayUnavailable ? (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-5 text-center">
                <p className="text-zinc-400 text-sm font-bold">この日は予約をお受けできません</p>
                <p className="text-zinc-600 text-xs mt-1">別の日をお選びください</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-5 text-center">
                <p className="text-zinc-400 text-sm font-bold">この日はスロットがありません</p>
                <p className="text-zinc-600 text-xs mt-1">別の日をお選びください</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slots.map(slot => {
                  const isSelected = selectedTime === slot.time
                  return (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => {
                        if (!slot.available) return
                        setSelectedTime(slot.time)
                        setStep('info')
                      }}
                      className={`py-3 px-3 rounded-xl text-sm font-bold transition-all text-left ${
                        !slot.available
                          ? 'bg-zinc-900/50 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                          : isSelected
                          ? 'bg-indigo-600 border border-indigo-500 text-white ring-1 ring-indigo-400/40'
                          : 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700'
                      }`}
                    >
                      <span className="block">{slot.time}</span>
                      <span className={`text-xs font-normal mt-0.5 block ${
                        !slot.available ? 'text-zinc-600'
                        : isSelected ? 'text-indigo-200'
                        : 'text-zinc-400'
                      }`}>
                        {slot.available
                          ? `残${slot.remaining}枠`
                          : '× 満員'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ============ STEP 3: お名前・備考 ============ */}
        {(step === 'info' || step === 'confirm') && selectedTime && (
          <section>
            <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl px-4 py-3 mb-4">
              <p className="text-indigo-300 text-xs font-bold">選択中</p>
              <p className="text-white font-black text-sm mt-0.5">
                {selectedService?.label} / {fmtDateJp(selectedDate)} {selectedTime}〜
              </p>
            </div>

            {/* お名前 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
                <User size={13} className="text-indigo-400" />お名前 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="山田 花子"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* 備考 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
                <FileText size={13} className="text-indigo-400" />備考（任意）
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ご質問やご要望があればお書きください"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>

            {errorMsg && (
              <p className="text-red-400 text-sm text-center mb-3">{errorMsg}</p>
            )}

            {/* 送信ボタン */}
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || submitting}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
              {submitting ? '送信中...' : '予約を申し込む'}
            </button>
            <p className="text-zinc-600 text-xs text-center mt-2">予約は確認後に確定となります</p>
          </section>
        )}
      </div>
    </div>
  )
}
