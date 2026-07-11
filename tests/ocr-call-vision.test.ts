import { describe, it, expect } from 'vitest'
import { stripJsonFence, normalizeMime, parseImageInput } from '@/lib/ocr/callVision'

describe('stripJsonFence', () => {
  it('コードブロックフェンスを除去する', () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('フェンスが無ければそのまま', () => {
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}')
  })
  it('前後の空白をtrimする', () => {
    expect(stripJsonFence('  {"a":1}  ')).toBe('{"a":1}')
  })
})

describe('normalizeMime', () => {
  it('有効なMIMEはそのまま', () => {
    expect(normalizeMime('image/png')).toBe('image/png')
    expect(normalizeMime('image/webp')).toBe('image/webp')
  })
  it('不明・未指定は image/jpeg に正規化', () => {
    expect(normalizeMime('application/pdf')).toBe('image/jpeg')
    expect(normalizeMime(undefined)).toBe('image/jpeg')
    expect(normalizeMime(null)).toBe('image/jpeg')
  })
})

describe('parseImageInput', () => {
  it('dataURLからbase64本体とMIMEを取り出す', () => {
    const { base64, mime } = parseImageInput('data:image/png;base64,AAAA')
    expect(base64).toBe('AAAA')
    expect(mime).toBe('image/png')
  })
  it('素のbase64はそのまま（MIMEはjpegにフォールバック）', () => {
    const { base64, mime } = parseImageInput('BBBB')
    expect(base64).toBe('BBBB')
    expect(mime).toBe('image/jpeg')
  })
})
