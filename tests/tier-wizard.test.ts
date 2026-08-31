import { describe, it, expect } from 'vitest'
import { buildTiers, buildBandTiers } from '@/lib/repairPresets'

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

describe('buildBandTiers（区切りで料金が変わる）', () => {
  // スカート・スラックスの詰め:「〜5cmまでは同一料金、それ以上は加工が変わるので別料金」
  const bands = [{ upto: 5, add: 0 }, { upto: 10, add: 1000 }]
  const cm = { unit: 'cm', labelStyle: 'upto' as const }

  it('区切りだけを選択肢にする（既定）— 2つだけ作る', () => {
    const t = buildBandTiers({ ...cm, min: 1, max: 10, step: 1, bands })
    expect(t).toEqual([
      { name: '〜5cm',  delta: 0 },
      { name: '〜10cm', delta: 1000 },
    ])
  })

  it('刻みごとに全部作る場合、料金は区切りどおりに付く', () => {
    const t = buildBandTiers({ ...cm, min: 1, max: 10, step: 1, bands, bandOnly: false })
    expect(t.map(x => x.name)).toHaveLength(10)
    // 1〜5cm は 0円、6〜10cm は 1000円
    expect(t.slice(0, 5).every(x => x.delta === 0)).toBe(true)
    expect(t.slice(5).every(x => x.delta === 1000)).toBe(true)
  })

  it('境目ちょうどは安いほうに入る（〜5cm は 5cm を含む）', () => {
    const t = buildBandTiers({ ...cm, min: 5, max: 6, step: 1, bands, bandOnly: false })
    expect(t).toEqual([
      { name: '〜5cm', delta: 0 },
      { name: '〜6cm', delta: 1000 },
    ])
  })

  it('区切りは3つ以上でもよい', () => {
    const t = buildBandTiers({ ...cm, min: 1, max: 15, step: 1,
      bands: [{ upto: 3, add: 0 }, { upto: 8, add: 800 }, { upto: 15, add: 2000 }] })
    expect(t).toEqual([
      { name: '〜3cm',  delta: 0 },
      { name: '〜8cm',  delta: 800 },
      { name: '〜15cm', delta: 2000 },
    ])
  })

  it('順番が前後していても上限の小さい順に並べ直す', () => {
    const t = buildBandTiers({ ...cm, min: 1, max: 10, step: 1,
      bands: [{ upto: 10, add: 1000 }, { upto: 5, add: 0 }] })
    expect(t.map(x => x.name)).toEqual(['〜5cm', '〜10cm'])
  })

  it('上限が重複しても同名の選択肢を作らない', () => {
    const t = buildBandTiers({ ...cm, min: 1, max: 10, step: 1,
      bands: [{ upto: 10, add: 0 }, { upto: 10, add: 1000 }] })
    expect(t).toEqual([{ name: '〜10cm', delta: 0 }])
  })

  it('最後の区切りを超える値は、いちばん高い区切りの料金になる', () => {
    const t = buildBandTiers({ ...cm, min: 1, max: 12, step: 1, bands, bandOnly: false })
    expect(t[11]).toEqual({ name: '〜12cm', delta: 1000 })
  })

  it('区切りが無ければ何も作らない', () => {
    expect(buildBandTiers({ ...cm, min: 1, max: 10, step: 1, bands: [] })).toEqual([])
  })

  it('ぴったり表示にもできる', () => {
    const t = buildBandTiers({ ...cm, labelStyle: 'exact', min: 1, max: 10, step: 1, bands })
    expect(t.map(x => x.name)).toEqual(['5cm', '10cm'])
  })
})
