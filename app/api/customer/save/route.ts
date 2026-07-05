export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { verifyLineAccessToken } from '@/lib/auth/lineAuth'

/** customers への upsert で受け付けるフィールド(ホワイトリスト) */
const CUSTOMER_FIELDS = ['name', 'kana', 'tel', 'school_name', 'school_id', 'notes'] as const
/** children への insert/update で受け付けるフィールド */
const CHILD_FIELDS = ['name', 'kana', 'school_id', 'school_name', 'grade', 'gender', 'admission_year'] as const

function pick(src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (k in src) out[k] = src[k]
  return out
}

/**
 * POST /api/customer/save
 * Body: {
 *   storeId, accessToken,
 *   customer?:    { name?, kana?, tel?, ... }   // upsert(本人レコード)
 *   childInsert?: { name, kana?, ... }          // お子様追加
 *   childUpdate?: { id, ...fields }             // お子様更新(本人の子のみ)
 * }
 *
 * LIFF トークンで本人確認した LINE ユーザー自身の顧客情報のみ更新できる。
 * 返り値: { customer, children, child }(child は childInsert/childUpdate の結果)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeId, accessToken } = body
    if (!storeId) return NextResponse.json({ error: 'storeId が必要です' }, { status: 400 })

    const line = await verifyLineAccessToken(accessToken)
    if (!line) return NextResponse.json({ error: 'LINE認証に失敗しました' }, { status: 401 })

    const supabase = createAdminClient({ noStore: true })

    // 既存顧客(削除済み含む)を取得
    const { data: rows } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('line_user_id', line.userId)
      .order('created_at', { ascending: false })
      .limit(1)
    let customer = rows?.[0] ?? null

    // 顧客の upsert
    if (body.customer && typeof body.customer === 'object') {
      const patch = pick(body.customer, CUSTOMER_FIELDS)
      if (customer) {
        const { data: updated, error } = await supabase
          .from('customers')
          .update({ ...patch, deleted_at: null })
          .eq('id', customer.id)
          .select()
          .single()
        if (error) throw new Error(error.message)
        customer = updated
      } else {
        const { data: inserted, error } = await supabase
          .from('customers')
          .insert({ ...patch, store_id: storeId, line_user_id: line.userId })
          .select()
          .single()
        if (error) throw new Error(error.message)
        customer = inserted
      }
    }

    if (!customer || customer.deleted_at) {
      return NextResponse.json({ error: '顧客レコードがありません' }, { status: 404 })
    }

    let child: unknown = null

    if (body.childInsert && typeof body.childInsert === 'object') {
      const { data: inserted, error } = await supabase
        .from('children')
        .insert({ ...pick(body.childInsert, CHILD_FIELDS), customer_id: customer.id, store_id: storeId })
        .select()
        .single()
      if (error) throw new Error(error.message)
      child = inserted
    }

    if (body.childUpdate && typeof body.childUpdate === 'object' && body.childUpdate.id) {
      const { data: updated, error } = await supabase
        .from('children')
        .update(pick(body.childUpdate, CHILD_FIELDS))
        .eq('id', body.childUpdate.id)
        .eq('customer_id', customer.id) // 本人の子のみ
        .select()
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!updated) return NextResponse.json({ error: 'お子様情報が見つかりません' }, { status: 404 })
      child = updated
    }

    const { data: children } = await supabase
      .from('children')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ customer, children: children ?? [], child })
  } catch (err) {
    console.error('[customer/save]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'サーバーエラー' }, { status: 500 })
  }
}
