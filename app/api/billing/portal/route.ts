export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

/**
 * POST /api/billing/portal
 * Body: { storeId }
 * 既に契約中の店舗が、支払い方法変更・解約などを行うための
 * Stripe Billing Portal セッションを作り、遷移先URLを返す。
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe未設定です。管理者にお問い合わせください。', code: 'not_configured' }, { status: 501 })
  }

  let body: { storeId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body parse error' }, { status: 400 })
  }
  const storeId = body.storeId
  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

  const supabase = createAdminClient({ noStore: true })
  const { data: sub } = await (supabase as any)
    .from('store_subscriptions').select('stripe_customer_id').eq('store_id', storeId).maybeSingle()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'まだご契約がありません' }, { status: 404 })
  }

  try {
    const stripe = getStripe()
    const origin = req.nextUrl.origin
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/${storeId}/admin/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'サーバーエラー' }, { status: 500 })
  }
}
