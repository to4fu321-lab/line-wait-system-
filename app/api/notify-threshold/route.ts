import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getTodayStart } from '@/lib/supabase'

const LIFF_URL = 'https://liff.line.me/2010126882-aUahQStD'

// POST { storeId, excludeId }
// 完了/不在 になったチケットを除外した (waiting + calling) のうち
// ちょうど threshold 番目の人にプッシュ通知を送る
export async function POST(req: NextRequest) {
  const { storeId, excludeId } = await req.json()

  if (!storeId) {
    return NextResponse.json({ ok: false, error: 'storeId is required' }, { status: 400 })
  }

  const supabaseUrl =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim() ||
    'https://ffbixfbddxguhdhayqqy.supabase.co'
  const supabaseKey =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim() ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYml4ZmJkZHhndWhkaGF5cXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzk3MjksImV4cCI6MjA5NDcxNTcyOX0.F2YjXfFE148wL6kh93WMzKF68SBf-pIYIxGImMMUnFk'

  const supabase = createClient<Database>(supabaseUrl, supabaseKey)

  // 1. stores から notice_threshold と店舗名を取得
  //    notice_threshold カラムが未作成でも name だけでフォールバック動作する
  let noticeThreshold = 3
  let storeName = ''

  const { data: storeData, error: storeErr } = await supabase
    .from('stores')
    .select('name, notice_threshold')
    .eq('id', storeId)
    .single()

  if (storeErr) {
    console.warn('[notify-threshold] full store fetch failed, retrying name only:', storeErr.message)
    const { data: basicData } = await supabase
      .from('stores').select('name').eq('id', storeId).single()
    if (!basicData) {
      return NextResponse.json({ ok: false, error: 'store not found' }, { status: 404 })
    }
    storeName = basicData.name ?? ''
  } else if (storeData) {
    noticeThreshold = storeData.notice_threshold ?? 3
    storeName       = storeData.name ?? ''
  } else {
    return NextResponse.json({ ok: false, error: 'store not found' }, { status: 404 })
  }

  // 2. waiting + calling を ticket_number 昇順で取得
  //    （顧客画面と同じカウント方法 = 完了/不在でポジションが下がる設計）
  //    excludeId は直前に完了/不在になったチケット → まだ DB に old status が残る可能性があるため除外
  const baseQuery = supabase
    .from('queues')
    .select('id, ticket_number, customer_name, line_user_id, status')
    .eq('store_id', storeId)
    .in('status', ['waiting', 'calling'])
    .gte('created_at', getTodayStart())
    .order('ticket_number', { ascending: true })

  const { data: activeTickets, error: queueErr } = excludeId
    ? await baseQuery.neq('id', excludeId)
    : await baseQuery

  if (queueErr) {
    console.error('[notify-threshold] queue fetch error:', queueErr)
    return NextResponse.json({ ok: false, error: 'queue fetch failed' }, { status: 500 })
  }

  const activeCount = activeTickets?.length ?? 0

  // 3. ちょうど threshold 番目のチケットに通知
  //    呼出のたびに threshold 番目の人が入れ替わり、1人ずつ通知が届く
  const targetIdx  = noticeThreshold - 1
  const nextTicket = activeTickets?.[targetIdx]

  if (!nextTicket) {
    console.log(`[notify-threshold] active=${activeCount} < threshold=${noticeThreshold} → skip`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no ticket at threshold position' })
  }

  if (!nextTicket.line_user_id) {
    console.log(`[notify-threshold] No.${nextTicket.ticket_number} LINE未連携 → skip`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no line_user_id' })
  }

  const token =
    process.env.LINE_CHANNEL_ACCESS_TOKEN ||
    'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='

  const storeLabel = storeName ? `【${storeName}】\n` : ''
  const paddedNum  = String(nextTicket.ticket_number).padStart(3, '0')
  const messageText =
    `⏰ まもなくお呼びします！\n\n${storeLabel}整理番号：${paddedNum}\n${nextTicket.customer_name} 様\n\nカウンター付近でお待ちください。\n\n▼ 待ち状況を確認\n${LIFF_URL}/${storeId}`

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: nextTicket.line_user_id,
        messages: [{ type: 'text', text: messageText }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[notify-threshold] LINE API Error:', err)
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }

    console.log(
      `[notify-threshold] 通知送信 No.${nextTicket.ticket_number} ${nextTicket.customer_name} 様 (position=${noticeThreshold}, active=${activeCount})`
    )
    return NextResponse.json({ ok: true, notified: nextTicket.ticket_number })
  } catch (e) {
    console.error('[notify-threshold] fetch failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
