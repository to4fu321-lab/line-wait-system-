export const dynamic = 'force-dynamic'

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) { timingSafeEqual(bufA, bufA); return false }
  return timingSafeEqual(bufA, bufB)
}

// ── お直し伝票の抽出スキーマ ────────────────────────────────────
const REPAIR_SCHEMA = `
{
  "repair_type": "以下のいずれか1つ(null可): hem=裾上げ, sleeve=袖丈直し, waist=ウエスト, embroidery=刺繍, button=ボタン, tear=修理・補修, badge=校章付け, size_exchange=サイズ交換, other=その他",
  "item_name": "品名・商品名 (例: スラックス 165A, ブレザー, 詰め襟上着) | null",
  "content": "お直し内容の自由記述 | null",
  "price": "金額(数値・円) | null",
  "customer_name": "顧客名(氏名) | null",
  "tel": "電話番号(ハイフンあり・なし可) | null",
  "hem_length_mm": "裾上げ量(mm整数, 正=長く 負=短く) | null",
  "sleeve_adjust_mm": "袖丈調整量(mm整数) | null",
  "waist_adjust_mm": "ウエスト調整量(mm整数) | null",
  "embroidery_text": "刺繍する文字列 | null",
  "embroidery_color": "刺繍糸色 | null",
  "embroidery_pos": "刺繍位置 | null",
  "vendor_name": "外注先名 | null",
  "desired_completion_date": "希望完了日(YYYY-MM-DD形式) | null",
  "internal_memo": "スタッフ向けメモ・特記事項 | null",
  "confidence": "high=全項目明確に読めた / medium=一部推測あり / low=手書きが不鮮明で推測が多い",
  "warnings": ["読み取り不確かな箇所を日本語で列挙"]
}`

// ── 注文伝票の抽出スキーマ ────────────────────────────────────
const ORDER_SCHEMA = `
{
  "customer_name": "顧客名(氏名) | null",
  "school_name": "学校名 | null",
  "items": [
    {
      "item_name": "商品名(例: 男子スラックス, ブレザー) | null",
      "size_label": "サイズ表記(例: 165A, M, 150) | null",
      "quantity": "数量(整数, デフォルト1)",
      "unit_price": "単価(数値・円) | null"
    }
  ],
  "notes": "備考・特記事項 | null",
  "slip_number": "伝票番号・受付番号 | null",
  "confidence": "high / medium / low",
  "warnings": ["読み取り不確かな箇所を日本語で列挙"]
}`

// ── 問合せメモの抽出スキーマ ────────────────────────────────────
const INQUIRY_SCHEMA = `
{
  "content": "メモ・書き込みの全内容を自由記述でそのまま起こす（改行・箇条書き含む）",
  "customer_name": "顧客名・お客様名が読み取れる場合 | null",
  "school_name": "学校名・学年が読み取れる場合 | null",
  "confidence": "high=全体明確に読めた / medium=一部推測あり / low=判読困難",
  "warnings": ["読み取り不確かな箇所を日本語で列挙"]
}`

function buildPrompt(slipType: 'repair' | 'order' | 'inquiry'): string {
  const schema =
    slipType === 'order'   ? ORDER_SCHEMA :
    slipType === 'inquiry' ? INQUIRY_SCHEMA :
    REPAIR_SCHEMA
  const typeName =
    slipType === 'order'   ? '注文伝票' :
    slipType === 'inquiry' ? '問合せメモ・手書きノート' :
    'お直し伝票'

  return `この画像は制服販売店の「${typeName}」です。
手書き・印刷どちらにも対応し、読み取れる情報をすべて抽出してください。

【抽出ルール】
- 読み取れない・書かれていない項目は null にする
- 日付は必ず YYYY-MM-DD 形式に変換する（例: R7.6.15 → 2025-06-15）
- 金額は数値のみ（¥マーク・円・カンマは除く）
- mm数値は数値のみ（単位を除く）
- 手書きで判読が難しい場合は最善を尽くし、不確かな部分は warnings に記述する

出力するJSONスキーマ:
${schema}

重要: JSON のみを返してください。コードブロック（\`\`\`）は不要です。`
}

export async function POST(req: NextRequest) {
  // TODO: レート制限を追加（例: 同一storeIdで1分あたり10回以内）
  // 推奨: Upstash Redis + @upstash/ratelimit を使用
  try {
    const body = await req.json()
    const { imageBase64, mimeType, slipType = 'repair', storeId, storePin } = body as {
      imageBase64: string
      mimeType?: string
      slipType?: 'repair' | 'order' | 'inquiry'
      storeId?: string
      storePin?: string
    }

    // ── 認証: storeId + storePin の照合 ──────────────────────────
    if (!storeId || !storePin) {
      return NextResponse.json({ ok: false, error: '認証情報が必要です (storeId + storePin)' }, { status: 401 })
    }
    const supabase = getSupabase()
    const { data: store } = await supabase
      .from('stores')
      .select('pin')
      .eq('id', storeId)
      .single()
    if (!store) {
      return NextResponse.json({ ok: false, error: '店舗が見つかりません' }, { status: 401 })
    }
    if (!safeEqual(String(storePin), String(store.pin ?? ''))) {
      return NextResponse.json({ ok: false, error: '認証に失敗しました' }, { status: 401 })
    }
    // ─────────────────────────────────────────────────────────────

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: '画像データが必要です' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY が未設定です' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })

    const validMimeType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType ?? ''))
      ? (mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
      : 'image/jpeg'

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: validMimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: buildPrompt(slipType),
          },
        ],
      }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // コードブロックが含まれる場合も対応
    const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let data: unknown
    try {
      data = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ ok: false, error: 'JSONパースに失敗しました', raw: rawText }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data, slipType })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
