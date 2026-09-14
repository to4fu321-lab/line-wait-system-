export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { createAdminClient } from '@/lib/supabaseAdmin'
import {
  getGithubConfig, addLabel, findPrByBranch, mergePr, createPrToMain,
  getIssueComments, postIssueComment, dispatchAutofixWorkflow, checkGithubAuth,
  type GithubPr, type GithubComment,
} from '@/lib/githubApi'
import { webpush, setupWebPush } from '@/lib/webPushSetup'

// 秘密鍵はコードに埋め込まない（必ず env で設定する。漏洩時はローテーション）
const vapidReady = setupWebPush(
  'mailto:to4fu321@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
)

interface FeedbackRow {
  id: string
  issue_number: number | null
  approved_at: string | null
}

interface NoticeRow {
  id: string
  feedback_id: string | null
  acknowledged_at: string | null
}

interface FollowupRow {
  id: string
  issue_number: number | null
  related_feedback_id: string | null
  created_at: string
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
    const prMainByFeedbackId = new Map<string, GithubPr | null>()
    const commentsByFeedbackId = new Map<string, GithubComment[]>()
    let githubError: string | null = null

    if (config) {
      const targets = rows.filter(r => r.approved_at && r.issue_number)
      if (targets.length > 0) {
        const auth = await checkGithubAuth(config)
        if (!auth.ok) {
          githubError = `GitHub連携エラー (status=${auth.status}): ${auth.error}`
          console.error(`[feedback/GET] ${githubError}`)
        } else {
          await Promise.all(targets.map(async r => {
            const branch = `auto/feedback-${r.issue_number}`
            const [pr, prMain, comments] = await Promise.all([
              findPrByBranch(config, branch, 'dev'),
              findPrByBranch(config, branch, 'main'),
              getIssueComments(config, r.issue_number!),
            ])
            prByFeedbackId.set(r.id, pr)
            prMainByFeedbackId.set(r.id, prMain)
            commentsByFeedbackId.set(r.id, comments)
          }))
        }
      }
    } else {
      githubError = 'GITHUB_TOKEN が未設定です'
    }

    // お知らせの既読状況と、「まだ直っていない」からの再報告を、元のフィードバックに紐づけて返す。
    const ids = rows.map(r => r.id)
    const [{ data: notices }, { data: followups }] = ids.length > 0
      ? await Promise.all([
          supabase.from('feedback_notices').select('id, feedback_id, acknowledged_at').in('feedback_id', ids),
          supabase.from('feedback').select('id, issue_number, related_feedback_id, created_at').in('related_feedback_id', ids),
        ])
      : [{ data: [] }, { data: [] }]

    const noticesByFeedbackId = new Map<string, NoticeRow[]>()
    for (const n of (notices ?? []) as NoticeRow[]) {
      if (!n.feedback_id) continue
      const list = noticesByFeedbackId.get(n.feedback_id) ?? []
      list.push(n)
      noticesByFeedbackId.set(n.feedback_id, list)
    }
    const followupsByFeedbackId = new Map<string, FollowupRow[]>()
    for (const f of (followups ?? []) as FollowupRow[]) {
      if (!f.related_feedback_id) continue
      const list = followupsByFeedbackId.get(f.related_feedback_id) ?? []
      list.push(f)
      followupsByFeedbackId.set(f.related_feedback_id, list)
    }

    const feedback = rows.map(r => {
      const rowNotices = noticesByFeedbackId.get(r.id) ?? []
      return {
        ...r,
        pr: prByFeedbackId.get(r.id) ?? null,
        prMain: prMainByFeedbackId.get(r.id) ?? null,
        comments: commentsByFeedbackId.get(r.id) ?? [],
        noticeAcknowledgedAt: rowNotices.find(n => n.acknowledged_at)?.acknowledged_at ?? null,
        noticeSentCount: rowNotices.length,
        followups: followupsByFeedbackId.get(r.id) ?? [],
      }
    })
    return NextResponse.json({ feedback, githubError })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { id, status, approve, mergePr: shouldMergePr, prNumber, comment, promote, notifyFix } = await req.json() as {
      id?: string; status?: string; approve?: boolean; mergePr?: boolean; prNumber?: number; comment?: string; promote?: boolean
      notifyFix?: { target?: 'store' | 'all'; message?: string }
    }
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

    const supabase = createAdminClient({ noStore: true })

    if (approve) return await approveForAutofix(supabase, id)
    if (shouldMergePr) return await mergeFeedbackPr(prNumber)
    if (comment) return await postCommentAndRerun(supabase, id, comment)
    if (promote) return await promoteFeedbackToMain(supabase, id)
    if (notifyFix) return await notifyFeedbackFix(supabase, id, notifyFix)

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

// PRマージ: dev宛・main宛どちらのPRもこれでマージする（base非依存）。
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

// 本番昇格: dev宛PRがマージ済みであることを確認し、同じブランチからmain宛の第二PRを作る
// （既にあれば作らず既存を返す＝冪等）。これにより dev に他の未昇格案件が積まれていても
// 巻き込まず、この案件の差分だけを本番へ反映できる。マージは mergeFeedbackPr を別途呼ぶ。
async function promoteFeedbackToMain(
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
  if (!issueNumber) return NextResponse.json({ error: 'GitHub Issue が未作成です' }, { status: 400 })

  const config = getGithubConfig()
  if (!config) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 })

  const branch = `auto/feedback-${issueNumber}`
  const devPr = await findPrByBranch(config, branch, 'dev')
  if (!devPr?.merged) {
    return NextResponse.json({ error: 'dev へのマージが完了していないため、本番へ昇格できません' }, { status: 400 })
  }

  const existing = await findPrByBranch(config, branch, 'main')
  if (existing) return NextResponse.json({ ok: true, pr: existing })

  const created = await createPrToMain(config, branch, issueNumber)
  if (!created.ok) {
    console.error(`[feedback/promote] ${created.error}`)
    return NextResponse.json({ error: created.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true, pr: created.pr })
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

// 修正完了のお知らせ: 運用者が任意のタイミングで、フィードバックを送ってきた店舗
// （target: 'store'）または全店舗（target: 'all'）へ「直った」ことを知らせる。
// feedback_notices に保存（店舗の管理画面はここを見て表示）した上で、
// 該当店舗の管理者にブラウザ通知（Webプッシュ）も送る。
async function notifyFeedbackFix(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  notifyFix: { target?: 'store' | 'all'; message?: string },
): Promise<NextResponse> {
  const message = (notifyFix.message ?? '').trim()
  if (!message) return NextResponse.json({ error: 'メッセージが空です' }, { status: 400 })

  const { data, error } = await supabase
    .from('feedback')
    .select('store_id')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const feedbackStoreId = (data as { store_id: string | null } | null)?.store_id ?? null
  const target = notifyFix.target === 'all' ? 'all' : 'store'
  if (target === 'store' && !feedbackStoreId) {
    return NextResponse.json({ error: 'このフィードバックには投稿元の店舗が記録されていないため、店舗宛には送れません' }, { status: 400 })
  }
  const noticeStoreId = target === 'all' ? null : feedbackStoreId

  const { error: insertError } = await supabase.from('feedback_notices').insert({
    feedback_id: id,
    store_id: noticeStoreId,
    message,
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  await pushFixNoticeToAdmins(supabase, noticeStoreId, message)

  return NextResponse.json({ ok: true })
}

// 対象店舗（noticeStoreId が null なら全店舗）の管理者宛にWebプッシュを送る。
// プッシュ未購読の店舗には届かないが、feedback_notices の保存自体は成立しているため
// 管理画面を開けば後からでも表示される（プッシュはあくまで即時通知の補助）。
async function pushFixNoticeToAdmins(
  supabase: ReturnType<typeof createAdminClient>,
  noticeStoreId: string | null,
  message: string,
): Promise<void> {
  if (!vapidReady) return
  let query = (supabase.from('push_subscriptions') as any)
    .select('endpoint, p256dh, auth, store_id').eq('kind', 'admin')
  if (noticeStoreId) query = query.eq('store_id', noticeStoreId)
  const { data: subs } = await query
  if (!subs?.length) return

  const results = await Promise.allSettled(
    (subs as any[]).map(s => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title: '修正完了のお知らせ', body: message, url: `/${s.store_id}/admin` }),
    ))
  )

  const expired = (subs as any[]).filter((_, i) => {
    const r = results[i]
    return r.status === 'rejected' && [410, 404].includes((r as any).reason?.statusCode)
  })
  if (expired.length) {
    await Promise.all(expired.map(s =>
      (supabase.from('push_subscriptions') as any).delete().eq('endpoint', s.endpoint)))
  }
}
