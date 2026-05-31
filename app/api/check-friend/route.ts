export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getLineToken, type BizType } from '@/lib/line-config'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ friend: false })

  const biz = (req.nextUrl.searchParams.get('biz') ?? 'uniform') as BizType
  const token = getLineToken(biz)

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return NextResponse.json({ friend: res.ok })
  } catch {
    return NextResponse.json({ friend: false })
  }
}
