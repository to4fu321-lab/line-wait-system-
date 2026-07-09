import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabaseAdmin'

export interface StaffSessionTokens {
  access_token: string
  refresh_token: string
}

interface IssuedTokens {
  access_token: string
  refresh_token: string
  expires_at: string // ISO
}

// キャッシュの有効期限をこのマージン分だけ手前で「切れている」扱いにする
const CACHE_SAFETY_MARGIN_MS = 60_000

function plainClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** stores からキャッシュ済みトークンを読む。失敗時は null(=キャッシュ無し扱い) */
async function readCache(
  admin: ReturnType<typeof createAdminClient>,
  storeId: string,
): Promise<IssuedTokens | null> {
  try {
    const { data } = await admin
      .from('stores')
      .select('staff_session_access_token, staff_session_refresh_token, staff_session_expires_at')
      .eq('id', storeId)
      .maybeSingle()
    const row = data as {
      staff_session_access_token: string | null
      staff_session_refresh_token: string | null
      staff_session_expires_at: string | null
    } | null
    if (!row?.staff_session_access_token || !row.staff_session_refresh_token || !row.staff_session_expires_at) {
      return null
    }
    return {
      access_token: row.staff_session_access_token,
      refresh_token: row.staff_session_refresh_token,
      expires_at: row.staff_session_expires_at,
    }
  } catch (e) {
    console.error('[staffSession] readCache:', e)
    return null
  }
}

/** stores にトークンを書き戻す。失敗してもレスポンスには影響させない(呼び出し元でawait有無を選ぶ) */
async function writeCache(
  admin: ReturnType<typeof createAdminClient>,
  storeId: string,
  tokens: IssuedTokens,
): Promise<void> {
  try {
    await admin
      .from('stores')
      .update({
        staff_session_access_token: tokens.access_token,
        staff_session_refresh_token: tokens.refresh_token,
        staff_session_expires_at: tokens.expires_at,
      })
      .eq('id', storeId)
  } catch (e) {
    console.error('[staffSession] writeCache:', e)
  }
}

/** 期限間近/切れのキャッシュを refresh_token で軽量更新する(Auth API呼び出し1回) */
async function tryRefresh(refreshToken: string): Promise<IssuedTokens | null> {
  try {
    const plain = plainClient()
    if (!plain) return null
    const { data, error } = await plain.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) return null
    const { access_token, refresh_token, expires_at } = data.session
    return {
      access_token,
      refresh_token,
      expires_at: expires_at ? new Date(expires_at * 1000).toISOString() : new Date(Date.now() + 3600_000).toISOString(),
    }
  } catch (e) {
    console.error('[staffSession] tryRefresh:', e)
    return null
  }
}

/**
 * 店舗ごとの Auth ユーザー(store-<storeId>@staff.local)を find-or-create し、
 * app_metadata.store_id を持つ JWT を新規発行するフルフロー。
 * (既存ロジック。キャッシュが使えない時のみ呼ばれる)
 */
async function issueFullSession(
  admin: ReturnType<typeof createAdminClient>,
  storeId: string,
): Promise<IssuedTokens | null> {
  try {
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
    const plain = plainClient()
    if (!plain) return null
    const { data: otpData, error: otpErr } = await plain.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    })
    if (otpErr || !otpData.session) {
      console.error('[staffSession] verifyOtp:', otpErr?.message)
      return null
    }
    const { access_token, refresh_token, expires_at } = otpData.session
    return {
      access_token,
      refresh_token,
      expires_at: expires_at ? new Date(expires_at * 1000).toISOString() : new Date(Date.now() + 3600_000).toISOString(),
    }
  } catch (e) {
    console.error('[staffSession] issueFullSession:', e)
    return null
  }
}

/**
 * 店舗スタッフ用の Supabase Auth セッションを発行する(キャッシュ優先)。
 *
 * PIN 照合成功後に呼ぶ。店舗ごとに1つの Auth ユーザー
 * (store-<storeId>@staff.local) を find-or-create し、
 * app_metadata.store_id を持つ JWT を返す。RLS はこのクレームで
 * 自店舗の行だけを許可する(public.is_staff_of)。
 *
 * 同じ店舗であればセッションの中身(store_idクレーム)は不変なため、
 * stores.staff_session_* に発行済みトークンをキャッシュして使い回す。
 * 有効期限が近い/切れている場合のみ軽量リフレッシュ、それも失敗した
 * 場合のみ Auth Admin API のフルフロー(createUser→generateLink→
 * verifyOtp)を実行する。キャッシュ層のどの段階が失敗してもフルフロー
 * にフォールスルーするため、失敗経路は増えない。
 *
 * パブリックサインアップは無効化されている前提(ユーザー作成は
 * service_role のみ)。失敗時は null(呼び出し元は 500 にせず
 * セッション無しで続行させない=ログイン失敗扱いにすること)。
 *
 * 同一店舗の複数スタッフが同時にPINを打つ(出勤時間帯など)と、
 * 期限間近の同じ refresh_token を並行してリフレッシュしてしまう。
 * Supabase の refresh_token はローテーション式(使うと即失効)なため、
 * 後発のリクエストは失効済みトークンでの再利用エラーとなり
 * フルフロー(generateLink)に落ちる。これが同時多発すると
 * generateLink のレート制限に達し、店舗全体でPINが通らなくなる。
 * 店舗IDごとに実行を1本化(single-flight)して同時Auth API呼び出しを防ぐ。
 */
const inFlight = new Map<string, Promise<StaffSessionTokens | null>>()

export async function createStaffSession(storeId: string): Promise<StaffSessionTokens | null> {
  const existing = inFlight.get(storeId)
  if (existing) return existing

  const promise = createStaffSessionUncached(storeId).finally(() => {
    inFlight.delete(storeId)
  })
  inFlight.set(storeId, promise)
  return promise
}

async function createStaffSessionUncached(storeId: string): Promise<StaffSessionTokens | null> {
  const admin = createAdminClient({ noStore: true })

  const cached = await readCache(admin, storeId)
  if (cached) {
    const expMs = new Date(cached.expires_at).getTime()
    if (expMs - Date.now() > CACHE_SAFETY_MARGIN_MS) {
      // ケース1: キャッシュ有効 → Auth API呼び出しゼロ
      return { access_token: cached.access_token, refresh_token: cached.refresh_token }
    }

    // ケース2: 期限間近/切れ → 軽量リフレッシュを1回だけ試す
    const refreshed = await tryRefresh(cached.refresh_token)
    if (refreshed) {
      // 次のリクエストが失効済みトークンを読まないよう、書き込みを待ってから返す
      await writeCache(admin, storeId, refreshed)
      return { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token }
    }
    // リフレッシュ失敗 → フルフローへフォールスルー
  }

  // ケース3: キャッシュ無し/リフレッシュ失敗 → フルフロー
  const full = await issueFullSession(admin, storeId)
  if (!full) return null
  await writeCache(admin, storeId, full) // 次回以降のキャッシュヒット率のため待つ
  return { access_token: full.access_token, refresh_token: full.refresh_token }
}
