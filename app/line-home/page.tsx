'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Loader2, QrCode, Store, ChevronRight, ChevronLeft,
  ShoppingBag, RefreshCw, Clock, AlertCircle,
} from 'lucide-react'

// ── 型定義 ───────────────────────────────────────────────────
type FeatureStatus = 'available' | 'paused' | 'unavailable'

interface StoreInfo {
  id:            string
  name:          string
  is_open:       boolean
  business_type: string
  type:          'uniform' | 'takeout'
  features:      Record<string, FeatureStatus>
}

// ── アクション設定 ───────────────────────────────────────────
// rich menu の ?action= パラメータと画面・機能を対応付ける
// inquiry/size/access は情報系（機能チェック不要 → 常にメインページへ）
const ACTION_META: Record<string, {
  label:    string
  emoji:    string
  buildUrl: (id: string) => string
}> = {
  queue:    { label: '採寸・順番待ち',   emoji: '🎓', buildUrl: id => `/${id}` },
  reserve:  { label: '来店予約',         emoji: '📅', buildUrl: id => `/${id}/reserve` },
  repair:   { label: 'お直し依頼',       emoji: '✂️', buildUrl: id => `/${id}/repair` },
  order:    { label: 'テイクアウト注文', emoji: '🥡', buildUrl: id => `/${id}/order` },
  purchase: { label: 'ネット注文',       emoji: '🛒', buildUrl: id => `/${id}/order` },
  inquiry:  { label: 'お問い合わせ',     emoji: '💬', buildUrl: id => `/${id}` },
  size:     { label: 'サイズガイド',     emoji: '📏', buildUrl: id => `/${id}` },
  access:   { label: 'アクセス',         emoji: '📍', buildUrl: id => `/${id}` },
}

// ── ページ状態 ───────────────────────────────────────────────
type PageState =
  | { kind: 'loading' }
  | { kind: 'not_registered' }
  | { kind: 'error' }
  | { kind: 'select'; stores: StoreInfo[]; action: string | null; refreshing: boolean }
  | { kind: 'guidance'; store: StoreInfo; requestedAction: string; featureStatus: 'paused' | 'unavailable'; canGoBack: boolean }

// ── ヘルパー ─────────────────────────────────────────────────

// 代替として案内できるアクションを抽出（available のもののみ）
function getAlternatives(store: StoreInfo, excludeAction: string): string[] {
  return Object.keys(ACTION_META).filter(
    act => act !== excludeAction && store.features[act] === 'available'
  )
}

// 指定アクションへ遷移
function navigateToStore(store: StoreInfo, action: string | null) {
  if (!action) {
    window.location.href = store.business_type === 'takeout' ? `/${store.id}/order` : `/${store.id}`
    return
  }
  const meta = ACTION_META[action]
  window.location.href = meta ? meta.buildUrl(store.id) : `/${store.id}`
}

// アクションの可否チェック。案内が必要な場合は理由を返す
function checkFeature(
  store: StoreInfo,
  action: string | null,
): { guided: false } | { guided: true; featureStatus: 'paused' | 'unavailable' } {
  if (!action || !(action in ACTION_META)) return { guided: false }
  const status = store.features[action]
  if (!status || status === 'available') return { guided: false }
  return { guided: true, featureStatus: status as 'paused' | 'unavailable' }
}

// ── メインコンポーネント ──────────────────────────────────────
export default function LineHomePage() {
  const [state, setState]     = useState<PageState>({ kind: 'loading' })
  const [debugInfo, setDebug] = useState<string | null>(null)

  // ref はコールバック間で共有する値（re-render を起こさない）
  const userIdRef       = useRef<string | null>(null)
  const actionRef       = useRef<string | null>(null)
  const storesRef       = useRef<StoreInfo[]>([])
  const initializedRef  = useRef(false)

  // ── 店舗一覧の受付状況を再取得（select 画面での更新用）
  const refreshStores = useCallback(async () => {
    if (!userIdRef.current) return
    setState(prev => prev.kind === 'select' ? { ...prev, refreshing: true } : prev)
    try {
      const res = await fetch(
        `/api/line-store-lookup?userId=${encodeURIComponent(userIdRef.current!)}&t=${Date.now()}`
      )
      const { stores: found } = await res.json()
      if (Array.isArray(found) && found.length > 0) {
        storesRef.current = found
        setState(prev =>
          prev.kind === 'select' ? { ...prev, stores: found, refreshing: false } : prev
        )
      } else {
        setState(prev => prev.kind === 'select' ? { ...prev, refreshing: false } : prev)
      }
    } catch {
      setState(prev => prev.kind === 'select' ? { ...prev, refreshing: false } : prev)
    }
  }, [])

  // LINEアプリから戻ってきたとき（visibilitychange）に自動更新
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && userIdRef.current) {
        refreshStores()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshStores])

  // select 画面表示中は30秒ごとにポーリング
  useEffect(() => {
    if (state.kind !== 'select') return
    const id = setInterval(refreshStores, 30_000)
    return () => clearInterval(id)
  }, [state.kind, refreshStores])

  // ── 初期化（LIFF init → store lookup → ルーティング判定）
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    ;(async () => {
      try {
        const liff = (await import('@line/liff')).default
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_UNIFORM || process.env.NEXT_PUBLIC_LIFF_ID || ''
        await liff.init({ liffId })

        // LINE アプリ外からのアクセスは案内ページへ
        if (!liff.isInClient()) {
          window.location.href = '/open-in-line'
          return
        }
        if (!liff.isLoggedIn()) { liff.login(); return }

        const profile = await liff.getProfile()
        userIdRef.current = profile.userId

        const sp = new URLSearchParams(window.location.search)
        // action は通常トップレベルのクエリにあるが、LIFFエンドポイントの設定によっては
        // liff.state の中に埋もれて届く場合がある。両方を見て確実に拾う。
        let urlAction = sp.get('action')
        if (!urlAction) {
          const ls = sp.get('liff.state')
          if (ls) {
            const m = decodeURIComponent(ls).match(/[?&]action=([^&]+)/)
            if (m) urlAction = decodeURIComponent(m[1])
          }
        }
        actionRef.current = urlAction

        const res = await fetch(
          `/api/line-store-lookup?userId=${encodeURIComponent(profile.userId)}&t=${Date.now()}`
        )
        const { stores: found } = await res.json()

        if (!Array.isArray(found) || found.length === 0) {
          setState({ kind: 'not_registered' })
          return
        }

        storesRef.current = found

        // デバッグモード: ?debug=1 → 常に選択画面
        if (sp.get('debug') === '1') {
          setDebug(`userId: ${profile.userId} / 登録店舗: ${found.map((s: StoreInfo) => s.name).join(', ')}`)
          setState({ kind: 'select', stores: found, action: urlAction, refreshing: false })
          return
        }

        // 1店舗 → アクション可否チェックして直接遷移 or 案内
        if (found.length === 1) {
          const check = checkFeature(found[0], urlAction)
          if (check.guided) {
            setState({
              kind: 'guidance',
              store: found[0],
              requestedAction: urlAction!,
              featureStatus: check.featureStatus,
              canGoBack: false,
            })
          } else {
            navigateToStore(found[0], urlAction)
          }
          return
        }

        // 複数店舗 → 選択画面
        setState({ kind: 'select', stores: found, action: urlAction, refreshing: false })

      } catch {
        setState({ kind: 'error' })
      }
    })()
  }, [])

  // ── ストアボタンタップ（select → navigate or guidance）
  function handleSelectStore(store: StoreInfo) {
    const action = actionRef.current
    const check  = checkFeature(store, action)
    if (check.guided) {
      setState({
        kind: 'guidance',
        store,
        requestedAction: action!,
        featureStatus: check.featureStatus,
        canGoBack: storesRef.current.length > 1,
      })
    } else {
      navigateToStore(store, action)
    }
  }

  // ── 案内画面 → 店舗選択に戻る
  function handleBack() {
    setState({
      kind: 'select',
      stores: storesRef.current,
      action: actionRef.current,
      refreshing: false,
    })
  }

  // ── 描画 ──────────────────────────────────────────────────

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (state.kind === 'not_registered') {
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

  if (state.kind === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle size={36} className="text-zinc-500 mb-4" />
        <p className="text-zinc-300 text-sm mb-6">通信エラーが発生しました</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-transform"
        >
          再試行
        </button>
      </div>
    )
  }

  if (state.kind === 'guidance') {
    return (
      <GuidanceScreen
        state={state}
        onBack={state.canGoBack ? handleBack : undefined}
        onNavigate={(store, act) => navigateToStore(store, act)}
      />
    )
  }

  // kind === 'select'
  const { stores, action, refreshing } = state
  const uniformStores = stores.filter(s => s.type === 'uniform')
  const takeoutStores = stores.filter(s => s.type === 'takeout')

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {debugInfo && (
          <div className="mb-3 p-2 bg-yellow-900/40 border border-yellow-600/40 rounded-xl text-yellow-300 text-xs break-all">
            {debugInfo}
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
            <Store size={28} className="text-indigo-400" />
          </div>
          {action && ACTION_META[action] && (
            <div className="inline-block bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full mb-3">
              {ACTION_META[action].emoji} {ACTION_META[action].label}
            </div>
          )}
          <h1 className="text-xl font-black text-white">ご利用の店舗を選択</h1>
          <p className="text-zinc-500 text-sm mt-1">どちらをご利用ですか？</p>
          <button
            onClick={refreshStores}
            disabled={refreshing}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-700 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '更新中...' : '受付状況を更新'}
          </button>
        </div>

        <div className="space-y-6">
          {uniformStores.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2 px-1">
                🏫 制服・採寸
              </p>
              <div className="space-y-2">
                {uniformStores.map(s => (
                  <StoreButton
                    key={s.id}
                    store={s}
                    action={action}
                    onClick={() => handleSelectStore(s)}
                  />
                ))}
              </div>
            </div>
          )}
          {takeoutStores.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2 px-1">
                🥡 テイクアウト
              </p>
              <div className="space-y-2">
                {takeoutStores.map(s => (
                  <StoreButton
                    key={s.id}
                    store={s}
                    action={action}
                    onClick={() => handleSelectStore(s)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── StoreButton ───────────────────────────────────────────────
// アクション指定ありの場合は機能ステータス、なしは is_open を表示
function StoreButton({
  store,
  action,
  onClick,
}: {
  store:   StoreInfo
  action:  string | null
  onClick: () => void
}) {
  const isTakeout = store.type === 'takeout'
  const featureStatus: FeatureStatus | null = action ? (store.features[action] ?? null) : null

  let statusLabel: string
  let statusClass: string
  if (!featureStatus) {
    statusLabel = store.is_open ? '受付中' : '受付停止中'
    statusClass = store.is_open ? 'text-emerald-400' : 'text-zinc-500'
  } else if (featureStatus === 'available') {
    statusLabel = '受付中'
    statusClass = 'text-emerald-400'
  } else if (featureStatus === 'paused') {
    statusLabel = '受付停止中'
    statusClass = 'text-zinc-500'
  } else {
    statusLabel = '非対応'
    statusClass = 'text-zinc-600'
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left ${
        isTakeout ? 'hover:border-orange-500/40' : 'hover:border-indigo-500/40'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        isTakeout
          ? 'bg-orange-500/20 border border-orange-500/30'
          : 'bg-indigo-500/20 border border-indigo-500/30'
      }`}>
        {isTakeout
          ? <ShoppingBag size={18} className="text-orange-400" />
          : <Store size={18} className="text-indigo-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-base font-bold truncate">{store.name}</p>
        <p className={`text-xs font-bold mt-0.5 ${statusClass}`}>{statusLabel}</p>
      </div>
      <ChevronRight size={16} className="text-zinc-600 shrink-0" />
    </button>
  )
}

// ── GuidanceScreen ────────────────────────────────────────────
// 4パターンの案内画面：
//   paused + 代替あり    → 一時停止中 + 使える機能を提示
//   paused + 代替なし    → 一時停止中 + 全停止案内
//   unavailable + 代替あり → 非搭載 + 使える機能を提示
//   unavailable + 代替なし → 非搭載 + 全停止案内
function GuidanceScreen({
  state,
  onBack,
  onNavigate,
}: {
  state:      Extract<PageState, { kind: 'guidance' }>
  onBack?:    () => void
  onNavigate: (store: StoreInfo, action: string) => void
}) {
  const { store, requestedAction, featureStatus } = state
  const requestedMeta = ACTION_META[requestedAction]
  const alternatives  = getAlternatives(store, requestedAction)
  const isPaused      = featureStatus === 'paused'

  const title = isPaused
    ? `${requestedMeta?.label ?? requestedAction}は\n現在受付停止中です`
    : `この店舗では${requestedMeta?.label ?? requestedAction}を\nご利用いただけません`

  const subtitle = isPaused
    ? '営業時間外または受付を手動で停止しています。'
    : 'この機能は現在ご利用いただけません。'

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* 戻るボタン（複数店舗から来た場合のみ表示）*/}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-zinc-400 text-sm mb-6 -ml-1 active:opacity-70"
          >
            <ChevronLeft size={18} />
            店舗選択に戻る
          </button>
        )}

        {/* ステータスバナー */}
        <div className="bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 mb-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
            {isPaused
              ? <Clock size={26} className="text-zinc-400" />
              : <AlertCircle size={26} className="text-zinc-400" />
            }
          </div>
          {requestedMeta && (
            <p className="text-3xl mb-2">{requestedMeta.emoji}</p>
          )}
          <p className="text-white font-black text-lg mb-2 whitespace-pre-line leading-snug">
            {title}
          </p>
          <p className="text-zinc-400 text-sm">{subtitle}</p>
          <p className="text-zinc-600 text-xs font-bold mt-3">{store.name}</p>
        </div>

        {/* 代替機能ボタン or 全停止メッセージ */}
        {alternatives.length > 0 ? (
          <div>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-3 px-1">
              引き続きご利用いただける機能
            </p>
            <div className="space-y-2">
              {alternatives.map(act => {
                const meta = ACTION_META[act]
                return (
                  <button
                    key={act}
                    onClick={() => onNavigate(store, act)}
                    className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40 active:scale-95 transition-all rounded-2xl px-5 py-4 text-left"
                  >
                    <span className="text-2xl w-10 text-center shrink-0">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold">{meta.label}</p>
                      <p className="text-emerald-400 text-xs font-bold mt-0.5">受付中</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-center">
            <p className="text-zinc-400 text-sm leading-relaxed">
              現在、オンラインでのご受付を<br />
              すべて停止しています。
            </p>
            <p className="text-zinc-500 text-xs mt-3 leading-relaxed">
              再開時にLINEでお知らせします。<br />
              しばらく時間をおいてからお試しください。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
