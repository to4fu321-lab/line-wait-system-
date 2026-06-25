export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLineToken } from '@/lib/line-config'
import { pushCard } from '@/lib/line-flex'

// POST /api/arrival-notify
// 入荷時LINE通知: purchase_orders または repair_histories の入荷/完成を親へ通知し notified=true にする
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    storeId: string
    kind: 'purchase' | 'repair'
    id: string
  }
  const { storeId, kind, id } = body

  if (!storeId || !kind || !id) {
    return NextResponse.json({ ok: false, error: 'storeId / kind / id は必須です' }, { status: 400 })
  }

  const { data: store } = await (supabase as any)
    .from('stores')
    .select('is_test_mode, business_type, name')
    .eq('id', storeId)
    .single()

  if (store?.is_test_mode) {
    return NextResponse.json({ ok: true, sent: 0, skipped: true, reason: 'test_mode' })
  }

  const table = kind === 'purchase' ? 'purchase_orders' : 'repair_histories'

  const { data: row, error: rowErr } = await (supabase as any)
    .from(table)
    .select('id, item_name, notes, customer:customers(id, name, line_user_id)')
    .eq('id', id)
    .eq('store_id', storeId)
    .single()

  if (rowErr || !row) {
    return NextResponse.json({ ok: false, error: rowErr?.message ?? 'record not found' }, { status: 404 })
  }

  const lineUserId: string | null = row.customer?.line_user_id ?? null
  if (!lineUserId) {
    return NextResponse.json({ ok: false, error: 'line_user_id 未登録のため送信できません' }, { status: 422 })
  }

  const token = getLineToken(store?.business_type === 'takeout' ? 'takeout' : 'uniform')
  const storeName: string = store?.name ?? 'ショップ'
  const customerName: string = row.customer?.name ?? 'お客様'
  const itemName: string = row.item_name ?? ''
  const isRepair = kind === 'repair'

  const result = await pushCard(token, lineUserId, `${itemName}の${isRepair ? '仕上がり' : '入荷'}をお知らせします`, {
    kind: 'ready',
    title: isRepair ? '仕上がりのお知らせ' : '入荷のお知らせ',
    storeName,
    customerName,
    bodyLines: [
      itemName,
      ...(row.notes ? [row.notes] : []),
    ],
    note: isRepair
      ? 'お手数ですが、店舗までお受け取りにいらしてください。'
      : 'ご注文品が入荷しました。店舗までお受け取りにいらしてください。',
    buttonLabel: 'マイページを確認する',
    buttonUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/${storeId}/mypage`,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  // notified フラグを更新
  await (supabase as any)
    .from(table)
    .update({ notified: true })
    .eq('id', id)

  return NextResponse.json({ ok: true, sent: 1 })
}
