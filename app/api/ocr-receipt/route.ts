export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { callVisionJson, parseImageInput, VisionNotConfiguredError } from '@/lib/ocr/callVision'
import { rateLimit, RATE_LIMITED_BODY } from '@/lib/rateLimit'

// 受付票・メモ・名刺などの簡易OCR。OcrCaptureButton から呼ばれる。
const PROMPT = [
  'この画像（衣類お直し受付票・メモ・名刺など）から情報を抽出し、必ずJSON形式のみで返してください。',
  '{"name":"お客様の氏名（不明はnull）","tel":"電話番号ハイフン区切り（不明はnull）","items":["お直し内容の配列（例:裾上げ、ウエスト詰め）"],"price":"金額（数値のみ。¥・円・カンマは除く。不明はnull）","desiredDate":"希望納期YYYY-MM-DD（不明はnull）"}',
  'JSONのみ。余分なテキスト不要。',
].join('\n')

export async function POST(req: NextRequest) {
  let body: { image?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'parse error' }, { status: 400 })
  }

  const { image } = body
  if (!image) return NextResponse.json({ ok: false, error: 'image required' }, { status: 400 })

  // 認証の無い公開API + AI課金があるためIP単位で制限（1分10回）
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`ocr-receipt:${ip}`, 10, 60_000)) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 })
  }

  try {
    const { base64, mime } = parseImageInput(image)
    const { data, raw } = await callVisionJson<Record<string, unknown>>({
      imageBase64: base64, mimeType: mime, prompt: PROMPT, maxTokens: 512,
    })
    if (!data) {
      return NextResponse.json({ ok: false, error: 'JSON解析に失敗しました', raw })
    }
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof VisionNotConfiguredError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
    console.error('[ocr-receipt]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
