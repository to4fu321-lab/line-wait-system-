export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { safeEqual } from '@/lib/auth/safeEqual'

/**
 * POST /api/timecard/clock
 * Body: { storeId, staffId, date, pin? }
 *
 * 店頭kioskからの打刻。現在の状態から出勤/退勤を自動判定する。
 * 店舗設定 timecard_settings.require_pin が有効な場合は
 * スタッフ個人PINをサーバー側で照合する。
 */
export async function POST(req: Request) {
  try {
    const { storeId, staffId, date, pin } = await req.json()
    if (!storeId || !staffId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return NextResponse.json({ error: 'storeId / staffId / date が必要です' }, { status: 400 })
    }

    const supabase = createAdminClient({ noStore: true })

    const [{ data: store }, { data: staff }] = await Promise.all([
      supabase.from('stores').select('timecard_settings').eq('id', storeId).single(),
      supabase.from('staff').select('id, pin, active')
        .eq('id', staffId).eq('store_id', storeId).maybeSingle(),
    ])
    if (!staff || !staff.active) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 })
    }
    const requirePin = !!(store?.timecard_settings as { require_pin?: boolean } | null)?.require_pin
    if (requirePin) {
      if (!pin || !staff.pin || !safeEqual(String(pin), String(staff.pin))) {
        return NextResponse.json({ error: 'PINが違います' }, { status: 401 })
      }
    }

    // 当日の最新打刻を取得して出勤/退勤を判定
    const { data: records } = await supabase
      .from('time_records').select('*')
      .eq('store_id', storeId).eq('staff_id', staffId).eq('work_date', date)
      .order('created_at', { ascending: false })
      .limit(1)
    const latest = records?.[0] ?? null

    if (latest && latest.status !== 'done') {
      // 勤務中 → 退勤
      const { error } = await supabase.from('time_records')
        .update({ clock_out_at: new Date().toISOString(), status: 'done' })
        .eq('id', latest.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ action: 'out' })
    }

    // 出勤(公開シフトがあれば紐づけ)
    const { data: shifts } = await supabase
      .from('shifts').select('id')
      .eq('store_id', storeId).eq('staff_id', staffId)
      .eq('work_date', date).eq('status', 'published')
      .limit(1)
    const { error } = await supabase.from('time_records').insert({
      store_id: storeId, staff_id: staffId, shift_id: shifts?.[0]?.id ?? null,
      work_date: date, clock_in_at: new Date().toISOString(), status: 'working',
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ action: 'in' })
  } catch (err) {
    console.error('[timecard/clock]', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
