export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ friend: false })

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // 200 = 友達, それ以外 = 未追加 or ブロック
    return NextResponse.json({ friend: res.ok })
  } catch {
    return NextResponse.json({ friend: false })
  }
}
