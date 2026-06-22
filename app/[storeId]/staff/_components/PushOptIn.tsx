'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BAmZx5b8ScrgrqWa822FdQhtfHV2CSyqvxNeQX-Ds1KsqztPPRtZRyBP_LaQZmCLejg8Ivd7Gu4cBxKtNwodb3o'

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from(raw.split('').map(c => c.charCodeAt(0)))
}

// スタッフ個人宛プッシュ通知の購読ボタン（シフト公開・欠員・新着メッセージ）
export function PushOptIn({ storeId, staffId }: { storeId: string; staffId: string }) {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
      setStatus('unsupported'); return
    }
    const p = (window as any).Notification.permission
    if (p === 'granted') setStatus('granted')
    else if (p === 'denied') setStatus('denied')
  }, [])

  const setup = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setStatus('unsupported'); return }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const perm = await (window as any).Notification.requestPermission()
      if (perm !== 'granted') { setStatus('denied'); return }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
      await fetch('/api/push-subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, staffId, kind: 'staff', subscription: sub.toJSON() }),
      })
      setStatus('granted')
    } catch { setStatus('denied') }
  }

  if (status === 'unsupported') return null
  if (status === 'granted') return (
    <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold px-1 py-2">
      <Bell size={14} />通知オン（シフト公開・連絡を受け取れます）
    </div>
  )

  return (
    <button onClick={setup}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border active:scale-[0.99] transition-all ${
        status === 'denied' ? 'border-red-200 bg-red-50' : 'border-indigo-200 bg-indigo-50'
      }`}>
      {status === 'denied' ? <BellOff size={18} className="text-red-500" /> : <Bell size={18} className="text-indigo-600" />}
      <span className={`text-sm font-bold flex-1 text-left ${status === 'denied' ? 'text-red-600' : 'text-indigo-700'}`}>
        {status === 'denied' ? '通知がブロック中（ブラウザ設定で許可）' : 'プッシュ通知をオンにする'}
      </span>
    </button>
  )
}
