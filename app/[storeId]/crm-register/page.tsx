'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle2, MessageCircle, AlertCircle, Plus, User, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initLiff, getLineProfile } from '@/lib/liff'
import type { Customer } from '@/types/crm'

type View = 'loading' | 'existing' | 'new_form' | 'done' | 'not_line'

export default function CrmRegisterPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [view,           setView]           = useState<View>('loading')
  const [lineUserId,     setLineUserId]     = useState('')
  const [lineDisplayName, setLineDisplayName] = useState('')
  const [storeName,      setStoreName]      = useState('')
  const [existingList,   setExistingList]   = useState<Customer[]>([])
  const [name,           setName]           = useState('')
  const [saving,         setSaving]         = useState(false)
  const [errorMsg,       setErrorMsg]       = useState('')
  const [doneName,       setDoneName]       = useState('')

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
        setLineDisplayName(profile.displayName ?? '')

        // 同じLINE IDで登録済みのお子様を検索
        const { data: existing } = await supabase
          .from('customers')
          .select('*')
          .eq('store_id', storeId)
          .eq('line_user_id', profile.userId)
          .order('created_at', { ascending: true })

        if (existing && existing.length > 0) {
          setExistingList(existing as Customer[])
          setView('existing')
        } else {
          setName(profile.displayName ?? '')
          setView('new_form')
        }
      } catch {
        setView('not_line')
      }
    })()
  }, [storeId])

  const handleRegister = async () => {
    if (!name.trim() || !lineUserId) return
    setSaving(true); setErrorMsg('')
    const { error } = await supabase.from('customers').insert({
      store_id:     storeId,
      name:         name.trim(),
      line_user_id: lineUserId,
    })
    setSaving(false)
    if (error) {
      if (error.message.includes('unique')) {
        setErrorMsg('同じお名前のお子様が既に登録されています')
      } else {
        setErrorMsg('登録に失敗しました。もう一度お試しください。')
      }
      return
    }
    setDoneName(name.trim())
    setView('done')
  }

  const handleSelectExisting = (customer: Customer) => {
    setDoneName(customer.name)
    setView('done')
  }

  // ── ローディング ──────────────────────────────
  if (view === 'loading') return (
    <div className="min-h-screen bg-[#06C755] flex items-center justify-center">
      <Loader2 size={44} className="animate-spin text-white" />
    </div>
  )

  // ── LINE未使用 ────────────────────────────────
  if (view === 'not_line') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-4">
      <MessageCircle size={64} className="opacity-80" />
      <div>
        <h1 className="text-2xl font-black mb-2">LINEで開いてください</h1>
        <p className="text-green-100 text-base">スタッフのQRコードをLINEカメラで<br />読み取ってください</p>
      </div>
    </div>
  )

  // ── 完了 ──────────────────────────────────────
  if (view === 'done') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-5">
      <CheckCircle2 size={88} />
      <div>
        <h1 className="text-4xl font-black mb-2">確認しました！</h1>
        <p className="text-2xl font-bold mb-1">{doneName} 様</p>
      </div>
      <div className="bg-white/20 rounded-2xl px-6 py-4 text-green-100 text-base leading-relaxed">
        <p className="font-bold">スタッフにお声がけください</p>
        <p className="text-sm mt-1 opacity-80">お直しの受付を行います</p>
      </div>
    </div>
  )

  // ── 登録済みお子様一覧 ─────────────────────────
  if (view === 'existing') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col px-5 pt-12 pb-8">
      <div className="text-white text-center mb-6">
        <MessageCircle size={44} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">登録済みのお子様</h1>
        <p className="text-green-100 text-sm mt-1">お名前を選択してください</p>
      </div>

      <div className="space-y-3 mb-4">
        {existingList.map(c => (
          <button
            key={c.id}
            onClick={() => handleSelectExisting(c)}
            className="w-full bg-white rounded-2xl px-5 py-4 flex items-center gap-3 active:scale-[0.98] transition-all shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <User size={18} className="text-[#06C755]" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-black text-zinc-900 text-base truncate">{c.name}</p>
              {c.school_name && <p className="text-zinc-400 text-xs truncate">{c.school_name}</p>}
            </div>
            <ChevronRight size={18} className="text-zinc-300 shrink-0" />
          </button>
        ))}
      </div>

      <button
        onClick={() => { setName(''); setView('new_form') }}
        className="w-full bg-white/20 border-2 border-white/40 rounded-2xl py-4 flex items-center justify-center gap-2 text-white font-bold text-base active:scale-[0.98] transition-all">
        <Plus size={18} />別のお子様を新規登録
      </button>
    </div>
  )

  // ── 新規登録フォーム ───────────────────────────
  return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center text-white">
        <MessageCircle size={48} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">お子様の登録</h1>
        <p className="text-green-100 text-sm mt-1">
          {lineDisplayName ? `${lineDisplayName} さんのLINEで登録します` : 'LINEで顧客登録を行います'}
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
        <div>
          <p className="text-zinc-500 text-xs font-bold text-center mb-2">お子様のお名前を入力してください</p>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrorMsg('') }}
            placeholder="例：山田 花子"
            className="w-full text-center text-xl font-black text-zinc-900 border-b-2 border-zinc-200 focus:border-[#06C755] focus:outline-none py-2 bg-transparent placeholder-zinc-300"
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
            : <><MessageCircle size={20} />登録する</>
          }
        </button>

        {existingList.length > 0 && (
          <button
            onClick={() => setView('existing')}
            className="w-full text-zinc-400 text-sm py-2 hover:text-zinc-600 transition-colors">
            ← 登録済みのお子様に戻る
          </button>
        )}
      </div>
    </div>
  )
}
