'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function DetailsForm() {
  const { storeId } = useParams<{ storeId: string }>()
  const searchParams = useSearchParams()
  const ticketId = searchParams.get('ticketId')

  const [height,      setHeight]      = useState('')
  const [weight,      setWeight]      = useState('')
  const [parentPhone, setParentPhone] = useState('')

  const [loading,      setLoading]      = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)
  const [notFound,     setNotFound]     = useState(false)
  const [lineUserId,   setLineUserId]   = useState<string | null>(null)

  useEffect(() => {
    if (!ticketId) return
    ;(supabase as any)
      .from('queues')
      .select('ticket_number, details, line_user_id')
      .eq('id', ticketId)
      .single()
      .then(({ data, error: err }: { data: any; error: any }) => {
        if (err || !data) { setNotFound(true); return }
        setTicketNumber(data.ticket_number)
        setLineUserId(data.line_user_id ?? null)
        const d = (data.details ?? {}) as Record<string, string>
        if (d.height)      setHeight(d.height)
        if (d.weight)      setWeight(d.weight)
        if (d.parentPhone) setParentPhone(d.parentPhone)
      })
  }, [ticketId])

  const handleSave = async () => {
    if (!ticketId) return
    setLoading(true)
    setError(null)

    const details: Record<string, string> = {}
    if (height.trim())      details.height      = height.trim()
    if (weight.trim())      details.weight      = weight.trim()
    if (parentPhone.trim()) details.parentPhone = parentPhone.trim()

    const { error: updateErr } = await (supabase as any)
      .from('queues')
      .update({ details })
      .eq('id', ticketId)

    if (!updateErr && parentPhone.trim() && lineUserId && storeId) {
      await (supabase as any)
        .from('customers')
        .update({ tel: parentPhone.trim() })
        .eq('store_id', storeId)
        .eq('line_user_id', lineUserId)
    }

    setLoading(false)
    if (updateErr) {
      setError('保存に失敗しました。もう一度お試しください。')
    } else {
      setSaved(true)
    }
  }

  if (!ticketId || notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-black text-gray-700 mb-2">受付情報が見つかりません</h1>
          <p className="text-gray-500">URLをご確認ください</p>
        </div>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center px-6">
        <div className="text-center animate-slide-up">
          <CheckCircle2 size={96} className="text-emerald-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-emerald-800 mb-3">保存しました</h2>
          <p className="text-lg text-emerald-600 mb-8">詳細情報を受け付けました</p>
          <a
            href={`/${storeId}`}
            className="bg-emerald-500 text-white text-lg font-bold py-4 px-8 rounded-2xl shadow-lg inline-block active:scale-95 transition-transform"
          >
            待ち状況に戻る
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-amber-500 flex flex-col">
      <div className="px-6 pt-10 pb-6 text-center text-white">
        <div className="text-4xl mb-2">📏</div>
        <h1 className="text-2xl font-black tracking-tight">詳細情報の入力</h1>
        {ticketNumber !== null && (
          <p className="text-orange-100 mt-2 text-lg font-bold">整理番号 {String(ticketNumber).padStart(3, '0')}</p>
        )}
        <p className="text-orange-100 mt-1 text-sm">任意項目です。入力しなくても受付は完了しています。</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-6 pb-10">
        <div className="max-w-md mx-auto space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">お子様の身長（cm）</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full text-lg border-2 border-gray-200 rounded-2xl px-4 py-4 focus:border-orange-400 focus:outline-none transition-colors"
                placeholder="例：155"
                value={height}
                onChange={e => setHeight(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">お子様の体重（kg）</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full text-lg border-2 border-gray-200 rounded-2xl px-4 py-4 focus:border-orange-400 focus:outline-none transition-colors"
                placeholder="例：50"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">保護者の電話番号</label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 focus:border-orange-400 focus:outline-none transition-colors"
              placeholder="例：090-1234-5678"
              value={parentPhone}
              onChange={e => setParentPhone(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600">
              <AlertCircle size={20} className="shrink-0" />
              <span className="text-base font-medium">{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xl font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {loading ? (
              <><Loader2 size={22} className="animate-spin" />保存中...</>
            ) : (
              '保存する'
            )}
          </button>

          <a href={`/${storeId}`}
            className="w-full py-4 rounded-2xl border-2 border-gray-200 bg-gray-50 text-gray-500 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all">
            ⏭ 入力せず待ち状況に戻る
          </a>

          <p className="text-center text-gray-400 text-sm">すべての項目は任意です</p>
        </div>
      </div>
    </div>
  )
}

export default function DetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-orange-500 flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-white" />
      </div>
    }>
      <DetailsForm />
    </Suspense>
  )
}
