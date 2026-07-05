import { describe, it, expect, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn() },
}))

describe('setupWebPush', () => {
  const validPublic  = 'BNEGMHJ-ttOVIs4HavfiHj8vYkzOzMrLjyBGKhK-YvA-ZCkuwwXAwnHg4zS-0H39jQxQGlBx-QjvnZqqsFi_nLE'
  const validPrivate = 'UIjC7J3fGWETc5epEDe6lYpWCx3hj-WafAy__0dOYdQ'

  it('正しい65バイト公開鍵+32バイト秘密鍵なら true を返す', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    expect(setupWebPush('mailto:a@b.com', validPublic, validPrivate)).toBe(true)
  })

  it('壊れた/短い公開鍵は例外を投げず false を返す（ビルドを落とさない）', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    expect(() => setupWebPush('mailto:a@b.com', 'not-a-valid-key', validPrivate)).not.toThrow()
    expect(setupWebPush('mailto:a@b.com', 'not-a-valid-key', validPrivate)).toBe(false)
  })

  it('公開鍵は正しいが秘密鍵が32バイトでない場合も例外を投げず false（今回の再発ケース）', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    expect(() => setupWebPush('mailto:a@b.com', validPublic, 'too-short')).not.toThrow()
    expect(setupWebPush('mailto:a@b.com', validPublic, 'too-short')).toBe(false)
  })

  it('鍵が空文字なら false', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    expect(setupWebPush('mailto:a@b.com', '', '')).toBe(false)
  })

  it('前後に空白・改行が混入していても trim して受け付ける（コピペ時の混入対策）', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    expect(setupWebPush('mailto:a@b.com', `  ${validPublic}\n`, `${validPrivate}\n`)).toBe(true)
  })

  it('通常のBase64（+/=を含む）は URL-safe でないため例外を投げず false（今回の再発ケース）', async () => {
    vi.resetModules()
    const { setupWebPush } = await import('@/lib/webPushSetup')
    const notUrlSafe = 'a+b/c=='
    expect(() => setupWebPush('mailto:a@b.com', validPublic, notUrlSafe)).not.toThrow()
    expect(setupWebPush('mailto:a@b.com', validPublic, notUrlSafe)).toBe(false)
  })
})
