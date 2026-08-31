import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FeatureKey } from '@/lib/features'
// vi.mock は import より前に巻き上げられるので、静的 import で問題ない
import { fetchWorkBadgeCount } from '@/lib/workBadge'

// supabase クライアントを差し替えて「どのテーブルを何件数えたか」を検証する。
// 実害が出たのは repairs_focus プラン（発注・入荷待ちタブOFF）で、
// 画面のどのタイルも 0 なのにバッジだけ 1 が残ったケース。
const counts: Record<string, number> = {}
const asked: string[] = []

function makeQuery(table: string) {
  const key = () => `${table}:${filters.join(',')}`
  const filters: string[] = []
  const q = {
    eq:  (col: string, v: string) => { if (col !== 'store_id') filters.push(`${col}=${v}`); return q },
    in:  (col: string, v: string[]) => { filters.push(`${col}in(${v.join('|')})`); return q },
    not: (col: string, _op: string, v: string) => { filters.push(`${col}not${v}`); return q },
    then: (resolve: (r: { count: number }) => void) => {
      asked.push(key())
      resolve({ count: counts[key()] ?? 0 })
    },
  }
  return q
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => ({ select: () => makeQuery(table) }) },
}))

const featuresOn  = (): boolean => true
const repairsFocus = (k: FeatureKey) => k === 'repairs_tab_delivery'   // 発注・入荷待ちはOFF

beforeEach(() => {
  for (const k of Object.keys(counts)) delete counts[k]
  asked.length = 0
})

describe('fetchWorkBadgeCount', () => {
  it('発注タブOFFの店では purchase_orders を数えない（消せないバッジを出さない）', async () => {
    counts['purchase_orders:statusin(received|ordered)'] = 1
    expect(await fetchWorkBadgeCount('s1', repairsFocus)).toBe(0)
    expect(asked.some(k => k.startsWith('purchase_orders:statusin(received|ordered)'))).toBe(false)
  })

  it('発注タブONなら数える', async () => {
    counts['purchase_orders:statusin(received|ordered)'] = 1
    expect(await fetchWorkBadgeCount('s1', featuresOn)).toBe(1)
  })

  it('入荷待ちは on_order と stocked の両方（stocked の数え漏れを防ぐ）', async () => {
    counts['purchase_orders:statusin(on_order|stocked)'] = 2
    expect(await fetchWorkBadgeCount('s1', featuresOn)).toBe(2)
  })

  it('お渡しタブOFFなら完了済みお直しを数えない', async () => {
    counts['repair_histories:status=completed'] = 3
    expect(await fetchWorkBadgeCount('s1', () => false)).toBe(0)
  })

  it('未対応の問合せは常に数える（タブ設定に関係なく画面に出る）', async () => {
    counts['inquiries:status=pending'] = 2
    expect(await fetchWorkBadgeCount('s1', () => false)).toBe(2)
  })

  it('完了した問合せは数えない', async () => {
    counts['inquiries:status=completed'] = 5
    expect(await fetchWorkBadgeCount('s1', featuresOn)).toBe(0)
  })

  it('受付中のお直しは常に数える', async () => {
    counts['repair_histories:status=received'] = 4
    expect(await fetchWorkBadgeCount('s1', () => false)).toBe(4)
  })

  it('お渡し済みの追加購入は数えない', async () => {
    counts['uniform_orders:statusnot("delivered")'] = 0
    expect(await fetchWorkBadgeCount('s1', featuresOn)).toBe(0)
  })

  it('各区分の合計になる', async () => {
    counts['repair_histories:status=received'] = 1
    counts['uniform_orders:statusnot("delivered")'] = 2
    counts['purchase_orders:statusin(received|ordered)'] = 3
    counts['inquiries:status=pending'] = 4
    expect(await fetchWorkBadgeCount('s1', featuresOn)).toBe(10)
  })
})
