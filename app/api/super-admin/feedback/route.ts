export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'
import { createAdminClient } from '@/lib/supabaseAdmin'

// 運用側のみ閲覧・更新可（assertSuperAdmin）。現場フィードバックの一覧/ステータス更新。
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
    return NextResponse.json({ feedback: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { id, status, approve } = await req.json() as { id?: string; status?: string; approve?: boolean }
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

    const supabase = createAdminClient({ noStore: true })

    if (approve) return await approveForAutofix(supabase, id)

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

  const token = process.env.GITHUB_TOKEN
  const repo  = process.env.GITHUB_REPO || 'to4fu321-lab/line-wait-system-'
  if (!token) return NextResponse.json({ error: 'GITHUB_TOKEN が未設定です' }, { status: 500 })

  const label = 'approved-for-autofix'
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'line-wait-system-feedback',
  }

  let labelRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
    method: 'POST', headers, body: JSON.stringify({ labels: [label] }),
  })
  if (labelRes.status === 404) {
    // ラベル自体が未作成の場合は作成してから再試行する
    await fetch(`https://api.github.com/repos/${repo}/labels`, {
      method: 'POST', headers, body: JSON.stringify({ name: label, color: '1a7f37', description: '承認済み・自動実装対象' }),
    })
    labelRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
      method: 'POST', headers, body: JSON.stringify({ labels: [label] }),
    })
  }
  if (!labelRes.ok) {
    const detail = await labelRes.text().catch(() => '')
    console.error(`[feedback/approve] GitHub ラベル付与に失敗しました (status=${labelRes.status}): ${detail}`)
    return NextResponse.json({ error: `GitHub ラベル付与に失敗しました: ${detail}` }, { status: 502 })
  }

  const { error: updateError } = await supabase
    .from('feedback')
    .update({ approved_at: new Date().toISOString(), approved_by: 'super-admin', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
