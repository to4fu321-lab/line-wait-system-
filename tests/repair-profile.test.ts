import { describe, it, expect } from 'vitest'
import { parseRepairSettings, PROFILE_DEFAULTS } from '@/lib/repairProfile'
import { toFieldDefs } from '@/types/repair'
import { canNotifyNow } from '@/lib/notifyWindow'
import type { BusinessHours } from '@/lib/pop'

describe('parseRepairSettings', () => {
  it('未設定の店舗は制服プロファイル（既存店を壊さない）', () => {
    const s = parseRepairSettings(null)
    expect(s.profile).toBe('uniform')
    expect(s.labels.garment).toBe('服種')
    expect(s.material_enabled).toBe(false)
  })

  it('racket プロファイルは語彙が入れ替わる', () => {
    const s = parseRepairSettings({ profile: 'racket' })
    expect(s.labels.domain).toBe('ガット張り')
    expect(s.labels.garment).toBe('種目')
    expect(s.labels.measurement).toBe('仕様')
    expect(s.intake_photo_required).toBe(true)
  })

  it('店舗が個別に上書きしたラベルだけが既定に重なる', () => {
    const s = parseRepairSettings({ profile: 'racket', labels: { garment: '競技' } })
    expect(s.labels.garment).toBe('競技')
    expect(s.labels.item).toBe(PROFILE_DEFAULTS.racket.labels.item) // 未指定は既定のまま
  })

  it('壊れた値・未知のプロファイルは uniform へフォールバック', () => {
    expect(parseRepairSettings('なにか').profile).toBe('uniform')
    expect(parseRepairSettings([1, 2]).profile).toBe('uniform')
    expect(parseRepairSettings({ profile: 'unknown' }).profile).toBe('uniform')
  })
})

describe('toFieldDefs', () => {
  it('fields があればそれを使う', () => {
    const f = [{ key: 'tension_lbs', label: 'ポンド数', type: 'number' as const, min: 15, max: 30 }]
    expect(toFieldDefs(f, [])).toEqual(f)
  })

  it('fields が空なら measurements にフォールバックする（既存の制服店）', () => {
    const out = toFieldDefs([], [{ key: 'hem_length_mm', label: '仕上がり丈', unit: 'mm', required: true }])
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('number')   // mm は数値扱い
    expect(out[0].required).toBe(true)
  })

  it('単位が mm/cm 以外の measurements は text 扱い', () => {
    const out = toFieldDefs(null, [{ key: 'text', label: '刺繍文字', unit: '文字' }])
    expect(out[0].type).toBe('text')
  })

  it('どちらも空なら空配列', () => {
    expect(toFieldDefs(null, null)).toEqual([])
  })
})

describe('canNotifyNow', () => {
  // 月〜金 10:00-19:00 / 土 10:00-18:00 / 水・日 定休（ビーストロークの営業日を模した設定）
  const bh: BusinessHours = {
    hours: {
      mon: { open: '10:00', close: '19:00', closed: false },
      tue: { open: '10:00', close: '19:00', closed: false },
      wed: { open: '10:00', close: '19:00', closed: true },
      thu: { open: '10:00', close: '19:00', closed: false },
      fri: { open: '10:00', close: '19:00', closed: false },
      sat: { open: '10:00', close: '18:00', closed: false },
      sun: { open: '10:00', close: '19:00', closed: true },
    },
  }
  // 2026-08-31 は月曜
  const at = (iso: string) => new Date(iso)

  it('営業時間内は送れる', () => {
    const r = canNotifyNow(bh, at('2026-08-31T14:00:00'))
    expect(r.canSendNow).toBe(true)
    expect(r.reason).toBe('open')
  })

  it('閉店30分前を過ぎたら翌営業日へ回す', () => {
    const r = canNotifyNow(bh, at('2026-08-31T18:45:00'))
    expect(r.canSendNow).toBe(false)
    expect(r.reason).toBe('after_close')
    expect(r.nextOpenAt?.getDate()).toBe(1)      // 9/1(火)
    expect(r.nextOpenAt?.getHours()).toBe(10)
  })

  it('開店前は当日の開店時刻を返す', () => {
    const r = canNotifyNow(bh, at('2026-08-31T08:00:00'))
    expect(r.canSendNow).toBe(false)
    expect(r.reason).toBe('before_open')
    expect(r.nextOpenAt?.getDate()).toBe(31)
    expect(r.nextOpenAt?.getHours()).toBe(10)
  })

  it('定休日は次に開いている日まで飛ばす（水曜→木曜）', () => {
    const r = canNotifyNow(bh, at('2026-09-02T12:00:00')) // 水曜
    expect(r.canSendNow).toBe(false)
    expect(r.reason).toBe('closed_day')
    expect(r.nextOpenAt?.getDate()).toBe(3)      // 9/3(木)
  })

  it('営業時間が未設定の店舗は止めない（従来挙動）', () => {
    expect(canNotifyNow(null).canSendNow).toBe(true)
    expect(canNotifyNow({ hours: {} }).canSendNow).toBe(true)
  })

  it('壊れた時刻文字列は止めない', () => {
    const broken: BusinessHours = { hours: { mon: { open: 'あさ', close: '', closed: false } } }
    const r = canNotifyNow(broken, at('2026-08-31T14:00:00'))
    expect(r.canSendNow).toBe(false) // 判定できない曜日は翌営業日を探しにいく
    expect(r.nextOpenAt).toBeNull()  // 全曜日不明 → 呼び出し側は送信扱いにする
  })
})
