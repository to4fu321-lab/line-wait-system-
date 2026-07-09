export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { assertStorePin } from '@/lib/auth/storeAuth'

// ============================================================
// お直し価格表/マニュアルの写真 → 服種・項目・価格を構造化
//   既存のOCRルート(slip-ocr)と同じ Anthropic vision・store認証を使用。
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, storeId, storePin } = await req.json() as {
      imageBase64?: string; mimeType?: string; storeId?: string; storePin?: string
    }

    // ── 認証: storeId + storePin の照合（bcrypt hash は verify_store_pin RPC 経由） ──
    const denied = await assertStorePin(req, { storeId, storePin })
    if (denied) return denied

    if (!imageBase64) return NextResponse.json({ ok: false, error: '画像データが必要です' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, error: 'AI機能が未設定です（ANTHROPIC_API_KEY）' }, { status: 500 })

    const media = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType ?? '')
      ? mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const client = new Anthropic({ apiKey })
    const prompt = `この画像は学生服店の「お直し価格表」または「お直しマニュアル」です。
服種（大項目：例 学ラン上着・スラックス・スカート等）ごとに、お直し項目とその料金を読み取り、JSONのみで返してください（コードブロック不要）。

ルール:
- 価格は数値(円)。税抜/税込の区別はせず読み取れた数字をそのまま。読み取れない場合は null。
- 服種が明記されず項目だけの表なら、garments を1つ（name は空文字）にまとめてよい。
- アイコン(icon)は内容に合う絵文字を1つ推測（不明なら "✂️"）。
- 該当しない注釈・住所・電話番号などは無視。

形式:
{
  "garments": [
    { "name": "服種名", "icon": "👖", "items": [ { "name": "項目名", "price": 1500 } ] }
  ]
}`

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let data: any
    try { data = JSON.parse(jsonText) } catch {
      return NextResponse.json({ ok: false, error: '読み取りに失敗しました。価格表が鮮明に写るよう再撮影してください。' }, { status: 200 })
    }
    const garments = Array.isArray(data?.garments) ? data.garments : []
    return NextResponse.json({ ok: true, garments })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
