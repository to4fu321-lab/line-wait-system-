// ============================================================
// 簡易レートリミッタ（サーバーAPI用）
//
// 外部から storeId だけで叩ける公開API（整理券発行・LINE通知など）の
// 乱用を抑えるための軽量ガード。インメモリ方式のため、サーバーレスの
// インスタンスごとに独立してカウントされる=完全な保証ではないが、
// 単純なスクリプトによる連打・通知枠の浪費は実用上防げる。
// 厳密な制限が必要になったら Upstash Redis 等の外部ストアに置き換える。
// ============================================================

interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// メモリリーク防止: 定期的に期限切れバケットを掃除
let lastSweep = Date.now()
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  buckets.forEach((b, k) => { if (b.resetAt <= now) buckets.delete(k) })
}

/**
 * key ごとに windowMs あたり limit 回まで許可する。
 * 超過した場合 false（=拒否すべき）を返す。
 *
 * 例: if (!rateLimit(`queue-issue:${storeId}`, 20, 60_000)) return 429
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  sweep(now)
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count++
  return b.count <= limit
}

/** 429レスポンス用の共通ボディ */
export const RATE_LIMITED_BODY = { error: 'アクセスが集中しています。しばらくしてからお試しください' }
