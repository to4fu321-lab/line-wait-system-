export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  let body: { image?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'parse error' }, { status: 400 })
  }

  const { image } = body
  if (!image) return NextResponse.json({ ok: false, error: 'image required' }, { status: 400 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const commaIdx = image.indexOf(',')
  const base64   = commaIdx >= 0 ? image.slice(commaIdx + 1) : image
  const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
    image.startsWith('data:image/png')  ? 'image/png'  :
    image.startsWith('data:image/webp') ? 'image/webp' :
    image.startsWith('data:image/gif')  ? 'image/gif'  :
    'image/jpeg'

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: [
              'この画像（衣類お直し受付票・メモ・名刺など）から情報を抽出し、必ずJSON形式のみで返してください。',
              '{"name":"お客様の氏名（不明はnull）","tel":"電話番号ハイフン区切り（不明はnull）","items":["お直し内容の配列（例:裾上げ、ウエスト詰め）"],"desiredDate":"希望納期YYYY-MM-DD（不明はnull）"}',
              'JSONのみ。余分なテキスト不要。',
            ].join('\n'),
          },
        ],
      }],
    })

    const text = (msg.content[0] as { type: string; text?: string }).text ?? ''
    // Claudeが指示に反してコードブロックで包む場合があるため除去してからパースする
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    try {
      const parsed = JSON.parse(jsonText)
      return NextResponse.json({ ok: true, ...parsed })
    } catch {
      return NextResponse.json({ ok: false, error: 'JSON解析に失敗しました', raw: text })
    }
  } catch (e) {
    console.error('[ocr-receipt]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
