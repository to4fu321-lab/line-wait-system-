export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * GET /api/admin/stores            → 店舗一覧（PINを含まない）
 * GET /api/admin/stores?storeId=x  → 単一店舗（PINを含まない）
 *
 * 管理画面の店舗選択用。stores.pin / features.owner_pin は
 * クライアントへ渡さない（照合は /api/admin/verify-pin で行う）。
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const storeId = req.nextUrl.searchParams.get('storeId')

    let query = supabase
      .from('stores')
      .select('id, name, group_id, business_type, features')
      .order('name', { ascending: true })
    if (storeId) query = query.eq('id', storeId)

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
