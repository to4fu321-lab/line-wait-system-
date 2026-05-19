'use client'

import type { Liff } from '@line/liff'

let liffInstance: Liff | null = null
let initPromise: Promise<Liff | null> | null = null

export interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
}

/**
 * LIFFを初期化する（多重初期化防止つき）
 * LIFF_IDが設定されていない場合・初期化失敗時は null を返す（システムは継続動作）
 */
export async function initLiff(): Promise<Liff | null> {
  if (typeof window === 'undefined') return null
  if (liffInstance) return liffInstance
  if (initPromise) return initPromise

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) {
    console.warn('[LIFF] NEXT_PUBLIC_LIFF_ID is not set — LIFF disabled')
    return null
  }

  initPromise = (async () => {
    try {
      const liffModule = await import('@line/liff')
      const liff = liffModule.default
      await liff.init({ liffId })
      liffInstance = liff
      return liff
    } catch (e) {
      console.error('[LIFF] init failed:', e)
      return null
    }
  })()

  return initPromise
}

/**
 * LINEプロフィール（userId含む）を取得
 * LINE未ログイン時は自動でログイン誘導
 */
export async function getLineProfile(): Promise<LiffProfile | null> {
  const liff = await initLiff()
  if (!liff) return null

  try {
    if (!liff.isLoggedIn()) {
      // 外部ブラウザでは LINE Login にリダイレクトされる
      // LINE内ブラウザでは自動的にログイン済み
      liff.login({ redirectUri: window.location.href })
      return null
    }

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

/** LINE内ブラウザで開かれているか */
export function isInLineApp(): boolean {
  if (!liffInstance) return false
  try {
    return liffInstance.isInClient()
  } catch {
    return false
  }
}
