import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { safeEqual } from '@/lib/auth/safeEqual'
import { hasSuperAdminSession } from '@/lib/auth/verifyAdmin'

export type StoreRole = 'owner' | 'staff'

/**
 * 店舗PINをサーバー側で照合する。
 * - features.owner_pin と一致 → 'owner'
 * - stores.pin と一致 → 'staff'
 * - 不一致 → null
 */
export async function verifyStorePin(storeId: string, pin: string): Promise<StoreRole | null> {
  if (!storeId || !pin) return null
  const supabase = createAdminClient()
  const { data: store } = await supabase
    .from('stores')
    .select('pin, features')
    .eq('id', storeId)
    .maybeSingle()
  if (!store) return null

  const ownerPin = String((store.features as Record<string, unknown> | null)?.owner_pin ?? '')
  if (ownerPin && safeEqual(pin, ownerPin)) return 'owner'
  if (store.pin && safeEqual(pin, String(store.pin))) return 'staff'
  return null
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
