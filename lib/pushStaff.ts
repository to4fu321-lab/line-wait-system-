// ============================================================
// スタッフ個人宛のWebプッシュ送信ヘルパ（サーバ専用）
//   push_subscriptions(kind='staff', staff_id=...) を対象に送る。
//   既存 push-admin と同じ web-push / VAPID を使用。
// ============================================================
import { webpush, setupWebPush } from '@/lib/webPushSetup'
import { createAdminClient } from '@/lib/supabaseAdmin'

// 秘密鍵はコードに埋め込まない（必ず env で設定する。漏洩時はローテーション）
const vapidReady = setupWebPush(
  'mailto:to4fu321@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
)

// staffIds（複数可）宛に通知。テストモードの店舗はスキップ。
export async function pushToStaff(opts: {
  storeId: string
  staffIds: string[]
  title: string
  body: string
  url: string
}): Promise<{ sent: number }> {
  const { storeId, staffIds, title, body, url } = opts
  if (!vapidReady || !staffIds.length) return { sent: 0 }
  const supabase = createAdminClient()

  const { data: store } = await (supabase.from('stores') as any)
    .select('is_test_mode').eq('id', storeId).single()
  if (store?.is_test_mode) return { sent: 0 }

  const { data: subs } = await (supabase.from('push_subscriptions') as any)
    .select('endpoint, p256dh, auth').eq('kind', 'staff').in('staff_id', staffIds)
  if (!subs?.length) return { sent: 0 }

  const payload = JSON.stringify({ title, body, url })
  const results = await Promise.allSettled(
    subs.map((s: any) => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
    ))
  )
  // 期限切れ削除
  const expired = subs.filter((_: any, i: number) => {
    const r = results[i]
    return r.status === 'rejected' && [410, 404].includes((r as any).reason?.statusCode)
  })
  if (expired.length) {
    await Promise.all(expired.map((s: any) =>
      (supabase.from('push_subscriptions') as any).delete().eq('endpoint', s.endpoint)))
  }
  return { sent: results.filter(r => r.status === 'fulfilled').length }
}
