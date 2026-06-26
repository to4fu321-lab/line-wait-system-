// ============================================================
// OCR 共通型
// ============================================================

// Anthropic Messages API の content block param と構造的に一致するブロック型。
// （SDK バージョン差異を避けるため最小限の構造型として定義し、呼び出し時に cast する）
export type OcrBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const PDF_MIME = ['application/pdf']
export const SHEET_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel',                                          // xls
  'text/csv',
]

export function classifyFile(file: { name: string; type: string }): 'image' | 'pdf' | 'sheet' | 'unknown' {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  if (IMAGE_MIME.includes(type) || /\.(jpe?g|png|webp|gif)$/.test(name)) return 'image'
  if (PDF_MIME.includes(type) || name.endsWith('.pdf')) return 'pdf'
  if (SHEET_MIME.includes(type) || /\.(xlsx?|csv)$/.test(name)) return 'sheet'
  return 'unknown'
}
