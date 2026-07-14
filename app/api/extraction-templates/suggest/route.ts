export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { assertStorePin } from '@/lib/auth/storeAuth'
import { callVisionTool, VisionNotConfiguredError } from '@/lib/ocr/callVision'
import { sanitizeSuggestedFields } from '@/lib/extraction-schema'

// ============================================================
// サンプル伝票の撮影画像から「抽出すべき項目」をAIに提案させる。
//   これを店側が微修正して extraction_templates に保存することで、
//   伝票ごとに自己最適化されたOCRを作れる（ゼロから項目を考えなくてよい）。
//
//   Anthropic呼び出しは規約通り lib/ocr/callVision.ts 経由。
//   ここでは項目定義そのものをAIに設計させる「メタ」なTool Useを使う。
// ============================================================

const SUGGEST_PROMPT = `あなたは帳票設計のアシスタントです。
この画像は、ある店舗で使われている「伝票（受付票・お直し伝票・加工伝票・注文書など）」のサンプルです。
この伝票をOCRで自動入力できるようにするために、「1件の明細として抽出すべき項目」を設計してください。

【設計ルール】
- 伝票の見出し・記入欄・繰り返し行などから項目を洗い出す
- field_key は英小文字・数字・アンダースコアのみ（例: product_name, tension, unit_price）
- field_label は日本語の分かりやすい名称（例: 品名, ガットテンション, 単価）
- field_type は text / number / date のいずれか（金額・数量・mm等は number、日付は date）
- description には読み取り時の注意（単位・書式など）があれば簡潔に
- is_required は、その伝票で必ず記入される中心的な項目のみ true
- 項目数は多すぎないよう、実際に使う3〜12個程度に絞る

【scope（見出し/明細の区別）】
- scope='header' … 伝票全体で1つだけの情報（顧客名・電話番号・受付日・希望日など）
- scope='item'   … 明細行として繰り返し書かれる情報（品名・サイズ・数量・単価など）

【role（意味役割・分かる場合のみ設定、無ければ省略）】
- customer_name=顧客氏名, customer_tel=電話番号, date=日付,
  quantity=数量, unit_price=単価(金額), line_name=明細の主品目名, note=備考

必ず propose_template ツールを呼び出して結果を返してください。`

interface SuggestPayload {
  imageBase64?: string
  mimeType?: string
  storeId?: string
  storePin?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuggestPayload
    const { imageBase64, mimeType, storeId, storePin } = body

    const denied = await assertStorePin(req, { storeId, storePin })
    if (denied) return denied
    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: '画像データが必要です' }, { status: 400 })
    }

    const inputSchema = {
      type: 'object',
      properties: {
        suggested_label: {
          type: 'string',
          description: 'この伝票の種別を表す短い日本語名（例: お直し伝票, 購入承り書）',
        },
        fields: {
          type: 'array',
          description: '抽出すべき項目の配列',
          items: {
            type: 'object',
            properties: {
              field_key: { type: 'string', description: '英小文字・数字・_のみのキー' },
              field_label: { type: 'string', description: '日本語の項目名' },
              field_type: { type: 'string', enum: ['text', 'number', 'date'] },
              description: { type: ['string', 'null'], description: '読み取り時の注意（任意）' },
              is_required: { type: 'boolean' },
              scope: { type: 'string', enum: ['header', 'item'], description: 'header=伝票全体で1つ / item=明細行' },
              role: {
                type: ['string', 'null'],
                enum: ['customer_name', 'customer_tel', 'date', 'quantity', 'unit_price', 'line_name', 'note', null],
                description: '意味役割（分かる場合のみ）',
              },
            },
            required: ['field_key', 'field_label', 'field_type', 'scope'],
          },
        },
      },
      required: ['fields'],
    }

    const { data, raw } = await callVisionTool<{ suggested_label?: string; fields?: unknown[] }>({
      imageBase64,
      mimeType,
      prompt: SUGGEST_PROMPT,
      toolName: 'propose_template',
      toolDescription: '伝票から抽出すべき項目定義を提案する',
      inputSchema,
      maxTokens: 2048,
    })

    if (!data) {
      return NextResponse.json({ ok: false, error: '項目の自動提案に失敗しました', raw }, { status: 500 })
    }

    const fields = sanitizeSuggestedFields(data.fields)
    if (fields.length === 0) {
      return NextResponse.json({ ok: false, error: '伝票から項目を検出できませんでした' }, { status: 422 })
    }

    return NextResponse.json({
      ok: true,
      suggestedLabel: typeof data.suggested_label === 'string' ? data.suggested_label : '',
      fields,
    })
  } catch (e) {
    if (e instanceof VisionNotConfiguredError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
