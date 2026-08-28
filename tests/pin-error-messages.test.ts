import { describe, it, expect } from 'vitest'
import { PIN_ERROR_MESSAGES, PinAuthError } from '@/lib/pinAuth'

// PIN認証の失敗理由が「入力ミス」と「障害」で明確に分かれていることを守る。
// ここが混ざると、現場が原因に辿り着けず調査に時間がかかる（実例あり）。
describe('PIN_ERROR_MESSAGES', () => {
  it('入力ミスの文面は簡潔で、管理者への連絡を促さない', () => {
    expect(PIN_ERROR_MESSAGES.wrongPin).toBe('PINが違います')
    expect(PIN_ERROR_MESSAGES.wrongPin).not.toContain('管理者')
  })

  it('障害系の文面はすべて管理者への連絡を促す', () => {
    const failures = [
      PIN_ERROR_MESSAGES.network,
      PIN_ERROR_MESSAGES.server(500),
      PIN_ERROR_MESSAGES.badResponse,
      PIN_ERROR_MESSAGES.database,
    ]
    for (const msg of failures) {
      expect(msg).toContain('管理者へご連絡ください')
      expect(msg).not.toBe(PIN_ERROR_MESSAGES.wrongPin)
    }
  })

  it('サーバーエラーはHTTPステータスを含め、原因を追跡できる', () => {
    expect(PIN_ERROR_MESSAGES.server(500)).toContain('500')
    expect(PIN_ERROR_MESSAGES.server(503)).toContain('503')
  })

  it('DB接続失敗は「PINは正しい」と伝え、ネットワーク制限の可能性を案内する', () => {
    expect(PIN_ERROR_MESSAGES.database).toContain('PINは確認できました')
    expect(PIN_ERROR_MESSAGES.database).toContain('社内ネットワーク')
    expect(PIN_ERROR_MESSAGES.database).toContain('モバイル通信')
  })
})

describe('PinAuthError', () => {
  it('Errorとして判別でき、文面をそのまま保持する', () => {
    const e = new PinAuthError(PIN_ERROR_MESSAGES.database)
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(PinAuthError)
    expect(e.name).toBe('PinAuthError')
    expect(e.message).toBe(PIN_ERROR_MESSAGES.database)
  })

  it('通常のErrorはPinAuthErrorとして扱われない(既定の入力ミス表示に落ちる)', () => {
    expect(new Error('boom')).not.toBeInstanceOf(PinAuthError)
  })
})
