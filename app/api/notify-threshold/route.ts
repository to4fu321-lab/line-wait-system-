export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase, getTodayStart } from '@/lib/supabase'
import { pushCard, ogTicketUrl, resolveOrigin } from '@/lib/line-flex'

const LIFF_URL = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}`

// POST { storeId, excludeId }
// 完了/不在 になったチケットを除外した (waiting + calling) のうち
// ちょうど threshold 番目の人にプッシュ通知を送る
export async function POST(req: NextRequest) {
  let storeId: string | undefined
  let excludeId: string | undefined

  try {
    const body = await req.json()
    storeId  = body.storeId
    excludeId = body.excludeId
  } catch (e) {
    return NextResponse.json({ ok: false, error: `body parse error: ${String(e)}` }, { status: 400 })
  }

  if (!storeId) {
    return NextResponse.json({ ok: false, error: 'storeId is required' }, { status: 400 })
  }

  // 1. stores から notice_threshold と店舗名を取得
  let noticeThreshold = 3
  let storeName = ''

  try {
    const { data: storeData, error: storeErr } = await supabase
      .from('stores')
      .select('name, notice_threshold')
      .eq('id', storeId)
      .single()

    if (storeErr) {
      console.warn('[notify-threshold] store fetch failed, retrying name only:', storeErr.message)
      const { data: basicData, error: basicErr } = await supabase
        .from('stores').select('name').eq('id', storeId).single()
      if (basicErr || !basicData) {
        return NextResponse.json({ ok: false, error: `store not found: ${basicErr?.message}` }, { status: 404 })
      }
      storeName = basicData.name ?? ''
    } else if (storeData) {
      noticeThreshold = storeData.notice_threshold ?? 3
      storeName       = storeData.name ?? ''
    } else {
      return NextResponse.json({ ok: false, error: 'store not found' }, { status: 404 })
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: `store query error: ${String(e)}` }, { status: 500 })
  }

  // 2. waiting + calling を ticket_number 昇順で取得
  let activeTickets: Array<{ id: string; ticket_number: number; customer_name: string; line_user_id: string | null; status: string }> | null = null

  try {
    const baseQuery = supabase
      .from('queues')
      .select('id, ticket_number, customer_name, line_user_id, status')
      .eq('store_id', storeId)
      .in('status', ['waiting', 'calling'])
      .gte('created_at', getTodayStart())
      .order('ticket_number', { ascending: true })

    const { data, error: queueErr } = excludeId
      ? await baseQuery.neq('id', excludeId)
      : await baseQuery

    if (queueErr) {
      console.error('[notify-threshold] queue fetch error:', queueErr)
      return NextResponse.json({ ok: false, error: `queue fetch error: ${queueErr.message}` }, { status: 500 })
    }
    activeTickets = data
  } catch (e) {
    return NextResponse.json({ ok: false, error: `queue query error: ${String(e)}` }, { status: 500 })
  }

  const activeCount = activeTickets?.length ?? 0

  // 3. ちょうど threshold 番目のチケットに通知
  const targetIdx  = noticeThreshold - 1
  const nextTicket = activeTickets?.[targetIdx]

  if (!nextTicket) {
    console.log(`[notify-threshold] active=${activeCount} < threshold=${noticeThreshold} → skip`)
    return NextResponse.json({ ok: true, skipped: true, reason: `active=${activeCount} < threshold=${noticeThreshold}` })
  }

  if (!nextTicket.line_user_id) {
    console.log(`[notify-threshold] No.${nextTicket.ticket_number} LINE未連携 → skip`)
    return NextResponse.json({ ok: true, skipped: true, reason: `No.${nextTicket.ticket_number} LINE未連携` })
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
  const paddedNum  = String(nextTicket.ticket_number).padStart(3, '0')
  const origin = resolveOrigin(req.url)
  const progressUrl = `${LIFF_URL}/${storeId}/progress?queue=${nextTicket.id}`

  const result = await pushCard(token, nextTicket.line_user_id, `まもなくお呼び出し 整理番号:${paddedNum}`, {
    kind: 'soon',
    title: 'まもなくお呼びします',
    storeName: storeName || undefined,
    numberLabel: '整理番号',
    number: paddedNum,
    customerName: nextTicket.customer_name,
    imageUrl: ogTicketUrl(origin, { no: paddedNum, store: storeName || undefined, label: '整理番号', kind: 'soon' }),
    steps: [{ label: '受付完了' }, { label: 'お呼び出し' }, { label: '完了' }],
    currentStep: 0,
    note: 'カウンター付近でお待ちください。\n下のボタンから待ち状況を確認できます。',
    buttonLabel: '待ち状況を見る',
    buttonUrl: progressUrl,
  })

  if (!result.ok) {
    console.error('[notify-threshold] LINE API Error:', result.error)
    return NextResponse.json({ ok: false, error: `LINE API ${result.status ?? ''}: ${result.error}` }, { status: 500 })
  }

  console.log(
    `[notify-threshold] 通知送信 No.${nextTicket.ticket_number} ${nextTicket.customer_name} 様 (position=${noticeThreshold}, active=${activeCount})`
  )
  return NextResponse.json({ ok: true, notified: nextTicket.ticket_number })
}
