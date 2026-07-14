export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { assertStorePin } from '@/lib/auth/storeAuth'
import { createAdminClient } from '@/lib/supabaseAdmin'
import type { ExtractionField } from '@/lib/extraction-schema'
import {
  extractCustomer,
  computeTotal,
  findOrCreateCustomerServer,
} from '@/lib/slip-records'

// ============================================================
// 汎用受付レコード（slip_records）の作成・一覧
//   テンプレ駆動OCRの読み取り結果（header + items）を実際の受付として保存する。
//   認証は storePin + createAdminClient + 明示 store_id フィルタ（既存 dynamic と同方式）。
// ============================================================

interface Body {
  action?: 'create' | 'list'
  storeId?: string
  storePin?: string
  templateId?: string
  header?: Record<string, unknown>
  items?: Record<string, unknown>[]
  limit?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const { action = 'create', storeId, storePin } = body

    const denied = await assertStorePin(req, { storeId, storePin })
    if (denied) return denied
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'storeIdが必要です' }, { status: 400 })
    }

    const supabase = createAdminClient({ noStore: true })

    // ── 一覧 ──
    if (action === 'list') {
      const { data, error } = await supabase
        .from('slip_records')
        .select('id, template_id, customer_id, header, items, total_amount, status, received_date, created_at, customers(name)')
        .eq('store_id', storeId)
        .order('received_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(Math.min(body.limit ?? 50, 200))
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, records: data ?? [] })
    }

    // ── 作成 ──
    const templateId = body.templateId
    if (!templateId) {
      return NextResponse.json({ ok: false, error: 'templateIdが必要です' }, { status: 400 })
    }

    // テンプレの所有確認 + 項目定義（role/scope）取得
    const { data: template } = await supabase
      .from('extraction_templates')
      .select('id')
      .eq('id', templateId)
      .eq('store_id', storeId)
      .maybeSingle()
    if (!template) {
      return NextResponse.json({ ok: false, error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    const { data: fieldRows } = await supabase
      .from('extraction_schemas')
      .select('field_key, field_label, field_type, description, sort_order, is_required, scope, role, master_kind')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true })
    const fields = (fieldRows ?? []) as ExtractionField[]

    const header = (body.header && typeof body.header === 'object') ? body.header : {}
    const items = Array.isArray(body.items) ? body.items : []

    // 顧客解決（role=customer_name / customer_tel から）
    const { name, tel } = extractCustomer(fields, header)
    const customerId = await findOrCreateCustomerServer(supabase, storeId, name, tel)

    // 合計計算（role=unit_price × quantity）
    const total = computeTotal(fields, items)

    const { data: created, error } = await supabase
      .from('slip_records')
      .insert({
        store_id: storeId,
        template_id: templateId,
        customer_id: customerId,
        header,
        items,
        total_amount: total,
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, recordId: created.id, customerId, totalAmount: total })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
