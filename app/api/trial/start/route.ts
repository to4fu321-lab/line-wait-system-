export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

const TRIAL_DAYS = 30

// 無料体験のセルフ開始。店舗をその場で発行し、storeId と PIN を返す（即ログイン可）。
export async function POST(req: Request) {
  try {
    const { storeName, contact } = await req.json() as { storeName?: string; contact?: string }
    const name = (storeName ?? '').trim()
    if (!name) return NextResponse.json({ ok: false, error: 'お店の名前を入力してください' }, { status: 400 })
    if (name.length > 50) return NextResponse.json({ ok: false, error: 'お店の名前が長すぎます' }, { status: 400 })

    const supabase = createAdminClient({ noStore: true })
    const pin = String(Math.floor(1000 + Math.random() * 9000)) // 4桁

    const features = {
      _plan: 'simple',
      tab_queue: true,
      queue: true,
      reservation: true,
      _trial: true,
      _trial_started: new Date().toISOString(),
      _trial_days: TRIAL_DAYS,
    }

    const { data, error } = await supabase.from('stores').insert({
      name,
      pin,
      business_type: 'uniform',
      store_type: 'uniform',
      is_open: false,
      features,
      repair_notes: contact ? `体験申込連絡先: ${String(contact).slice(0, 120)}` : null,
    }).select('id').single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, storeId: (data as { id: string }).id, pin, trialDays: TRIAL_DAYS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
