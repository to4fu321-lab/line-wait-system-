import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// LINE webhook signature verification (same pattern as app/api/webhook/route.ts)
function verifySignature(body: string, sig: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET ?? ''
  if (!secret) return true
  return crypto.createHmac('sha256', secret).update(body).digest('base64') === sig
}

// Send LINE reply message
async function sendLineReply(replyToken: string, text: string): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

// Generate random coupon code
function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: { events: LineEvent[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = getSupabase()

  for (const event of body.events ?? []) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue

    const lineUid = event.source?.userId ?? ''
    const replyToken = event.replyToken ?? ''
    const text = event.message.text.trim()

    // Format: 投稿:学校名:アイテム名:コメント
    if (!text.startsWith('投稿:')) continue

    const parts = text.split(':')
    if (parts.length < 4) {
      await sendLineReply(replyToken, '形式が正しくありません。\n「投稿:学校名:アイテム名:コメント」の形式で送信してください。')
      continue
    }

    const [, schoolName, itemName, ...commentParts] = parts
    const tipText = commentParts.join(':').trim()

    if (!schoolName || !tipText) {
      await sendLineReply(replyToken, '学校名とコメントは必須です。')
      continue
    }

    // Find school by name — search all stores for simplicity (or require store_id in message)
    const { data: schools } = await supabase
      .from('schools')
      .select('id, store_id')
      .ilike('name', `%${schoolName.trim()}%`)
      .limit(1)

    if (!schools || schools.length === 0) {
      await sendLineReply(replyToken, `「${schoolName}」が見つかりませんでした。学校名をご確認ください。`)
      continue
    }

    const school = schools[0]

    // Save the tip
    await supabase.from('school_parent_tips').insert({
      school_id: school.id,
      store_id: school.store_id,
      item_name: itemName?.trim() ?? '',
      tip_text: tipText,
      line_uid: lineUid,
      approved: false,
      updated_by: `line:${lineUid}`,
    })

    // Check if line_coupon feature is enabled for this store
    const { data: storeData } = await supabase
      .from('stores')
      .select('features, plan')
      .eq('id', school.store_id)
      .single()

    const features = (storeData?.features as Record<string, boolean>) ?? {}
    const lineCouponEnabled = features['line_coupon'] === true

    if (lineCouponEnabled) {
      // Issue a coupon
      const code = generateCouponCode()
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + 30) // 30 days validity

      await supabase.from('coupons').insert({
        store_id: school.store_id,
        code,
        label: '情報提供クーポン',
        discount: '5%OFF',
        valid_until: validUntil.toISOString().split('T')[0],
        issued_to: lineUid,
        used: false,
        updated_by: 'system',
      })

      await sendLineReply(
        replyToken,
        `ありがとうございます！情報を受け付けました🙏\n\n感謝のクーポンをお送りします。\n\n🎫 クーポンコード: ${code}\n割引: 5%OFF\n有効期限: ${validUntil.toLocaleDateString('ja-JP')}\n\n次回のお買い物でご利用ください。`
      )
    } else {
      await sendLineReply(
        replyToken,
        `ありがとうございます！情報を受け付けました🙏\nスタッフが確認後、掲載させていただきます。`
      )
    }
  }

  return NextResponse.json({ ok: true })
}

// Type definitions for LINE webhook events
interface LineEvent {
  type: string
  replyToken?: string
  source?: { userId?: string; type?: string }
  message?: { type: string; text: string }
}
