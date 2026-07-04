import { timingSafeEqual } from 'crypto'

/**
 * タイミング攻撃に耐性のある文字列比較。
 * 長さが異なる場合も比較処理を必ず実行し、長さ差による時間リークを防ぐ。
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
