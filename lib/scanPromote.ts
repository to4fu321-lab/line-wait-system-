// ── 置くだけスキャン: 読取結果の表示・本登録（クライアント用） ──

import { supabase } from './supabase'

export type ScanSlipType = 'repair' | 'order' | 'inquiry'

export interface ScanInboxRow {
  id: string
  store_id: string
  slip_type: ScanSlipType
  extracted: Record<string, unknown>
  confidence: string | null
  warnings: string[]
  image_data: string | null
  status: 'pending' | 'confirmed' | 'discarded'
  created_at: string
}

export const SLIP_TYPE_LABELS: Record<ScanSlipType, string> = {
  repair:  '✂️ お直し',
  order:   '🛍️ ご注文',
  inquiry: '📝 メモ・問合せ',
}

// 確認カード用のサマリー行を生成
export function summarizeScan(slipType: ScanSlipType, d: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  const add = (label: string, v: unknown) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') rows.push({ label, value: String(v) })
  }
  if (slipType === 'repair') {
    add('お名前', d.customer_name)
    add('電話', d.tel)
    add('品物', d.item_name)
    add('内容', d.content)
    if (typeof d.hem_length_mm === 'number' && d.hem_length_mm !== 0) add('裾上げ', `${d.hem_length_mm}mm`)
    if (typeof d.sleeve_adjust_mm === 'number' && d.sleeve_adjust_mm !== 0) add('袖丈', `${d.sleeve_adjust_mm}mm`)
    if (typeof d.waist_adjust_mm === 'number' && d.waist_adjust_mm !== 0) add('ウエスト', `${d.waist_adjust_mm}mm`)
    add('刺繍', d.embroidery_text)
    add('金額', d.price != null ? `${Number(d.price).toLocaleString()}円` : null)
    add('仕上がり希望', d.desired_completion_date)
    add('メモ', d.internal_memo)
  } else if (slipType === 'order') {
    add('お名前', d.customer_name)
    add('学校', d.school_name)
    const items = (d.items as { item_name?: string; size_label?: string; quantity?: number }[] | null) ?? []
    items.forEach((it, i) => {
      add(`商品${i + 1}`, `${it.item_name ?? '?'}${it.size_label ? ` ${it.size_label}` : ''}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ''}`)
    })
    add('備考', d.notes)
  } else {
    add('お名前', d.customer_name)
    add('学校', d.school_name)
    add('内容', d.content)
  }
  return rows
}

// 電話番号 or 氏名で既存顧客を照合。見つからなければ作成。
async function findOrCreateCustomer(
  storeId: string,
  name: string | null,
  tel: string | null,
): Promise<{ id: string } | null> {
  const telDigits = (tel ?? '').replace(/[-\s()]/g, '')

  if (telDigits.length >= 8) {
    const { data } = await (supabase as any)
      .from('customers')
      .select('id')
      .eq('store_id', storeId)
      .ilike('tel', `%${telDigits.slice(-8)}%`)
      .is('deleted_at', null)
      .limit(1)
    if (data?.[0]) return data[0]
  }
  if (name?.trim()) {
    const { data } = await (supabase as any)
      .from('customers')
      .select('id')
      .eq('store_id', storeId)
      .eq('name', name.trim())
      .is('deleted_at', null)
      .limit(1)
    if (data?.[0]) return data[0]
  }
  // 新規作成（名前が無い場合は仮名で作る）
  const { data: created, error } = await (supabase as any)
    .from('customers')
    .insert({
      store_id: storeId,
      name: name?.trim() || `お客様（スキャン ${new Date().toLocaleDateString('ja-JP')}）`,
      tel: tel || null,
      notes: '置くだけスキャンから自動登録',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return null
  return created
}

const VALID_REPAIR_TYPES = ['hem', 'sleeve', 'waist', 'embroidery', 'button', 'tear', 'badge', 'size_exchange', 'other']

// 受信箱のドラフトを実レコードへ昇格させる
export async function promoteScan(
  scan: Pick<ScanInboxRow, 'id' | 'store_id' | 'slip_type' | 'extracted'>,
): Promise<{ ok: boolean; error?: string }> {
  const d = scan.extracted ?? {}
  const storeId = scan.store_id
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  let promotedTable: string | null = null
  let promotedId: string | null = null

  try {
    if (scan.slip_type === 'repair') {
      const cust = await findOrCreateCustomer(storeId, d.customer_name as string | null, d.tel as string | null)
      if (!cust) return { ok: false, error: '顧客の登録に失敗しました' }

      const repairType = VALID_REPAIR_TYPES.includes(String(d.repair_type)) ? String(d.repair_type) : 'other'
      const payload: Record<string, unknown> = {
        store_id: storeId,
        customer_id: cust.id,
        item_name: (d.item_name as string) || 'お直し品',
        content: (d.content as string) || '',
        request_type: 'repair',
        repair_type: repairType,
        status: 'received',
        received_date: today,
        desired_completion_date: (d.desired_completion_date as string) || null,
        price: d.price != null ? Number(d.price) : null,
        prepaid: false,
        notified: false,
        internal_memo: [(d.internal_memo as string) || null, '（置くだけスキャンで登録）'].filter(Boolean).join(' '),
        work_started: false,
        created_at: now,
        updated_at: now,
      }
      if (typeof d.hem_length_mm === 'number')    payload.hem_length_mm = d.hem_length_mm
      if (typeof d.sleeve_adjust_mm === 'number') payload.sleeve_adjust_mm = d.sleeve_adjust_mm
      if (typeof d.waist_adjust_mm === 'number')  payload.waist_adjust_mm = d.waist_adjust_mm
      if (d.embroidery_text) {
        payload.embroidery_text  = d.embroidery_text
        payload.embroidery_color = d.embroidery_color ?? null
        payload.embroidery_pos   = d.embroidery_pos ?? null
      }
      if (d.vendor_name) payload.vendor_name = d.vendor_name

      const { data: inserted, error } = await (supabase as any)
        .from('repair_histories').insert(payload).select('id').single()
      if (error) return { ok: false, error: error.message }
      promotedTable = 'repair_histories'
      promotedId = inserted.id

    } else if (scan.slip_type === 'order') {
      const cust = await findOrCreateCustomer(storeId, d.customer_name as string | null, null)
      if (!cust) return { ok: false, error: '顧客の登録に失敗しました' }

      const items = ((d.items as { item_name?: string; size_label?: string; quantity?: number; unit_price?: number }[] | null) ?? [])
        .filter(it => it.item_name)
      const total = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0)

      const orderId = crypto.randomUUID()
      const { error: oErr } = await (supabase as any).from('uniform_orders').insert({
        id: orderId,
        store_id: storeId,
        customer_id: cust.id,
        priority: 'normal',
        status: 'confirmed',
        payment_status: 'unpaid',
        total_amount: total || null,
        notes: [(d.notes as string) || null, '（置くだけスキャンで登録）'].filter(Boolean).join(' '),
      })
      if (oErr) return { ok: false, error: oErr.message }

      if (items.length > 0) {
        const { error: iErr } = await (supabase as any).from('uniform_order_items').insert(
          items.map(it => ({
            order_id: orderId,
            store_id: storeId,
            item_name: `${it.item_name}${it.size_label ? ` ${it.size_label}` : ''}`,
            size_label: it.size_label ?? null,
            quantity: Number(it.quantity) || 1,
            unit_price: it.unit_price != null ? Number(it.unit_price) : null,
            status: 'ordered',
          })),
        )
        if (iErr) return { ok: false, error: iErr.message }
      }
      promotedTable = 'uniform_orders'
      promotedId = orderId

    } else {
      // inquiry
      const { data: inserted, error } = await (supabase as any).from('inquiries').insert({
        store_id: storeId,
        customer_name: (d.customer_name as string) || null,
        content: [(d.school_name ? `【${d.school_name}】` : ''), (d.content as string) || ''].join(''),
        type: 'inquiry',
        is_urgent: false,
        status: 'pending',
        created_at: now,
        updated_at: now,
      }).select('id').single()
      if (error) return { ok: false, error: error.message }
      promotedTable = 'inquiries'
      promotedId = inserted.id
    }

    await (supabase as any).from('scan_inbox')
      .update({ status: 'confirmed', promoted_table: promotedTable, promoted_id: promotedId })
      .eq('id', scan.id)

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
