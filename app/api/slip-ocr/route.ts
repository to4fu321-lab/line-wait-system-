export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { assertStorePin } from '@/lib/auth/storeAuth'
import { callVisionJson, VisionNotConfiguredError } from '@/lib/ocr/callVision'

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

// ── 種別自動判定（置くだけスキャン用） ──────────────────────────
const AUTO_PROMPT = `この画像は制服販売店で接客後に書かれた紙（承り書・伝票・メモ）です。
まず内容から種別を判定し、種別に応じたスキーマで情報を抽出してください。

【種別の判定基準】
- repair  = お直し・加工の依頼（裾上げ・袖丈・ウエスト・刺繍・ボタン・補修・校章・サイズ交換）
- order   = 商品の注文・追加購入・取り寄せ（品名×サイズ×数量が主体）
- inquiry = 問合せ・伝言・相談・その他のメモ（上記2つに当てはまらないもの全般）

【抽出ルール】
- 読み取れない・書かれていない項目は null にする
- 日付は必ず YYYY-MM-DD 形式に変換する（例: R7.6.15 → 2025-06-15）
- 金額は数値のみ（¥マーク・円・カンマは除く）
- mm数値は数値のみ（単位を除く）
- 手書きで判読が難しい場合は最善を尽くし、不確かな部分は warnings に記述する

出力形式: {"slip_type": "repair|order|inquiry", "data": <種別に応じた以下のスキーマ>}

repair の data スキーマ:
${REPAIR_SCHEMA}

order の data スキーマ:
${ORDER_SCHEMA}

inquiry の data スキーマ:
${INQUIRY_SCHEMA}

重要: JSON のみを返してください。コードブロック（\`\`\`）は不要です。`

function buildPrompt(slipType: 'repair' | 'order' | 'inquiry' | 'auto'): string {
  if (slipType === 'auto') return AUTO_PROMPT
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
      slipType?: 'repair' | 'order' | 'inquiry' | 'auto'
      storeId?: string
      storePin?: string
    }

    // ── 認証: storeId + storePin の照合（bcrypt hash は verify_store_pin RPC 経由） ──
    const denied = await assertStorePin(req, { storeId, storePin })
    if (denied) return denied
    // ─────────────────────────────────────────────────────────────

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: '画像データが必要です' }, { status: 400 })
    }

    const { data, raw } = await callVisionJson({
      imageBase64, mimeType, prompt: buildPrompt(slipType),
      maxTokens: slipType === 'auto' ? 1024 : 512,
    })
    if (!data) {
      return NextResponse.json({ ok: false, error: 'JSONパースに失敗しました', raw }, { status: 500 })
    }

    // auto の場合は {slip_type, data} 形式を展開して判定種別を返す
    if (slipType === 'auto') {
      const auto = data as { slip_type?: string; data?: unknown }
      const detected = ['repair', 'order', 'inquiry'].includes(auto.slip_type ?? '')
        ? auto.slip_type as 'repair' | 'order' | 'inquiry'
        : 'inquiry'
      return NextResponse.json({ ok: true, data: auto.data ?? data, slipType: detected })
    }

    return NextResponse.json({ ok: true, data, slipType })
  } catch (e) {
    if (e instanceof VisionNotConfiguredError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
