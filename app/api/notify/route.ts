export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLiffBaseUrl, getLineToken, storeBizType } from '@/lib/line-config'

export async function POST(req: NextRequest) {
  const { lineUserId, ticketNumber, customerName, storeName: rawStoreName, storeId, type } = await req.json()

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
    const { data: st } = await (supabase.from('stores') as any)
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
    const { data } = await supabase.from('stores').select('name').eq('id', storeId).single()
    storeName = data?.name ?? ''
  }

  const paddedNum = String(ticketNumber).padStart(3, '0')
  const storeUrl  = storeId ? `\n\n▼ 画面を開く\n${liffBase}/${storeId}\n\nURLを開き\n画面をスタッフにお見せください。` : ''
  const storeLabel = storeName ? `【${storeName}】\n` : ''

  const messageText = type === 'registered'
    ? `✅ 受付が完了しました！\n\n${storeLabel}整理番号：${paddedNum}\n${customerName} 様\n\n現在の待ち状況はこちらから確認できます👇\n${liffBase}/${storeId}`
    : `🔔 お呼びしています！\n\n${storeLabel}整理番号：${paddedNum}\n${customerName} 様\n\nカウンターへお越しください。${storeUrl}`

  console.log(`[LINE通知送信] type=${type ?? 'calling'} No.${ticketNumber} ${customerName} userId=${lineUserId.slice(0, 8)}...`)

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: messageText }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[LINE API Error] status=${res.status}`, err)
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }

    console.log(`[LINE通知成功] No.${ticketNumber} ${customerName}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[LINE notify exception]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
