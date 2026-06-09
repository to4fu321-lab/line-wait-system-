'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2, QrCode, Store, ChevronRight, ShoppingBag, RefreshCw } from 'lucide-react'

type StoreType = 'uniform' | 'takeout'
interface StoreInfo { id: string; name: string; is_open: boolean; type: StoreType }

const ACTION_LABELS: Record<string, string> = {
  queue:    '採寸の順番待ち',
  reserve:  '来店予約',
  repair:   '依頼',
  purchase: 'ネット注文',
}

function buildStoreUrl(storeId: string, type: StoreType, action: string | null): string {
  if (type === 'takeout') return `/${storeId}/order`
  if (!action || action === 'order') return `/${storeId}`
  if (action === 'reserve') return `/${storeId}/reserve`
  if (action === 'repair')  return `/${storeId}/repair`
  return `/${storeId}?action=${encodeURIComponent(action)}`
}

export default function LineHomePage() {
  const [status, setStatus] = useState<'loading' | 'select' | 'not_registered' | 'error'>('loading')
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [action, setAction] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const userIdRef  = useRef<string | null>(null)
  const actionRef  = useRef<string | null>(null)
  const initializedRef = useRef(false)

  // isオープン情報のみ再取得（リダイレクトしない）
  const refreshStatus = useCallback(async () => {
    if (!userIdRef.current) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/line-store-lookup?userId=${encodeURIComponent(userIdRef.current)}&t=${Date.now()}`)
      const { stores: found } = await res.json()
      if (found && found.length > 0) {
        setStores(found)
        setStatus('select')
      }
    } catch { /* ignore */ } finally {
      setRefreshing(false)
    }
  }, [])

  // 画面が再表示されたとき自動更新（LINEアプリから戻ってきたときなど）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && userIdRef.current) {
        refreshStatus()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshStatus])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

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
        userIdRef.current = profile.userId

        const urlAction = new URLSearchParams(window.location.search).get('action')
        setAction(urlAction)
        actionRef.current = urlAction

        const res = await fetch(`/api/line-store-lookup?userId=${encodeURIComponent(profile.userId)}&t=${Date.now()}`)
        const { stores: found } = await res.json()

        if (!found || found.length === 0) {
          setStatus('not_registered')
          return
        }

        // 1店舗のみの場合は直接遷移（初回のみ）
        if (found.length === 1) {
          window.location.href = buildStoreUrl(found[0].id, found[0].type, urlAction)
          return
        }

        // テイクアウト1店舗のみの場合
        if (urlAction === 'order') {
          const takeoutStores = found.filter((s: StoreInfo) => s.type === 'takeout')
          if (takeoutStores.length === 1) {
            window.location.href = `/${takeoutStores[0].id}/order`
            return
          }
        }

        setStores(found)
        setStatus('select')
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
    const uniformStores = stores.filter(s => s.type === 'uniform')
    const takeoutStores = stores.filter(s => s.type === 'takeout')

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
            <h1 className="text-xl font-black text-white">ご利用の店舗を選択</h1>
            <p className="text-zinc-500 text-sm mt-1">どちらをご利用ですか？</p>
            {/* 受付状況更新ボタン */}
            <button onClick={refreshStatus} disabled={refreshing}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-700 active:scale-95 transition-all disabled:opacity-50">
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? '更新中...' : '受付状況を更新'}
            </button>
          </div>

          <div className="space-y-6">
            {/* 制服店 */}
            {uniformStores.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2 px-1">🏫 制服・採寸</p>
                <div className="space-y-2">
                  {uniformStores.map(s => (
                    <button key={s.id}
                      onClick={() => { window.location.href = buildStoreUrl(s.id, 'uniform', action) }}
                      className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left">
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
            )}

            {/* テイクアウト店 */}
            {takeoutStores.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2 px-1">🥡 テイクアウト・再注文</p>
                <div className="space-y-2">
                  {takeoutStores.map(s => (
                    <button key={s.id}
                      onClick={() => { window.location.href = buildStoreUrl(s.id, 'takeout', action) }}
                      className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/40 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                        <ShoppingBag size={18} className="text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-base font-bold truncate">{s.name}</p>
                        <p className="text-xs font-bold mt-0.5 text-orange-400">再注文する</p>
                      </div>
                      <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
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
          受付・注文ページが開きます
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
