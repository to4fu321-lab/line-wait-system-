// ── かんたんLINEモード: タスク生成・LINE配信・返信処理 ──────────
// サーバー専用（service role の supabase クライアントを受け取る）

import type { SupabaseClient } from '@supabase/supabase-js'
import { getLineToken } from './line-config'

const TOKEN = getLineToken('uniform')

export type KantanTaskType = 'repair_finish' | 'repair_deliver' | 'purchase_notify'

export interface KantanTask {
  id: string
  store_id: string
  task_date: string
  seq: number
  task_type: KantanTaskType
  ref_id: string
  label: string
  status: 'pending' | 'done'
}

export function jstToday(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

// ── LINE 送信 ────────────────────────────────────────────────
export async function linePush(to: string, text: string): Promise<void> {
  if (!TOKEN || !to) return
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  }).catch(console.error)
}

export async function lineReply(replyToken: string, text: string): Promise<void> {
  if (!TOKEN || !replyToken) return
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  }).catch(console.error)
}

// ── タスク生成 ───────────────────────────────────────────────
// 今日のタスクが既にあればそれを返し、無ければ現在のDB状態から生成する。
export async function getOrCreateTodayTasks(
  supabase: SupabaseClient,
  storeId: string,
): Promise<KantanTask[]> {
  const today = jstToday()

  const { data: existing } = await supabase
    .from('kantan_tasks')
    .select('*')
    .eq('store_id', storeId)
    .eq('task_date', today)
    .order('seq')

  if (existing && existing.length > 0) return existing as KantanTask[]

  return regenerateTodayTasks(supabase, storeId)
}

// 既存の done を保持しつつ、pending を最新のDB状態で作り直す
export async function regenerateTodayTasks(
  supabase: SupabaseClient,
  storeId: string,
): Promise<KantanTask[]> {
  const today = jstToday()

  const [{ data: repairsToFinish }, { data: repairsToDeliver }, { data: purchasesToNotify }] =
    await Promise.all([
      // 納期が今日以前で、まだ作業中のお直し → 「仕上げる」
      supabase.from('repair_histories')
        .select('id, item_name, content, customer:customers(name)')
        .eq('store_id', storeId)
        .eq('status', 'received')
        .lte('desired_completion_date', today),
      // 作業完了済み・未渡し → 「お渡しする」
      supabase.from('repair_histories')
        .select('id, item_name, customer:customers(name)')
        .eq('store_id', storeId)
        .eq('status', 'completed')
        .is('delivered_date', null),
      // 入荷済み・未連絡 → 「入荷連絡する」
      supabase.from('purchase_orders')
        .select('id, item_name, notified, customer:customers(name)')
        .eq('store_id', storeId)
        .eq('status', 'arrived')
        .eq('notified', false),
    ])

  type Row = { id: string; item_name: string; customer?: { name?: string } | { name?: string }[] | null }
  const custName = (r: Row) => {
    const c = Array.isArray(r.customer) ? r.customer[0] : r.customer
    return c?.name ? `${c.name}様` : 'お客様'
  }

  const candidates: Array<Pick<KantanTask, 'task_type' | 'ref_id' | 'label'>> = [
    ...(repairsToFinish ?? []).map((r: Row) => ({
      task_type: 'repair_finish' as const,
      ref_id: r.id,
      label: `${custName(r)}の「${r.item_name}」を仕上げる（納期）`,
    })),
    ...(repairsToDeliver ?? []).map((r: Row) => ({
      task_type: 'repair_deliver' as const,
      ref_id: r.id,
      label: `${custName(r)}に「${r.item_name}」をお渡しする`,
    })),
    ...(purchasesToNotify ?? []).map((r: Row) => ({
      task_type: 'purchase_notify' as const,
      ref_id: r.id,
      label: `${custName(r)}に「${r.item_name}」の入荷連絡をする`,
    })),
  ]

  // 既存タスクの done 状態を引き継ぐ
  const { data: olds } = await supabase
    .from('kantan_tasks')
    .select('ref_id, task_type, status, done_by, done_at')
    .eq('store_id', storeId)
    .eq('task_date', today)

  await supabase.from('kantan_tasks')
    .delete()
    .eq('store_id', storeId)
    .eq('task_date', today)

  if (candidates.length === 0) return []

  const rows = candidates.slice(0, 20).map((c, i) => {
    const old = (olds ?? []).find(o => o.ref_id === c.ref_id && o.task_type === c.task_type)
    return {
      store_id: storeId,
      task_date: today,
      seq: i + 1,
      ...c,
      status: old?.status === 'done' ? 'done' : 'pending',
      done_by: old?.done_by ?? null,
      done_at: old?.done_at ?? null,
    }
  })

  const { data: inserted, error } = await supabase
    .from('kantan_tasks')
    .insert(rows)
    .select('*')
    .order('seq')

  if (error) {
    console.error('[kantan] task insert failed:', error.message)
    return []
  }
  return (inserted ?? []) as KantanTask[]
}

// ── タスクリストの文面 ───────────────────────────────────────
export function buildTaskListMessage(tasks: KantanTask[], storeName?: string): string {
  const head = storeName ? `【${storeName}】きょうのやること\n` : 'きょうのやること\n'
  if (tasks.length === 0) {
    return head + '\n今日は持ち越しゼロです。落ち着いたスタートですね😊'
  }
  const pending = tasks.filter(t => t.status === 'pending')
  const lines = tasks.map(t =>
    t.status === 'done' ? `✅ ${t.seq}. ${t.label}` : `${numEmoji(t.seq)} ${t.label}`,
  )
  const foot = pending.length === 0
    ? '\n\nぜんぶ完了しています。お疲れ様です！'
    : '\n\n終わったら「1できた」のように返信してください。\n「きょう」と送ると最新のリストが届きます。'
  return head + '\n' + lines.join('\n') + foot
}

function numEmoji(n: number): string {
  const map = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
  return n <= 10 ? map[n] : `${n}.`
}

// ── 返信パース ───────────────────────────────────────────────
// 「1できた」「２ 完了」「できた 1」「1、2できた」「ぜんぶできた」などを解釈
const DONE_WORDS = /(できた|出来た|でけた|完了|かんりょう|おわった|終わった|終わり|おわり|済み|すみ|OK|ok|ｏｋ)/

export function parseDoneReply(text: string): { all: boolean; nums: number[] } | null {
  const t = text.trim().replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (!DONE_WORDS.test(t)) return null
  if (/(ぜんぶ|全部|すべて|全て|みんな)/.test(t)) return { all: true, nums: [] }
  const nums = (t.match(/\d+/g) ?? []).map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 99)
  if (nums.length === 0) return null
  return { all: false, nums: Array.from(new Set(nums)) }
}

// ── タスク完了の実処理（ステータス遷移＋お客様への自動連絡） ──
export async function completeTask(
  supabase: SupabaseClient,
  task: KantanTask,
  doneBy: string,
  storeName: string,
): Promise<string> {
  const today = jstToday()
  const now = new Date().toISOString()
  const label = storeName ? `【${storeName}】` : ''

  if (task.task_type === 'repair_finish') {
    await supabase.from('repair_histories')
      .update({ status: 'completed', completed_date: today, notified: true, updated_at: now })
      .eq('id', task.ref_id)
    // お客様へ完了連絡（LINE連携済みの場合のみ・ベストエフォート）
    const { data: r } = await supabase.from('repair_histories')
      .select('item_name, customer:customers(name, line_user_id)')
      .eq('id', task.ref_id).single()
    const c = Array.isArray(r?.customer) ? r?.customer[0] : r?.customer
    if (c?.line_user_id) {
      await linePush(c.line_user_id,
        `${label}${c.name ?? ''}様\nお直しの品「${r?.item_name ?? ''}」が仕上がりました。ご都合の良いときにご来店ください😊`)
      return '作業完了にして、お客様へLINEで仕上がり連絡を送りました'
    }
    return '作業完了にしました（お客様はLINE未連携のため連絡は手動でお願いします）'
  }

  if (task.task_type === 'repair_deliver') {
    await supabase.from('repair_histories')
      .update({ status: 'delivered', delivered_date: today, updated_at: now })
      .eq('id', task.ref_id)
    return 'お渡し済みにしました'
  }

  // purchase_notify
  await supabase.from('purchase_orders')
    .update({ notified: true, updated_at: now })
    .eq('id', task.ref_id)
  const { data: p } = await supabase.from('purchase_orders')
    .select('item_name, customer:customers(name, line_user_id)')
    .eq('id', task.ref_id).single()
  const c = Array.isArray(p?.customer) ? p?.customer[0] : p?.customer
  if (c?.line_user_id) {
    await linePush(c.line_user_id,
      `${label}${c.name ?? ''}様\nご注文の「${p?.item_name ?? ''}」が入荷しました。ご都合の良いときにご来店ください😊`)
    return '入荷連絡済みにして、お客様へLINEで入荷連絡を送りました'
  }
  return '入荷連絡済みにしました（お客様はLINE未連携のため連絡は手動でお願いします）'
}
