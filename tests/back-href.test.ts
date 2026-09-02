import { describe, it, expect } from 'vitest'
import { withBack } from '@/lib/useBackHref'

// 初期設定の完了画面から各マスタへ飛ぶと、そのページの「戻る」が設定画面に
// 固定されていて、チェックリストに帰れなかった。?back= を付けて帰り先を渡す。
describe('withBack', () => {
  const back = '/s1/admin/setup?step=done'

  it('クエリの無いURLには ? で足す', () => {
    expect(withBack('/s1/admin/master/repair', back))
      .toBe('/s1/admin/master/repair?back=%2Fs1%2Fadmin%2Fsetup%3Fstep%3Ddone')
  })

  it('既にクエリがあるURLは & で足す（既存のクエリを壊さない）', () => {
    const out = withBack('/s1/admin/master?tab=staff', back)
    expect(out.startsWith('/s1/admin/master?tab=staff&back=')).toBe(true)
  })

  it('帰り先はURLエンコードする（?や&が混ざっても切れない）', () => {
    const out = withBack('/a', '/b?x=1&y=2')
    expect(new URLSearchParams(out.split('?')[1]).get('back')).toBe('/b?x=1&y=2')
  })
})
