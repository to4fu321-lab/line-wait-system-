'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, QrCode, Store, ChevronRight, ShoppingBag, Ban, Clock } from 'lucide-react'
import { initLiff, getLineProfile } from '@/lib/liff'

type StoreType = 'uniform' | 'takeout'
// caps: /api/line-store-lookup が resolveFeature で算出した顧客向け機能可否。
// 旧レスポンス（capsなし）でも動くよう optional にし、未取得時は許可扱い。
interface StoreCaps { queue: boolean; reserve: boolean; repair: boolean; purchase: boolean }
interface StoreInfo { id: string; name: string; is_open: boolean; type: StoreType; caps?: StoreCaps }

const ACTION_LABELS: Record<string, string> = {
  order:    'テイクアウト注文',
  queue:    '採寸・受付',
  reserve:  '来店予約',
  repair:   'お直し依頼',
  purchase: 'ネット注文',
}

// action ごとの利用可否判定。
// - not_offered: 店舗の機能フラグ（プラン）でOFF → 「取り扱いがありません」
// - paused:      機能はあるが一時停止中（受付停止など） → 「現在一時停止中です」
type Availability =
  | { ok: true; url: string }
  | { ok: false; reason: 'not_offered' | 'paused' }

function checkAvailability(store: StoreInfo, action: string | null): Availability {
  const { id, type, caps, is_open } = store
  const allowed = (k: keyof StoreCaps) => !caps || caps[k]

  if (type === 'takeout') {
    // テイクアウト店: 注文は受付状態に従う。それ以外のactionは注文ページへ集約
    if (!is_open && (action === 'order' || !action)) return { ok: false, reason: 'paused' }
    return { ok: true, url: `/${id}/order` }
  }

  switch (action) {
    case 'order':
      // 制服店にテイクアウト注文は無い
      return { ok: false, reason: 'not_offered' }
    case 'queue':
      if (!allowed('queue')) return { ok: false, reason: 'not_offered' }
      if (!is_open)          return { ok: false, reason: 'paused' }
      return { ok: true, url: `/${id}?action=queue` }
    case 'reserve':
      if (!allowed('reserve')) return { ok: false, reason: 'not_offered' }
      return { ok: true, url: `/${id}/reserve` }
    case 'repair':
      if (!allowed('repair')) return { ok: false, reason: 'not_offered' }
      return { ok: true, url: `/${id}?action=repair` }
    case 'purchase':
      if (!allowed('purchase')) return { ok: false, reason: 'not_offered' }
      return { ok: true, url: `/${id}?action=purchase` }
    default:
      return { ok: true, url: `/${id}` }
  }
}

interface UnavailableInfo {
  store: StoreInfo
  actionLabel: string
  reason: 'not_offered' | 'paused'
  canGoBack: boolean  // 複数店舗登録時は店舗選択に戻れる
}

export default function LineHomePage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'select' | 'not_registered' | 'unavailable' | 'error'>('loading')
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [action, setAction] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<UnavailableInfo | null>(null)
  const initializedRef = useRef(false)

  // 行き先を判定して遷移 or 利用不可画面を表示
  const goToStore = (store: StoreInfo, act: string | null, opts: { replace?: boolean; canGoBack?: boolean }) => {
    const avail = checkAvailability(store, act)
    if (avail.ok) {
      if (opts.replace) router.replace(avail.url)
      else router.push(avail.url)
      return
    }
    setUnavailable({
      store,
      actionLabel: (act && ACTION_LABELS[act]) || 'このサービス',
      reason: avail.reason,
      canGoBack: !!opts.canGoBack,
    })
    setStatus('unavailable')
  }

  // LINEアプリ内ブラウザは戻る/再表示で bfcache から古い描画を復元する。
  // 会員削除後も古い店舗一覧が残る問題を防ぐため、bfcache復元時は再読込。
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const run = async () => {
      try {
        // ── パラメータ解決（LIFF init より先に行う）────────────
        // リッチメニュー経由の初回ロードでは action/to が liff.state の
        // 中にしか入っていない。liff.state を残したまま liff.init すると
        // SDK が liff.state のパスへ location.replace してページ全体が
        // もう一度読み込まれる（＝体感の「何回もリロード」の正体）。
        // ここで自前で解決して URL から liff.state を除去することで、
        // SDK の二次リダイレクトを起こさず1回のロードで完結させる。
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

        // QRコード由来の店舗指定: ?to=/{uuid}（middleware変換後）
        // または liff.state が /{uuid} 直パスの場合（endpoint設定によってはこちら）
        let toParam = getParam('to')
        if (!toParam && decodedState) {
          const m = decodedState.match(/^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
          if (m) toParam = `/${m[1]}`
        }
        const toStoreId = toParam ? toParam.replace(/^\//, '').split('/')[0] : null
        const isDebug = getParam('debug') === '1'

        // URLを正規化: liff.state を取り除き、解決済みの action/to を明示。
        // OAuth 完了に必要な code/state と、LIFF がトークンを渡してくる
        // URLフラグメント（#access_token=... 等）は必ず残す。
        // ※フラグメントを消すと liff.init が認証情報を受け取れず
        //   「読み込みエラー」になるため絶対に保持すること。
        if (rawState) {
          const clean = new URLSearchParams()
          for (const k of ['code', 'state', 'liffClientId', 'liffRedirectUri', 'error', 'error_description']) {
            const v = search.get(k)
            if (v) clean.set(k, v)
          }
          if (urlAction) clean.set('action', urlAction)
          if (toParam)   clean.set('to', toParam)
          if (isDebug)   clean.set('debug', '1')
          const qs = clean.toString()
          window.history.replaceState(null, '', `/line-home${qs ? `?${qs}` : ''}${window.location.hash || ''}`)
        }

        const liff = await initLiff('uniform')
        if (!liff) { setStatus('error'); return }

        if (!liff.isInClient()) {
          window.location.href = '/open-in-line'
          return
        }

        if (!liff.isLoggedIn()) {
          // redirectUri にフラグメントを含めない（LINE認可後の戻りが壊れるため）
          liff.login({ redirectUri: `${window.location.origin}${window.location.pathname}${window.location.search}` })
          return
        }

        const profile = await getLineProfile()
        if (!profile) { setStatus('error'); return }

        const res = await fetch(`/api/line-store-lookup?userId=${encodeURIComponent(profile.userId)}&t=${Date.now()}`)
        const { stores: found } = await res.json() as { stores: StoreInfo[] }

        // ?debug=1: リダイレクトせず必ず選択画面（userId・登録店舗の確認用）
        if (isDebug) {
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
            goToStore(matched, urlAction, { replace: true })
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

        // 3. 1店舗のみ登録: その店舗へ直行（機能フラグ・受付状態で可否判定）
        if (found.length === 1) {
          setStores(found)
          goToStore(found[0], urlAction, { replace: true })
          return
        }

        // 4. 複数店舗登録: 必ず選択画面（勝手にどれかへ飛ばさない）
        setStores(found)
        setStatus('select')
        // 遷移を速くするため、候補の店舗ページを事前読み込み
        for (const s of found) {
          const avail = checkAvailability(s, urlAction)
          if (avail.ok) router.prefetch(avail.url)
        }
      } catch {
        setStatus('error')
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  // ── 利用不可（機能なし / 一時停止中）───────────────────────
  if (status === 'unavailable' && unavailable) {
    const { store, actionLabel, reason, canGoBack } = unavailable
    const isPaused = reason === 'paused'
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <div className={`w-20 h-20 rounded-3xl border flex items-center justify-center mx-auto mb-6 ${
          isPaused ? 'bg-amber-500/15 border-amber-500/30' : 'bg-zinc-500/15 border-zinc-500/30'}`}>
          {isPaused ? <Clock size={36} className="text-amber-400" /> : <Ban size={36} className="text-zinc-400" />}
        </div>
        <p className="text-zinc-500 text-xs font-bold mb-1">{store.name}</p>
        <h1 className="text-xl font-black text-white mb-3">
          {isPaused
            ? <>{actionLabel}は<br />現在一時停止中です</>
            : <>{actionLabel}の<br />お取り扱いはありません</>}
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          {isPaused
            ? '受付が再開されるまでお待ちください。\nその他のサービスは店舗ページからご利用いただけます。'
            : 'こちらの店舗ではご利用いただけないサービスです。\nその他のサービスは店舗ページからご利用いただけます。'}
        </p>
        <div className="w-full max-w-xs space-y-3">
          <button onClick={() => router.push(`/${store.id}`)}
            className="w-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold py-3.5 rounded-2xl active:scale-95 transition-all">
            {store.name} のページを開く
          </button>
          {canGoBack && (
            <button onClick={() => { setUnavailable(null); setStatus('select') }}
              className="w-full text-zinc-500 text-sm py-2 active:opacity-60 transition-opacity">
              ← 店舗選択に戻る
            </button>
          )}
        </div>
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
          </div>

          <div className="space-y-6">
            {/* 制服店 */}
            {uniformStores.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2 px-1">🏫 制服・採寸</p>
                <div className="space-y-2">
                  {uniformStores.map(s => (
                    <button key={s.id}
                      onClick={() => goToStore(s, action, { canGoBack: true })}
                      className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <Store size={18} className="text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-base font-bold truncate">{s.name}</p>
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
                      onClick={() => goToStore(s, action, { canGoBack: true })}
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
