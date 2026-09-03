// ============================================================================
//  プラン上限エラーの共通変換
//
//  DBトリガ(enforce_plan_limit, supabase/migrations/20260903_plan_limits.sql)や
//  API側の上限チェック(lib/planUsage.ts)は、機械可読な "PLAN_LIMIT_EXCEEDED:<metric>"
//  という文字列で失敗を通知する。これを、見る相手に応じた文言に変換する。
//
//    - 店舗オーナー/スタッフ向け（マスタ画面など）: 上限とアップグレード導線を伝える
//    - LINE利用客向け（自己登録など）: 店舗の契約状況を晒さず、問い合わせを促すだけ
// ============================================================================

export type PlanLimitMetric = 'customers_max' | 'staff_max' | 'sms_per_month'

const MARKER = 'PLAN_LIMIT_EXCEEDED:'

/** エラーメッセージ文字列からプラン上限マーカーを取り出す。該当なければ null */
export function parsePlanLimitError(message: string | null | undefined): PlanLimitMetric | null {
  if (!message) return null
  const i = message.indexOf(MARKER)
  if (i === -1) return null
  const metric = message.slice(i + MARKER.length).trim()
  if (metric === 'customers_max' || metric === 'staff_max' || metric === 'sms_per_month') return metric
  return null
}

/** 店舗オーナー・スタッフ向けの文言（設定 > 契約プランへの導線を含む） */
export const PLAN_LIMIT_OWNER_MESSAGES: Record<PlanLimitMetric, string> = {
  customers_max: '顧客登録数が無料トライアルの上限に達しました。有料プランでは上限なくご利用いただけます。「設定 > 契約プラン」からご確認ください。',
  staff_max: 'スタッフ登録数が無料トライアルの上限に達しました。有料プランでは上限なくご利用いただけます。「設定 > 契約プラン」からご確認ください。',
  sms_per_month: '今月のSMS・LINE通知の上限に達しました。有料プランでは上限なくご利用いただけます。「設定 > 契約プラン」からご確認ください。',
}

/** LINE利用客など、店舗の契約状況を見せるべきでない相手向けの中立な文言 */
export const PLAN_LIMIT_CUSTOMER_MESSAGE =
  '只今、新規のご登録を一時的に停止しております。恐れ入りますが店舗まで直接お問い合わせください。'

/** 店舗オーナー向けの文言を生成（billing へのリンク付きテキストが欲しい呼び出し元用） */
export function ownerPlanLimitMessage(metric: PlanLimitMetric): string {
  return PLAN_LIMIT_OWNER_MESSAGES[metric]
}
