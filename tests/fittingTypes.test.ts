import { describe, it, expect } from 'vitest'
import { isFitting, isFittingServiceType } from '@/lib/fittingTypes'
import { MENU_PRESETS } from '@/app/[storeId]/admin/reservations/_lib/menuPresets'

describe('試着室を使う予約かの判定', () => {
  it('採寸メニューのプリセットは全て枠を消費する扱いになる', () => {
    // uniform2 のような枝番キーが採寸扱いから漏れると、
    // 予約が入っているのに枠が減らず二重予約になる
    for (const p of MENU_PRESETS) {
      expect(isFittingServiceType(p.key), p.key).toBe(true)
    }
  })

  it('purpose に「採寸」を含めば service_type が無くても採寸扱い', () => {
    expect(isFitting('制服採寸のご相談', null)).toBe(true)
    expect(isFitting(null, 'uniform')).toBe(true)
  })

  it('採寸でない要件は枠を消費しない', () => {
    expect(isFitting('お直しの相談', 'consult')).toBe(false)
    expect(isFitting(null, null)).toBe(false)
    expect(isFittingServiceType('')).toBe(false)
  })
})
