// ============================================================================
//  Stripe連携（サーバー専用）
//
//  スモールスタートなので、有料プランは今のところ1本（STRIPE_PRICE_ID が
//  指す Price）だけを扱う。複数プランを売るようになったら、
//  STRIPE_PRICE_ID→プランキーの対応をここに増やせばよい。
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

/** Checkout/Portal を出す前に確認する。未設定ならアプリ側は問い合わせ導線にフォールバックする */
export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
}

/** Webhook検証に使う。未設定なら検証できないため、呼び出し側は必ず拒否すること(fail-close) */
export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

/** 契約成立時に stores.features._plan / store_subscriptions.plan へ書く値。未設定なら 'standard' 扱い */
export function paidPlanKey(): Plan {
  return (process.env.STRIPE_PLAN_KEY as Plan | undefined) ?? 'standard'
}

/** サブスクリプションが有効でなくなったときに戻すプラン */
export function fallbackPlanKey(): Plan {
  return 'free_trial'
}

/** このアプリが払い出す Price ID かどうか（Webhookで無関係なイベントを無視するため） */
export function isKnownPriceId(priceId: string | null | undefined): boolean {
  return !!priceId && priceId === process.env.STRIPE_PRICE_ID
}
