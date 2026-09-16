export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { assertStorePin } from '@/lib/auth/storeAuth'

/**
 * POST /api/master/directory
 * Body: { storeId, storePin, query }
 *
 * 学校名から住所・電話を引く「名簿」。マスタで唯一、意図的に他店の行も見る口。
 *
 * 経緯:
 *   外部の学校名簿を持っていないため、システムに登録済みの学校を名簿として使う
 *   (制服店は同じ学区の学校を複数店が抱えるのでよく当たる)。
 *   以前は schools が anon に開いていたのでブラウザから直接検索していたが、
 *   それだと他店の学校の内部メモ・締切・採寸日程まで読めてしまう。
 *
 * ここで返してよいのは「学校そのものの連絡先」だけ:
 *   name / kana / address / tel。
 *   店の商売に関わる列(notes・special_notes・締切・採寸日程など)は返さない。
 *   店舗PINで認証し、どの店の登録かも伏せる(own 判定のみ返す)。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const storeId = typeof body.storeId === 'string' ? body.storeId : ''
    const query   = typeof body.query === 'string' ? body.query.trim() : ''
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })
    if (query.length < 2) return NextResponse.json({ hits: [] })

    const denied = await assertStorePin(req, body)
    if (denied) return denied

    // ilike のワイルドカード・PostgREST の or() 区切りを打ち消す
    const safe = query.replace(/[%_,()]/g, ' ').trim()
    if (safe.length < 2) return NextResponse.json({ hits: [] })

    const supabase = createAdminClient({ noStore: true })
    const { data, error } = await supabase
      .from('schools')
      .select('id, store_id, name, kana, address, tel')
      .or(`name.ilike.%${safe}%,kana.ilike.%${safe}%`)
      .limit(40)
    if (error) return NextResponse.json({ hits: [] })   // 候補は補助機能。取れなくても手入力で進める

    type Row = { id: string; store_id: string; name: string; kana: string | null; address: string | null; tel: string | null }
    const hits = ((data ?? []) as Row[])
      .filter(r => r.address || r.tel)   // 埋める材料が無い行は出しても意味がない
      .map(r => ({
        id: r.id, name: r.name, kana: r.kana, address: r.address, tel: r.tel,
        own: r.store_id === storeId,
      }))
    return NextResponse.json({ hits })
  } catch (err) {
    console.error('[master/directory]', err)
    return NextResponse.json({ hits: [] })
  }
}
