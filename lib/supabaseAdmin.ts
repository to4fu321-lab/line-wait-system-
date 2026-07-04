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

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) return createClient(url, serviceKey)

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY のいずれも未設定です')
  }
  if (!warned) {
    warned = true
    console.warn('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY が未設定のため anon キーで代替します。RLS の制約を受けます。')
  }
  return createClient(url, anonKey)
}
