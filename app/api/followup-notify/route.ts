export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLineToken } from '@/lib/line-config'
import { pushMessages } from '@/lib/line-flex'

// POST /api/followup-notify
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    storeId: string
    childIds: string[]
    message: string
    filterDesc?: string
  }
  const { storeId, childIds, message, filterDesc } = body

  if (!storeId || !childIds?.length || !message?.trim()) {
    return NextResponse.json({ ok: false, error: 'storeId / childIds / message は必須です' }, { status: 400 })
  }

  const { data: store } = await (supabase as any)
    .from('stores').select('is_test_mode, business_type, features').eq('id', storeId).single()

  if (store?.is_test_mode) {
    return NextResponse.json({ ok: true, sent: 0, skipped: childIds.length, reason: 'test_mode', unitPrice: 0, totalAmount: 0 })
  }

  const unitPrice: number = (store?.features?.followup_notify_price as number | undefined) ?? 10
  const token = getLineToken(store?.business_type === 'takeout' ? 'takeout' : 'uniform')

  const { data: children, error: childErr } = await (supabase as any)
    .from('children')
    .select('id, name, school_name, customer:customers(id, name, line_user_id)')
    .in('id', childIds)
    .eq('store_id', storeId)

  if (childErr || !children?.length) {
    return NextResponse.json({ ok: false, error: childErr?.message ?? 'children not found' }, { status: 404 })
  }

  const results = { sent: 0, skipped: 0, errors: 0 }

  for (const child of children) {
    const lineUserId = child.customer?.line_user_id
    if (!lineUserId) { results.skipped++; continue }

    const textMessage = {
      type: 'text',
      text: message.replace('{{name}}', child.name ?? '').replace('{{school}}', child.school_name ?? ''),
    }

    const res = await pushMessages(token, lineUserId, [textMessage])
    if (res.ok) results.sent++
    else results.errors++
  }

  const totalAmount = results.sent * unitPrice

  // 送信ログを記録（テーブル未作成でも無視）
  if (results.sent > 0) {
    try {
      await (supabase as any).from('notification_logs').insert({
        store_id: storeId,
        type: 'followup',
        recipient_count: results.sent,
        unit_price: unitPrice,
        total_amount: totalAmount,
        filter_desc: filterDesc ?? null,
      })
    } catch { /* graceful — migration 未適用時はスキップ */ }
  }

  return NextResponse.json({ ok: true, ...results, unitPrice, totalAmount })
}

// GET /api/followup-notify?storeId=xxx
export async function GET(req: NextRequest) {
  const storeId   = req.nextUrl.searchParams.get('storeId')
  const gradeYear = req.nextUrl.searchParams.get('gradeYear')

  if (!storeId) return NextResponse.json({ ok: false, error: 'storeId is required' }, { status: 400 })

  const { data: store } = await (supabase as any)
    .from('stores').select('features').eq('id', storeId).single()

  const unitPrice: number = (store?.features?.followup_notify_price as number | undefined) ?? 10

  const query = (supabase as any)
    .from('children')
    .select('id, name, kana, school_name, school_id, grade, gender, admission_year, customer:customers(id, name, line_user_id)')
    .eq('store_id', storeId)
    .not('admission_year', 'is', null)
    .order('school_name', { ascending: true })

  if (gradeYear) query.eq('admission_year', parseInt(gradeYear))

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, children: data ?? [], unitPrice })
}
