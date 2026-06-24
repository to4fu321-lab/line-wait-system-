export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase, getTodayStart } from '@/lib/supabase'
import { getLiffBaseUrl, getLineToken, storeBizType } from '@/lib/line-config'
import { pushCard, ogTicketUrl, resolveOrigin, type CardOptions } from '@/lib/line-flex'

export async function POST(req: NextRequest) {
  const { lineUserId, ticketNumber, customerName, storeName: rawStoreName, storeId, type, queueId: rawQueueId } = await req.json()

  if (!lineUserId) {
    console.log(`[LINE通知スキップ] No.${ticketNumber} ${customerName} 様 – line_user_id が null`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_line_user_id' })
  }

  if (process.env.LINE_NOTIFY_DISABLED === 'true') {
    console.log(`[LINE通知無効] No.${ticketNumber} ${customerName} 様 – LINE_NOTIFY_DISABLED=true`)
    return NextResponse.json({ ok: true, skipped: true, reason: 'disabled' })
  }

  // 店舗情報を取得（テストモード確認 + business_type でトークン選択）
  let bizType: ReturnType<typeof storeBizType> = 'uniform'
  if (storeId) {
    const { data: st } = await ((supabase as any).from('stores') as any)
      .select('is_test_mode, business_type').eq('id', storeId).single()
    if (st?.is_test_mode) {
      console.log(`[LINE通知スキップ] テストモード中 No.${ticketNumber} ${customerName}`)
      return NextResponse.json({ ok: true, skipped: true, reason: 'test_mode' })
    }
    bizType = storeBizType(st?.business_type)
  }

  const token = getLineToken(bizType)
  const liffBase = getLiffBaseUrl(bizType)

  let storeName = rawStoreName
  if (!storeName && storeId) {
    const { data } = await (supabase as any).from('stores').select('name').eq('id', storeId).single()
    storeName = data?.name ?? ''
  }

  // 進捗ページ用に queue id を解決（未指定なら ticket_number から当日分を逆引き）
  let queueId: string | undefined = rawQueueId
  if (!queueId && storeId && ticketNumber != null) {
    const { data: q } = await supabase
      .from('queues')
      .select('id')
      .eq('store_id', storeId)
      .eq('ticket_number', ticketNumber)
      .gte('created_at', getTodayStart())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    queueId = (q as { id?: string } | null)?.id
  }

  const paddedNum = String(ticketNumber).padStart(3, '0')
  const origin = resolveOrigin(req.url)
  const progressUrl = queueId && storeId ? `${liffBase}/${storeId}/progress?queue=${queueId}` : (storeId ? `${liffBase}/${storeId}` : undefined)

  const isRegistered = type === 'registered'
  const kind = isRegistered ? 'registered' : 'call'
  const imageUrl = ogTicketUrl(origin, {
    no: paddedNum,
    store: storeName || undefined,
    label: '整理番号',
    kind,
  })

  const card: CardOptions = isRegistered
    ? {
        kind: 'registered',
        title: '受付が完了しました',
        storeName,
        numberLabel: '整理番号',
        number: paddedNum,
        customerName,
        imageUrl,
        steps: [{ label: '受付完了' }, { label: 'お呼び出し' }, { label: '完了' }],
        currentStep: 0,
        note: '順番になりましたらお呼び出しします。\n下のボタンから待ち状況を確認できます。',
        buttonLabel: '待ち状況を見る',
        buttonUrl: progressUrl,
      }
    : {
        kind: 'call',
        title: 'お呼び出し中です',
        storeName,
        numberLabel: '整理番号',
        number: paddedNum,
        customerName,
        imageUrl,
        steps: [{ label: '受付完了' }, { label: 'お呼び出し' }, { label: '完了' }],
        currentStep: 1,
        note: 'カウンターへお越しください。\nこの画面をスタッフにお見せください。',
        buttonLabel: progressUrl ? '受付画面を開く' : undefined,
        buttonUrl: progressUrl,
      }

  const altText = isRegistered
    ? `受付完了 整理番号:${paddedNum} ${customerName ?? ''} 様`
    : `お呼び出し 整理番号:${paddedNum} ${customerName ?? ''} 様`

  console.log(`[LINE通知送信] type=${type ?? 'calling'} No.${ticketNumber} ${customerName} userId=${lineUserId.slice(0, 8)}...`)

  const result = await pushCard(token, lineUserId, altText, card)
  if (!result.ok) {
    console.error(`[LINE API Error] status=${result.status}`, result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  console.log(`[LINE通知成功] No.${ticketNumber} ${customerName}`)
  return NextResponse.json({ ok: true })
}
