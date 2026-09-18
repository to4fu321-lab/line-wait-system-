import { describe, it, expect } from 'vitest'
import { isFitting, isFittingServiceType } from '@/lib/fittingTypes'
import { RESERVABLE_PURPOSES, WALK_IN_PURPOSES } from '@/app/[storeId]/admin/reservations/_lib/purposes'

describe('枠を使う予約かの判定', () => {
  it('予約が必要な用件はすべて枠を1つ使う', () => {
    // 枠を消費する判定から漏れると、予約が入っているのに枠が減らず
    // 二重予約になる
    for (const p of RESERVABLE_PURPOSES) {
      expect(isFittingServiceType(p.serviceType), p.key).toBe(true)
    }
  })

  it('予約不要の用件は枠を使わない', () => {
    for (const p of WALK_IN_PURPOSES) {
      expect(isFittingServiceType(p.serviceType), p.key).toBe(false)
    }
  })

  it('service_type が無い旧データは枠を使う扱いにする', () => {
    // 枠を減らし忘れて二重予約になるより、多めに埋まる方が安全
    expect(isFitting('採寸', null)).toBe(true)
    expect(isFitting(null, '')).toBe(true)
  })
})
