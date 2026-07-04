import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { verifyLineSignature } from '@/lib/lineSignature'

const SECRET = 'test-channel-secret'
const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('base64')

describe('verifyLineSignature', () => {
  it('正しい署名は通る', () => {
    const body = JSON.stringify({ events: [] })
    expect(verifyLineSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('署名が違えば拒否', () => {
    const body = JSON.stringify({ events: [] })
    expect(verifyLineSignature(body, sign(body + 'tampered'), SECRET)).toBe(false)
  })

  it('secret 未設定は fail-close（拒否）', () => {
    const body = JSON.stringify({ events: [] })
    expect(verifyLineSignature(body, sign(body), '')).toBe(false)
  })

  it('署名ヘッダーなしは拒否', () => {
    expect(verifyLineSignature('{}', '', SECRET)).toBe(false)
  })
})
