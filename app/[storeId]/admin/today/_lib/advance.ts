// ============================================================
// 「今日やること」アクション実行ヘルパー
//   既存カード（RepairCard/ArrivalCard/InquiryTabCard/handleDeliver）と
//   同じ Supabase update 形を再利用し、挙動の一貫性を保つ。
// ============================================================
import { supabase } from '@/lib/supabase'
import type { DeliveryItem } from '../../repairs/_components/types'

const sb = supabase as any
const today = () => new Date().toISOString().slice(0, 10)
const now = () => new Date().toISOString()

export type Result = { ok: boolean; error?: string }

// お直し: 作業開始（RepairCard.tsx:68-73）
export async function startRepair(rowId: string): Promise<Result> {
  const { error } = await sb.from('repair_histories')
    .update({ work_started: true, updated_at: now() }).eq('id', rowId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type NotifyMode = 'line' | 'sms' | 'phone_manual' | 'none'

// お直し: 完了＋通知（RepairCard.tsx:75-84 / handleSimpleComplete:187-228）
export async function completeRepair(rowId: string, opts: {
  notify: NotifyMode
  lineUserId?: string | null; tel?: string | null
  customerName?: string; itemName?: string; storeName?: string; reqNo?: string
}): Promise<Result> {
  const upd: Record<string, unknown> = { status: 'completed', completed_date: today(), work_started: true, updated_at: now() }
  if (opts.notify === 'phone_manual') upd.notified = true // 手動電話連絡済み
  const { error } = await sb.from('repair_histories').update(upd).eq('id', rowId)
  if (error) return { ok: false, error: error.message }
  if (opts.notify === 'line' || opts.notify === 'sms') {
    try {
      const res = await fetch('/api/notify-repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repairId: rowId, lineUserId: opts.lineUserId ?? null, tel: opts.tel ?? null,
          customerName: opts.customerName ?? '', itemName: opts.itemName ?? '',
          storeName: opts.storeName ?? '', reqNo: opts.reqNo,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) return { ok: false, error: json.error ?? '通知送信に失敗しました' }
    } catch (e) { return { ok: false, error: String(e) } }
  }
  return { ok: true }
}

// お直し以外の依頼（相談・確保・入金など）を完了（RepairCard.tsx:85-135）
export async function completeRepairOther(rowId: string): Promise<Result> {
  const { error } = await sb.from('repair_histories')
    .update({ status: 'completed', completed_date: today(), notified: true, updated_at: now() })
    .eq('id', rowId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// 入荷完了（ArrivalCard.tsx:18-34）
export async function markArrived(rowId: string): Promise<Result> {
  const { error } = await sb.from('purchase_orders')
    .update({ status: 'arrived', arrived_date: today(), notified: true, updated_at: now() })
    .eq('id', rowId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// お渡し（page.tsx:261-280 handleDeliver）
export async function deliver(item: DeliveryItem, paid: boolean, deliveredBy?: string): Promise<Result> {
  const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
  const upd: Record<string, unknown> = { status: 'delivered', delivered_date: today(), updated_at: now() }
  if (paid) upd.payment_status = 'paid'
  if (deliveredBy?.trim()) upd.delivered_by = deliveredBy.trim()
  const { error } = await sb.from(table).update(upd).eq('id', item.id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// 問合せ: in_progress → completed（InquiryTabCard.tsx:30-39）
export async function completeInquiry(rowId: string): Promise<Result> {
  const { error } = await sb.from('inquiries')
    .update({ status: 'completed', responded_at: now(), updated_at: now() }).eq('id', rowId)
  return error ? { ok: false, error: error.message } : { ok: true }
}
