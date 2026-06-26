'use client'

// ============================================================
// LINE連携ページ（既存顧客に line_user_id を後付け）
//   管理画面で発行した「LINE連携QR」をお客様がLINEで開くと、
//   この画面が自分の line_user_id を対象顧客レコードへ紐付ける。
//   QR URL: https://liff.line.me/{LIFF_ID}/{storeId}/link-line?cid={customerId}
// ============================================================
import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { initLiff, getLineProfile } from '@/lib/liff'

type View = 'loading' | 'done' | 'error' | 'not_line'

function LinkLineInner() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const searchParams = useSearchParams()
  const customerId = searchParams?.get('cid') ?? ''

  const [view, setView] = useState<View>('loading')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!storeId || !customerId) { setView('error'); setMsg('QRが正しくありません'); return }
    ;(async () => {
      const liff = await initLiff()
      if (!liff) { setView('not_line'); return }
      try {
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return }
        const profile = await getLineProfile()
        if (!profile?.userId) { setView('not_line'); return }
        const res = await fetch('/api/customers/link-line', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId, customerId, lineUserId: profile.userId }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) { setView('error'); setMsg(data.error ?? '連携に失敗しました'); return }
        setName(data.customer?.name ?? '')
        setView('done')
      } catch {
        setView('not_line')
      }
    })()
  }, [storeId, customerId])

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center space-y-3">
        {view === 'loading' && <p className="text-gray-500 font-bold">連携中です…</p>}
        {view === 'done' && (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-100 grid place-items-center mx-auto text-2xl">✅</div>
            <p className="font-black text-gray-900 text-lg">LINE連携が完了しました</p>
            {name && <p className="text-sm text-gray-500">{name} 様のアカウントに連携しました</p>}
            <p className="text-xs text-gray-400">この画面は閉じて大丈夫です。</p>
          </>
        )}
        {view === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 grid place-items-center mx-auto text-2xl">⚠️</div>
            <p className="font-black text-gray-900">連携できませんでした</p>
            <p className="text-sm text-gray-500">{msg}</p>
          </>
        )}
        {view === 'not_line' && (
          <>
            <div className="w-14 h-14 rounded-full bg-gray-100 grid place-items-center mx-auto text-2xl">📱</div>
            <p className="font-black text-gray-900">LINEアプリで開いてください</p>
            <p className="text-sm text-gray-500">このページはLINEから開く必要があります。</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function LinkLinePage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-gray-400">読み込み中…</div>}>
      <LinkLineInner />
    </Suspense>
  )
}
