'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { initLiff, getLineProfile } from '@/lib/liff'
import { supabase } from '@/lib/supabase'
import { useStoreTheme } from '@/lib/theme-context'

type View = 'loading' | 'ready' | 'no_line'

export default function StoreHomePage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const theme = useStoreTheme()
  const [view, setView] = useState<View>('loading')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    if (!storeId) return

    // Active ticket: go straight to queue status screen
    const savedId   = localStorage.getItem(`queue_ticket_id_${storeId}`)
    const savedDate = localStorage.getItem(`queue_ticket_date_${storeId}`)
    if (savedId && savedDate === new Date().toDateString()) {
      router.replace(`/${storeId}/queue`)
      return
    }

    let cancelled = false
    ;(async () => {
      const liff = await initLiff()
      if (!liff) {
        if (!cancelled) setView('no_line')
        return
      }
      const profile = await getLineProfile()
      if (!profile) {
        if (!cancelled) setView('no_line')
        return
      }
      if (cancelled) return
      setDisplayName(profile.displayName)

      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('store_id',     storeId)
        .eq('line_user_id', profile.userId)
        .limit(1)

      if (cancelled) return

      if (!data || data.length === 0) {
        router.replace(`/${storeId}/onboarding`)
        return
      }
      setView('ready')
    })()
    return () => { cancelled = true }
  }, [storeId, router])

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-4 border-white/30 border-t-transparent animate-spin"
            style={{ borderTopColor: theme.colors.primary }}
          />
          <p className="text-sm text-zinc-500">読み込み中…</p>
        </div>
      </div>
    )
  }

  if (view === 'no_line') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm bg-white/70 backdrop-blur-xl rounded-3xl border border-white/40 p-8 shadow-xl">
          <div className="text-5xl mb-4">{theme.logoEmoji}</div>
          <h1 className="text-xl font-bold mb-2 text-zinc-900">{theme.storeName}</h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            LINEアプリで開いて<br />ご利用ください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen px-5 pt-10 pb-16 max-w-md mx-auto">
      <Header theme={theme} />

      <section className="mb-8 px-1">
        <p className="text-xs text-zinc-500 mb-1">こんにちは</p>
        <p className="text-2xl font-bold text-zinc-900 tracking-tight">
          {displayName}<span className="text-base text-zinc-500 ml-1 font-medium">さん</span>
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <ServiceCard
          href={`/${storeId}/queue`}
          emoji="📋"
          title="順番待ち受付"
          desc="混雑時の整理券を取得します"
        />
        <ServiceCard
          href={`/${storeId}/repair`}
          emoji="✂️"
          title="お直し受付"
          desc="制服のお直しを依頼します"
        />
      </section>

      <FooterBadge theme={theme} />
    </main>
  )
}

function Header({ theme }: { theme: ReturnType<typeof useStoreTheme> }) {
  return (
    <header className="flex items-center gap-3 mb-10">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl text-white"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.accent} 100%)`,
          boxShadow: `
            0 10px 24px -8px rgb(${theme.colors.primaryRgb} / 0.5),
            inset 0 1px 0 0 rgb(255 255 255 / 0.3)
          `,
        }}
      >
        {theme.logoUrl
          ? <img src={theme.logoUrl} alt="" className="w-8 h-8 object-contain" />
          : <span>{theme.logoEmoji}</span>}
      </div>
      <div className="leading-tight">
        <h1 className="text-base font-bold text-zinc-900">{theme.storeName}</h1>
        <p className="text-[11px] text-zinc-500 tracking-wide">{theme.tagline}</p>
      </div>
    </header>
  )
}

function ServiceCard({ href, emoji, title, desc }: {
  href:  string
  emoji: string
  title: string
  desc:  string
}) {
  const theme = useStoreTheme()
  return (
    <Link
      href={href}
      className="group relative block rounded-3xl bg-white/65 backdrop-blur-xl border border-white/50 p-5 transition-all hover:bg-white/80 active:scale-[0.98]"
      style={{
        boxShadow: `
          0 12px 32px -12px rgb(${theme.colors.primaryRgb} / 0.22),
          0 1px 0 0 rgb(255 255 255 / 0.6) inset
        `,
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{
            background: `linear-gradient(135deg, rgb(${theme.colors.primaryRgb} / 0.18), rgb(${theme.colors.accentRgb} / 0.12))`,
            boxShadow: `inset 0 1px 0 0 rgb(255 255 255 / 0.5)`,
          }}
        >
          <span>{emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-zinc-900">{title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold transition-transform group-hover:translate-x-0.5"
          style={{
            color:      theme.colors.primary,
            background: `rgb(${theme.colors.primaryRgb} / 0.12)`,
          }}
        >
          →
        </div>
      </div>
    </Link>
  )
}

function FooterBadge({ theme }: { theme: ReturnType<typeof useStoreTheme> }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: theme.colors.primary }}
      />
      <span>Powered by LINE</span>
    </div>
  )
}
