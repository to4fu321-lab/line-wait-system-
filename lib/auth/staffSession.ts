import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabaseAdmin'

export interface StaffSessionTokens {
  access_token: string
  refresh_token: string
}

/**
 * 店舗スタッフ用の Supabase Auth セッションをサーバー側で発行する。
 *
 * PIN 照合成功後に呼ぶ。店舗ごとに1つの Auth ユーザー
 * (store-<storeId>@staff.local) を find-or-create し、
 * app_metadata.store_id を持つ JWT を返す。RLS はこのクレームで
 * 自店舗の行だけを許可する(public.is_staff_of)。
 *
 * パブリックサインアップは無効化されている前提(ユーザー作成は
 * service_role のみ)。失敗時は null(呼び出し元は 500 にせず
 * セッション無しで続行させない=ログイン失敗扱いにすること)。
 */
export async function createStaffSession(storeId: string): Promise<StaffSessionTokens | null> {
  try {
    const admin = createAdminClient()
    const email = `store-${storeId}@staff.local`

    // 1. ユーザー作成(既存なら email_exists で失敗して良い)
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { store_id: storeId },
    })
    if (createErr && !/already|exists|registered/i.test(createErr.message)) {
      console.error('[staffSession] createUser:', createErr.message)
    }

    // 2. magiclink を生成してユーザーIDと token_hash を得る
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !linkData?.user || !linkData.properties?.hashed_token) {
      console.error('[staffSession] generateLink:', linkErr?.message)
      return null
    }

    // 3. 既存ユーザーにも store_id クレームを保証(JWT に載る)
    const meta = (linkData.user.app_metadata ?? {}) as Record<string, unknown>
    if (meta.store_id !== storeId) {
      const { error: updErr } = await admin.auth.admin.updateUserById(linkData.user.id, {
        app_metadata: { ...meta, store_id: storeId },
      })
      if (updErr) {
        console.error('[staffSession] updateUserById:', updErr.message)
        return null
      }
    }

    // 4. token_hash を検証してセッションを発行(anon キーで可)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null
    const plain = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: otpData, error: otpErr } = await plain.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    })
    if (otpErr || !otpData.session) {
      console.error('[staffSession] verifyOtp:', otpErr?.message)
      return null
    }
    return {
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
    }
  } catch (e) {
    console.error('[staffSession]', e)
    return null
  }
}
