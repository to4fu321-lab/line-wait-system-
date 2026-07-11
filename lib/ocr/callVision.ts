import Anthropic from '@anthropic-ai/sdk'

// ============================================================
// 画像OCR共通ヘルパー
//   Anthropic vision 呼び出し・MIME正規化・コードブロックフェンス除去・
//   JSONパースを一元化する。個別ルート(repair-ocr/tag-scan/slip-ocr/
//   ocr-receipt)がそれぞれ手書きしていた処理の共通化。
//   「1ルートだけフェンス除去が漏れて読み取り不可」のような
//   実装差分によるバグを構造的に防ぐ。
// ============================================================

export type VisionMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const VALID_MIMES: VisionMime[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** 不明・未指定のMIMEは image/jpeg に正規化する */
export function normalizeMime(mimeType?: string | null): VisionMime {
  return VALID_MIMES.includes(mimeType as VisionMime) ? (mimeType as VisionMime) : 'image/jpeg'
}

/** dataURL(data:image/png;base64,...)にも素のbase64にも対応してbase64本体とMIMEを取り出す */
export function parseImageInput(image: string): { base64: string; mime: VisionMime } {
  const commaIdx = image.indexOf(',')
  const base64 = commaIdx >= 0 ? image.slice(commaIdx + 1) : image
  const mime: VisionMime =
    image.startsWith('data:image/png')  ? 'image/png'  :
    image.startsWith('data:image/webp') ? 'image/webp' :
    image.startsWith('data:image/gif')  ? 'image/gif'  :
    'image/jpeg'
  return { base64, mime }
}

/** AIが指示に反して```json ... ```で包んで返す場合があるため除去する */
export function stripJsonFence(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
}

export class VisionNotConfiguredError extends Error {
  constructor() { super('AI機能が未設定です（ANTHROPIC_API_KEY）') }
}

/**
 * 画像 + プロンプト → パース済みJSON。
 * パース失敗時は null を返す（呼び出し元がユーザー向けメッセージを決める）。
 * ANTHROPIC_API_KEY 未設定は VisionNotConfiguredError を投げる。
 */
export async function callVisionJson<T = unknown>(opts: {
  imageBase64: string
  mimeType?: string | null
  prompt: string
  maxTokens?: number
  model?: string
}): Promise<{ data: T | null; raw: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new VisionNotConfiguredError()

  const client = new Anthropic({ apiKey })
  const res = await client.messages.create({
    model: opts.model ?? 'claude-haiku-4-5-20251001',
    max_tokens: opts.maxTokens ?? 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: normalizeMime(opts.mimeType), data: opts.imageBase64 } },
        { type: 'text', text: opts.prompt },
      ],
    }],
  })

  const raw = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
  try {
    return { data: JSON.parse(stripJsonFence(raw)) as T, raw }
  } catch {
    return { data: null, raw }
  }
}
