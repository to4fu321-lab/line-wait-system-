export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { pushToStaff } from '@/lib/pushStaff'

// スタッフ宛プッシュ送信（シフト公開・欠員募集・新着メッセージ・承認）
export async function POST(req: NextRequest) {
  try {
    const { storeId, staffIds, title, body, url } = await req.json() as {
      storeId: string; staffIds: string[]; title: string; body: string; url: string
    }
    if (!storeId || !Array.isArray(staffIds)) {
      return NextResponse.json({ ok: false, error: 'storeId/staffIds は必須' }, { status: 400 })
    }
    const r = await pushToStaff({ storeId, staffIds, title, body, url: url || `/${storeId}/staff` })
    return NextResponse.json({ ok: true, sent: r.sent })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
