import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BAmZx5b8ScrgrqWa822FdQhtfHV2CSyqvxNeQX-Ds1KsqztPPRtZRyBP_LaQZmCLejg8Ivd7Gu4cBxKtNwodb3o'
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY            || 'C_FaNHSoxtJikB1p6Q2dOai2DwhnsFTn6ERAGIeJtBY'

webpush.setVapidDetails('mailto:to4fu321@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)

type PushType = 'queue_new' | 'purchase_new'

export async function POST(req: NextRequest) {
  const { storeId, type, title, body, url } = await req.json() as {
    storeId: string; type: PushType; title: string; body: string; url: string
  }
  if (!storeId) return NextResponse.json({ ok: false, error: 'no storeId' }, { status: 400 })

  // 店舗の push_settings を確認してタイプが無効なら送信しない
  const { data: store } = await (supabase.from('stores') as any)
    .select('push_settings, is_test_mode').eq('id', storeId).single()

  // テストモード中はブラウザ通知もスキップ
  if (store?.is_test_mode) {
    console.log(`[push-admin] テストモード中 type=${type} → skip`)
    return NextResponse.json({ ok: true, sent: 0, skipped: true, reason: 'test_mode' })
  }

  const settings: Record<string, boolean> = store?.push_settings ?? {}
  // デフォルトは true（カラムが未設定の店舗でも通知する）
  if (type && settings[type] === false) {
    console.log(`[push-admin] type=${type} disabled for store=${storeId}`)
    return NextResponse.json({ ok: true, sent: 0, skipped: true })
  }

  const { data: subs } = await (supabase.from('push_subscriptions') as any)
    .select('endpoint, p256dh, auth').eq('store_id', storeId)

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title, body, url })
  const results = await Promise.allSettled(
    subs.map((s: any) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      )
    )
  )

  // 期限切れサブスクリプション（410/404）を自動削除
  const expired = subs.filter((_: any, i: number) => {
    const r = results[i]
    return r.status === 'rejected' && [410, 404].includes((r as any).reason?.statusCode)
  })
  if (expired.length) {
    await Promise.all(
      expired.map((s: any) =>
        (supabase.from('push_subscriptions') as any).delete().eq('endpoint', s.endpoint)
      )
    )
  }

  const sent = results.filter(r => r.status === 'fulfilled').length
  console.log(`[push-admin] type=${type} storeId=${storeId} sent=${sent}/${subs.length}`)
  return NextResponse.json({ ok: true, sent })
}
