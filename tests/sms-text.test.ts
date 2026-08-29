import { describe, it, expect } from 'vitest'
import { smsSegments, isUcs2, fitToOneSegment, buildRepairSms } from '@/lib/smsText'

describe('smsSegments', () => {
  it('日本語70文字までは1通', () => {
    expect(smsSegments('あ'.repeat(70))).toBe(1)
  })

  it('日本語71文字で2通になる（ここが課金の崖）', () => {
    expect(smsSegments('あ'.repeat(71))).toBe(2)
  })

  it('分割後は67文字ごと', () => {
    expect(smsSegments('あ'.repeat(134))).toBe(2)   // 67×2
    expect(smsSegments('あ'.repeat(135))).toBe(3)
  })

  it('半角英数のみなら GSM-7 で160文字まで1通', () => {
    expect(smsSegments('a'.repeat(160))).toBe(1)
    expect(smsSegments('a'.repeat(161))).toBe(2)
  })

  it('絵文字はサロゲートペアで2文字ぶん数える', () => {
    // 69文字 + 絵文字(2単位) = 71 → 2通
    expect(smsSegments('あ'.repeat(69) + '🎾')).toBe(2)
  })

  it('空文字は0', () => {
    expect(smsSegments('')).toBe(0)
  })
})

describe('isUcs2', () => {
  it('日本語を含めば UCS-2', () => {
    expect(isUcs2('田中様')).toBe(true)
    expect(isUcs2('No.0302 田中')).toBe(true)
  })
  it('半角英数記号のみなら GSM-7 扱い', () => {
    expect(isUcs2('No.0302 ready')).toBe(false)
  })
})

describe('fitToOneSegment', () => {
  it('収まる範囲で任意行を足す', () => {
    const t = fitToOneSegment(['あ'.repeat(10)], ['い'.repeat(10), 'う'.repeat(10)])
    expect(t).toContain('い'.repeat(10))
    expect(t).toContain('う'.repeat(10))
    expect(smsSegments(t)).toBe(1)
  })

  it('溢れる任意行は落として1通を死守する', () => {
    const t = fitToOneSegment(['あ'.repeat(60)], ['い'.repeat(30)])
    expect(t).toBe('あ'.repeat(60))
    expect(smsSegments(t)).toBe(1)
  })

  it('必須行だけで超える場合は切らない（情報欠落より課金増を選ぶ）', () => {
    const t = fitToOneSegment(['あ'.repeat(80)], ['い'])
    expect(t).toBe('あ'.repeat(80))
    expect(smsSegments(t)).toBe(2)
  })
})

describe('buildRepairSms', () => {
  const real = {
    storeName:    'ビーストローク',
    customerName: '田中太郎',
    itemName:     'バドミントン',
    reqNo:        'R-0302',
  }

  it('完了通知が1通に収まる（旧文面は78文字で2通だった）', () => {
    const t = buildRepairSms({ kind: 'completed', ...real })
    expect(smsSegments(t)).toBe(1)
    // 必要な情報は落ちていない
    expect(t).toContain('ビーストローク')
    expect(t).toContain('田中太郎')
    expect(t).toContain('バドミントン')
    expect(t).toContain('R-0302')
    expect(t).toContain('仕上がりました')
  })

  it('受付通知も1通に収まる', () => {
    const t = buildRepairSms({ kind: 'received', ...real, desiredDate: '9/2' })
    expect(smsSegments(t)).toBe(1)
    expect(t).toContain('お預かりしました')
  })

  it('店名・品名が長くても、誰の・何が・番号は必ず残る', () => {
    const t = buildRepairSms({
      kind: 'completed',
      storeName:    'とても長い名前のラケットショップ○○店',
      customerName: '長谷川さくらこ',
      itemName:     'バドミントンガット張替え（ハイブリッド）',
      reqNo:        'R-99999',
    })
    expect(t).toContain('長谷川さくらこ')
    expect(t).toContain('R-99999')
    expect(t).toContain('仕上がりました')
  })

  it('店名・番号が無くても壊れない', () => {
    const t = buildRepairSms({ kind: 'completed', customerName: '田中', itemName: null })
    expect(t).toContain('お預かり品')
    expect(smsSegments(t)).toBe(1)
  })
})
