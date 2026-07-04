import crypto from 'crypto'
import { safeEqual } from '@/lib/auth/safeEqual'

/**
 * LINE webhook の署名検証（fail-close）。
 * secret 未設定・署名なしは「検証スキップ」ではなく必ず拒否する。
 * env の設定漏れが無検証の受け入れに化けるのを防ぐ。
 */
export function verifyLineSignature(body: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return safeEqual(expected, signature)
}
