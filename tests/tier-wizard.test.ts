import { describe, it, expect } from 'vitest'
import { buildTiers } from '@/lib/repairPresets'

const names = (t: { name: string }[]) => t.map(x => x.name)
const base = { unit: '文字', labelStyle: 'upto' as const, baseAdd: 0, stepAdd: 0 }

describe('buildTiers（段階の一覧づくり）', () => {
  it('「まで」表示（ネーム刺繍の文字数）', () => {
    expect(names(buildTiers({ ...base, min: 3, max: 6, step: 1 })))
      .toEqual(['〜3文字', '〜4文字', '〜5文字', '〜6文字'])
  })

  it('ぴったり表示', () => {
    expect(names(buildTiers({ ...base, min: 3, max: 5, step: 1, labelStyle: 'exact' })))
      .toEqual(['3文字', '4文字', '5文字'])
  })

  it('刻みを大きくすると段階が減る', () => {
    expect(names(buildTiers({ ...base, unit: 'cm', min: 2, max: 10, step: 2 })))
      .toEqual(['〜2cm', '〜4cm', '〜6cm', '〜8cm', '〜10cm'])
  })

  it('一律なら全部0円（記録だけ残したいとき）', () => {
    const t = buildTiers({ ...base, min: 1, max: 3, step: 1 })
    expect(t.every(x => x.delta === 0)).toBe(true)
  })

  it('1段ふえるごとに加算される。先頭は基本料金内（0円）', () => {
    const t = buildTiers({ ...base, min: 3, max: 6, step: 1, stepAdd: 100 })
    expect(t.map(x => x.delta)).toEqual([0, 100, 200, 300])
  })

  it('先頭にも上乗せできる', () => {
    const t = buildTiers({ ...base, min: 3, max: 5, step: 1, baseAdd: 50, stepAdd: 100 })
    expect(t.map(x => x.delta)).toEqual([50, 150, 250])
  })

  it('最大が最小より小さければ何も作らない（次へを押させない判定に使う）', () => {
    expect(buildTiers({ ...base, min: 10, max: 3, step: 1 })).toEqual([])
  })

  it('刻みが0以下なら無限ループせず空を返す', () => {
    expect(buildTiers({ ...base, min: 1, max: 10, step: 0 })).toEqual([])
    expect(buildTiers({ ...base, min: 1, max: 10, step: -1 })).toEqual([])
  })

  it('件数に上限がある（誤入力でオプションを数百件作らない）', () => {
    expect(buildTiers({ ...base, min: 1, max: 1000, step: 1 }).length).toBeLessThanOrEqual(60)
  })

  it('小数の刻みでも端数が出ない', () => {
    expect(names(buildTiers({ ...base, unit: 'cm', min: 1, max: 2, step: 0.5 })))
      .toEqual(['〜1cm', '〜1.5cm', '〜2cm'])
  })

  it('最小=最大なら1段階（〜3文字だけ、のような設定）', () => {
    expect(names(buildTiers({ ...base, min: 3, max: 3, step: 1 }))).toEqual(['〜3文字'])
  })
})
