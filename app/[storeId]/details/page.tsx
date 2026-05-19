'use client'

// NOTE: Before using this page, run the following SQL in Supabase:
//   ALTER TABLE queues ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';
//   ALTER TABLE queues ADD COLUMN IF NOT EXISTS child_name text;

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function DetailsForm() {
  const { storeId } = useParams<{ storeId: string }>()
  const searchParams = useSearchParams()
  const ticketId = searchParams.get('ticketId')

  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!ticketId) return
    supabase
      .from('queues')
      .select('ticket_number, details')
      .eq('id', ticketId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setNotFound(true); return }
        setTicketNumber(data.ticket_number)
        const d = (data.details ?? {}) as Record<string, string>
        if (d.postalCode) setPostalCode(d.postalCode)
        if (d.address) setAddress(d.address)
        if (d.phone) setPhone(d.phone)
        if (d.notes) setNotes(d.notes)
      })
  }, [ticketId])

  const handleSave = async () => {
    if (!ticketId) return
    setLoading(true)
    setError(null)

    const { error: updateErr } = await supabase
      .from('queues')
      .update({
        details: {
          postalCode: postalCode.trim(),
          address: address.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        },
      })
      .eq('id', ticketId)

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
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-6">
        <div className="text-center animate-slide-up">
          <CheckCircle2 size={96} className="text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-green-800 mb-3">保存しました</h2>
          <p className="text-lg text-green-600 mb-8">詳細情報を受け付けました</p>
          <a
            href={`/${storeId}`}
            className="bg-green-500 text-white text-lg font-bold py-4 px-8 rounded-2xl shadow-lg inline-block active:scale-95 transition-transform"
          >
            待ち状況に戻る
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-700 flex flex-col">
      <div className="px-6 pt-10 pb-8 text-center text-white">
        <div className="text-4xl mb-3">📋</div>
        <h1 className="text-2xl font-black tracking-tight">詳細情報の入力</h1>
        {ticketNumber !== null && (
          <p className="text-blue-100 mt-2">整理番号 {String(ticketNumber).padStart(3, '0')}</p>
        )}
        <p className="text-blue-200 mt-1 text-sm">任意項目です。入力しなくても受付は完了しています。</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-10">
        <div className="max-w-md mx-auto space-y-6">

          <div>
            <label className="block text-base font-bold text-gray-700 mb-2">
              郵便番号
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="例：123-4567"
              value={postalCode}
              onChange={e => setPostalCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-700 mb-2">
              住所
            </label>
            <input
              type="text"
              inputMode="text"
              autoComplete="street-address"
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="例：東京都渋谷区〇〇1-2-3"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-700 mb-2">
              電話番号
            </label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="例：090-1234-5678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-700 mb-2">
              備考
            </label>
            <textarea
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none transition-colors resize-none"
              placeholder="ご要望・メモなど"
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
            className="w-full bg-blue-600 text-white text-xl font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                保存中...
              </>
            ) : (
              '保存する'
            )}
          </button>

          <p className="text-center text-gray-400 text-sm">
            すべての項目は任意です
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-white" />
      </div>
    }>
      <DetailsForm />
    </Suspense>
  )
}
