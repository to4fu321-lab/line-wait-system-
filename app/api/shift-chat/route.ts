export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// AIチャット申請（自然言語 → 申請内容の構造化）
//   「来週金曜休みたい」「今週土曜出勤できます」「○○さんと交換したい」等を
//   Anthropic で意図抽出 → 確認用の提案(JSON)を返す。
//   実際のDB書き込みはクライアント側で確認後に行う（人の確認を必須化）。
// ============================================================
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export async function POST(req: NextRequest) {
  try {
    const { storeId, text } = await req.json() as { storeId: string; text: string }
    if (!storeId || !text?.trim()) return NextResponse.json({ ok: false, error: '入力が必要です' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, error: 'AI機能が未設定です（ANTHROPIC_API_KEY）' }, { status: 500 })

    // 同店スタッフ名（交換相手の解決用）
    const sb = getSupabase()
    const { data: staff } = await sb.from('staff').select('id, name').eq('store_id', storeId).eq('active', true)
    const roster = (staff ?? []) as { id: string; name: string }[]

    const today = new Date(Date.now() + 9 * 3600000)
    const todayStr = today.toISOString().slice(0, 10)
    const dow = WEEK[today.getUTCDay()]

    const client = new Anthropic({ apiKey })
    const prompt = `あなたはシフト管理アプリの申請アシスタントです。スタッフの発話から「何を申請したいか」を読み取り、JSONのみで返してください。

【今日】${todayStr}（${dow}曜日）。日付はこれを基準に解釈し YYYY-MM-DD で出力。
【同僚名簿】${roster.map(s => s.name).join('、') || 'なし'}

【発話】${text}

次のJSONのみ返す（コードブロック不要）:
{
  "intent": "leave | work | off | swap | unknown",   // 休暇=leave, 出勤可=work, 休み希望=off, 交換=swap
  "leave_type": "paid | unpaid | sick | other | null",
  "start_date": "YYYY-MM-DD | null",
  "end_date": "YYYY-MM-DD | null",
  "start_time": "HH:MM | null",                       // work時の希望開始
  "end_time": "HH:MM | null",
  "target_staff_name": "交換相手の名前 | null",        // 名簿の表記に合わせる
  "summary": "申請内容を1文で日本語要約",
  "needs_clarification": true/false,                  // 日付等が不明なら true
  "clarification": "聞き返す質問 | null"
}`

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let parsed: any
    try { parsed = JSON.parse(jsonText) } catch { return NextResponse.json({ ok: false, error: 'うまく読み取れませんでした。もう少し具体的に入力してください。' }, { status: 200 }) }

    // 交換相手を名簿からID解決
    let target_staff_id: string | null = null
    if (parsed.target_staff_name) {
      const m = roster.find(s => s.name === parsed.target_staff_name || s.name.includes(parsed.target_staff_name) || parsed.target_staff_name.includes(s.name))
      target_staff_id = m?.id ?? null
    }

    return NextResponse.json({ ok: true, proposal: { ...parsed, target_staff_id } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
