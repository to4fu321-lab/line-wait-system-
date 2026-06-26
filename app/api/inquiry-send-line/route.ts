export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getLineToken } from '@/lib/line-config'

// POST /api/inquiry-send-line  { lineUserId, text }
// 問合せ対応の返信を LINE プッシュ送信する。
export async function POST(req: NextRequest) {
  try {
    const { lineUserId, text } = (await req.json()) as { lineUserId?: string; text?: string }
    if (!lineUserId) return NextResponse.json({ ok: false, error: 'lineUserId required' }, { status: 400 })
    if (!text?.trim()) return NextResponse.json({ ok: false, error: 'text required' }, { status: 400 })

    const token = getLineToken('uniform')
    if (!token) return NextResponse.json({ ok: false, error: 'LINEトークンが未設定です' }, { status: 500 })

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
    })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ ok: false, error: `LINE ${res.status}: ${err}` }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
