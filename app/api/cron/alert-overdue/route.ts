import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Vercel cron secret check
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret) return auth === `Bearer ${secret}`
  return true // dev: allow without secret
}

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='

async function pushLine(to: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  })
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  const results: string[] = []

  // 全店舗のアラート設定を取得
  const { data: stores } = await (supabase.from('stores') as any)
    .select('id, line_user_id, alert_days_repair, alert_days_purchase')
    .not('line_user_id', 'is', null)

  if (!stores) return NextResponse.json({ ok: true, results: [] })

  for (const store of stores) {
    const alertRepair   = store.alert_days_repair   ?? 7
    const alertPurchase = store.alert_days_purchase ?? 7
    const repairCutoff   = new Date(today.getTime() - alertRepair   * 86400000).toISOString()
    const purchaseCutoff = new Date(today.getTime() - alertPurchase * 86400000).toISOString()

    // お直し完了連絡済み → 未お渡し で期限超過
    const { data: overdueRepairs } = await supabase.from('repair_histories')
      .select('id, item_name, customer_id, completed_date')
      .eq('store_id', store.id).eq('status', 'completed')
      .lt('completed_date', repairCutoff.slice(0, 10))

    // 取置き入荷連絡済み → 未お渡し で期限超過
    const { data: overduePurchases } = await supabase.from('purchase_orders')
      .select('id, item_name, customer_id, arrived_date')
      .eq('store_id', store.id).eq('status', 'arrived')
      .lt('arrived_date', purchaseCutoff.slice(0, 10))

    const totalRepair   = overdueRepairs?.length   ?? 0
    const totalPurchase = overduePurchases?.length ?? 0

    if (totalRepair === 0 && totalPurchase === 0) continue

    const lines: string[] = ['📋 未お渡しアラート']
    if (totalRepair   > 0) lines.push(`✂️ お直し完了・未お渡し：${totalRepair}件（${alertRepair}日超）`)
    if (totalPurchase > 0) lines.push(`📦 取置き入荷・未お渡し：${totalPurchase}件（${alertPurchase}日超）`)
    lines.push('顧客管理画面からご確認ください。')

    await pushLine(store.line_user_id, lines.join('\n'))
    results.push(`${store.id}: repair=${totalRepair} purchase=${totalPurchase}`)
  }

  return NextResponse.json({ ok: true, results })
}
