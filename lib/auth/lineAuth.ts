import { getLiffId } from '@/lib/line-config'

/**
 * LIFF アクセストークンのサーバー側検証。
 *
 * 顧客導線の API ルートは「LINEユーザー本人であること」をこれで確認する。
 * クライアントが自称する userId は信用せず、必ずトークンから導出すること。
 */
export interface VerifiedLineUser {
  userId: string
  displayName: string | null
}

/** 自アプリの LIFF ID(=チャネルID プレフィックス)から許可チャネル一覧を作る */
function allowedChannelIds(): Set<string> {
  const ids = new Set<string>()
  for (const biz of ['uniform', 'takeout'] as const) {
    const channelId = getLiffId(biz).split('-')[0]
    if (channelId) ids.add(channelId)
  }
  return ids
}

export async function verifyLineAccessToken(accessToken: string | null | undefined): Promise<VerifiedLineUser | null> {
  if (!accessToken || typeof accessToken !== 'string') return null
  try {
    // 1. トークンの正当性 + 発行チャネルの確認
    const vRes = await fetch(
      `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
      { cache: 'no-store' },
    )
    if (!vRes.ok) return null
    const v = (await vRes.json()) as { client_id?: string; expires_in?: number }
    if ((v.expires_in ?? 0) <= 0) return null
    const allowed = allowedChannelIds()
    if (allowed.size > 0 && !allowed.has(String(v.client_id))) return null

    // 2. プロフィール取得(userId はここから導出)
    const pRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!pRes.ok) return null
    const p = (await pRes.json()) as { userId?: string; displayName?: string }
    if (!p.userId) return null
    return { userId: p.userId, displayName: p.displayName ?? null }
  } catch (e) {
    console.error('[lineAuth] verify failed:', e)
    return null
  }
}
