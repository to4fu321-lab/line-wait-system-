export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

const KIND_LABEL: Record<string, string> = { request: '要望', bug: '不具合', question: '質問' }

// 現場フィードバックの受付。Supabaseに保存し、GITHUB_TOKEN があれば Issue を自動作成する。
// Issue作成は失敗してもフィードバック保存は成立させる（投稿を止めない）。
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      storeId?: string; kind?: string; body?: string; pageUrl?: string; userAgent?: string
    }
    const kind = ['request', 'bug', 'question'].includes(body.kind ?? '') ? body.kind! : 'request'
    const text = (body.body ?? '').trim()
    if (!text) return NextResponse.json({ ok: false, error: '内容が空です' }, { status: 400 })
    if (text.length > 4000) return NextResponse.json({ ok: false, error: '内容が長すぎます' }, { status: 400 })

    const supabase = createAdminClient({ noStore: true })

    // 店名を解決（任意）
    let storeName: string | null = null
    if (body.storeId) {
      const { data } = await supabase.from('stores').select('name').eq('id', body.storeId).single()
      storeName = (data as { name?: string } | null)?.name ?? null
    }

    // 保存
    const { data: inserted, error } = await supabase.from('feedback').insert({
      store_id:   body.storeId || null,
      store_name: storeName,
      kind,
      body:       text,
      page_url:   body.pageUrl ?? null,
      user_agent: body.userAgent ?? null,
    }).select('id').single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const feedbackId = (inserted as { id: string }).id

    // GitHub Issue 自動作成（任意・トークンがあるときのみ）
    const token = process.env.GITHUB_TOKEN
    const repo  = process.env.GITHUB_REPO || 'to4fu321-lab/line-wait-system-'
    if (token) {
      try {
        const title = `[${KIND_LABEL[kind] ?? kind}] ${text.split('\n')[0].slice(0, 60)}${storeName ? `（${storeName}）` : ''}`
        const issueBody = [
          `**種別**: ${KIND_LABEL[kind] ?? kind}`,
          storeName ? `**店舗**: ${storeName}` : null,
          body.pageUrl ? `**画面**: \`${body.pageUrl}\`` : null,
          body.userAgent ? `**端末**: ${body.userAgent}` : null,
          `**feedback id**: ${feedbackId}`,
          '',
          '---',
          '',
          text,
          '',
          '_アプリ内フィードバックから自動作成_',
        ].filter(Boolean).join('\n')

        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'line-wait-system-feedback',
          },
          body: JSON.stringify({ title, body: issueBody, labels: ['feedback', KIND_LABEL[kind] ?? kind] }),
        })
        if (res.ok) {
          const issue = await res.json() as { number?: number; html_url?: string }
          await supabase.from('feedback')
            .update({ issue_number: issue.number ?? null, issue_url: issue.html_url ?? null })
            .eq('id', feedbackId)
        }
      } catch { /* Issue作成失敗はフィードバック保存に影響させない */ }
    }

    return NextResponse.json({ ok: true, id: feedbackId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
