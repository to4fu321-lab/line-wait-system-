export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { callVisionJson, VisionNotConfiguredError } from '@/lib/ocr/callVision'

const TAG_SCHEMA = `
{
  "barcode": "バーコード番号・QRコード値（JAN/EAN-13/Code128/QR等、数字・英数字）| null",
  "item_name": "品名・商品名（例：男子スラックス、ブレザー、スカート、ワイシャツ）| null",
  "maker": "メーカー名・ブランド名・製造会社名（例：トンボ、スクールフォーラム、明石スクールユニフォームカンパニー、カンコー、菅公学生服）| null",
  "maker_code": "品番・型番・品目コード（例：SL-101、BL-202）| null",
  "school_name": "学校名（タグ・ラベルに明記されていれば）| null",
  "size_label": "サイズ表記（例：165A、M、L、W72、150cm）| null",
  "price": "価格（数値のみ、¥・円・カンマ除く）| null",
  "category": "以下から最も近いもの1つ: 制服（上着）/ スラックス・スカート / シャツ・ブラウス / セーター・ベスト / ネクタイ・リボン / 体操着 / 上靴 / カバン・バッグ / その他 | null",
  "gender": "男子用 / 女子用 / 男女共通 のいずれか | null",
  "color_code": "色・色番（例：黒、紺、01、チェック）| null",
  "confidence": "high=全項目明確 / medium=一部推測 / low=不鮮明で推測多い",
  "warnings": ["読み取り不確かな箇所を日本語で列挙"]
}`

function buildPrompt(): string {
  return `この画像は制服・学用品の商品タグ（紙タグ・縫い付けタグ・バーコードラベル・QRコードラベル等）です。
読み取れる情報をすべて抽出してください。バーコードの数字が見えれば必ず取得してください。

【抽出ルール】
- バーコード: 数字列をそのまま文字列として返す（ハイフン・スペース除く）
- 品名: 商品種別を日本語で（英語表記があれば日本語に）
- メーカー名: タグ・ロゴ・会社名から製造元を判定（例：TOMBOW→トンボ、KANKO→カンコー）
- 品番: タグに印字されている型番・品目コードをそのまま
- サイズ: 数字やアルファベットの組み合わせをそのまま
- カテゴリ・性別区分: 見た目・品名から推測可
- 読み取れない・記載なし項目は null にする

出力スキーマ（JSONのみ返すこと。コードブロック不要）:
${TAG_SCHEMA}`
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json() as {
      imageBase64: string
      mimeType?: string
    }

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: '画像データが必要です' }, { status: 400 })
    }

    // バーコード読み取り精度が必要なためsonnetを使用（他のOCRルートはhaiku）
    const { data, raw } = await callVisionJson({
      imageBase64, mimeType, prompt: buildPrompt(), model: 'claude-sonnet-4-6', maxTokens: 1024,
    })
    if (!data) {
      return NextResponse.json({ ok: false, error: 'JSONパースに失敗', raw }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e) {
    if (e instanceof VisionNotConfiguredError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
