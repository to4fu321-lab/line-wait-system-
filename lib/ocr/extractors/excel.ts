// ============================================================
// Excel/CSV 抽出器: SheetJS(xlsx) でシートをテキスト(CSV)化 → Claude へ
// ============================================================
import * as XLSX from 'xlsx'

// シートごとに見出し付き CSV テキストへ変換して結合する。
export async function sheetToText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const parts: string[] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
    if (csv.trim()) parts.push(`# シート: ${sheetName}\n${csv}`)
  }
  return parts.join('\n\n')
}
