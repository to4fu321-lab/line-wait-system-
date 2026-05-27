export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const LIFF_URL = 'https://liff.line.me/2010126882-aUahQStD'

// POST { repairId, type }
// type: 'completed' = お直し完了通知 / 'ready' = お受け取り準備完了（将来拡張用）
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

  // お直し情報 + 顧客 + 店舗を一括取得
  const { data: repair, error: repairErr } = await supabase
    .from('repair_histories')
    .select(`
      id, item_name, content, slip_number, status,
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

  const token =
    process.env.LINE_CHANNEL_ACCESS_TOKEN ||
    'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='

  const storeName   = store?.name  ?? ''
  const storeLabel  = storeName ? `【${storeName}】` : ''
  const slipText    = repair.slip_number ? `\n伝票番号：${repair.slip_number}` : ''
  const storeUrl    = store?.id ? `\n\n▼ 待ち状況\n${LIFF_URL}/${store.id}` : ''

  const messageText =
    `✂️ お直しが完了しました！\n\n${storeLabel}\n${customer.name} 様\n\n` +
    `${repair.item_name}\n${repair.content}${slipText}\n\n` +
    `お控えの伝票をお持ちの上、ご来店ください。\n` +
    `スタッフがお渡しの準備をしてお待ちしております。${storeUrl}`

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${token}`,
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

    // 通知済みフラグを更新
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
