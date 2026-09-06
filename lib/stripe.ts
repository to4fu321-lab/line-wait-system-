// ============================================================================
//  Stripe連携（サーバー専用）
//
//  有料プランは複数ティア（Lite/Standard/Pro）を扱う。各ティアの
//  Price IDとプランキーの対応は env で持つ（コード変更なしで
//  差し替え・追加できるようにするため）:
//
//    STRIPE_PRICE_LITE / STRIPE_PLAN_LITE
//    STRIPE_PRICE_STANDARD / STRIPE_PLAN_STANDARD
//    STRIPE_PRICE_PRO / STRIPE_PLAN_PRO
//
//  STRIPE_PRICE_<TIER> が設定されているティアだけが「販売中」として
//  扱われる。STRIPE_PLAN_<TIER> を省略した場合は lib/features.ts の
//  Plan と同名の小文字キー（lite→'simple' 等ではなく、そのまま
//  'standard'）にフォールバックする…と紛らわしいため、省略時は
//  常に 'standard' にフォールバックする（=最低限どこかのプランには
//  必ず乗る。実運用では必ず明示設定すること）。
//
//  クライアントコンポーネントから import してはいけない
//  （STRIPE_SECRET_KEY が無いため必ず失敗する）。
// ============================================================================

import Stripe from 'stripe'
import type { Plan } from '@/lib/features'

let client: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (!client) {
    client = new Stripe(key, { apiVersion: '2026-08-26.dahlia' })
  }
  return client
}

export type PriceTier = 'lite' | 'standard' | 'pro'
export const PRICE_TIERS: PriceTier[] = ['lite', 'standard', 'pro']
export const TIER_LABELS: Record<PriceTier, string> = { lite: 'Lite', standard: 'Standard', pro: 'Pro' }

/** そのティアのPrice ID。env未設定なら「販売していない」ティア */
export function tierPriceId(tier: PriceTier): string | undefined {
  return process.env[`STRIPE_PRICE_${tier.toUpperCase()}`]
}

/** 契約成立時に stores.features._plan / store_subscriptions.plan へ入れる値 */
export function tierPlanKey(tier: PriceTier): Plan {
  return (process.env[`STRIPE_PLAN_${tier.toUpperCase()}`] as Plan | undefined) ?? 'standard'
}

/** Price IDが設定されている(=販売中の)ティアの一覧 */
export function configuredTiers(): PriceTier[] {
  return PRICE_TIERS.filter(t => !!tierPriceId(t))
}

/** Checkout/Portal を出す前に確認する。未設定ならアプリ側は問い合わせ導線にフォールバックする */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && configuredTiers().length > 0
}

/** Webhook検証に使う。未設定なら検証できないため、呼び出し側は必ず拒否すること(fail-close) */
export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

/** サブスクリプションが有効でなくなったときに戻すプラン */
export function fallbackPlanKey(): Plan {
  return 'free_trial'
}

/** Price ID からティアを逆引き（Webhookで metadata が無い場合のフォールバック用） */
export function tierForPriceId(priceId: string | null | undefined): PriceTier | null {
  if (!priceId) return null
  return PRICE_TIERS.find(t => tierPriceId(t) === priceId) ?? null
}
