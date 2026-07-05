export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyStorePin } from '@/lib/auth/storeAuth'
import { createStaffSession } from '@/lib/auth/staffSession'

/**
 * POST /api/admin/verify-pin
 * Body: { storeId: string, pin: string }
 *
 * 店舗管理画面のPINをサーバー側で照合する。
 * 正解PINをクライアントへ送らないための唯一の照合窓口。
 * 成功時: { ok: true, role: 'owner' | 'staff', session: { access_token, refresh_token } }
 * session はクライアントが supabase.auth.setSession() に渡す。以後の
 * DB 読み書き・Realtime は authenticated ロール(自店舗スコープRLS)で行われる。
 */
export async function POST(req: NextRequest) {
  try {
    const { storeId, pin } = await req.json()
    if (!storeId || !pin || String(pin).length < 4) {
      return NextResponse.json({ ok: false, error: 'PINを入力してください' }, { status: 400 })
    }
    const role = await verifyStorePin(String(storeId), String(pin))
    if (!role) {
      return NextResponse.json({ ok: false, error: 'PINが違います' }, { status: 401 })
    }
    const session = await createStaffSession(String(storeId))
    if (!session) {
      return NextResponse.json({ ok: false, error: 'セッションの発行に失敗しました' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, role, session })
  } catch (err) {
    console.error('[admin/verify-pin]', err)
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 })
  }
}
