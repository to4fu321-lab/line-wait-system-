import { describe, it, expect, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn() },
}))

describe('setupWebPush', () => {
  it('正しい65バイトの公開鍵なら true を返す', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    const validPublic = 'BNEGMHJ-ttOVIs4HavfiHj8vYkzOzMrLjyBGKhK-YvA-ZCkuwwXAwnHg4zS-0H39jQxQGlBx-QjvnZqqsFi_nLE'
    expect(setupWebPush('mailto:a@b.com', validPublic, 'dummy-private')).toBe(true)
  })

  it('壊れた/短い公開鍵は例外を投げず false を返す（ビルドを落とさない）', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    expect(() => setupWebPush('mailto:a@b.com', 'not-a-valid-key', 'dummy-private')).not.toThrow()
    expect(setupWebPush('mailto:a@b.com', 'not-a-valid-key', 'dummy-private')).toBe(false)
  })

  it('鍵が空文字なら false', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    expect(setupWebPush('mailto:a@b.com', '', '')).toBe(false)
  })
})
