export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLiffBaseUrl, getLineToken, getLineSecret } from '@/lib/line-config'

// テイクアウト専門店向け LINE チャンネルの webhook
const TOKEN    = getLineToken('takeout')
const SECRET   = getLineSecret('takeout')
const LIFF_BASE = getLiffBaseUrl('takeout')

function verifySignature(body: string, sig: string) {
  if (!SECRET) return true
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64') === sig
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  if (!verifySignature(body, req.headers.get('x-line-signature') || '')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const { events = [] } = JSON.parse(body)
  for (const event of events) {
    if (event.type === 'follow') {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          to: event.source.userId,
          messages: [{
            type: 'text',
            text: `友だち追加ありがとうございます😊\nテイクアウト注文はこちらからどうぞ。\n${LIFF_BASE}/line-home-takeout`,
          }],
        }),
      }).catch(console.error)
    }
  }
  return NextResponse.json({ ok: true })
}
