export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getLineToken, storeBizType } from '@/lib/line-config'
import { pushCard } from '@/lib/line-flex'
import { rateLimit, RATE_LIMITED_BODY } from '@/lib/rateLimit'

interface FittingItem {
  item_name: string
  size_label: string
  qty:        number
  price:      number
}

export async function POST(req: NextRequest) {
  const {
    storeId,
    lineUserId,
    childName,
    schoolName,
    items,
    totalAmount,
  }: {
    storeId:     string
    lineUserId:  string
    childName:   string
    schoolName:  string
    items:       FittingItem[]
    totalAmount: number
  } = await req.json()

  // storeIdだけで叩ける公開APIのため店舗単位で連打を制限（1分60通）
  if (!rateLimit(`notify-fitting:${storeId ?? 'unknown'}`, 60, 60_000)) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 })
  }

  if (!lineUserId) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_line_user_id' })
  }

  if (process.env.LINE_NOTIFY_DISABLED === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'disabled' })
  }
  const supabase = createAdminClient()

  const { data: store } = await (supabase as any)
    .from('stores').select('name, business_type, is_test_mode')
    .eq('id', storeId).single()

  if (store?.is_test_mode) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'test_mode' })
  }

  const token     = getLineToken(storeBizType(store?.business_type))
  const storeName = store?.name ?? ''

  const itemLines = (items ?? [])
    .filter(i => i.qty > 0 && i.size_label)
    .map(i => `${i.item_name}　${i.size_label} × ${i.qty}枚${i.price > 0 ? `　¥${(i.price * i.qty).toLocaleString()}` : ''}`)
  if (totalAmount > 0) itemLines.push(`合計：¥${totalAmount.toLocaleString()}`)

  const result = await pushCard(token, lineUserId, `採寸完了 ${childName} さん`, {
    kind: 'ready',
    title: '採寸が完了しました',
    storeName: [storeName, schoolName].filter(Boolean).join('｜') || undefined,
    customerName: childName,
    nameSuffix: 'さん',
    bodyLines: itemLines.length ? itemLines : undefined,
    note: 'ご来店ありがとうございました。\nご不明な点はお気軽にお問い合わせください。',
  })

  if (!result.ok) {
    console.error('[notify-fitting] LINE API error', result.status, result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
