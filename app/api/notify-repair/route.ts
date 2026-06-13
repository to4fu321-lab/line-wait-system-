export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getLineToken } from '@/lib/line-config'
import { pushCard } from '@/lib/line-flex'

const TOKEN      = getLineToken('uniform')
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
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'body parse error' }, { status: 400 })
  }

  const repairId    = body.repairId     as string | undefined
  const lineUserId  = body.lineUserId   as string | null | undefined
  const tel         = body.tel          as string | null | undefined
  const customerName = body.customerName as string | undefined ?? ''
  const itemName    = body.itemName     as string | undefined ?? ''
  const storeName   = body.storeName    as string | undefined ?? ''
  const reqNo       = body.reqNo        as string | undefined

  if (!repairId) {
    return NextResponse.json({ ok: false, error: 'repairId required' }, { status: 400 })
  }

  const storeLabel = storeName ? `【${storeName}】` : ''
  const reqText    = reqNo ? `\n依頼番号：${reqNo}` : ''

  // ── LINE通知 ────────────────────────────────────────────────
  if (lineUserId) {
    const bodyLines = [itemName, reqNo ? `依頼番号：${reqNo}` : null].filter(Boolean) as string[]
    const result = await pushCard(TOKEN, lineUserId, `お直し完了 ${customerName} 様`, {
      kind: 'ready',
      title: 'お直しが完了しました',
      storeName: storeName || undefined,
      customerName: customerName || undefined,
      bodyLines: bodyLines.length ? bodyLines : undefined,
      note: 'お控えの依頼番号をお伝えください。\nスタッフがお渡しの準備をしてお待ちしております。',
    })
    if (!result.ok) {
      console.error('[notify-repair] LINE error:', result.error)
      return NextResponse.json({ ok: false, error: `LINE ${result.status ?? ''}` }, { status: 500 })
    }
    await supabase.from('repair_histories').update({ notified: true }).eq('id', repairId)
    console.log('[notify-repair] LINE sent:', repairId)
    return NextResponse.json({ ok: true, channel: 'line' })
  }

  // ── SMS通知 ─────────────────────────────────────────────────
  if (tel) {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      console.log('[notify-repair] Twilio未設定 skip')
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_twilio_config' })
    }
    const smsText =
      `${storeLabel}✂️お直し完了のお知らせ\n\n` +
      `${customerName} 様\n${itemName}のお直しが完了しました。` +
      `${reqText}\nお受け取りにお越しください。`
    try {
      await sendSms(tel, smsText)
      await supabase.from('repair_histories').update({ notified: true }).eq('id', repairId)
      console.log('[notify-repair] SMS sent:', repairId, toE164Japan(tel))
      return NextResponse.json({ ok: true, channel: 'sms' })
    } catch (e) {
      console.error('[notify-repair] SMS error:', e)
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, skipped: true, reason: 'no_contact' })
}
