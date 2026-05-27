'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || ''

function OpenInLineContent() {
  const params = useSearchParams()
  const to = params.get('to') ?? ''
  const liffUrl = `https://liff.line.me/${LIFF_ID}${to}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-500 to-green-600 flex flex-col items-center justify-center px-6">
      <div className="text-center text-white mb-10">
        <div className="text-7xl mb-6">💬</div>
        <h1 className="text-3xl font-black mb-3">LINEで開いてください</h1>
        <p className="text-green-100 text-lg leading-relaxed">
          このサービスはLINEアプリ内で<br />ご利用いただけます
        </p>
      </div>

      <a
        href={liffUrl}
        className="w-full max-w-xs bg-white text-green-600 text-2xl font-black py-6 rounded-2xl shadow-2xl text-center active:scale-95 transition-transform block"
      >
        LINEで開く →
      </a>

      <p className="text-green-200 text-sm mt-6 text-center">
        LINEがインストールされていない場合は<br />App Store / Google Play からインストールしてください
      </p>
    </div>
  )
}

export default function OpenInLinePage() {
  return (
    <Suspense>
      <OpenInLineContent />
    </Suspense>
  )
}
