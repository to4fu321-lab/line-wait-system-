// ============================================================================
//  無料トライアルの月間SMS・LINE通知件数の管理（サーバー専用）
//
//  顧客・スタッフの登録数はDBトリガ(supabase/migrations/20260903_plan_limits.sql)
//  でテーブルinsert自体を止めているが、SMS/LINE通知は外部API(Twilio/LINE)への
//  送信であってテーブルinsertではないため、送信経路(app/api/notify-repair)側で
//  usage_counters を見てチェック・カウントする。
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlanLimits } from '@/lib/features'
import { PLAN_LIMIT_OWNER_MESSAGES } from '@/lib/planLimitError'

/** JSTの「今月」('YYYY-MM')。サーバーの実行タイムゾーンに関わらず日本時間で揃える */
function currentPeriodJst(): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value ?? '0000'
  const m = parts.find(p => p.type === 'month')?.value ?? '01'
  return `${y}-${m}`
}

export type SmsLimitCheck =
  | { ok: true; limit: number | null; remaining: number | null }
  | { ok: false; message: string }

/**
 * 送信前に呼ぶ。上限に達していれば ok:false（送信は行わない）。
 * 上限が無いプランでは常に ok:true。
 */
export async function checkSmsLimit(
  supabase: SupabaseClient, storeId: string,
): Promise<SmsLimitCheck> {
  const { data: store } = await supabase
    .from('stores').select('features').eq('id', storeId).maybeSingle()
  const limit = getPlanLimits((store as any)?.features ?? {}).sms_per_month
  if (!limit) return { ok: true, limit: null, remaining: null }

  const period = currentPeriodJst()
  const { data: row } = await supabase
    .from('usage_counters').select('count')
    .eq('store_id', storeId).eq('metric', 'sms_per_month').eq('period', period)
    .maybeSingle()
  const count = (row as any)?.count ?? 0

  if (count >= limit) {
    return { ok: false, message: PLAN_LIMIT_OWNER_MESSAGES.sms_per_month }
  }
  return { ok: true, limit, remaining: limit - count }
}

/** 送信成功後に呼ぶ。上限が設定されていないプランでも呼んで問題ない(実績として残る) */
export async function incrementSmsUsage(supabase: SupabaseClient, storeId: string): Promise<void> {
  const period = currentPeriodJst()
  const { error } = await (supabase as any).rpc('increment_usage_counter', {
    p_store_id: storeId, p_metric: 'sms_per_month', p_period: period,
  })
  if (error) console.error('[planUsage] increment failed:', error.message)
}

export type UsageSummary = {
  plan: string
  customers: { used: number; limit: number | null }
  staff: { used: number; limit: number | null }
  smsThisMonth: { used: number; limit: number | null }
}

/** 利用状況ページ用のまとめ取得 */
export async function getUsageSummary(supabase: SupabaseClient, storeId: string): Promise<UsageSummary> {
  const { data: store } = await supabase
    .from('stores').select('features').eq('id', storeId).maybeSingle()
  const rawFeatures = (store as any)?.features ?? {}
  const limits = getPlanLimits(rawFeatures)
  const plan = (rawFeatures._plan as string | undefined) ?? 'full'

  const [{ count: customersUsed }, { count: staffUsed }, { data: smsRow }] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).is('deleted_at', null),
    supabase.from('staff').select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).neq('active', false),
    supabase.from('usage_counters').select('count')
      .eq('store_id', storeId).eq('metric', 'sms_per_month').eq('period', currentPeriodJst())
      .maybeSingle(),
  ])

  return {
    plan,
    customers: { used: customersUsed ?? 0, limit: limits.customers_max ?? null },
    staff: { used: staffUsed ?? 0, limit: limits.staff_max ?? null },
    smsThisMonth: { used: (smsRow as any)?.count ?? 0, limit: limits.sms_per_month ?? null },
  }
}
