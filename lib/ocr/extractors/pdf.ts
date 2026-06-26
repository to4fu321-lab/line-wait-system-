// ============================================================
// PDF 抽出器: PDF → Claude Document API 用 document ブロック（変換不要）
//   最大 100 ページまでネイティブ送信可能。
// ============================================================
import type { OcrBlock } from '../types'

export async function pdfBlock(file: File): Promise<OcrBlock> {
  const buffer = await file.arrayBuffer()
  const data = Buffer.from(buffer).toString('base64')
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
}
