export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'

// お直しは制服販売店専用 → uniform アカウントで通知
const TOKEN    = getLineToken('uniform')
const LIFF_URL = getLiffBaseUrl('uniform')

export async function POST(req: NextRequest) {
  let repairId: string | undefined
  let type: string = 'completed'

  try {
    const body = await req.json()
    repairId = body.repairId
    type     = body.type ?? 'completed'
  } catch (e) {
    return NextResponse.json({ ok: false, error: `body parse error: ${String(e)}` }, { status: 400 })
  }

  if (!repairId) {
    return NextResponse.json({ ok: false, error: 'repairId is required' }, { status: 400 })
  }

  const { data: repair, error: repairErr } = await supabase
    .from('repair_histories')
    .select(`
      id, item_name, content, slip_number, request_no, status,
      customer:customers ( name, line_user_id, tel ),
      store:stores ( id, name )
    `)
    .eq('id', repairId)
    .single()

  if (repairErr || !repair) {
    return NextResponse.json({ ok: false, error: `repair not found: ${repairErr?.message}` }, { status: 404 })
  }

  const customer = repair.customer as { name: string; line_user_id: string | null; tel: string | null } | null
  const store    = repair.store    as { id: string; name: string } | null

  if (!customer?.line_user_id) {
    console.log(`[notify-repair] LINE未連携 → skip (repair: ${repairId})`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no line_user_id' })
  }

  const storeName  = store?.name  ?? ''
  const storeLabel = storeName ? `【${storeName}】` : ''
  const reqNo      = (repair as any).request_no != null
    ? `R-${String((repair as any).request_no).padStart(4, '0')}`
    : repair.slip_number ?? null
  const reqText    = reqNo ? `\n依頼番号：${reqNo}` : ''
  const storeUrl   = store?.id ? `\n\n▼ 待ち状況\n${LIFF_URL}/${store.id}` : ''

  const messageText =
    `✂️ お直しが完了しました！\n\n${storeLabel}\n${customer.name} 様\n\n` +
    `${repair.item_name}\n${repair.content}${reqText}\n\n` +
    `お控えの依頼番号をお伝えください。\n` +
    `スタッフがお渡しの準備をしてお待ちしております。${storeUrl}`

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        to:       customer.line_user_id,
        messages: [{ type: 'text', text: messageText }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[notify-repair] LINE API Error:', err)
      return NextResponse.json({ ok: false, error: `LINE API ${res.status}: ${err}` }, { status: 500 })
    }

    await supabase
      .from('repair_histories')
      .update({ notified: true })
      .eq('id', repairId)

    console.log(`[notify-repair] 通知送信 repair=${repairId} customer=${customer.name}`)
    return NextResponse.json({ ok: true, notified: true })
  } catch (e) {
    console.error('[notify-repair] LINE fetch error:', e)
    return NextResponse.json({ ok: false, error: `LINE fetch error: ${String(e)}` }, { status: 500 })
  }
}
