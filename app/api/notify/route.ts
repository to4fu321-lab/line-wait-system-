import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const LIFF_URL = 'https://liff.line.me/2010126882-aUahQStD'

export async function POST(req: NextRequest) {
  const { lineUserId, ticketNumber, customerName, storeName: rawStoreName, storeId, type } = await req.json()

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='

  if (!token || !lineUserId) {
    console.log(`[LINE通知スキップ] No. ${ticketNumber} ${customerName} 様 (LINE未連携)`)
    return NextResponse.json({ ok: true, skipped: true })
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
      console.error('LINE API Error:', err)
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('LINE notify failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
