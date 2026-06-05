export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const TYPE_LABELS: Record<string, string> = {
  inquiry:   '問合せ',
  complaint: 'クレーム',
  request:   '要望',
  other:     'その他',
}

export async function POST(req: NextRequest) {
  try {
    const { type, content, isUrgent, customerName } = await req.json() as {
      type: string
      content: string
      isUrgent: boolean
      customerName?: string
    }

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: '内容が必要です' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY が未設定です' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })

    const prompt = `あなたは制服販売店のベテランスタッフです。以下の${TYPE_LABELS[type] ?? type}に対して、適切な対応アドバイスをJSON形式で返してください。

【${TYPE_LABELS[type] ?? type}情報】
${customerName ? `お客様名: ${customerName}` : ''}
種別: ${TYPE_LABELS[type] ?? type}${isUrgent ? '（急ぎ）' : ''}
内容: ${content}

以下のJSON形式のみを返してください（コードブロック不要）:
{
  "priority": "高・中・低のいずれか",
  "priority_reason": "優先度の理由（種別・内容から1〜2文で）",
  "recommended_action": "推奨する対応（具体的に1〜3文で）",
  "sample_reply": "お客様への返答例（自然な日本語で）",
  "notes": "注意点・補足（1〜2文。なければnull）"
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let advice: unknown
    try {
      advice = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ ok: false, error: 'パース失敗', raw: rawText }, { status: 500 })
    }

    return NextResponse.json({ ok: true, advice })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
