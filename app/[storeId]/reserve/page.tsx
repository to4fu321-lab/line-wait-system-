'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Clock, User, FileText, Check, Loader2 } from 'lucide-react'

const TIME_SLOTS = [
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00',
]

function todayJst() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

export default function ReservePage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [step, setStep]             = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [storeName, setStoreName]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg]     = useState('')

  // Form fields
  const [name,     setName]     = useState('')
  const [date,     setDate]     = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [purpose,  setPurpose]  = useState('')
  const [note,     setNote]     = useState('')

  useEffect(() => {
    const init = async () => {
      // Store name
      const { data: store } = await (supabase as any)
        .from('stores').select('name').eq('id', storeId).single()
      if (store) setStoreName(store.name ?? '')

      // Try LIFF
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
      } catch {
        // LIFF not available (e.g. desktop browser) — proceed without LINE ID
      }
      setStep('form')
    }
    init()
  }, [storeId])

  async function handleSubmit() {
    if (!date) return
    setSubmitting(true)
    setErrorMsg('')

    // Build reserved_at timestamp (JST noon if no time selected)
    const time = timeSlot || '12:00'
    const reservedAt = new Date(`${date}T${time}:00+09:00`).toISOString()

    // Look up customer by LINE user ID
    let customerId: string | null = null
    if (lineUserId) {
      const { data: customer } = await (supabase as any)
        .from('customers').select('id')
        .eq('store_id', storeId).eq('line_user_id', lineUserId)
        .single()
      if (customer) customerId = customer.id
    }

    const { error } = await (supabase as any).from('reservations').insert({
      store_id:    storeId,
      customer_id: customerId,
      line_user_id: lineUserId,
      reserved_at: reservedAt,
      purpose:     purpose || null,
      status:      'confirmed',
      notes:       [name ? `お名前: ${name}` : null, note || null].filter(Boolean).join('\n') || null,
    })

    setSubmitting(false)
    if (error) {
      setErrorMsg('予約の送信に失敗しました。もう一度お試しください。')
    } else {
      setStep('done')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#111827' }}>
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-5">
          <Check size={28} className="text-emerald-400" />
        </div>
        <h1 className="text-xl font-black text-white mb-2">予約を受け付けました</h1>
        <p className="text-zinc-400 text-sm mb-2">{storeName && `${storeName}への`}ご来店予約を承りました。</p>
        <p className="text-zinc-500 text-xs">
          {date && new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          {timeSlot && ` ${timeSlot}〜`}
        </p>
        <p className="text-zinc-600 text-xs mt-4">※ 確認のご連絡をお送りする場合があります</p>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#111827' }}>
        <p className="text-red-400 text-sm text-center">エラーが発生しました。ページを再読み込みしてください。</p>
      </div>
    )
  }

  const minDate = todayJst()
  const maxDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

  return (
    <div className="min-h-screen pb-10" style={{ background: '#111827' }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-6">
        <p className="text-indigo-400 text-xs font-bold mb-1">{storeName}</p>
        <h1 className="text-2xl font-black text-white">来店予約</h1>
        <p className="text-zinc-400 text-sm mt-1">ご希望の日時をお選びください</p>
      </div>

      <div className="px-5 space-y-5">
        {/* Date picker */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
            <CalendarDays size={13} className="text-indigo-400" />来店日 <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3.5 text-white text-base focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Time slot */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
            <Clock size={13} className="text-indigo-400" />ご希望の時間帯
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map(t => (
              <button
                key={t}
                onClick={() => setTimeSlot(prev => prev === t ? '' : t)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  timeSlot === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Purpose */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
            <FileText size={13} className="text-indigo-400" />来店目的（任意）
          </label>
          <div className="flex flex-wrap gap-2">
            {['採寸・制服選び', 'お直し受取', '取置き受取', 'その他'].map(p => (
              <button
                key={p}
                onClick={() => setPurpose(prev => prev === p ? '' : p)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  purpose === p
                    ? 'bg-indigo-600/30 border border-indigo-500 text-indigo-300'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Name (if not from LIFF) */}
        {!lineUserId && (
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 mb-2">
              <User size={13} className="text-indigo-400" />お名前
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="山田 花子"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        {/* Notes */}
        <div>
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
          <p className="text-red-400 text-sm text-center">{errorMsg}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!date || submitting}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
          {submitting ? '送信中...' : '予約を申し込む'}
        </button>
        <p className="text-zinc-600 text-xs text-center">予約は確認後に確定となります</p>
      </div>
    </div>
  )
}
