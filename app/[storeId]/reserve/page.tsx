'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveFeature } from '@/lib/features'
import { getLiffId } from '@/lib/line-config'
import {
  CalendarDays, Clock, User, FileText, Check,
  Loader2, ChevronLeft, ChevronRight, GraduationCap, Plus, X, ShoppingBag,
} from 'lucide-react'

// 採寸サービスかどうかの判定
function isFittingService(serviceType: string, label: string) {
  return label.includes('採寸') || serviceType.includes('fitting') || serviceType.includes('uniform')
}

const GRADE_OPTIONS = ['中学1年', '中学2年', '中学3年', '高校1年', '高校2年', '高校3年']

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

// reservation_settings 未登録の店舗用デフォルト枠（admin/settings の DEFAULT_RESV と同値）
const DEFAULT_SETTINGS: ReservationSetting[] = [
  { id: 'default-uniform', service_type: 'uniform', label: '制服採寸', duration_min: 60,
    start_time: '10:00', end_time: '17:00', is_active: true,
    slots_sun: 0, slots_mon: 2, slots_tue: 2, slots_wed: 2, slots_thu: 2, slots_fri: 2, slots_sat: 3 },
  { id: 'default-jersey', service_type: 'jersey', label: 'ジャージ採寸', duration_min: 30,
    start_time: '10:00', end_time: '17:00', is_active: true,
    slots_sun: 0, slots_mon: 2, slots_tue: 2, slots_wed: 2, slots_thu: 2, slots_fri: 2, slots_sat: 3 },
]

// ============================================================
// シンプルフォールバックフォーム（reservation_settings 未対応時）
// ============================================================
function FallbackForm({ storeId, storeName, initialName, selfOrderEnabled }: { storeId: string; storeName: string; initialName?: string; selfOrderEnabled?: boolean }) {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [name, setName] = useState(initialName ?? '')
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

        {/* 予約のお客様もそのままスマホから制服注文を入力できる（店舗設定でON/OFF） */}
        {selfOrderEnabled && (
          <>
            <a href={`/${storeId}?action=purchase`}
              className="mt-7 w-full max-w-xs flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-colors">
              <ShoppingBag size={18} />制服を注文する
            </a>
            <p className="text-zinc-600 text-xs mt-2">サイズ・数量を選んでご注文いただけます</p>
          </>
        )}
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
  const [selfOrderEnabled, setSelfOrderEnabled] = useState(true)
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [settings, setSettings] = useState<ReservationSetting[]>([])

  // ステップ内の状態
  // step: 'service' | 'child' | 'datetime' | 'info'
  const [step, setStep] = useState<'service' | 'child' | 'datetime' | 'info'>('service')

  // フォーム値
  const [selectedService, setSelectedService] = useState<ReservationSetting | null>(null)
  const [selectedDate, setSelectedDate]       = useState(todayJst())
  const [selectedTime, setSelectedTime]       = useState<string | null>(null)
  const [name, setName]                       = useState('')
  const [note, setNote]                       = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [errorMsg, setErrorMsg]               = useState('')

  // お子様選択（採寸サービス専用）
  type ChildRow = { id: string; name: string; school_name: string | null; school_id: string | null; grade: string | null; gender: string | null }
  type SchoolRow = { id: string; name: string }
  const [customerId,      setCustomerId]      = useState<string | null>(null)
  const [children,        setChildren]        = useState<ChildRow[]>([])
  const [selectedChild,   setSelectedChild]   = useState<ChildRow | null>(null)
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [showAddChild,    setShowAddChild]    = useState(false)
  const [schools,         setSchools]         = useState<SchoolRow[]>([])
  // 新規お子様フォーム
  const [ncName,     setNcName]     = useState('')
  const [ncSchoolId, setNcSchoolId] = useState('')
  const [ncGrade,    setNcGrade]    = useState('')
  const [ncGender,   setNcGender]   = useState('')
  const [ncSaving,   setNcSaving]   = useState(false)

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
          .from('stores').select('name, features').eq('id', storeId).single()
        if (store) {
          setStoreName(store.name ?? '')
          setSelfOrderEnabled(resolveFeature('customer_self_order', (store.features ?? {}) as Record<string, unknown>))
        }
      } catch { /* ignore */ }

      // LIFF（フォールバック表示時も顧客名を反映できるよう、設定取得より先に実行）
      try {
        const liffModule = await import('@line/liff')
        const liff = liffModule.default
        const liffId = getLiffId('uniform')
        if (liffId) {
          await liff.init({ liffId })
          if (!liff.isLoggedIn()) { liff.login(); return }
          const profile = await liff.getProfile()
          setLineUserId(profile.userId)
          // CRM登録名を優先、なければLINE表示名
          try {
            const { data: regCust } = await (supabase as any)
              .from('customers').select('name').eq('store_id', storeId)
              .eq('line_user_id', profile.userId).maybeSingle()
            setName(regCust?.name || (profile.displayName ?? ''))
          } catch {
            setName(profile.displayName ?? '')
          }
        }
      } catch { /* LIFF not available */ }

      // reservation_settings を取得（テーブル自体がない場合のみフォールバック）
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

      // 設定未登録の店舗はデフォルト枠でスロットUIを表示
      setSettings(fetchedSettings.length > 0 ? fetchedSettings : DEFAULT_SETTINGS)

      setPageState('slot')
    }
    init()
  }, [storeId])

  // ============================================================
  // お子様ロード（採寸サービス選択時）
  // ============================================================
  const loadChildren = useCallback(async (lUserId: string) => {
    setLoadingChildren(true)
    // LINE IDから顧客を検索
    const { data: cust } = await (supabase as any)
      .from('customers').select('id, name').eq('store_id', storeId)
      .eq('line_user_id', lUserId).maybeSingle()
    if (cust) {
      setCustomerId(cust.id)
      if (cust.name) setName(cust.name) // 採寸サービス選択時も登録名で上書き
      const { data: kids } = await (supabase as any).from('children').select('id, name, school_name, school_id, grade, gender')
        .eq('customer_id', cust.id).order('created_at')
      setChildren((kids ?? []) as ChildRow[])
    }
    // 学校マスターを取得
    const { data: sc } = await (supabase as any).from('schools').select('id, name')
      .eq('store_id', storeId).eq('active', true).order('sort_order')
    setSchools((sc ?? []) as SchoolRow[])
    setLoadingChildren(false)
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
        .select('reserved_at, service_type, purpose')
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
          // 試着室(採寸)を使う予約のみ枠を消費する
          if (!isFittingService(r.service_type ?? '', r.purpose ?? '')) continue
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
      child_id:     selectedChild?.id ?? null,
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
    return <FallbackForm storeId={storeId} storeName={storeName} initialName={name} selfOrderEnabled={selfOrderEnabled} />
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

        {/* 予約のお客様もそのままスマホから制服注文を入力できる（店舗設定でON/OFF） */}
        {selfOrderEnabled && (
          <>
            <a href={`/${storeId}?action=purchase`}
              className="mt-7 w-full max-w-xs flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-colors">
              <ShoppingBag size={18} />制服を注文する
            </a>
            <p className="text-zinc-600 text-xs mt-2">サイズ・数量を選んでご注文いただけます</p>
          </>
        )}
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
                  setSelectedChild(null)
                  if (isFittingService(s.service_type, s.label) && lineUserId) {
                    loadChildren(lineUserId)
                    setStep('child')
                  } else {
                    setStep('datetime')
                  }
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

        {/* ============ STEP 1.5: お子様選択（採寸サービスのみ） ============ */}
        {(step === 'child' || step === 'datetime' || step === 'info') && selectedService && isFittingService(selectedService.service_type, selectedService.label) && (
          <section>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-3">
              <GraduationCap size={13} className="text-indigo-400" />採寸するお子様を選択
            </label>

            {loadingChildren ? (
              <div className="flex justify-center py-6">
                <Loader2 size={22} className="animate-spin text-indigo-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {children.map(c => {
                  const isSelected = selectedChild?.id === c.id
                  const schoolLabel = c.school_name ?? ''
                  return (
                    <button key={c.id} onClick={() => {
                      setSelectedChild(c)
                      if (step === 'child') setStep('datetime')
                    }}
                      className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/40'
                          : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600' : 'bg-zinc-700'}`}>
                          {isSelected ? <Check size={15} className="text-white" /> : <GraduationCap size={15} className="text-zinc-400" />}
                        </div>
                        <div>
                          <p className="font-black text-white text-sm">{c.name}</p>
                          <p className="text-zinc-500 text-xs mt-0.5">{[schoolLabel, c.grade, c.gender === 'male' ? '男子' : c.gender === 'female' ? '女子' : null].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}

                {/* 新規お子様追加 */}
                {showAddChild ? (
                  <div className="bg-zinc-900 border border-indigo-500/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-indigo-300 flex items-center gap-1.5"><GraduationCap size={13} />お子様を追加</p>
                      <button onClick={() => setShowAddChild(false)} className="text-zinc-500 hover:text-zinc-300"><X size={15} /></button>
                    </div>
                    <input type="text" value={ncName} onChange={e => setNcName(e.target.value)}
                      placeholder="お名前（例：山田 太郎）"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none text-sm" />
                    <select value={ncSchoolId} onChange={e => setNcSchoolId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none text-white">
                      <option value="">学校を選択</option>
                      {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={ncGrade} onChange={e => setNcGrade(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none text-white">
                        <option value="">学年</option>
                        {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select value={ncGender} onChange={e => setNcGender(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none text-white">
                        <option value="">性別</option>
                        <option value="male">男子</option>
                        <option value="female">女子</option>
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        if (!ncName.trim() || !customerId) return
                        setNcSaving(true)
                        const schoolName = schools.find(s => s.id === ncSchoolId)?.name ?? null
                        const { data } = await (supabase as any).from('children').insert({
                          customer_id: customerId, store_id: storeId,
                          name: ncName.trim(), school_id: ncSchoolId || null,
                          school_name: schoolName, grade: ncGrade || null, gender: ncGender || null,
                        }).select().single()
                        setNcSaving(false)
                        if (data) {
                          const newChild = data as ChildRow
                          setChildren(prev => [...prev, newChild])
                          setSelectedChild(newChild)
                          setShowAddChild(false)
                          setStep('datetime')
                        }
                      }}
                      disabled={!ncName.trim() || ncSaving}
                      className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white disabled:opacity-40 flex items-center justify-center gap-2">
                      {ncSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}追加する
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddChild(true)}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-600 text-zinc-500 text-sm hover:border-indigo-500 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2">
                    <Plus size={14} />別のお子様を追加
                  </button>
                )}

                {selectedChild && step === 'child' && (
                  <button onClick={() => setStep('datetime')}
                    className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-base flex items-center justify-center gap-2">
                    <CalendarDays size={18} />日時を選ぶ
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ============ STEP 2: 日付・時間帯選択 ============ */}
        {(step === 'datetime' || step === 'info') && selectedService && (
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
                  const isFull    = !slot.available
                  const isLast    = slot.available && slot.remaining === 1
                  const isFew     = slot.available && slot.remaining === 2
                  const fillRatio = slot.maxSlots > 0 ? slot.booked / slot.maxSlots : 1

                  const containerCls = isFull
                    ? 'bg-zinc-900/50 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : isSelected
                    ? 'bg-indigo-600 border border-indigo-500 text-white ring-1 ring-indigo-400/40'
                    : isLast
                    ? 'bg-orange-950/60 border-2 border-orange-500/80 text-white hover:border-orange-400 shadow-orange-900/40 shadow-md'
                    : isFew
                    ? 'bg-yellow-950/50 border border-yellow-600/60 text-white hover:border-yellow-500'
                    : 'bg-zinc-800 border border-green-700/50 text-white hover:bg-zinc-700'

                  const labelCls = isFull
                    ? 'text-zinc-600'
                    : isSelected
                    ? 'text-indigo-200'
                    : isLast
                    ? 'text-orange-300 font-black'
                    : isFew
                    ? 'text-yellow-400 font-bold'
                    : 'text-green-400'

                  const barCls = isFull
                    ? 'bg-zinc-700'
                    : isLast
                    ? 'bg-orange-500'
                    : isFew
                    ? 'bg-yellow-500'
                    : 'bg-green-500'

                  return (
                    <button
                      key={slot.time}
                      disabled={isFull}
                      onClick={() => {
                        if (isFull) return
                        setSelectedTime(slot.time)
                        setStep('info')
                      }}
                      className={`relative py-3 px-3 rounded-xl text-sm font-bold transition-all text-left overflow-hidden ${containerCls}`}
                    >
                      <span className="block text-base">{slot.time}</span>
                      <span className={`text-xs mt-0.5 block ${labelCls}`}>
                        {isFull ? '✕ 満員' : isLast ? '⚡ あと1枠！' : `残${slot.remaining}枠`}
                      </span>
                      {/* 予約埋まり具合バー */}
                      {!isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/40 overflow-hidden rounded-b-xl">
                          <div
                            className={`h-full transition-all duration-500 ${barCls}`}
                            style={{ width: `${Math.round(fillRatio * 100)}%` }}
                          />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ============ STEP 3: お名前・備考 ============ */}
        {step === 'info' && selectedTime && (
          <section>
            <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl px-4 py-3 mb-4 space-y-1">
              <p className="text-indigo-300 text-xs font-bold">選択中</p>
              <p className="text-white font-black text-sm">
                {selectedService?.label} / {fmtDateJp(selectedDate)} {selectedTime}〜
              </p>
              {selectedChild && (
                <p className="text-indigo-200 text-xs flex items-center gap-1">
                  <GraduationCap size={11} />{selectedChild.name}{selectedChild.school_name ? `（${selectedChild.school_name}）` : ''}
                </p>
              )}
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
