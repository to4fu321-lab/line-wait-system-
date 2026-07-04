export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { safeEqual } from '@/lib/auth/safeEqual'

/**
 * POST /api/super-admin/auth
 * Body: { pin: string }
 *
 * Verifies the PIN server-side against SUPER_ADMIN_PIN (non-public env var).
 * On success, sets an HttpOnly cookie containing SUPER_ADMIN_SECRET so that
 * subsequent requests to /api/super-admin/* are authenticated automatically.
 * The client never sees SUPER_ADMIN_SECRET or SUPER_ADMIN_PIN.
 */
export async function POST(req: Request) {
  try {
    const { pin } = await req.json()
    const correctPin = process.env.SUPER_ADMIN_PIN
    const secret     = process.env.SUPER_ADMIN_SECRET

    if (!correctPin || !secret) {
      return NextResponse.json(
        { error: 'SUPER_ADMIN_PIN または SUPER_ADMIN_SECRET が未設定です' },
        { status: 500 },
      )
    }

    if (!pin || !safeEqual(String(pin), correctPin)) {
      return NextResponse.json({ error: 'PINが違います' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('super_admin_session', secret, {
      httpOnly:  true,
      secure:    process.env.NODE_ENV === 'production',
      sameSite:  'strict',
      // /api/super-admin/* に加えて /api/test/* 等の運用系ルートでも
      // super-admin 判定に使うため /api 全体に送る（HttpOnly なのでJSからは読めない）
      path:      '/api',
      maxAge:    86400,                // 24 hours
    })
    return res
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
