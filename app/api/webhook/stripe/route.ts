export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getStripe, getWebhookSecret, paidPlanKey, fallbackPlanKey, isKnownPriceId } from '@/lib/stripe'

/**
 * POST /api/webhook/stripe
 *
 * 署名検証は fail-close（lib/lineSignature.ts と同方針）: secret未設定・
 * 署名なし・検証失敗はすべて拒否する。「検証をスキップして受け入れる」は
 * 絶対にしない。
 *
 * 生ボディが必要なので、ここでは req.text() 以外で body に触らないこと
 * （req.json() を先に呼ぶと署名検証が壊れる）。
 */
export async function POST(req: NextRequest) {
  const secret = getWebhookSecret()
  const signature = req.headers.get('stripe-signature')
  if (!secret || !signature) {
    return NextResponse.json({ error: 'signature required' }, { status: 400 })
  }

  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error('[webhook/stripe] signature verify failed:', err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  async function applyPlan(storeId: string, plan: string) {
    const { data: store } = await supabase.from('stores').select('features').eq('id', storeId).maybeSingle()
    const features = { ...((store as any)?.features ?? {}), _plan: plan }
    await supabase.from('stores').update({ features }).eq('id', storeId)
  }

  async function upsertSubscription(storeId: string, sub: Stripe.Subscription) {
    const priceId = sub.items.data[0]?.price?.id ?? null
    const plan = isKnownPriceId(priceId) ? paidPlanKey() : (sub.metadata?.plan ?? paidPlanKey())
    const periodEndUnix = (sub as any).current_period_end as number | undefined
    await (supabase as any).from('store_subscriptions').upsert({
      store_id: storeId,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      status: sub.status,
      plan,
      current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
    }, { onConflict: 'store_id' })

    const activeLike = sub.status === 'active' || sub.status === 'trialing'
    await applyPlan(storeId, activeLike ? plan : fallbackPlanKey())
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const storeId = session.metadata?.store_id ?? session.client_reference_id
        if (storeId && session.mode === 'subscription' && session.subscription) {
          const stripe = getStripe()
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await upsertSubscription(storeId, sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        const storeId = sub.metadata?.store_id
        if (storeId) await upsertSubscription(storeId, sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const storeId = sub.metadata?.store_id
        if (storeId) {
          await (supabase as any).from('store_subscriptions')
            .update({ status: 'canceled', stripe_subscription_id: sub.id })
            .eq('store_id', storeId)
          await applyPlan(storeId, fallbackPlanKey())
        }
        break
      }
      default:
        // それ以外のイベントは今のところ関心が無い
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook/stripe] handling failed:', event.type, err)
    // 500を返すとStripe側が自動リトライしてくれる
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
