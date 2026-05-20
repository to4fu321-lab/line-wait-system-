'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initLiff, getLineProfile } from '@/lib/liff'

type View = 'loading' | 'form' | 'done' | 'not_line' | 'error'

export default function CrmRegisterPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [view,        setView]        = useState<View>('loading')
  const [lineUserId,  setLineUserId]  = useState('')
  const [name,        setName]        = useState('')
  const [storeName,   setStoreName]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const { data: sd } = await supabase.from('stores').select('name').eq('id', storeId).single()
      if (sd?.name) setStoreName(sd.name)

      const liff = await initLiff()
      if (!liff) { setView('not_line'); return }

      try {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href })
          return
        }
        const profile = await getLineProfile()
        if (!profile?.userId) { setView('not_line'); return }
        setLineUserId(profile.userId)
        setName(profile.displayName ?? '')
        setView('form')
      } catch {
        setView('not_line')
      }
    })()
  }, [storeId])

  const handleRegister = async () => {
    if (!name.trim() || !lineUserId) return
    setSaving(true); setErrorMsg('')
    const { error } = await supabase.from('customers').upsert({
      store_id:     storeId,
      name:         name.trim(),
      line_user_id: lineUserId,
    }, { onConflict: 'store_id,line_user_id' })
    setSaving(false)
    if (error) { setErrorMsg('登録に失敗しました。もう一度お試しください。'); return }
    setView('done')
  }

  if (view === 'loading') return (
    <div className="min-h-screen bg-[#06C755] flex items-center justify-center">
      <Loader2 size={44} className="animate-spin text-white" />
    </div>
  )

  if (view === 'not_line') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center">
      <MessageCircle size={64} className="mb-4 opacity-80" />
      <h1 className="text-2xl font-black mb-3">LINEで開いてください</h1>
      <p className="text-green-100 text-base">
        スタッフのQRコードをLINEカメラで<br />読み取ってください
      </p>
    </div>
  )

  if (view === 'done') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center">
      <CheckCircle2 size={88} className="mb-6" />
      <h1 className="text-4xl font-black mb-2">登録完了！</h1>
      <p className="text-2xl font-bold mb-4">{name} 様</p>
      <div className="bg-white/20 rounded-2xl px-6 py-4 text-green-100 text-base leading-relaxed">
        <p>スタッフにお声がけください</p>
        <p className="text-sm mt-1 opacity-80">お直しの受付を行います</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6">
      <div className="text-center text-white mb-6">
        <MessageCircle size={56} className="mx-auto mb-3" />
        {storeName && <p className="text-green-100 text-sm font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">LINE登録</h1>
        <p className="text-green-100 text-sm mt-1">お直し受付のためにLINEで登録します</p>
      </div>

      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
        <div>
          <p className="text-zinc-500 text-xs font-bold text-center mb-2">お名前を確認してください</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full text-center text-2xl font-black text-zinc-900 border-b-2 border-zinc-200 focus:border-[#06C755] focus:outline-none py-2 bg-transparent"
          />
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={13} />{errorMsg}
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={saving || !name.trim()}
          className="w-full bg-[#06C755] text-white text-lg font-black py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200">
          {saving
            ? <><Loader2 size={20} className="animate-spin" />登録中...</>
            : <><MessageCircle size={20} />LINEで登録する</>
          }
        </button>

        <p className="text-zinc-400 text-xs text-center">
          LINEのお名前で登録されます
        </p>
      </div>
    </div>
  )
}
