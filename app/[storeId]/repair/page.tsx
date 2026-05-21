'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, MessageCircle, User, ChevronRight, Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initLiff, getLineProfile } from '@/lib/liff'
import { useStoreTheme } from '@/lib/theme-context'
import type { Customer } from '@/types/crm'

type View = 'loading' | 'select' | 'confirm' | 'done' | 'not_line'

export default function RepairPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const theme = useStoreTheme()

  const [view,      setView]      = useState<View>('loading')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selected,  setSelected]  = useState<Customer | null>(null)

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const liff = await initLiff()
      if (!liff) { setView('not_line'); return }

      const profile = await getLineProfile()
      if (!profile?.userId) { setView('not_line'); return }

      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('line_user_id', profile.userId)
        .order('created_at', { ascending: true })

      if (!data || data.length === 0) {
        router.replace(`/${storeId}/onboarding`)
        return
      }

      const list = data as Customer[]
      setCustomers(list)
      if (list.length === 1) { setSelected(list[0]); setView('confirm') }
      else { setView('select') }
    })()
  }, [storeId, router])

  const cardStyle: React.CSSProperties = {
    boxShadow: `0 24px 60px -20px rgb(${theme.colors.primaryRgb} / 0.22), 0 1px 0 0 rgb(255 255 255 / 0.65) inset`,
  }

  if (view === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={44} className="animate-spin" style={{ color: theme.colors.primary }} />
    </div>
  )

  if (view === 'not_line') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <MessageCircle size={56} style={{ color: theme.colors.primary }} />
      <div>
        <h1 className="text-xl font-bold text-zinc-900">LINEで開いてください</h1>
        <p className="text-sm text-zinc-500 mt-1">店舗のQRコードをLINEで読み取ってください</p>
      </div>
    </div>
  )

  if (view === 'select') return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          ✂️
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">お直し受付</h1>
        <p className="text-zinc-500 text-sm mt-1">お子様を選択してください</p>
      </div>

      <div className="space-y-3">
        {customers.map(c => (
          <button key={c.id} onClick={() => { setSelected(c); setView('confirm') }}
            className="group w-full bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 p-5 flex items-center gap-4 active:scale-[0.98] transition-all text-left"
            style={cardStyle}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `rgb(${theme.colors.primaryRgb} / 0.12)` }}>
              <User size={22} style={{ color: theme.colors.primary }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-900 text-base truncate">{c.name}</p>
              {c.kana && <p className="text-zinc-400 text-xs">{c.kana}</p>}
              {c.school_name && <p className="text-zinc-400 text-xs truncate">{c.school_name}</p>}
            </div>
            <ChevronRight size={18} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
          </button>
        ))}

        <button onClick={() => router.push(`/${storeId}/onboarding`)}
          className="w-full border-2 border-dashed border-zinc-200 rounded-3xl py-4 flex items-center justify-center gap-2 text-zinc-400 text-sm font-medium active:scale-[0.98] transition-all hover:border-zinc-300">
          <Plus size={16} />別のお子様を登録
        </button>
      </div>
    </main>
  )

  if (view === 'confirm' && selected) return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 max-w-md mx-auto gap-6">
      <div className="text-center">
        <p className="text-xs font-bold mb-2" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">お名前の確認</h1>
      </div>

      <div className="w-full bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 p-6 text-center space-y-5" style={cardStyle}>
        <p className="text-zinc-500 text-sm">こちらのお名前でよろしいですか？</p>
        <div className="flex items-center justify-center gap-3 rounded-2xl px-5 py-4"
          style={{ background: `rgb(${theme.colors.primaryRgb} / 0.08)` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `rgb(${theme.colors.primaryRgb} / 0.15)` }}>
            <User size={18} style={{ color: theme.colors.primary }} />
          </div>
          <p className="text-2xl font-black text-zinc-900">{selected.name}</p>
        </div>
        {selected.kana       && <p className="text-zinc-400 text-sm">{selected.kana}</p>}
        {selected.school_name && <p className="text-zinc-400 text-xs">{selected.school_name}</p>}

        <button onClick={() => setView('done')}
          className="w-full text-white text-base font-black py-4 rounded-2xl active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          はい、これで進む
        </button>
        {customers.length > 1 && (
          <button onClick={() => setView('select')} className="text-zinc-400 text-sm py-2">← 戻る</button>
        )}
      </div>
    </main>
  )

  // done
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.55)` }}>
        <CheckCircle2 size={56} className="text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-black mb-2 text-zinc-900">確認しました！</h1>
        <p className="text-base text-zinc-600"><span className="font-bold">{selected?.name}</span> 様</p>
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/50 max-w-xs w-full"
        style={{ boxShadow: `0 12px 32px -12px rgb(${theme.colors.primaryRgb} / 0.2)` }}>
        <p className="font-bold text-zinc-800">スタッフにお声がけください</p>
        <p className="text-sm text-zinc-500 mt-1 opacity-80">お直しの受付を行います</p>
      </div>
      <button onClick={() => router.replace(`/${storeId}`)} className="text-zinc-400 text-sm py-2 underline">
        ホームに戻る
      </button>
    </main>
  )
}
