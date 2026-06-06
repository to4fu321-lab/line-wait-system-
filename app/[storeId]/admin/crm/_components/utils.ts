import type { KanaRow } from './types'
export { fmtDate } from '@/lib/adminUtils'

export function getKanaRow(kana: string | null | undefined): KanaRow {
  if (!kana) return '他'
  const code = kana.charCodeAt(0)
  if (code >= 0x30A2 && code <= 0x30AA) return 'ア'
  if (code >= 0x30AB && code <= 0x30B4) return 'カ'
  if (code >= 0x30B5 && code <= 0x30BE) return 'サ'
  if (code >= 0x30BF && code <= 0x30C9) return 'タ'
  if (code >= 0x30CA && code <= 0x30CE) return 'ナ'
  if (code >= 0x30CF && code <= 0x30DD) return 'ハ'
  if (code >= 0x30DE && code <= 0x30E2) return 'マ'
  if (code >= 0x30E4 && code <= 0x30E8) return 'ヤ'
  if (code >= 0x30E9 && code <= 0x30ED) return 'ラ'
  if (code >= 0x30EF && code <= 0x30F3) return 'ワ'
  return '他'
}
