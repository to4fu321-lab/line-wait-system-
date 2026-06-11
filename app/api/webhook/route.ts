export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getLiffBaseUrl, getLineToken, getLineSecret } from '@/lib/line-config'
import {
  getOrCreateTodayTasks, regenerateTodayTasks, buildTaskListMessage,
  parseDoneReply, completeTask, lineReply,
} from '@/lib/kantan'

// 制服販売店向け LINE チャンネルの webhook
const TOKEN    = getLineToken('uniform')
const SECRET   = getLineSecret('uniform')
const LIFF_BASE = getLiffBaseUrl('uniform')

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function verifySignature(body: string, sig: string) {
  if (!SECRET) return true
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64') === sig
}

// ── かんたんLINEモード: スタッフからのテキストを処理 ──────────
async function handleStaffText(
  event: { replyToken: string; source: { userId: string }; message: { text: string } },
): Promise<boolean> {
  const supabase = getSupabase()
  const userId = event.source.userId
  const text = (event.message.text ?? '').trim()

  // ① スタッフ登録「スタッフ登録 123456」
  const reg = text.match(/^スタッフ登録\s*(\d{4,8})$/)
  if (reg) {
    const code = reg[1]
    const { data: store } = await supabase
      .from('stores')
      .select('id, name')
      .eq('staff_link_code', code)
      .maybeSingle()
    if (!store) {
      await lineReply(event.replyToken, '登録コードが見つかりませんでした。お店の管理画面（設定 → かんたんLINEモード）でコードをご確認ください。')
      return true
    }
    // プロフィール名を取得（ベストエフォート）
    let displayName: string | null = null
    try {
      const prof = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
      if (prof.ok) displayName = (await prof.json()).displayName ?? null
    } catch { /* noop */ }

    await supabase.from('staff_line_accounts').upsert(
      { store_id: store.id, line_user_id: userId, display_name: displayName },
      { onConflict: 'line_user_id' },
    )
    await lineReply(event.replyToken,
      `【${store.name}】のスタッフとして登録しました✨\n\n「きょう」と送ると、今日のやることリストが届きます。\n終わったら「1できた」のように返信してください。`)
    return true
  }

  // ② 登録済みスタッフか確認（未登録なら何もしない＝お客様向けの動作を邪魔しない）
  const { data: staff } = await supabase
    .from('staff_line_accounts')
    .select('store_id, store:stores(name)')
    .eq('line_user_id', userId)
    .maybeSingle()
  if (!staff) return false

  const storeId = staff.store_id as string
  const storeRel = Array.isArray(staff.store) ? staff.store[0] : staff.store
  const storeName = (storeRel as { name?: string } | null)?.name ?? ''

  // ③ 「きょう」→ タスクリスト送信（最新状態で再生成）
  if (/^(きょう|今日|タスク|やること|リスト|めにゅー|メニュー)$/.test(text)) {
    const tasks = await regenerateTodayTasks(supabase, storeId)
    await lineReply(event.replyToken, buildTaskListMessage(tasks, storeName))
    return true
  }

  // ④ 「1できた」「ぜんぶできた」→ タスク完了
  const done = parseDoneReply(text)
  if (done) {
    const tasks = await getOrCreateTodayTasks(supabase, storeId)
    const targets = done.all
      ? tasks.filter(t => t.status === 'pending')
      : tasks.filter(t => done.nums.includes(t.seq) && t.status === 'pending')

    if (targets.length === 0) {
      const already = !done.all && done.nums.some(n => tasks.find(t => t.seq === n)?.status === 'done')
      await lineReply(event.replyToken, already
        ? 'その番号はもう完了になっています👌「きょう」と送ると最新のリストを確認できます。'
        : '対象のタスクが見つかりませんでした。「きょう」と送ると今日のリストが届きます。')
      return true
    }

    const results: string[] = []
    for (const task of targets) {
      const detail = await completeTask(supabase, task, userId, storeName)
      await supabase.from('kantan_tasks')
        .update({ status: 'done', done_by: userId, done_at: new Date().toISOString() })
        .eq('id', task.id)
      results.push(`✅ ${task.seq}. ${task.label}\n　→ ${detail}`)
    }

    const remaining = tasks.filter(t => t.status === 'pending' && !targets.some(d => d.id === t.id)).length
    const foot = remaining === 0
      ? '\n\nこれで今日のやることはぜんぶ完了です！お疲れ様でした🎉'
      : `\n\nのこり ${remaining} 件です。`
    await lineReply(event.replyToken, results.join('\n') + foot)
    return true
  }

  // ⑤ スタッフからのその他テキスト → 使い方を案内
  if (/^(ヘルプ|へるぷ|help|使い方|つかいかた)$/.test(text)) {
    await lineReply(event.replyToken,
      '📋 かんたんLINEモードの使い方\n\n・「きょう」→ 今日のやることリスト\n・「1できた」→ 1番を完了にする（お客様への連絡も自動で送ります）\n・「1、2できた」→ まとめて完了\n・「ぜんぶできた」→ 全部完了')
    return true
  }

  return false
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  if (!verifySignature(body, req.headers.get('x-line-signature') || '')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const { events = [] } = JSON.parse(body)
  for (const event of events) {
    if (event.type === 'follow') {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          to: event.source.userId,
          messages: [{
            type: 'text',
            text: `友だち追加ありがとうございます😊\n採寸・受付はこちらからどうぞ。\n${LIFF_BASE}/line-home`,
          }],
        }),
      }).catch(console.error)
    }

    if (event.type === 'message' && event.message?.type === 'text' && event.source?.userId) {
      try {
        await handleStaffText(event)
      } catch (e) {
        console.error('[webhook] staff text handling failed:', e)
      }
    }
  }
  return NextResponse.json({ ok: true })
}
