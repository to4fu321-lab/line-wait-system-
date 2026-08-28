export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { getLineToken } from '@/lib/line-config'
import { pushCard } from '@/lib/line-flex'
import { canNotifyNow } from '@/lib/notifyWindow'
import type { BusinessHours } from '@/lib/pop'

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
  const desiredDate = body.desiredDate  as string | undefined
  // kind: 'completed'(既定) = お直し完了通知 / 'received' = 受付完了通知（受付時にすぐ連絡したい場合）
  const kind = (body.kind as string | undefined) === 'received' ? 'received' : 'completed'

  if (!repairId) {
    return NextResponse.json({ ok: false, error: 'repairId required' }, { status: 400 })
  }
  const supabase = createAdminClient()

  // 営業時間チェック（完了通知のみ）。閉店間際・定休日は現場に知らせる。
  //   ※ 定期実行の仕組みが無いため「保留して後で自動送信」はできない。
  //     黙って送らないと通知そのものが消えるので、送信は止めず outsideHours を
  //     返し、呼び出し側（完了操作のUI）が声かけを判断できるようにする。
  //   store_id は呼び出し元が渡していないので repairId から引く。
  let outsideHours = false
  let nextOpenAt: string | null = null
  if (kind === 'completed') {
    const { data: row } = await (supabase as any)
      .from('repair_histories').select('store_id').eq('id', repairId).maybeSingle()
    if (row?.store_id) {
      const { data: store } = await (supabase as any)
        .from('stores').select('business_hours').eq('id', row.store_id).maybeSingle()
      const w = canNotifyNow(store?.business_hours as BusinessHours | null)
      if (!w.canSendNow) {
        outsideHours = true
        nextOpenAt = w.nextOpenAt ? w.nextOpenAt.toISOString() : null
      }
    }
  }

  const storeLabel = storeName ? `【${storeName}】` : ''
  const reqText    = reqNo ? `\n依頼番号：${reqNo}` : ''
  const dateText   = desiredDate ? `\n仕上がり希望：${desiredDate}` : ''

  // ── LINE通知 ────────────────────────────────────────────────
  if (lineUserId) {
    const bodyLines = [itemName, reqNo ? `依頼番号：${reqNo}` : null, kind === 'received' && desiredDate ? `仕上がり希望：${desiredDate}` : null]
      .filter(Boolean) as string[]
    const result = await pushCard(TOKEN, lineUserId, kind === 'received' ? `お直し受付 ${customerName} 様` : `お直し完了 ${customerName} 様`, {
      kind: kind === 'received' ? 'registered' : 'ready',
      title: kind === 'received' ? 'お直しを受け付けました' : 'お直しが完了しました',
      storeName: storeName || undefined,
      customerName: customerName || undefined,
      bodyLines: bodyLines.length ? bodyLines : undefined,
      note: kind === 'received'
        ? '仕上がり次第、あらためてご連絡いたします。\nお控えの依頼番号をお伝えください。'
        : 'お控えの依頼番号をお伝えください。\nスタッフがお渡しの準備をしてお待ちしております。',
    })
    if (!result.ok) {
      console.error('[notify-repair] LINE error:', result.error)
      return NextResponse.json({ ok: false, error: `LINE ${result.status ?? ''}` }, { status: 500 })
    }
    // notified は「完了通知済み」の意味で使われているため、受付通知では更新しない
    if (kind !== 'received') {
      await (supabase as any).from('repair_histories').update({ notified: true }).eq('id', repairId)
    }
    console.log('[notify-repair] LINE sent:', repairId, kind)
    return NextResponse.json({ ok: true, channel: 'line', outsideHours, nextOpenAt })
  }

  // ── SMS通知 ─────────────────────────────────────────────────
  if (tel) {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      console.log('[notify-repair] Twilio未設定 skip')
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_twilio_config' })
    }
    const smsText = kind === 'received'
      ? `${storeLabel}✂️お直し受付のお知らせ\n\n` +
        `${customerName} 様\n${itemName}のお直しを受け付けました。` +
        `${reqText}${dateText}\n仕上がり次第あらためてご連絡いたします。`
      : `${storeLabel}✂️お直し完了のお知らせ\n\n` +
        `${customerName} 様\n${itemName}のお直しが完了しました。` +
        `${reqText}\nお受け取りにお越しください。`
    try {
      await sendSms(tel, smsText)
      if (kind !== 'received') {
        await (supabase as any).from('repair_histories').update({ notified: true }).eq('id', repairId)
      }
      console.log('[notify-repair] SMS sent:', repairId, toE164Japan(tel), kind)
      return NextResponse.json({ ok: true, channel: 'sms', outsideHours, nextOpenAt })
    } catch (e) {
      console.error('[notify-repair] SMS error:', e)
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, skipped: true, reason: 'no_contact' })
}
