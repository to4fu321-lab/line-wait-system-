// ============================================================
// 汎用受付レコード（slip_records）の組立・保存ヘルパー（サーバ用）
//   テンプレの項目定義（role）を使って、読み取った header/items から
//   顧客解決・合計計算を行い slip_records を作る。
//   promoteScan(lib/scanPromote.ts) の顧客解決ロジックをサーバ版へ移植。
//   認証は API 側の storePin + createAdminClient（RLSバイパス）を前提とし、
//   必ず store_id を明示フィルタしてテナント分離する。
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractionField, FieldRole } from './extraction-schema'
import { headerFields, itemFields } from './extraction-schema'

/** 数値化（¥・カンマ・単位を除去）。不可なら null */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const cleaned = String(v).replace(/[^\d.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null // 数字が無い（例: 'あ'）
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** 指定 role を持つ最初の field の field_key を返す（無ければ null） */
export function roleKey(fields: ExtractionField[], role: FieldRole): string | null {
  const f = fields.find((x) => x.role === role)
  return f ? f.field_key : null
}

/**
 * 明細から合計金額を計算する。
 *   role=unit_price の明細項目が無ければ null（合計非対応テンプレ）。
 *   role=quantity があれば単価×数量、無ければ数量1として単価を合算。
 */
export function computeTotal(
  fields: ExtractionField[],
  items: Record<string, unknown>[],
): number | null {
  const lines = itemFields(fields)
  const priceKey = roleKey(lines, 'unit_price')
  if (!priceKey) return null
  const qtyKey = roleKey(lines, 'quantity')

  let total = 0
  let counted = false
  for (const it of items) {
    const price = toNum(it[priceKey])
    if (price == null) continue
    const qty = qtyKey ? (toNum(it[qtyKey]) ?? 1) : 1
    total += price * qty
    counted = true
  }
  return counted ? Math.round(total) : null
}

/** header から role=customer_name / customer_tel の値を取り出す */
export function extractCustomer(
  fields: ExtractionField[],
  header: Record<string, unknown>,
): { name: string | null; tel: string | null } {
  const heads = headerFields(fields)
  const nameKey = roleKey(heads, 'customer_name')
  const telKey = roleKey(heads, 'customer_tel')
  const name = nameKey && header[nameKey] != null ? String(header[nameKey]).trim() || null : null
  const tel = telKey && header[telKey] != null ? String(header[telKey]).trim() || null : null
  return { name, tel }
}

/**
 * 電話番号(下8桁) or 氏名で既存顧客を照合。無ければ作成。
 * scanPromote.findOrCreateCustomer のサーバ版（admin client）。
 * name/tel が両方空なら「顧客紐付けなし」で null を返す（仮顧客は作らない）。
 */
export async function findOrCreateCustomerServer(
  supabase: SupabaseClient,
  storeId: string,
  name: string | null,
  tel: string | null,
): Promise<string | null> {
  const telDigits = (tel ?? '').replace(/[-\s()]/g, '')

  if (telDigits.length >= 8) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('store_id', storeId)
      .ilike('tel', `%${telDigits.slice(-8)}%`)
      .is('deleted_at', null)
      .limit(1)
    if (data?.[0]) return data[0].id
  }
  if (name?.trim()) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('store_id', storeId)
      .eq('name', name.trim())
      .is('deleted_at', null)
      .limit(1)
    if (data?.[0]) return data[0].id
  }

  // 名前も電話も無ければ顧客を作らない（伝票だけ保存）
  if (!name?.trim() && telDigits.length < 8) return null

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      store_id: storeId,
      name: name?.trim() || `お客様（伝票 ${new Date().toLocaleDateString('ja-JP')}）`,
      tel: tel || null,
      notes: '伝票OCR受付から自動登録',
    })
    .select('id')
    .single()
  if (error) return null
  return created.id
}
