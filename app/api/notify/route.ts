import { NextRequest, NextResponse } from 'next/server'

// LINE Messaging API 呼出通知
// 実運用では LINE_CHANNEL_ACCESS_TOKEN を .env.local に設定してください
export async function POST(req: NextRequest) {
  const { lineUserId, ticketNumber, customerName, storeName } = await req.json()

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

  // LINEユーザーIDまたはトークンが未設定の場合はスキップ
  if (!token || !lineUserId) {
    console.log(`[LINE通知スキップ] No. ${ticketNumber} ${customerName} 様 (LINE未連携)`)
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: `🔔 お呼びしています！\n\n${storeName ? `【${storeName}】\n` : ''}整理番号：${String(ticketNumber).padStart(3, '0')}\n${customerName} 様\n\nカウンターへお越しください。`,
          },
        ],
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
