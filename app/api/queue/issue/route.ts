export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'
import { rateLimit, RATE_LIMITED_BODY } from '@/lib/rateLimit'

/**
 * POST /api/queue/issue
 * Body: { storeId, accessToken?, childId?, isRemote?, details? }
 *
 * 整理券を発行する(採番RPC + queues INSERT をサーバー側で実行)。
 * accessToken があれば LINE 本人確認して顧客・お子様を紐づける。
 * 無ければ「未登録」として発行(店頭のPC確認モード等)。
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 }) }

  try {
    const { storeId, accessToken, childId, isRemote, details } = body as {
      storeId?: string; accessToken?: string; childId?: string; isRemote?: boolean; details?: unknown
    }
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })

    // storeId だけで発行できる公開APIのため、店舗単位で連打を制限（1分30件）
    if (!rateLimit(`queue-issue:${storeId}`, 30, 60_000)) {
      return NextResponse.json(RATE_LIMITED_BODY, { status: 429 })
    }

    const supabase = createAdminClient({ noStore: true })

    const { data: store, error: storeErr } = await supabase
      .from('stores').select('is_open, allow_remote').eq('id', storeId).maybeSingle()
    if (storeErr) throw storeErr
    if (!store) return NextResponse.json({ error: '店舗が見つかりません' }, { status: 404 })
    if (store.is_open === false) return NextResponse.json({ error: 'ただいま受付を停止しています' }, { status: 409 })
    if (isRemote && !store.allow_remote) return NextResponse.json({ error: '遠隔受付は利用できません' }, { status: 400 })

    // LINE 本人確認(任意)→ 顧客・お子様を解決
    let customer: { id: string; name: string | null } | null = null
    let child: { id: string; name: string | null; school_name: string | null; gender: string | null } | null = null
    let lineUserId: string | null = null
    let displayName: string | null = null

    const line = await verifyLineAccessToken(accessToken)
    if (line) {
      lineUserId = line.userId
      displayName = line.displayName
      const { data: rows } = await supabase
        .from('customers').select('id, name, deleted_at')
        .eq('store_id', storeId).eq('line_user_id', line.userId)
        .order('created_at', { ascending: false }).limit(1)
      if (rows?.[0] && !rows[0].deleted_at) customer = rows[0]
      if (customer && childId) {
        const { data: c } = await supabase
          .from('children').select('id, name, school_name, gender')
          .eq('id', childId).eq('customer_id', customer.id).maybeSingle()
        if (c) child = c
      }
    }

    const { data: nextNum, error: numErr } = await supabase
      .rpc('get_next_ticket_number', { p_store_id: storeId })
    if (numErr || nextNum == null) throw numErr ?? new Error('採番に失敗しました')

    const { data: ticket, error } = await supabase
      .from('queues')
      .insert({
        store_id:      storeId,
        ticket_number: nextNum as number,
        status:        'waiting',
        customer_name: customer?.name ?? displayName ?? '未登録',
        child_name:    child?.name ?? null,
        school_name:   child?.school_name ?? null,
        category:      'fitting',
        gender:        child?.gender ?? 'other',
        line_user_id:  lineUserId,
        is_remote:     !!isRemote,
        checked_in:    !isRemote,
        customer_id:   customer?.id ?? null,
        child_id:      child?.id ?? null,
        ...(details && typeof details === 'object' ? { details } : {}),
      })
      .select()
      .single()
    if (error || !ticket) throw error ?? new Error('受付に失敗しました')

    return NextResponse.json({ ticket })
  } catch (err) {
    console.error('[queue/issue]', err)
    return NextResponse.json({ error: '受付に失敗しました。もう一度お試しください。' }, { status: 500 })
  }
}
