export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const OCR_PROMPT = `この画像は学校制服の販売マニュアルまたは「あんちょこ」です。
以下のJSON形式で情報を抽出してください。読み取れない場合はnullを使用。

{
  "items": [
    {
      "name": "アイテム名（例: 制服上着）",
      "required": true,
      "price_tax_in": 12100,
      "price_tax_out": 11000,
      "size_spec": "155〜185 / A体・B体",
      "product_code": "SH-401",
      "growth_adjust": false,
      "washable": "洗濯機可",
      "uses_grade_color": false,
      "grade_color_note": "",
      "item_notes": "",
      "confidence": "high"
    }
  ],
  "notes": "学校全体の注意事項テキスト",
  "raw_text": "画像から読み取ったテキスト全文"
}

判断基準:
- required: 「必須」「必ず購入」「全員」などの表現があれば true
- price_tax_in: 税込価格（整数・円）
- price_tax_out: 税抜価格（整数・円）
- growth_adjust: 「成長」「のびしろ」「成長機能」などがあれば true
- uses_grade_color: 学年によって色が違う場合 true（ジャージのライン色など）
- confidence: 読み取りに自信がない場合 "low"（⚠表示に使用）
`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('images') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'images required' }, { status: 400 })
    }

    // Convert files to base64 image content blocks
    const imageContents = await Promise.all(
      files.map(async (file) => {
        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data: base64,
          },
        }
      })
    )

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: OCR_PROMPT },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from response (handle ```json blocks or raw JSON)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'OCR parse failed', raw: text }, { status: 422 })
    }

    const result = JSON.parse(jsonMatch[1])
    return NextResponse.json(result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
