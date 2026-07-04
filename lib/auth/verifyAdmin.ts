import { NextResponse } from 'next/server'
import { safeEqual } from '@/lib/auth/safeEqual'

/**
 * super-admin シークレットを持っているか（ヘッダー or HttpOnly cookie）。
 * 認可の必須条件ではなく「super-admin なら通す」の判定に使う。
 */
export function hasSuperAdminSession(req: Request): boolean {
  const secret = process.env.SUPER_ADMIN_SECRET
  if (!secret) return false

  const headerVal = req.headers.get('x-admin-secret') ?? ''
  if (headerVal && safeEqual(headerVal, secret)) return true

  const cookie = req.headers.get('cookie') ?? ''
  const sessionVal =
    cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('super_admin_session='))
      ?.slice('super_admin_session='.length) ?? ''
  return !!sessionVal && safeEqual(sessionVal, secret)
}

/**
 * Verifies that the request carries a valid super-admin secret.
 * Accepts either:
 *   - `x-admin-secret` request header  (programmatic / curl access)
 *   - `super_admin_session` HttpOnly cookie  (browser session set by /api/super-admin/auth)
 *
 * Returns null if authorized, or a 401/500 NextResponse if not.
 * NEVER attach SUPER_ADMIN_SECRET to any NEXT_PUBLIC_ variable.
 */
export function assertSuperAdmin(req: Request): NextResponse | null {
  const secret = process.env.SUPER_ADMIN_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'SUPER_ADMIN_SECRET is not configured on the server' },
      { status: 500 },
    )
  }

  if (hasSuperAdminSession(req)) return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
