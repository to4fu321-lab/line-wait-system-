export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/admin/stores?storeId=x  → 単一店舗（PINを含まない）
 * GET /api/admin/stores?groupId=x  → 同一グループ内の店舗一覧（支店切替用。PINを含まない）
 *
 * 管理画面の店舗選択用。stores.pin / features.owner_pin は
 * クライアントへ渡さない（照合は /api/admin/verify-pin で行う）。
 *
 * storeId/groupId のどちらも無い無条件の全件取得は許可しない
 * （認証前に全店舗の一覧を誰でも取得できてしまうため）。
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const storeId = req.nextUrl.searchParams.get('storeId')
    const groupId = req.nextUrl.searchParams.get('groupId')
    if (!storeId && !groupId) {
      return NextResponse.json({ ok: false, error: 'storeId または groupId が必要です' }, { status: 400 })
    }

    let query = supabase
      .from('stores')
      .select('id, name, group_id, business_type, features')
      .order('name', { ascending: true })
    if (storeId) query = query.eq('id', storeId)
    else if (groupId) query = query.eq('group_id', groupId)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const stores = (data ?? []).map(({ features, ...rest }) => {
      const f = { ...(features as Record<string, unknown> | null ?? {}) }
      delete f.owner_pin
      return { ...rest, features: f }
    })
    return NextResponse.json({ ok: true, stores })
  } catch (err) {
    console.error('[admin/stores]', err)
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 })
  }
}
