'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveFeature } from '@/lib/features'
import { initLiff, getLineProfile } from '@/lib/liff'
import { fetchCustomerSession, saveCustomer, createReservation, fetchReservationsOfDay } from '@/lib/customerApi'
import { fetchSchools } from '@/lib/masterApi'
import { todayJst, toJstTimeString } from '@/lib/date'
import { loadDayCapacity } from '@/lib/reservationCapacity'
import { isFitting } from '@/lib/fittingTypes'
import {
  DEFAULT_RESERVABLE_PURPOSES, WALK_IN_PURPOSES, normalizePurposes, type VisitPurpose,
} from '@/app/[storeId]/admin/reservations/_lib/purposes'
import {
  DEFAULT_SEASON, isDateInSeason, offSeasonMessageOf, seasonFromRow, type SeasonSettings,
} from '@/app/[storeId]/admin/reservations/_lib/season'
import {
  CalendarDays, Clock, User, FileText, Check, Info,
  Loader2, ChevronLeft, ChevronRight, GraduationCap, Plus, X,
} from 'lucide-react'

// 採寸サービスかどうかの判定（判定本体は lib/fittingTypes に集約）
function isFittingService(serviceType: string, label: string) {
  return isFitting(label, serviceType)
}

const GRADE_OPTIONS = ['中学1年', '中学2年', '中学3年', '高校1年', '高校2年', '高校3年']

// ============================================================
// ユーティリティ
// ============================================================

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

// ============================================================
// 型
// ============================================================
type SlotInfo = {
  time: string
  maxSlots: number
  booked: number
  remaining: number
  available: boolean
}

// ============================================================
// シンプルフォールバックフォーム（枠が読めない等の非常時）
// ============================================================
function FallbackForm({ storeId, storeName, initialName }: { storeId: string; storeName: string; initialName?: string }) {
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
        {/* 予約しただけの段階で注文まで進めるのは誤発注のもとなので導線を置かない。
            採寸・対面での確認が済んだあとにご案内する。 */}
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
            try {
              await createReservation(storeId, {
                reservedAt: new Date(`${date}T12:00:00+09:00`).toISOString(),
                notes: [name ? `お名前: ${name}` : null, note || null].filter(Boolean).join('\n') || undefined,
              })
              setStep('done')
            } catch {
              setErrorMsg('予約の送信に失敗しました。もう一度お試しください。')
            }
            setSubmitting(false)
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

  // 店舗設定（来店理由・予約シーズン）
  const [purposes, setPurposes] = useState<VisitPurpose[]>(DEFAULT_RESERVABLE_PURPOSES)
  const [season, setSeason]     = useState<SeasonSettings>(DEFAULT_SEASON)

  // ステップ内の状態
  // step: 'service' | 'child' | 'datetime' | 'info'
  const [step, setStep] = useState<'service' | 'child' | 'datetime' | 'info'>('service')

  // フォーム値
  const [selectedPurpose, setSelectedPurpose] = useState<VisitPurpose | null>(null)
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
      // ストア名 + 予約機能フラグの確認
      try {
        const { data: store } = await (supabase as any)
          .from('stores').select('name, features').eq('id', storeId).single()
        if (store) {
          const features = (store.features ?? {}) as Record<string, unknown>
          // 予約機能が無効な店舗では予約ページを開かせない（店舗トップへ）
          if (!resolveFeature('reservation', features)) {
            window.location.replace(`/${storeId}`)
            return
          }
          setStoreName(store.name ?? '')
        }

        // 来店理由とシーズンは別のクエリにしておく。
        // マイグレーション前のDBだと列が無くてクエリごと失敗するので、
        // 店名・機能フラグの取得まで巻き込まないようにする（既定値で動く）
        const { data: cfg } = await (supabase as any)
          .from('stores')
          .select([
            'reservation_purposes',
            'reservation_season_enabled',
            'reservation_season_from_month', 'reservation_season_from_day',
            'reservation_season_to_month', 'reservation_season_to_day',
            'reservation_offseason_message',
          ].join(', '))
          .eq('id', storeId).maybeSingle()
        if (cfg) {
          setPurposes(normalizePurposes(cfg.reservation_purposes) ?? DEFAULT_RESERVABLE_PURPOSES)
          setSeason(seasonFromRow(cfg))
        }
      } catch { /* ignore */ }

      // LIFF（フォールバック表示時も顧客名を反映できるよう、設定取得より先に実行）
      // 共有の initLiff を使うことで、line-home からのSPA遷移時は
      // 初期化済みインスタンスを再利用でき、再初期化のロスがない
      try {
        const liff = await initLiff('uniform')
        if (liff) {
          if (!liff.isLoggedIn()) { liff.login(); return }
          const profile = await getLineProfile()
          if (profile) {
            setLineUserId(profile.userId)
            // CRM登録名を優先、なければLINE表示名
            try {
              const { customer } = await fetchCustomerSession(storeId)
              setName(customer?.name || (profile.displayName ?? ''))
            } catch {
              setName(profile.displayName ?? '')
            }
          }
        }
      } catch { /* LIFF not available */ }

      // 枠の長さ・枠数は店舗設定(stores)から自動で決まるので、
      // ここで取りに行くものは無い
      setPageState('slot')
    }
    init()
  }, [storeId])

  // ============================================================
  // お子様ロード（採寸サービス選択時）
  // ============================================================
  const loadChildren = useCallback(async (_lUserId: string) => {
    setLoadingChildren(true)
    // LINE本人の顧客+お子様(サーバーAPIで本人確認)
    const { customer, children: kids } = await fetchCustomerSession(storeId)
    if (customer) {
      setCustomerId(customer.id)
      if (customer.name) setName(customer.name) // 採寸サービス選択時も登録名で上書き
      setChildren((kids ?? []) as ChildRow[])
    }
    // 学校マスターを取得
    setSchools(await fetchSchools(storeId).catch(() => []))
    setLoadingChildren(false)
  }, [storeId])

  // ============================================================
  // スロット可用性の計算
  // ============================================================
  const fetchSlots = useCallback(async () => {
    if (!selectedPurpose || !selectedDate) return
    // シーズン外の日はそもそも受け付けないので、枠を取りに行かない
    if (!isDateInSeason(selectedDate, season)) {
      setSlots([]); setSelectedTime(null); setDayUnavailable(false); setSlotsLoading(false)
      return
    }
    setSlotsLoading(true)
    setSlots([])
    setDayUnavailable(false)
    setSelectedTime(null)

    try {
      // その日の受付枠を取得。営業時間・枠の長さ・枠数から決まる
      //（判断は lib/reservationCapacity に集約）
      const cap = await loadDayCapacity(storeId, selectedDate)
      if (!cap.open) {
        setDayUnavailable(true)
        setSlotsLoading(false)
        return
      }

      // 対象日の全予約をまとめて取得（非PII列のみのAPI経由）
      const { reservations } = await fetchReservationsOfDay(storeId, selectedDate)

      // 枠は固定長なので、予約は開始時刻の枠に1件として入る
      const bookedAt: Record<string, number> = {}
      for (const r of (reservations ?? [])) {
        if (!isFittingService(r.service_type ?? '', r.purpose ?? '')) continue
        const t = toJstTimeString(r.reserved_at)
        bookedAt[t] = (bookedAt[t] ?? 0) + 1
      }

      const slotInfos: SlotInfo[] = cap.slots.map(s => {
        const booked = bookedAt[s.time] ?? 0
        const remaining = s.capacity - booked
        return { time: s.time, maxSlots: s.capacity, booked, remaining, available: remaining > 0 }
      })

      setSlots(slotInfos.filter(s => s.maxSlots > 0))
    } catch (e) {
      console.error('fetchSlots error', e)
    }

    setSlotsLoading(false)
  }, [selectedPurpose, selectedDate, storeId, season])

  useEffect(() => {
    if (step === 'datetime' && selectedPurpose) {
      fetchSlots()
    }
  }, [step, selectedPurpose, selectedDate, fetchSlots])

  // いまがシーズン外でも先の日付なら取れることがあるので、
  // 最初に選ぶ日をシーズンが始まる日まで進めておく（お客様に探させない）
  useEffect(() => {
    if (!season.enabled || isDateInSeason(selectedDate, season)) return
    for (let d = minDate, i = 0; d <= maxDate && i < 400; d = addDays(d, 1), i++) {
      if (isDateInSeason(d, season)) { setSelectedDate(d); return }
    }
    // 90日先までずっとシーズン外のときは案内文だけを出すので、日付はそのままでよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season])

  // ============================================================
  // 送信
  // ============================================================
  async function handleSubmit() {
    if (!selectedPurpose || !selectedDate || !selectedTime) return
    setSubmitting(true)
    setErrorMsg('')

    const reservedAt = `${selectedDate}T${selectedTime}:00+09:00`

    try {
      // 顧客の紐づけはサーバー側(LIFFトークン検証)で行う
      await createReservation(storeId, {
        childId:     selectedChild?.id ?? null,
        reservedAt,
        serviceType: selectedPurpose.serviceType,
        purpose:     selectedPurpose.label,
        notes:       [name ? `お名前: ${name}` : null, note || null].filter(Boolean).join('\n') || undefined,
      })
      setPageState('done')
    } catch {
      setErrorMsg('予約の送信に失敗しました。もう一度お試しください。')
    }
    setSubmitting(false)
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
    return <FallbackForm storeId={storeId} storeName={storeName} initialName={name} />
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
        {selectedPurpose && (
          <p className="text-indigo-300 text-sm font-bold mb-1">{selectedPurpose.label}</p>
        )}
        <p className="text-zinc-500 text-xs">
          {dateLabel}{selectedTime && ` ${selectedTime}〜`}
        </p>
        <p className="text-zinc-600 text-xs mt-4">※ 確認のご連絡をお送りする場合があります</p>
        {/* 予約しただけの段階で注文まで進めるのは誤発注のもとなので導線を置かない。
            採寸・対面での確認が済んだあとにご案内する。 */}
      </div>
    )
  }

  // ============================================================
  // スロット制フォーム
  // ============================================================
  // シーズン外は予約を受けない。
  // 受付できる日（今日〜90日先）が丸ごとシーズン外なら、案内文だけを出して
  // フォームは見せない。一部でもシーズン内の日があれば、上に案内を出したうえで
  // シーズン内の日だけ選べるようにする。
  const offSeasonNow      = !isDateInSeason(minDate, season)
  const offSeasonSelected = !isDateInSeason(selectedDate, season)
  const wholeWindowOffSeason = offSeasonNow && !isDateInSeason(maxDate, season)
  const offSeasonMessage = offSeasonMessageOf(season)

  if (wholeWindowOffSeason) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center bg-zinc-950">
        <div className="w-16 h-16 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-5">
          <Info size={26} className="text-indigo-300" />
        </div>
        {storeName && <p className="text-indigo-400 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-xl font-black text-white mb-3">ただいま予約の受付はありません</h1>
        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap max-w-sm">{offSeasonMessage}</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] pb-12 bg-zinc-950">
      {/* ヘッダー */}
      <div className="px-5 pt-8 pb-5">
        <p className="text-indigo-400 text-xs font-bold mb-1">{storeName}</p>
        <h1 className="text-2xl font-black text-white">来店予約</h1>
        <p className="text-zinc-500 text-sm mt-1">ご希望のサービスと日時をお選びください</p>
      </div>

      <div className="px-5 space-y-6">

        {/* シーズン外の案内。いまは受付期間外でも、先の日付なら取れることがある */}
        {offSeasonNow && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 flex items-start gap-2">
            <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-100 text-xs leading-relaxed whitespace-pre-wrap">{offSeasonMessage}</p>
          </div>
        )}

        {/* ============ STEP 1: 来店理由 ============ */}
        <section>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-3">
            <FileText size={13} className="text-indigo-400" />ご来店の理由をお選びください
          </label>
          <div className="grid grid-cols-1 gap-3">
            {purposes.map(p => (
              <button
                key={p.key}
                onClick={() => {
                  setSelectedPurpose(p)
                  setSelectedTime(null)
                  setSelectedChild(null)
                  if (lineUserId) { loadChildren(lineUserId); setStep('child') }
                  else setStep('datetime')
                }}
                className={`w-full text-left rounded-2xl border px-4 py-4 transition-all ${
                  selectedPurpose?.key === p.key
                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <p className="font-black text-white text-base">{p.emoji} {p.label}</p>
              </button>
            ))}
          </div>

          {/* 予約が要らない用件は、枠を取らずにそのまま来ていただく */}
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-[11px] font-bold text-zinc-400 mb-1.5">下記は予約不要です。そのままご来店ください。</p>
            <div className="flex flex-wrap gap-1.5">
              {WALK_IN_PURPOSES.map(p => (
                <span key={p.key} className="px-2 py-1 rounded-lg bg-zinc-800 text-[11px] font-bold text-zinc-300">
                  {p.emoji} {p.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ============ STEP 1.5: お子様選択（採寸サービスのみ） ============ */}
        {(step === 'child' || step === 'datetime' || step === 'info') && selectedPurpose && (
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
                        let newChild: ChildRow | null = null
                        try {
                          const { child } = await saveCustomer(storeId, {
                            childInsert: {
                              name: ncName.trim(), school_id: ncSchoolId || null,
                              school_name: schoolName, grade: ncGrade || null, gender: ncGender || null,
                            },
                          })
                          newChild = child as ChildRow | null
                        } catch { /* 失敗時はボタン再押下で再試行 */ }
                        setNcSaving(false)
                        if (newChild) {
                          setChildren(prev => [...prev, newChild as ChildRow])
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
        {(step === 'datetime' || step === 'info') && selectedPurpose && (
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

            {offSeasonSelected ? (
              <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl px-4 py-5 text-center space-y-1.5">
                <p className="text-amber-200 text-sm font-bold">この日は予約の受付期間外です</p>
                <p className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap">{offSeasonMessage}</p>
              </div>
            ) : slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : dayUnavailable ? (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-5 text-center">
                <p className="text-zinc-400 text-sm font-bold">✕ この日は予約をお受けできません</p>
                <p className="text-zinc-600 text-xs mt-1">別の日をお選びください</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-5 text-center">
                <p className="text-zinc-400 text-sm font-bold">✕ この日は空き枠がありません</p>
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
                {selectedPurpose?.label} / {fmtDateJp(selectedDate)} {selectedTime}〜
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
