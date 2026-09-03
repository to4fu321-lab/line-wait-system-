import { describe, it, expect, afterEach } from 'vitest'
import {
  isStripeConfigured, getWebhookSecret, paidPlanKey, fallbackPlanKey, isKnownPriceId,
} from '@/lib/stripe'

// lib/stripe.ts の設定系ヘルパーは、モジュール読み込み時ではなく呼び出し時に
// process.env を読む作りになっている（Stripeクライアント自体は getStripe() 内で
// 遅延生成）。そのため env を書き換えてから呼び直すだけでよい。
describe('lib/stripe 設定ヘルパー', () => {
  const KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PLAN_KEY'] as const
  const original: Record<string, string | undefined> = {}
  for (const k of KEYS) original[k] = process.env[k]

  afterEach(() => {
    for (const k of KEYS) {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    }
  })

  it('STRIPE_SECRET_KEY・STRIPE_PRICE_ID が両方揃って初めて isStripeConfigured が true', () => {
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_PRICE_ID
    expect(isStripeConfigured()).toBe(false)

    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    expect(isStripeConfigured()).toBe(false) // PRICE_ID がまだ無い

    process.env.STRIPE_PRICE_ID = 'price_dummy'
    expect(isStripeConfigured()).toBe(true)
  })

  it('getWebhookSecret は未設定なら null（fail-closeの入口）', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    expect(getWebhookSecret()).toBeNull()

    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
    expect(getWebhookSecret()).toBe('whsec_dummy')
  })

  it('paidPlanKey は未設定なら standard、設定していればその値', () => {
    delete process.env.STRIPE_PLAN_KEY
    expect(paidPlanKey()).toBe('standard')

    process.env.STRIPE_PLAN_KEY = 'full'
    expect(paidPlanKey()).toBe('full')
  })

  it('fallbackPlanKey は常に free_trial（解約時に戻すプラン）', () => {
    expect(fallbackPlanKey()).toBe('free_trial')
  })

  it('isKnownPriceId はSTRIPE_PRICE_IDと一致するときだけtrue', () => {
    process.env.STRIPE_PRICE_ID = 'price_dummy'
    expect(isKnownPriceId('price_dummy')).toBe(true)
    expect(isKnownPriceId('price_other')).toBe(false)
    expect(isKnownPriceId(null)).toBe(false)
  })
})
