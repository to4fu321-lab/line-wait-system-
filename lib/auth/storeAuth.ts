import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { hasSuperAdminSession } from '@/lib/auth/verifyAdmin'

export type StoreRole = 'owner' | 'staff'

/**
 * 店舗PINをサーバー側で照合する。
 * PIN は DB 上 bcrypt ハッシュで保存されており、照合は
 * SECURITY DEFINER 関数 verify_store_pin(service_role 専用)が行う。
 * - owner_pin_hash と一致 → 'owner'
 * - stores.pin(ハッシュ)と一致 → 'staff'
 * - 不一致 → null
 */
export async function verifyStorePin(storeId: string, pin: string): Promise<StoreRole | null> {
  if (!storeId || !pin) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('verify_store_pin', {
    p_store_id: storeId,
    p_pin: pin,
  })
  if (error) {
    console.error('[verifyStorePin]', error.message)
    return null
  }
  return data === 'owner' ? 'owner' : data === 'staff' ? 'staff' : null
}

/**
 * リクエストボディの { storeId, storePin } を照合する API ルート用ガード。
 * 認可OKなら null、NGなら 401/400 レスポンスを返す。
 * super-admin シークレット（x-admin-secret ヘッダー）でも通過できる。
 */
export async function assertStorePin(
  req: Request,
  body: { storeId?: string; storePin?: string },
): Promise<NextResponse | null> {
  if (hasSuperAdminSession(req)) return null

  if (!body.storeId || !body.storePin) {
    return NextResponse.json({ ok: false, error: '認証情報が必要です (storeId + storePin)' }, { status: 401 })
  }
  const role = await verifyStorePin(String(body.storeId), String(body.storePin))
  if (!role) {
    return NextResponse.json({ ok: false, error: 'PINが違います' }, { status: 401 })
  }
  return null
}
