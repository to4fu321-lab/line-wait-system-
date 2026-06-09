import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // Prevent length-based timing leak: always run comparison, return false if lengths differ
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
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

  // 1. x-admin-secret header
  const headerVal = req.headers.get('x-admin-secret') ?? ''
  if (headerVal && safeEqual(headerVal, secret)) return null

  // 2. HttpOnly session cookie (set by /api/super-admin/auth on PIN login)
  const cookie = req.headers.get('cookie') ?? ''
  const sessionVal =
    cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('super_admin_session='))
      ?.slice('super_admin_session='.length) ?? ''
  if (sessionVal && safeEqual(sessionVal, secret)) return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
