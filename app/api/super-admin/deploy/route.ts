export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { getGithubConfig, compareBranches, mergeBranchIntoMain } from '@/lib/githubApi'

// dev が main よりどれだけ進んでいるかを返す。スーパー管理画面の「本番へ反映」ボタンの表示判断に使う。
export async function GET(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied

  const config = getGithubConfig()
  if (!config) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 })

  const compare = await compareBranches(config, 'main', 'dev')
  if (!compare) return NextResponse.json({ error: 'main/dev の比較に失敗しました' }, { status: 502 })

  return NextResponse.json({ aheadBy: compare.ahead_by, behindBy: compare.behind_by })
}

// dev を main へ反映（本番デプロイのトリガー）。運用者の明示的な操作でのみ実行する。
export async function POST(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied

  const config = getGithubConfig()
  if (!config) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 })

  const result = await mergeBranchIntoMain(config, 'dev', 'main')
  if (!result.ok) {
    console.error(`[super-admin/deploy] ${result.error}`)
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
