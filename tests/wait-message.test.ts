import { describe, it, expect } from 'vitest'
import { getWaitMessage, DEFAULT_THRESHOLDS, type WaitThreshold } from '@/types/database'

describe('getWaitMessage', () => {
  it('待ち人数に応じたメッセージを返す', () => {
    expect(getWaitMessage(0, DEFAULT_THRESHOLDS)).toBe(DEFAULT_THRESHOLDS[0].text)
    expect(getWaitMessage(4, DEFAULT_THRESHOLDS)).toBe(DEFAULT_THRESHOLDS[0].text)
    expect(getWaitMessage(5, DEFAULT_THRESHOLDS)).toBe(DEFAULT_THRESHOLDS[1].text)
    expect(getWaitMessage(100, DEFAULT_THRESHOLDS)).toBe(DEFAULT_THRESHOLDS[2].text)
  })

  it('しきい値が順不同でも max_wait 昇順で評価する', () => {
    const shuffled: WaitThreshold[] = [
      { max_wait: null, text: 'C' },
      { max_wait: 3,    text: 'A' },
      { max_wait: 8,    text: 'B' },
    ]
    expect(getWaitMessage(2, shuffled)).toBe('A')
    expect(getWaitMessage(5, shuffled)).toBe('B')
    expect(getWaitMessage(20, shuffled)).toBe('C')
  })

  it('該当なし（空配列）は空文字', () => {
    expect(getWaitMessage(3, [])).toBe('')
  })
})
