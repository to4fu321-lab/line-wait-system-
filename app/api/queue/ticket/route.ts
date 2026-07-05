export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

/** set_info で許可する queues のフィールド */
const INFO_FIELDS = ['customer_name', 'customer_id', 'child_name', 'child_id', 'school_name', 'gender', 'details'] as const

/**
 * POST /api/queue/ticket
 * Body: { storeId, ticketId, action, ... }
 *
 * 自分のチケット(UUID=能力ベアラー)への操作。
 *   action: 'cancel'      … 並ぶのをやめる(waiting/calling のみ)
 *           'complete'    … 案内を受けた(calling のみ)
 *           'checkin'     … 遠隔受付の到着チェックイン
 *           'set_info'    … 顧客・お子様情報の反映(INFO_FIELDS のみ)
 *           'set_details' … 身長体重等 details 保存(+ parentPhone は顧客telへ)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, ticketId, action } = body
    if (!storeId || !ticketId || !action) {
      return NextResponse.json({ error: 'storeId / ticketId / action が必要です' }, { status: 400 })
    }

    const supabase = createAdminClient({ noStore: true })
    const { data: ticket } = await supabase
      .from('queues').select('*').eq('id', ticketId).eq('store_id', storeId).maybeSingle()
    if (!ticket) return NextResponse.json({ error: '受付情報が見つかりません' }, { status: 404 })

    let patch: Record<string, unknown> | null = null

    switch (action) {
      case 'cancel':
        if (!['waiting', 'calling'].includes(ticket.status)) {
          return NextResponse.json({ error: 'この受付はキャンセルできません' }, { status: 409 })
        }
        patch = { status: 'cancelled' }
        break
      case 'complete':
        if (!['waiting', 'calling'].includes(ticket.status)) {
          return NextResponse.json({ error: 'この受付は完了にできません' }, { status: 409 })
        }
        patch = { status: 'completed' }
        break
      case 'checkin':
        patch = { checked_in: true }
        break
      case 'set_info': {
        patch = {}
        for (const k of INFO_FIELDS) if (k in body) patch[k] = body[k]
        if (Object.keys(patch).length === 0) {
          return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
        }
        break
      }
      case 'set_details': {
        const details = body.details && typeof body.details === 'object' ? body.details : {}
        patch = { details }
        const parentPhone = typeof body.parentPhone === 'string' ? body.parentPhone.trim() : ''
        if (parentPhone && ticket.line_user_id) {
          await supabase.from('customers')
            .update({ tel: parentPhone })
            .eq('store_id', storeId)
            .eq('line_user_id', ticket.line_user_id)
        }
        break
      }
      default:
        return NextResponse.json({ error: '不明な操作です' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('queues').update(patch).eq('id', ticketId).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ticket: updated })
  } catch (err) {
    console.error('[queue/ticket]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
