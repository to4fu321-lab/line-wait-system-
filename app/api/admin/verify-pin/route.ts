export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyStorePin } from '@/lib/auth/storeAuth'

/**
 * POST /api/admin/verify-pin
 * Body: { storeId: string, pin: string }
 *
 * 店舗管理画面のPINをサーバー側で照合する。
 * 正解PINをクライアントへ送らないための唯一の照合窓口。
 * 成功時: { ok: true, role: 'owner' | 'staff' }
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
    return NextResponse.json({ ok: true, role })
  } catch (err) {
    console.error('[admin/verify-pin]', err)
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 })
  }
}
