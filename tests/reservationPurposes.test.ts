import { describe, it, expect } from 'vitest'
import { isFittingServiceType } from '@/lib/fittingTypes'
import {
  DEFAULT_RESERVABLE_PURPOSES, makePurpose, normalizePurposes,
} from '@/app/[storeId]/admin/reservations/_lib/purposes'

describe('来店理由の既定値', () => {
  it('制服採寸・制服＋ジャージ採寸・ジャージ採寸の3つ', () => {
    expect(DEFAULT_RESERVABLE_PURPOSES.map(p => p.label))
      .toEqual(['制服採寸', '制服＋ジャージ採寸', 'ジャージ採寸'])
  })

  it('どれも枠を1つ使う', () => {
    for (const p of DEFAULT_RESERVABLE_PURPOSES) {
      expect(isFittingServiceType(p.serviceType), p.key).toBe(true)
    }
  })
})

describe('設定画面から追加した来店理由', () => {
  it('既存とキーがぶつからず、枠を使う service_type になる', () => {
    const p = makePurpose('体操服採寸', '👕', DEFAULT_RESERVABLE_PURPOSES)
    expect(DEFAULT_RESERVABLE_PURPOSES.some(x => x.key === p.key)).toBe(false)
    expect(isFittingServiceType(p.serviceType)).toBe(true)
  })
})

describe('DBに入っている来店理由の読み込み', () => {
  it('設定が無ければ null を返し、呼び出し側が既定値を使う', () => {
    expect(normalizePurposes(null)).toBeNull()
    expect(normalizePurposes([])).toBeNull()
    expect(normalizePurposes('こわれた値')).toBeNull()
  })

  it('label か key が欠けた行は捨てる', () => {
    const out = normalizePurposes([
      { key: 'a', label: '制服採寸' },
      { key: 'b' },
      { label: 'ラベルだけ' },
      'ただの文字列',
    ])
    expect(out).toEqual([
      { key: 'a', label: '制服採寸', emoji: '📌', serviceType: 'visit_a' },
    ])
  })

  it("service_type が 'walkin' 始まりなら付け替える", () => {
    // 'walkin' 始まりは予約不要の用件とみなされ枠を使わない（lib/fittingTypes）。
    // 予約の用件がそうなると、枠が減らず二重予約になる
    const out = normalizePurposes([{ key: 'x', label: 'ジャージ採寸', serviceType: 'walkin_x' }])
    expect(out?.[0].serviceType).toBe('visit_x')
    expect(isFittingServiceType(out![0].serviceType)).toBe(true)
  })
})
