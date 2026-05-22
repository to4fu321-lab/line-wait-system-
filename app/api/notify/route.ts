import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const LIFF_URL = 'https://liff.line.me/2010126882-aUahQStD'

export async function POST(req: NextRequest) {
  const { lineUserId, ticketNumber, customerName, storeName: rawStoreName, storeId, type } = await req.json()

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='

  if (!lineUserId) {
    console.log(`[LINE通知スキップ] No.${ticketNumber} ${customerName} 様 – line_user_id が null`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_line_user_id' })
  }

  // LINE_NOTIFY_DISABLED=true で通知を無効化（開発中の通数節約用）
  if (process.env.LINE_NOTIFY_DISABLED === 'true') {
    console.log(`[LINE通知無効] No.${ticketNumber} ${customerName} 様 – LINE_NOTIFY_DISABLED=true`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'disabled' })
  }

  // 店舗がテストモードの場合はスキップ
  if (storeId) {
    const { data: st } = await (supabase.from('stores') as any)
      .select('is_test_mode').eq('id', storeId).single()
    if (st?.is_test_mode) {
      console.log(`[LINE通知スキップ] テストモード中 No.${ticketNumber} ${customerName}`)
      return NextResponse.json({ ok: true, skipped: true, reason: 'test_mode' })
    }
  }

  // storeName が空の場合はDBから取得
  let storeName = rawStoreName
  if (!storeName && storeId) {
    const { data } = await supabase.from('stores').select('name').eq('id', storeId).single()
    storeName = data?.name ?? ''
  }

  const paddedNum = String(ticketNumber).padStart(3, '0')
  const storeUrl  = storeId ? `\n\n▼ 画面を開く\n${LIFF_URL}/${storeId}\n\nURLを開き\n画面をスタッフにお見せください。` : ''
  const storeLabel = storeName ? `【${storeName}】\n` : ''

  const messageText = type === 'registered'
    ? `✅ 受付が完了しました！\n\n${storeLabel}整理番号：${paddedNum}\n${customerName} 様\n\n現在の待ち状況はこちらから確認できます👇\n${LIFF_URL}/${storeId}`
    : `🔔 お呼びしています！\n\n${storeLabel}整理番号：${paddedNum}\n${customerName} 様\n\nカウンターへお越しください。${storeUrl}`

  console.log(`[LINE通知送信] type=${type ?? 'calling'} No.${ticketNumber} ${customerName} userId=${lineUserId.slice(0, 8)}...`)

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: messageText }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[LINE API Error] status=${res.status}`, err)
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }

    console.log(`[LINE通知成功] No.${ticketNumber} ${customerName}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[LINE notify exception]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
