import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='
const SECRET = process.env.LINE_CHANNEL_SECRET || ''
const LIFF_URL = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || '2010126882-aUahQStD'}`

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
            type: 'template',
            altText: '順番待ち受付はこちらから',
            template: {
              type: 'buttons',
              thumbnailImageUrl: undefined,
              title: 'ご来店ありがとうございます',
              text: '下のボタンから順番待ちの受付ができます。',
              actions: [{ type: 'uri', label: '受付する', uri: LIFF_URL }],
            },
          }],
        }),
      }).catch(console.error)
    }
  }
  return NextResponse.json({ ok: true })
}
