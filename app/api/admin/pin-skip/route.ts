export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { createStaffSession } from '@/lib/auth/staffSession'

/**
 * POST /api/admin/pin-skip
 * Body: { storeId: string }
 *
 * トライアル店舗など stores.features.pin_skip === true の店舗のみ、
 * PIN入力なしでスタッフセッションを発行する。フラグは管理者がDB側で
 * 個別に立てる想定で、クライアントからは変更できない。
 * 成功時のレスポンス形は /api/admin/verify-pin と揃える。
 */
export async function POST(req: NextRequest) {
  try {
    const { storeId } = await req.json()
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'storeIdが必要です' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('stores')
      .select('features')
      .eq('id', storeId)
      .single()
    if (error || !data) {
      return NextResponse.json({ ok: false, error: '店舗が見つかりません' }, { status: 404 })
    }

    const features = (data.features as Record<string, unknown> | null) ?? {}
    if (features.pin_skip !== true) {
      return NextResponse.json({ ok: false, error: 'この店舗はPIN省略が許可されていません' }, { status: 403 })
    }

    const session = await createStaffSession(String(storeId))
    if (!session) {
      return NextResponse.json({ ok: false, error: 'セッションの発行に失敗しました' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, role: 'owner', session })
  } catch (err) {
    console.error('[admin/pin-skip]', err)
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 })
  }
}
