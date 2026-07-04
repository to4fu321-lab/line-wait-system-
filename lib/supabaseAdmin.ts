import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * API ルート（サーバー側）専用の Supabase クライアント。
 * service-role キーで RLS をバイパスする。クライアントコンポーネントから
 * import してはいけない（キーが無いため必ず失敗する）。
 *
 * SUPABASE_SERVICE_ROLE_KEY 未設定時は anon キーで代替するが、その場合
 * RLS の制約を受けるため一部クエリが失敗しうる。設定漏れに気づけるよう
 * 起動ごとに一度だけ警告を出す。
 */
let warned = false

/**
 * noStore: Next.js App Router は fetch をサーバー側でキャッシュする。
 * Supabase の各クエリは同一URLになるためキャッシュ対象となり、
 * 更新後も古いスナップショットが返り続けることがある。
 * 最新のDB状態が必要なルートでは { noStore: true } を指定する。
 */
export function createAdminClient(options?: { noStore?: boolean }): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY のいずれも未設定です')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !warned) {
    warned = true
    console.warn('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY が未設定のため anon キーで代替します。RLS の制約を受けます。')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    ...(options?.noStore
      ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' as const }) } }
      : {}),
  })
}
