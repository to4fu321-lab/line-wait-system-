import { createAdminClient } from '@/lib/supabaseAdmin'

/**
 * PIN を bcrypt ハッシュ化する(DB の hash_pin 関数、service_role 専用)。
 * stores.pin / stores.owner_pin_hash へ保存する値は必ずこれを通すこと。
 * 平文 PIN を DB に書いてはいけない。
 */
export async function hashPin(pin: string): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('hash_pin', { p_pin: pin })
  if (error || typeof data !== 'string' || !data.startsWith('$2')) {
    throw new Error(`PINのハッシュ化に失敗しました: ${error?.message ?? 'invalid result'}`)
  }
  return data
}
