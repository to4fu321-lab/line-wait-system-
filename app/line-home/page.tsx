'use client'

import { useEffect, useState } from 'react'
import { Loader2, QrCode, Store, ChevronRight } from 'lucide-react'

interface StoreInfo { id: string; name: string; is_open: boolean }

// アクション追加時はここに1行足すだけ
const ACTION_LABELS: Record<string, string> = {
  queue:    '採寸の順番待ち',
  reserve:  '来店予約',
  repair:   '依頼',
  purchase: 'ネット注文',
}

// アクション追加時はここに1行足すだけ（path-based なら追記、それ以外はフォールバックで自動対応）
function buildStoreUrl(storeId: string, action: string | null): string {
  if (!action) return `/${storeId}`
  if (action === 'reserve') return `/${storeId}/reserve`
  if (action === 'repair') return `/${storeId}/repair`
  return `/${storeId}?action=${encodeURIComponent(action)}`
}

export default function LineHomePage() {
  const [status, setStatus] = useState<'loading' | 'select' | 'not_registered' | 'error'>('loading')
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [action, setAction] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const liff = (await import('@line/liff')).default
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_UNIFORM || process.env.NEXT_PUBLIC_LIFF_ID || ''
        await liff.init({ liffId })

        if (!liff.isInClient()) {
          window.location.href = '/open-in-line'
          return
        }

        if (!liff.isLoggedIn()) { liff.login(); return }

        const profile = await liff.getProfile()
        const res = await fetch(`/api/line-store-lookup?userId=${encodeURIComponent(profile.userId)}`)
        const { stores: found } = await res.json()

        const urlAction = new URLSearchParams(window.location.search).get('action')
        setAction(urlAction)

        if (!found || found.length === 0) {
          setStatus('not_registered')
        } else if (found.length === 1) {
          // 1店舗のみ → そのまま自動リダイレクト
          window.location.href = buildStoreUrl(found[0].id, urlAction)
        } else {
          // 複数店舗 → 選択画面
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
        <Loader2 size={36} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (status === 'select') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
              <Store size={28} className="text-indigo-400" />
            </div>
            {action && ACTION_LABELS[action] && (
              <div className="inline-block bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full mb-3">
                {ACTION_LABELS[action]}
              </div>
            )}
            <h1 className="text-xl font-black text-white">どちらの店舗ですか？</h1>
            <p className="text-zinc-500 text-sm mt-1">本日ご利用の店舗を選んでください</p>
          </div>
          <div className="space-y-3">
            {stores.map(s => (
              <button
                key={s.id}
                onClick={() => { window.location.href = buildStoreUrl(s.id, action) }}
                className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Store size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-bold truncate">{s.name}</p>
                  <p className={`text-xs font-bold mt-0.5 ${s.is_open ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {s.is_open ? '受付中' : '受付停止中'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-zinc-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'not_registered') {
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">読み込みエラー。しばらくしてから再度お試しください。</p>
    </div>
  )
}
