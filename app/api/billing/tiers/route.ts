export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getStripe, isStripeConfigured, configuredTiers, tierPriceId, TIER_LABELS } from '@/lib/stripe'

export type TierInfo = {
  tier: string
  label: string
  amount: number | null   // 最小通貨単位（円なら1円単位）
  currency: string | null
  interval: string | null // 'month' | 'year' など
}

/**
 * GET /api/billing/tiers
 * 現在販売中のティア（Lite/Standard/Pro のうち env で有効化されているもの）の
 * 価格表示情報を返す。金額をフロント側にハードコードせず、Stripeの実際の
 * Price設定を都度見せるため。
 */
export async function GET() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false, tiers: [] })
  }

  const tiers = configuredTiers()
  try {
    const stripe = getStripe()
    const infos: TierInfo[] = await Promise.all(tiers.map(async (tier) => {
      const priceId = tierPriceId(tier)!
      const price = await stripe.prices.retrieve(priceId)
      return {
        tier,
        label: TIER_LABELS[tier],
        amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
      }
    }))
    return NextResponse.json({ configured: true, tiers: infos })
  } catch (err) {
    console.error('[billing/tiers]', err)
    return NextResponse.json({ configured: false, tiers: [], error: err instanceof Error ? err.message : 'error' }, { status: 500 })
  }
}
