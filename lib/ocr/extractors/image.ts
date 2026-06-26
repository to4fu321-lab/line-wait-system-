// ============================================================
// 画像抽出器: JPG/PNG/WebP/GIF → Claude Vision 用 image ブロック
// ============================================================
import type { OcrBlock } from '../types'

export async function imageBlock(file: File): Promise<OcrBlock> {
  const buffer = await file.arrayBuffer()
  const data = Buffer.from(buffer).toString('base64')
  const t = (file.type || '').toLowerCase()
  const mediaType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(t)
    ? t
    : 'image/jpeg'
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
}
