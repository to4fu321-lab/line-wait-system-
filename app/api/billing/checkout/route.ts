export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getStripe, isStripeConfigured, tierPriceId, tierPlanKey, PRICE_TIERS, type PriceTier } from '@/lib/stripe'

/**
 * POST /api/billing/checkout
 * Body: { storeId, tier: 'lite' | 'standard' | 'pro' }
 * Stripe Checkout（サブスクリプション）セッションを作り、遷移先URLを返す。
 * 既存の Stripe顧客があれば使い回す（二重に顧客を作らない）。
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe未設定です。管理者にお問い合わせください。', code: 'not_configured' }, { status: 501 })
  }

  let body: { storeId?: string; tier?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body parse error' }, { status: 400 })
  }
  const storeId = body.storeId
  const tier = body.tier as PriceTier | undefined
  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })
  if (!tier || !PRICE_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'tier required (lite/standard/pro)' }, { status: 400 })
  }
  const priceId = tierPriceId(tier)
  if (!priceId) {
    return NextResponse.json({ error: `このプラン(${tier})は現在販売していません` }, { status: 400 })
  }

  const supabase = createAdminClient({ noStore: true })

  const { data: store } = await supabase.from('stores').select('id, name').eq('id', storeId).maybeSingle()
  if (!store) return NextResponse.json({ error: '店舗が見つかりません' }, { status: 404 })

  const { data: sub } = await (supabase as any)
    .from('store_subscriptions').select('stripe_customer_id').eq('store_id', storeId).maybeSingle()

  try {
    const stripe = getStripe()
    const origin = req.nextUrl.origin
    const plan = tierPlanKey(tier)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: sub?.stripe_customer_id || undefined,
      client_reference_id: storeId,
      metadata: { store_id: storeId, tier, plan },
      subscription_data: { metadata: { store_id: storeId, tier, plan } },
      success_url: `${origin}/${storeId}/admin/billing?checkout=success`,
      cancel_url: `${origin}/${storeId}/admin/billing?checkout=cancel`,
    })

    if (!session.url) throw new Error('Checkout Sessionの作成に失敗しました')
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'サーバーエラー' }, { status: 500 })
  }
}
