export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
const SECRET = process.env.LINE_CHANNEL_SECRET || ''
const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}`
const STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID || process.env.STORE_ID || ''

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
            text: `友だち追加ありがとうございます😊\nこちらからメニューへお進みください。\n${LIFF_BASE}/${STORE_ID}`,
          }],
        }),
      }).catch(console.error)
    }
  }
  return NextResponse.json({ ok: true })
}
