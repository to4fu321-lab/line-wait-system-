'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const DEFAULT_NOTES = `【お持ち込みの際のお願い】
・お直しの内容をできるだけ具体的にお知らせください（例：丈詰め○cm、ウエスト詰めなど）
・お名前とご連絡先をご記入いただく場合があります
・お直しの内容・状態によっては対応できない場合があります

【お預かりについて】
・お預かり後、仕上がり日をご連絡します
・お受け取りの際は受付票をお持ちください`

export default function RepairPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [notes, setNotes] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      try {
        const { data } = await (supabase as any)
          .from('stores')
          .select('name, repair_notes')
          .eq('id', storeId)
          .single()
        if (data) {
          setStoreName(data.name ?? '')
          setNotes(data.repair_notes ?? null)
        }
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [storeId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    )
  }

  const displayNotes = notes?.trim() || DEFAULT_NOTES

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 to-white px-5 py-10 max-w-md mx-auto">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-200">
          <span className="text-3xl">✂️</span>
        </div>
        {storeName && (
          <p className="text-xs font-bold text-violet-500 mb-1">{storeName}</p>
        )}
        <h1 className="text-2xl font-black text-zinc-900">お直し・依頼受付</h1>
        <p className="text-zinc-500 text-sm mt-1">ご来店前にご確認ください</p>
      </div>

      {/* 注意事項カード */}
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6 mb-6"
        style={{ boxShadow: '0 8px 30px -10px rgba(109,40,217,0.12)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
            <span className="text-sm">📋</span>
          </div>
          <p className="font-bold text-zinc-800 text-sm">ご来店前のご確認事項</p>
        </div>
        <div className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
          {displayNotes}
        </div>
      </div>

      {/* 受付の流れ */}
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6 mb-8"
        style={{ boxShadow: '0 8px 30px -10px rgba(109,40,217,0.08)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
            <span className="text-sm">🏪</span>
          </div>
          <p className="font-bold text-zinc-800 text-sm">受付の流れ</p>
        </div>
        <div className="space-y-3">
          {[
            { step: '1', text: 'お直し品をお持ちのうえ来店' },
            { step: '2', text: 'スタッフにお声がけください' },
            { step: '3', text: 'お預かり内容を確認・受付票をお渡し' },
            { step: '4', text: '仕上がり次第LINEでご連絡します' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-white">{step}</span>
              </div>
              <p className="text-sm text-zinc-700">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 戻るリンク */}
      <button
        onClick={() => window.history.back()}
        className="w-full py-3.5 rounded-2xl border-2 border-zinc-200 text-zinc-500 font-bold text-sm active:scale-95 transition-transform"
      >
        ← 戻る
      </button>
    </main>
  )
}
