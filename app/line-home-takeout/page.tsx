'use client'

import { useEffect, useState } from 'react'
import { Loader2, QrCode, ShoppingBag, ChevronRight } from 'lucide-react'

interface StoreInfo { id: string; name: string; is_open: boolean }

export default function LineHomeTakeoutPage() {
  const [status, setStatus] = useState<'loading' | 'select' | 'not_found' | 'error'>('loading')
  const [stores, setStores] = useState<StoreInfo[]>([])

  useEffect(() => {
    const run = async () => {
      try {
        const liff = (await import('@line/liff')).default
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TAKEOUT || process.env.NEXT_PUBLIC_LIFF_ID || ''
        await liff.init({ liffId })

        if (!liff.isInClient()) {
          window.location.href = '/open-in-line'
          return
        }

        if (!liff.isLoggedIn()) { liff.login(); return }

        const profile = await liff.getProfile()
        const res = await fetch(`/api/line-store-lookup?userId=${encodeURIComponent(profile.userId)}&biz=takeout`)
        const { stores: found } = await res.json()

        if (!found || found.length === 0) {
          setStatus('not_found')
        } else if (found.length === 1) {
          window.location.href = `/${found[0].id}/order`
        } else {
          setStores(found)
          setStatus('select')
        }
      } catch {
        setStatus('error')
      }
    }
    run()
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-orange-400" />
      </div>
    )
  }

  if (status === 'select') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={28} className="text-orange-400" />
            </div>
            <h1 className="text-xl font-black text-white">ご利用の店舗を選択</h1>
            <p className="text-zinc-500 text-sm mt-1">どちらの店舗ですか？</p>
          </div>
          <div className="space-y-3">
            {stores.map(s => (
              <button
                key={s.id}
                onClick={() => { window.location.href = `/${s.id}/order` }}
                className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/40 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <ShoppingBag size={18} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-bold truncate">{s.name}</p>
                  <p className="text-xs font-bold mt-0.5 text-orange-400">テイクアウト注文</p>
                </div>
                <ChevronRight size={16} className="text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-6">
          <QrCode size={36} className="text-orange-400" />
        </div>
        <h1 className="text-xl font-black text-white mb-3">
          店舗でQRコードを<br />スキャンしてください
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          お店に設置されているQRコードを<br />
          LINEカメラで読み取ると<br />
          注文ページが開きます
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">読み込みエラー。しばらくしてから再度お試しください。</p>
    </div>
  )
}
