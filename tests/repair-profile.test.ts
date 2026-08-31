import { describe, it, expect } from 'vitest'
import { REPAIR_LABELS, PRESET_KEYS } from '@/lib/repairProfile'
import { PRESETS_BY_KEY, mergePresetFields } from '@/lib/repairPresets'
import type { FieldDef } from '@/types/repair'
import { toFieldDefs, visibleFields } from '@/types/repair'
import { canNotifyNow } from '@/lib/notifyWindow'
import type { BusinessHours } from '@/lib/pop'

describe('REPAIR_LABELS（業種を問わない標準語彙）', () => {
  it('どの業種にも寄らない中立語である', () => {
    // 制服固有（服種・採寸）にもラケット固有（種目）にも寄らない
    expect(REPAIR_LABELS.garment).toBe('種類')
    expect(REPAIR_LABELS.item).toBe('作業')
    expect(REPAIR_LABELS.measurement).toBe('仕様')
    for (const v of Object.values(REPAIR_LABELS)) {
      expect(['服種', '採寸', '種目', 'お直し', 'ガット張り']).not.toContain(v)
    }
  })

  it('助数詞は業種を選ばない汎用のものを使う（本・足・枚に寄らない）', () => {
    expect(REPAIR_LABELS.unit_count).toBe('点')
  })

  it('すべての呼び名が空でない（画面に空文字が出ない）', () => {
    for (const v of Object.values(REPAIR_LABELS)) expect(v.trim().length).toBeGreaterThan(0)
  })
})

describe('標準セット', () => {
  it('業種で絞らず、どの店でも両方取り込める', () => {
    expect(PRESET_KEYS).toEqual(['uniform', 'racket'])
  })

  it('制服とラケットの種類コードが衝突しない（併用店で上書きが起きない）', () => {
    const uniformCodes = new Set(PRESETS_BY_KEY.uniform.map(g => g.code))
    const collided = PRESETS_BY_KEY.racket.map(g => g.code).filter(c => uniformCodes.has(c))
    expect(collided).toEqual([])
  })

  it('各セット内でも種類コードは一意', () => {
    for (const key of PRESET_KEYS) {
      const codes = PRESETS_BY_KEY[key].map(g => g.code)
      expect(new Set(codes).size).toBe(codes.length)
    }
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

describe('mergePresetFields（取り込み時の入力欄の更新）', () => {
  const preset: FieldDef[] = [
    { key: 'inseam_cm',    label: '股下', type: 'number' },
    { key: 'total_len_cm', label: '総丈', type: 'number' },
  ]

  it('cm入力に置き換えた旧mm項目は落とす（同じことを2回聞かせない）', () => {
    const cur: FieldDef[] = [
      { key: 'hem_length_mm', label: '仕上がり丈', type: 'number', unit: 'mm' },
      { key: 'fold_keep_mm',  label: '折り返し残し', type: 'number', unit: 'mm' },
    ]
    expect(mergePresetFields(cur, preset).map(f => f.key)).toEqual(['inseam_cm', 'total_len_cm'])
  })

  it('過去のプリセットが配った項目も落とす（裾上げ4項目→2項目の整理）', () => {
    const cur: FieldDef[] = [
      { key: 'inseam_cm', label: '股下', type: 'number' },
      { key: 'total_len_cm', label: '総丈', type: 'number' },
      { key: 'finish_len_cm', label: '仕上がり丈', type: 'number' },
      { key: 'fold_keep_cm', label: '折り返し残し', type: 'number' },
    ]
    expect(mergePresetFields(cur, preset).map(f => f.key)).toEqual(['inseam_cm', 'total_len_cm'])
  })

  it('他の項目のプリセット由来のキーは、この項目のプリセットに無ければ落とす', () => {
    // inseam_cm は裾上げでは使うが裾出しでは使わない。裾出し側に残っていたら消す。
    const cur: FieldDef[] = [
      { key: 'out_len_cm', label: '出す長さ', type: 'number' },
      { key: 'inseam_cm',  label: '股下',     type: 'number' },
    ]
    const outPreset: FieldDef[] = [{ key: 'out_len_cm', label: '出す長さ', type: 'number' }]
    const known = new Set(['inseam_cm', 'total_len_cm', 'out_len_cm'])
    expect(mergePresetFields(cur, outPreset, known).map(f => f.key)).toEqual(['out_len_cm'])
  })

  it('店が独自に足した項目は消さずに後ろへ残す', () => {
    const cur: FieldDef[] = [
      { key: 'hem_length_mm', label: '仕上がり丈', type: 'number' },
      { key: 'shop_note',     label: '当店メモ',   type: 'text' },
    ]
    expect(mergePresetFields(cur, preset, new Set(['inseam_cm', 'total_len_cm'])).map(f => f.key))
      .toEqual(['inseam_cm', 'total_len_cm', 'shop_note'])
  })

  it('プリセット側の定義が優先される（同キーは重複しない）', () => {
    const cur: FieldDef[] = [{ key: 'inseam_cm', label: '古い股下', type: 'text' }]
    const out = mergePresetFields(cur, preset)
    expect(out.map(f => f.key)).toEqual(['inseam_cm', 'total_len_cm'])
    expect(out[0].label).toBe('股下')
  })

  it('未取り込みの項目にはプリセットがそのまま入る', () => {
    expect(mergePresetFields([], preset)).toEqual(preset)
  })
})

describe('visibleFields（条件付きの入力欄）', () => {
  const fields: FieldDef[] = [
    { key: 'hem_measure',  label: '測り方', type: 'select' },
    { key: 'inseam_cm',    label: '股下',   type: 'number', show_if: { key: 'hem_measure', equals: '股下' } },
    { key: 'total_len_cm', label: '総丈',   type: 'number', show_if: { key: 'hem_measure', equals: '総丈' } },
  ]

  it('股下を選ぶと股下だけ出る（総丈は出さない）', () => {
    expect(visibleFields(fields, { hem_measure: '股下' }).map(f => f.key))
      .toEqual(['hem_measure', 'inseam_cm'])
  })

  it('総丈を選ぶと総丈だけ出る', () => {
    expect(visibleFields(fields, { hem_measure: '総丈' }).map(f => f.key))
      .toEqual(['hem_measure', 'total_len_cm'])
  })

  it('未選択なら条件付きの欄は出ない', () => {
    expect(visibleFields(fields, {}).map(f => f.key)).toEqual(['hem_measure'])
  })

  it('show_if を持たない項目は常に出る', () => {
    const plain: FieldDef[] = [{ key: 'a', label: 'A' }]
    expect(visibleFields(plain, {})).toEqual(plain)
  })
})

describe('サイズ入力（上下でサイズ体系が違う）', () => {
  const uniform = PRESETS_BY_KEY.uniform
  const sizeOf = (gCode: string, iCode: string) =>
    uniform.find(g => g.code === gCode)?.items.find(i => i.code === iCode)
      ?.fields?.find(f => f.key === 'garment_size')

  it('ボトム（スラックス）はウエストサイズ。身長サイズは出さない', () => {
    const f = sizeOf('slacks', 'hem')
    const vals = (f?.choices ?? []).map(c => c.value)
    expect(vals).toContain('W70')
    expect(vals).not.toContain('160')
    expect(f?.label).toBe('サイズ（ウエスト）')
  })

  it('上着（ブレザー・学ラン）は身長サイズ。ウエストは出さない', () => {
    const f = sizeOf('jacket', 'badge')
    const vals = (f?.choices ?? []).map(c => c.value)
    expect(vals).toContain('160')
    expect(vals).not.toContain('W70')
    expect(f?.label).toBe('サイズ（身長）')
  })

  it('上下ともS/M/Lが選べる', () => {
    for (const f of [sizeOf('slacks', 'hem'), sizeOf('jacket', 'badge')]) {
      const vals = (f?.choices ?? []).map(c => c.value)
      expect(vals).toEqual(expect.arrayContaining(['S', 'M', 'L']))
    }
  })

  it('規格外は手入力できる（allow_free）', () => {
    expect(sizeOf('slacks', 'hem')?.allow_free).toBe(true)
    expect(sizeOf('jacket', 'badge')?.allow_free).toBe(true)
  })

  it('スカートはボトム、シャツは上着として扱う', () => {
    expect(sizeOf('skirt', 'hem')?.label).toBe('サイズ（ウエスト）')
    expect(sizeOf('shirt', 'button')?.label).toBe('サイズ（身長）')
  })

  it('サイズ欄はキーが共通なので、取り込み直すと旧定義（自由入力）が置き換わる', () => {
    const old: FieldDef[] = [{ key: 'garment_size', label: 'サイズ（タグ表示）', type: 'text' }]
    const preset = PRESETS_BY_KEY.uniform.find(g => g.code === 'slacks')!
      .items.find(i => i.code === 'hem')!.fields!
    const merged = mergePresetFields(old, preset)
    const size = merged.find(f => f.key === 'garment_size')
    expect(size?.type).toBe('select')
    expect(merged.filter(f => f.key === 'garment_size')).toHaveLength(1)
  })
})
