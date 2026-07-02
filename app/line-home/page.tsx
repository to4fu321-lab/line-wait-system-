'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, QrCode, Store, ChevronRight, ShoppingBag, RefreshCw } from 'lucide-react'
import { initLiff, getLineProfile } from '@/lib/liff'

type StoreType = 'uniform' | 'takeout'
// caps: /api/line-store-lookup が resolveFeature で算出した顧客向け機能可否。
// 旧レスポンス（capsなし）でも動くよう optional にし、未取得時は許可扱い。
interface StoreCaps { queue: boolean; reserve: boolean; repair: boolean; purchase: boolean }
interface StoreInfo { id: string; name: string; is_open: boolean; type: StoreType; caps?: StoreCaps }

const ACTION_LABELS: Record<string, string> = {
  queue:    '採寸の順番待ち',
  reserve:  '来店予約',
  repair:   '依頼',
  purchase: 'ネット注文',
}

// 店舗の機能フラグを見て、対応していない action は捨てて店舗トップへ送る。
// （例: お直し特化プランの店に action=reserve で入ろうとしても予約ページには行かせない）
function buildStoreUrl(store: StoreInfo, action: string | null): string {
  const { id, type, caps } = store
  if (type === 'takeout') return `/${id}/order`
  if (!action || action === 'order') return `/${id}`
  const allowed = (k: keyof StoreCaps) => !caps || caps[k]
  if (action === 'reserve')  return allowed('reserve')  ? `/${id}/reserve` : `/${id}`
  if (action === 'queue')    return allowed('queue')    ? `/${id}?action=queue` : `/${id}`
  if (action === 'repair')   return allowed('repair')   ? `/${id}?action=repair` : `/${id}`
  if (action === 'purchase') return allowed('purchase') ? `/${id}?action=purchase` : `/${id}`
  return `/${id}`
}

export default function LineHomePage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'select' | 'not_registered' | 'error'>('loading')
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
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

  // 30秒ごとに受付状況を自動更新（店一覧表示中のみ）
  useEffect(() => {
    if (status !== 'select') return
    const id = setInterval(refreshStatus, 30000)
    return () => clearInterval(id)
  }, [status, refreshStatus])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const run = async () => {
      try {
        const liff = await initLiff('uniform')
        if (!liff) { setStatus('error'); return }

        if (!liff.isInClient()) {
          window.location.href = '/open-in-line'
          return
        }

        if (!liff.isLoggedIn()) { liff.login(); return }

        const profile = await getLineProfile()
        if (!profile) { setStatus('error'); return }
        userIdRef.current = profile.userId

        // ── パラメータ解決 ──────────────────────────────
        // 初回ロードでは action/to が liff.state の中にしか入っていない
        // （LIFF SDK が liff.state のパスへ置き換える前に本処理が走るため、
        //  URL直下と liff.state の両方から読む。これをしないと初回だけ
        //  action なしで誤ルーティングし、SDKの再遷移と競合して
        //  余計なリロード・不安定な遷移が起きる）
        const search = new URLSearchParams(window.location.search)
        const rawState = search.get('liff.state')
        const decodedState = (() => {
          if (!rawState) return null
          try { return rawState.includes('%') ? decodeURIComponent(rawState) : rawState } catch { return rawState }
        })()
        const stateParams = decodedState
          ? new URLSearchParams(decodedState.split('?')[1] ?? '')
          : null
        const getParam = (k: string) => search.get(k) ?? stateParams?.get(k) ?? null

        const urlAction = getParam('action')
        setAction(urlAction)
        actionRef.current = urlAction

        // QRコード由来の店舗指定: ?to=/{uuid}（middleware変換後）
        // または liff.state が /{uuid} 直パスの場合（endpoint設定によってはこちら）
        let toParam = getParam('to')
        if (!toParam && decodedState) {
          const m = decodedState.match(/^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
          if (m) toParam = `/${m[1]}`
        }
        const toStoreId = toParam ? toParam.replace(/^\//, '').split('/')[0] : null

        const res = await fetch(`/api/line-store-lookup?userId=${encodeURIComponent(profile.userId)}&t=${Date.now()}`)
        const { stores: found } = await res.json() as { stores: StoreInfo[] }

        // ?debug=1: リダイレクトせず必ず選択画面（userId・登録店舗の確認用）
        if (getParam('debug') === '1') {
          setDebugInfo(`userId: ${profile.userId} / 登録店舗: ${(found ?? []).map(s => s.name).join(', ') || 'なし'}`)
          setStores(found ?? [])
          setStatus(found && found.length > 0 ? 'select' : 'not_registered')
          return
        }

        // ── ルーティング（優先順位は固定・決定的）────────
        // 1. QR経由（toStoreIdあり）: スキャンした店舗を最優先。
        //    その店舗に登録済みならそのまま入店、未登録なら会員登録へ。
        if (toStoreId) {
          const matched = (found ?? []).find(s => s.id === toStoreId)
          if (matched) {
            router.replace(buildStoreUrl(matched, urlAction))
          } else {
            router.replace(`/${toStoreId}/crm-register`)
          }
          return
        }

        // 2. どこにも未登録: 登録を促す案内
        if (!found || found.length === 0) {
          setStatus('not_registered')
          return
        }

        // 3. 1店舗のみ登録: その店舗へ直行（店舗の機能フラグでaction可否を判定）
        if (found.length === 1) {
          router.replace(buildStoreUrl(found[0], urlAction))
          return
        }

        // 4. 複数店舗登録: 必ず選択画面（勝手にどれかへ飛ばさない）
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
            {debugInfo && (
              <div className="mb-3 p-2 bg-yellow-900/40 border border-yellow-600/40 rounded-xl text-yellow-300 text-xs break-all">{debugInfo}</div>
            )}
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
                      onClick={() => router.push(buildStoreUrl(s, action))}
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
                      onClick={() => router.push(buildStoreUrl(s, action))}
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
