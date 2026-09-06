import { describe, it, expect, afterEach } from 'vitest'
import {
  isStripeConfigured, getWebhookSecret, fallbackPlanKey,
  tierPriceId, tierPlanKey, configuredTiers, tierForPriceId, PRICE_TIERS,
} from '@/lib/stripe'

// lib/stripe.ts の設定系ヘルパーは、モジュール読み込み時ではなく呼び出し時に
// process.env を読む作りになっている（Stripeクライアント自体は getStripe() 内で
// 遅延生成）。そのため env を書き換えてから呼び直すだけでよい。
//
// 有料プランは Lite/Standard/Pro の3ティア構成（Stripeダッシュボード側で
// 3つのPrice作成済み）。各ティアの Price ID / プランキーは
// STRIPE_PRICE_<TIER> / STRIPE_PLAN_<TIER> という env で個別に設定する。
describe('lib/stripe 設定ヘルパー（複数ティア対応）', () => {
  const KEYS = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_LITE', 'STRIPE_PLAN_LITE',
    'STRIPE_PRICE_STANDARD', 'STRIPE_PLAN_STANDARD',
    'STRIPE_PRICE_PRO', 'STRIPE_PLAN_PRO',
    'STRIPE_WEBHOOK_SECRET',
  ] as const
  const original: Record<string, string | undefined> = {}
  for (const k of KEYS) original[k] = process.env[k]

  afterEach(() => {
    for (const k of KEYS) {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    }
  })

  it('PRICE_TIERS は lite/standard/pro の3つ', () => {
    expect(PRICE_TIERS).toEqual(['lite', 'standard', 'pro'])
  })

  it('Price IDが設定されているティアだけが configuredTiers に入る', () => {
    for (const k of KEYS) delete process.env[k]
    expect(configuredTiers()).toEqual([])

    process.env.STRIPE_PRICE_STANDARD = 'price_standard_dummy'
    expect(configuredTiers()).toEqual(['standard'])

    process.env.STRIPE_PRICE_LITE = 'price_lite_dummy'
    process.env.STRIPE_PRICE_PRO = 'price_pro_dummy'
    expect(configuredTiers()).toEqual(['lite', 'standard', 'pro'])
  })

  it('isStripeConfigured はSTRIPE_SECRET_KEYと最低1ティアの両方が要る', () => {
    for (const k of KEYS) delete process.env[k]
    expect(isStripeConfigured()).toBe(false)

    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    expect(isStripeConfigured()).toBe(false) // まだティアが1つも無い

    process.env.STRIPE_PRICE_LITE = 'price_lite_dummy'
    expect(isStripeConfigured()).toBe(true)
  })

  it('tierPriceId/tierPlanKey はそれぞれのenvをそのまま返す。plan未設定はstandardにフォールバック', () => {
    process.env.STRIPE_PRICE_PRO = 'price_pro_dummy'
    process.env.STRIPE_PLAN_PRO = 'full'
    expect(tierPriceId('pro')).toBe('price_pro_dummy')
    expect(tierPlanKey('pro')).toBe('full')

    process.env.STRIPE_PRICE_LITE = 'price_lite_dummy'
    delete process.env.STRIPE_PLAN_LITE
    expect(tierPlanKey('lite')).toBe('standard')
  })

  it('tierForPriceId はPrice IDからティアを逆引きできる', () => {
    process.env.STRIPE_PRICE_LITE = 'price_lite_dummy'
    process.env.STRIPE_PRICE_STANDARD = 'price_standard_dummy'
    expect(tierForPriceId('price_lite_dummy')).toBe('lite')
    expect(tierForPriceId('price_standard_dummy')).toBe('standard')
    expect(tierForPriceId('price_unknown')).toBeNull()
    expect(tierForPriceId(null)).toBeNull()
  })

  it('getWebhookSecret は未設定なら null（fail-closeの入口）', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    expect(getWebhookSecret()).toBeNull()

    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
    expect(getWebhookSecret()).toBe('whsec_dummy')
  })

  it('fallbackPlanKey は常に free_trial（解約時に戻すプラン）', () => {
    expect(fallbackPlanKey()).toBe('free_trial')
  })
})
