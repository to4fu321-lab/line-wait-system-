'use client'

import { useEffect, useState } from 'react'
import { Loader2, QrCode } from 'lucide-react'

export default function LineHomePage() {
  const [status, setStatus] = useState<'loading' | 'not_registered' | 'error'>('loading')

  useEffect(() => {
    const run = async () => {
      try {
        const liff = (await import('@line/liff')).default
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? ''
        await liff.init({ liffId })

        if (!liff.isInClient()) {
          window.location.href = '/open-in-line'
          return
        }

        if (!liff.isLoggedIn()) { liff.login(); return }

        const profile = await liff.getProfile()
        const res = await fetch(`/api/line-store-lookup?userId=${encodeURIComponent(profile.userId)}`)
        const { storeId } = await res.json()

        if (storeId) {
          window.location.href = `/${storeId}`
        } else {
          setStatus('not_registered')
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
        <Loader2 size={36} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6">
        <QrCode size={36} className="text-indigo-400" />
      </div>
      <h1 className="text-xl font-black text-white mb-3">
        店舗でQRコードを<br />スキャンしてください
      </h1>
      <p className="text-zinc-400 text-sm leading-relaxed">
        お店に設置されているQRコードを<br />
        LINEカメラで読み取ると<br />
        受付ページが開きます
      </p>
      {status === 'error' && (
        <p className="mt-6 text-red-400 text-xs">
          読み込みエラー。しばらくしてから再度お試しください。
        </p>
      )}
    </div>
  )
}
