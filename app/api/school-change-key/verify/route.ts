export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { rateLimit } from '@/lib/rateLimit'

/**
 * POST /api/school-change-key/verify
 * Body: { storeId: string; key: string }
 *
 * ネット注文画面で在籍校を変更するときの合言葉を照合する。
 * 合言葉は店舗だけが知っていて、お客様には店頭・電話でお伝えする運用。
 *
 * stores.school_change_key は anon に GRANT していないため、この
 * service role のAPIでしか読めない。当然、鍵そのものは返さない。
 */
export async function POST(req: NextRequest) {
  try {
    const { storeId, key } = await req.json()
    if (!storeId || typeof storeId !== 'string') {
      return NextResponse.json({ ok: false, error: 'storeIdが必要です' }, { status: 400 })
    }

    // 短い合言葉なので総当たりされうる。店舗単位で試行回数を絞る
    if (!rateLimit(`school-key:${storeId}`, 10, 60_000)) {
      return NextResponse.json(
        { ok: false, error: '試行回数が多すぎます。しばらくしてからお試しください' },
        { status: 429 },
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('stores')
      .select('school_change_key')
      .eq('id', storeId)
      .single()
    if (error || !data) {
      return NextResponse.json({ ok: false, error: '店舗が見つかりません' }, { status: 404 })
    }

    const expected = String((data as { school_change_key: string | null }).school_change_key ?? '').trim()
    // 未設定の店舗では誰も変更できない。お客様には店舗へ問い合わせてもらう
    if (!expected) {
      return NextResponse.json({ ok: false, configured: false })
    }

    const given = String(key ?? '').trim()
    // 口頭で伝える合言葉なので、大文字小文字の違いは許容する
    const match = given.length > 0 && given.toLowerCase() === expected.toLowerCase()
    return NextResponse.json({ ok: match, configured: true })
  } catch (err) {
    console.error('[school-change-key/verify]', err)
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 })
  }
}
