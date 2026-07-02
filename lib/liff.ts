'use client'

import type { Liff } from '@line/liff'
import { getLiffId, type BizType } from './line-config'

let liffInstance: Liff | null = null
let initPromise: Promise<Liff | null> | null = null

export interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
}

/**
 * LIFFを初期化する（多重初期化防止・リダイレクトループ防止つき）
 *
 * biz を明示しないと 'uniform' のIDで初期化される。/line-home や
 * richmenu 生成側と異なるLIFF IDになると、同じLINEユーザーでも
 * userId が一致せず「登録したのに見つからない/別店舗に飛ぶ」原因になるため、
 * 呼び出し元の業態に合わせて必ず biz を渡すこと。
 */
export async function initLiff(biz: BizType = 'uniform'): Promise<Liff | null> {
  if (typeof window === 'undefined') return null
  if (liffInstance) return liffInstance
  if (initPromise) return initPromise

  // LIFF認証コールバック（liff.state またはフラグメントのトークン類がある）はガード不要
  const isLiffCallback = window.location.search.includes('liff.state') ||
                         window.location.hash.includes('liff.state') ||
                         window.location.hash.includes('access_token') ||
                         window.location.search.includes('liffClientId')

  if (!isLiffCallback) {
    // リダイレクトループ検出: 直近2秒以内に既にLIFF initしていたらスキップ
    const lastInit = localStorage.getItem('liff_init_ts')
    const now = Date.now()
    if (lastInit && now - parseInt(lastInit) < 2000) {
      console.warn('[LIFF] init too fast — possible redirect loop, skipping')
      return null
    }
    localStorage.setItem('liff_init_ts', String(now))
  }

  const liffId = getLiffId(biz)

  initPromise = (async () => {
    try {
      const liffModule = await import('@line/liff')
      const liff = liffModule.default
      await liff.init({ liffId, withLoginOnExternalBrowser: false })
      liffInstance = liff
      localStorage.removeItem('liff_init_ts') // 正常完了 → ガード解除
      return liff
    } catch (e) {
      console.error('[LIFF] init failed:', e)
      initPromise = null
      localStorage.removeItem('liff_init_ts') // 失敗時もガード解除して再試行可能にする
      return null
    }
  })()

  return initPromise
}

/**
 * LINEプロフィール（userId含む）を取得
 */
export async function getLineProfile(): Promise<LiffProfile | null> {
  const liff = await initLiff()
  if (!liff) return null

  try {
    if (!liff.isLoggedIn()) return null

    const profile = await liff.getProfile()
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    }
  } catch (e) {
    console.error('[LIFF] getProfile failed:', e)
    return null
  }
}

/** LINE内ブラウザ（LIFFクライアント含む）で開かれているか */
export function isInLineApp(): boolean {
  if (liffInstance) {
    try { return liffInstance.isInClient() } catch { /* fall through */ }
  }
  if (typeof navigator !== 'undefined') {
    return /\bLine\b/i.test(navigator.userAgent)
  }
  return false
}

/**
 * LIFFのFriendship APIで友達チェック（最も信頼性が高い）
 * LIFF外では null を返す（スキップ）
 */
export async function checkFriendshipLiff(): Promise<boolean | null> {
  const liff = await initLiff()
  if (!liff || !liff.isLoggedIn()) return null
  if (!liff.isInClient()) return null // LIFF外ではgetFriendship不可
  try {
    const { friendFlag } = await liff.getFriendship()
    return friendFlag
  } catch (e) {
    console.warn('[LIFF] getFriendship failed:', e)
    return null
  }
}

/** 友達追加ページを開く */
export function openAddFriend(lineBasicId: string) {
  const id = lineBasicId.startsWith('@') ? lineBasicId : `@${lineBasicId}`
  const url = `https://line.me/R/ti/p/${id}`
  if (liffInstance?.isInClient()) {
    liffInstance.openWindow({ url, external: true })
  } else {
    window.open(url, '_blank')
  }
}
