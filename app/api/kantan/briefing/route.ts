export const dynamic = 'force-dynamic'

// かんたんLINEモード: 今日のやることリストを生成し、登録済みスタッフ全員のLINEへ配信する。
// 管理画面の「朝のリストを送る」ボタン、または cron から呼び出す想定。

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { regenerateTodayTasks, buildTaskListMessage, linePush } from '@/lib/kantan'
import { createAdminClient } from '@/lib/supabaseAdmin'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) { timingSafeEqual(bufA, bufA); return false }
  return timingSafeEqual(bufA, bufB)
}

export async function POST(req: NextRequest) {
  try {
    const { storeId, storePin } = await req.json() as { storeId?: string; storePin?: string }
    if (!storeId || !storePin) {
      return NextResponse.json({ ok: false, error: '認証情報が必要です (storeId + storePin)' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: store } = await supabase
      .from('stores')
      .select('id, name, pin')
      .eq('id', storeId)
      .single()
    if (!store || !safeEqual(String(storePin), String(store.pin ?? ''))) {
      return NextResponse.json({ ok: false, error: '認証に失敗しました' }, { status: 401 })
    }

    const tasks = await regenerateTodayTasks(supabase, storeId)
    const message = buildTaskListMessage(tasks, store.name)

    const { data: staff } = await supabase
      .from('staff_line_accounts')
      .select('line_user_id')
      .eq('store_id', storeId)

    let sent = 0
    for (const s of staff ?? []) {
      await linePush(s.line_user_id, message)
      sent++
    }

    return NextResponse.json({
      ok: true,
      taskCount: tasks.length,
      sentTo: sent,
      message,
    })
  } catch (e) {
    console.error('[kantan/briefing]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
