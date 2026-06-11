export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'

// お直しは制服販売店専用 → uniform アカウントで通知
const TOKEN    = getLineToken('uniform')
const LIFF_URL = getLiffBaseUrl('uniform')

// Twilio SMS（LINE未連携顧客向け）
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID  ?? ''
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN   ?? ''
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER  ?? ''

function toE164Japan(tel: string): string {
  const digits = tel.replace(/[-\s()]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0')) return `+81${digits.slice(1)}`
  return `+81${digits}`
}

async function sendSms(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const params = new URLSearchParams({ To: toE164Japan(to), From: TWILIO_FROM, Body: body })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
    },
    body: params.toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Twilio ${res.status}: ${err}`)
  }
}

export async function POST(req: NextRequest) {
  let repairId: string | undefined
  let type: string = 'completed'

  try {
    const body = await req.json()
    repairId = body.repairId
    type     = body.type ?? 'completed'
  } catch (e) {
    return NextResponse.json({ ok: false, error: `body parse error: ${String(e)}` }, { status: 400 })
  }

  if (!repairId) {
    return NextResponse.json({ ok: false, error: 'repairId is required' }, { status: 400 })
  }

  const { data: repair, error: repairErr } = await supabase
    .from('repair_histories')
    .select(`
      id, item_name, content, slip_number, request_no, status,
      customer:customers ( name, line_user_id, tel ),
      store:stores ( id, name )
    `)
    .eq('id', repairId)
    .single()

  if (repairErr || !repair) {
    console.error('[notify-repair] repair not found:', repairErr?.message, repairErr?.code)
    return NextResponse.json({ ok: false, error: `repair not found: ${repairErr?.message}` }, { status: 404 })
  }

  const customer = repair.customer as { name: string; line_user_id: string | null; tel: string | null } | null
  const store    = repair.store    as { id: string; name: string } | null

  const storeName  = store?.name  ?? ''
  const storeLabel = storeName ? `【${storeName}】` : ''
  const reqNo      = (repair as any).request_no != null
    ? `R-${String((repair as any).request_no).padStart(4, '0')}`
    : repair.slip_number ?? null
  const reqText    = reqNo ? `\n依頼番号：${reqNo}` : ''
  const storeUrl   = store?.id ? `\n\n▼ 待ち状況\n${LIFF_URL}/${store.id}` : ''

  // ── LINE通知（LINE連携済み） ─────────────────────────────────
  if (customer?.line_user_id) {
    const messageText =
      `✂️ お直しが完了しました！\n\n${storeLabel}\n${customer.name} 様\n\n` +
      `${repair.item_name}\n${repair.content}${reqText}\n\n` +
      `お控えの依頼番号をお伝えください。\n` +
      `スタッフがお渡しの準備をしてお待ちしております。${storeUrl}`

    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ to: customer.line_user_id, messages: [{ type: 'text', text: messageText }] }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('[notify-repair] LINE API Error:', err)
        return NextResponse.json({ ok: false, error: `LINE API ${res.status}: ${err}` }, { status: 500 })
      }
      await supabase.from('repair_histories').update({ notified: true }).eq('id', repairId)
      console.log(`[notify-repair] LINE通知送信 repair=${repairId} customer=${customer.name}`)
      return NextResponse.json({ ok: true, notified: true, channel: 'line' })
    } catch (e) {
      console.error('[notify-repair] LINE fetch error:', e)
      return NextResponse.json({ ok: false, error: `LINE fetch error: ${String(e)}` }, { status: 500 })
    }
  }

  // ── SMS通知（LINE未連携・電話番号あり） ─────────────────────
  if (customer?.tel) {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      console.log(`[notify-repair] Twilio未設定 → skip (repair: ${repairId})`)
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_twilio_config' })
    }
    const smsText =
      `${storeLabel}✂️お直し完了のお知らせ\n\n` +
      `${customer.name} 様\n${repair.item_name}のお直しが完了しました。` +
      `${reqText}\nお受け取りにお越しください。`

    try {
      await sendSms(customer.tel, smsText)
      await supabase.from('repair_histories').update({ notified: true }).eq('id', repairId)
      console.log(`[notify-repair] SMS送信 repair=${repairId} tel=${customer.tel}`)
      return NextResponse.json({ ok: true, notified: true, channel: 'sms' })
    } catch (e) {
      console.error('[notify-repair] SMS error:', e)
      return NextResponse.json({ ok: false, error: `SMS error: ${String(e)}` }, { status: 500 })
    }
  }

  // 連絡手段なし
  console.log(`[notify-repair] 連絡手段なし → skip (repair: ${repairId})`)
  return NextResponse.json({ ok: true, skipped: true, reason: 'no_contact' })
}
