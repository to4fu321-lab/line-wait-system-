export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { createAdminClient } from '@/lib/supabaseAdmin'
import {
  getGithubConfig, addLabel, findPrByBranch, mergePr,
  getIssueComments, postIssueComment, dispatchAutofixWorkflow,
  type GithubPr, type GithubComment,
} from '@/lib/githubApi'

interface FeedbackRow {
  id: string
  issue_number: number | null
  approved_at: string | null
}

// 運用側のみ閲覧・更新可（assertSuperAdmin）。現場フィードバックの一覧/ステータス更新。
// 承認済み（approved_at あり）の行は、ブランチ名 auto/feedback-<issue番号> でPRを検索し、
// PR状況（未作成・レビュー中・マージ済み）を pr フィールドに載せて返す。
export async function GET(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient({ noStore: true })
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as FeedbackRow[]
    const config = getGithubConfig()
    const prByFeedbackId = new Map<string, GithubPr | null>()
    const commentsByFeedbackId = new Map<string, GithubComment[]>()

    if (config) {
      const targets = rows.filter(r => r.approved_at && r.issue_number)
      await Promise.all(targets.map(async r => {
        const [pr, comments] = await Promise.all([
          findPrByBranch(config, `auto/feedback-${r.issue_number}`),
          getIssueComments(config, r.issue_number!),
        ])
        prByFeedbackId.set(r.id, pr)
        commentsByFeedbackId.set(r.id, comments)
      }))
    }

    const feedback = rows.map(r => ({
      ...r,
      pr: prByFeedbackId.get(r.id) ?? null,
      comments: commentsByFeedbackId.get(r.id) ?? [],
    }))
    return NextResponse.json({ feedback })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { id, status, approve, mergePr: shouldMergePr, prNumber, comment } = await req.json() as {
      id?: string; status?: string; approve?: boolean; mergePr?: boolean; prNumber?: number; comment?: string
    }
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

    const supabase = createAdminClient({ noStore: true })

    if (approve) return await approveForAutofix(supabase, id)
    if (shouldMergePr) return await mergeFeedbackPr(prNumber)
    if (comment) return await postCommentAndRerun(supabase, id, comment)

    if (!status) return NextResponse.json({ error: 'status が必要です' }, { status: 400 })
    if (!['new', 'triaged', 'done', 'wontfix'].includes(status)) {
      return NextResponse.json({ error: 'status の値が不正です' }, { status: 400 })
    }
    const { error } = await supabase
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// 承認: DBにフラグを立て、リンク済みGitHub Issueに approved-for-autofix ラベルを付与する。
// このラベルが feedback-autofix.yml の実装トリガーになる（＝承認なしに自動修正は走らない）。
async function approveForAutofix(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('feedback')
    .select('issue_number')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const issueNumber = (data as { issue_number: number | null } | null)?.issue_number
  if (!issueNumber) {
    return NextResponse.json({ error: 'GitHub Issue が未作成のため承認できません' }, { status: 400 })
  }

  const config = getGithubConfig()
  if (!config) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 })

  const labelResult = await addLabel(config, issueNumber, 'approved-for-autofix')
  if (!labelResult.ok) {
    console.error(`[feedback/approve] ${labelResult.error}`)
    return NextResponse.json({ error: labelResult.error }, { status: 502 })
  }

  const { error: updateError } = await supabase
    .from('feedback')
    .update({ approved_at: new Date().toISOString(), approved_by: 'super-admin', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PRマージ: 自動実装フローが作成したPR（dev宛）をマージする。本番（main）反映は別エンドポイント。
async function mergeFeedbackPr(prNumber?: number): Promise<NextResponse> {
  if (!prNumber) return NextResponse.json({ error: 'prNumber が必要です' }, { status: 400 })

  const config = getGithubConfig()
  if (!config) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 })

  const result = await mergePr(config, prNumber)
  if (!result.ok) {
    console.error(`[feedback/merge-pr] ${result.error}`)
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}

// 運用者からの返信をGitHub Issueにコメントとして投稿し、Claudeに続きを検討させるため
// ワークフローを再実行する。needs-decisionへの回答など、スーパー管理画面だけで
// やり取りを完結させるための入口。
async function postCommentAndRerun(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  comment: string,
): Promise<NextResponse> {
  const text = comment.trim()
  if (!text) return NextResponse.json({ error: 'コメントが空です' }, { status: 400 })

  const { data, error } = await supabase
    .from('feedback')
    .select('issue_number')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const issueNumber = (data as { issue_number: number | null } | null)?.issue_number
  if (!issueNumber) return NextResponse.json({ error: 'GitHub Issue が未作成です' }, { status: 400 })

  const config = getGithubConfig()
  if (!config) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 })

  const commentResult = await postIssueComment(config, issueNumber, `**運用者からの返信（スーパー管理画面より）**\n\n${text}`)
  if (!commentResult.ok) {
    console.error(`[feedback/comment] ${commentResult.error}`)
    return NextResponse.json({ error: commentResult.error }, { status: 502 })
  }

  const dispatchResult = await dispatchAutofixWorkflow(config, issueNumber)
  if (!dispatchResult.ok) {
    console.error(`[feedback/comment] ${dispatchResult.error}`)
    return NextResponse.json({ error: `コメントは投稿されましたが再実行に失敗しました: ${dispatchResult.error}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
