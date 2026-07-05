// GitHub REST API 呼び出しの共通ヘルパー。
// フィードバックの自動実装フロー（Issue作成・承認ラベル・PR確認・マージ・
// 個別案件のmainへの昇格）で使う最小限のラッパー。

export interface GithubConfig {
  token: string
  repo: string
}

export function getGithubConfig(): GithubConfig | null {
  const token = process.env.GITHUB_TOKEN
  const repo  = process.env.GITHUB_REPO || 'to4fu321-lab/line-wait-system-'
  if (!token) return null
  return { token, repo }
}

function headers(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'line-wait-system-feedback',
  }
}

export interface GithubPr {
  number: number
  html_url: string
  state: 'open' | 'closed'
  merged: boolean
  title: string
  body: string | null
  mergeable: boolean | null
}

// ブランチ名からPRを検索する（auto/feedback-<issue番号> の命名規則に依存）。
// 同じブランチが dev 宛・main 宛の2つのPRを同時に持ちうるため、base を指定して絞り込む。
export async function findPrByBranch(config: GithubConfig, branch: string, base?: string): Promise<GithubPr | null> {
  const owner = config.repo.split('/')[0]
  const baseQuery = base ? `&base=${base}` : ''
  const res = await fetch(
    `https://api.github.com/repos/${config.repo}/pulls?head=${owner}:${branch}&state=all${baseQuery}`,
    { headers: headers(config.token) },
  )
  if (!res.ok) return null
  // 一覧取得エンドポイントは merged が常に false で返る（merged_at はある）ため、
  // マージ済み判定は merged_at の有無から自前で導出する。
  const list = await res.json() as Array<Omit<GithubPr, 'merged'> & { merged_at: string | null }>
  const pr = list[0]
  if (!pr) return null
  return { ...pr, merged: pr.merged_at != null }
}

export async function mergePr(config: GithubConfig, prNumber: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: headers(config.token),
    body: JSON.stringify({ merge_method: 'squash' }),
  })
  if (res.ok) return { ok: true }
  const detail = await res.text().catch(() => '')
  return { ok: false, error: `PRマージに失敗しました (status=${res.status}): ${detail}` }
}

// 承認済み・dev反映済みのfeedbackブランチを、単独でmain宛にPR化する（本番への個別昇格）。
// dev宛PRとは独立したPRなので、devに他の案件が積まれていてもそれらは巻き込まない。
export async function createPrToMain(config: GithubConfig, branch: string, issueNumber: number): Promise<{ ok: true; pr: GithubPr } | { ok: false; error: string }> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}/pulls`, {
    method: 'POST',
    headers: headers(config.token),
    body: JSON.stringify({
      title: `本番反映: フィードバック #${issueNumber} (${branch})`,
      head: branch,
      base: 'main',
      body: `\`${branch}\` の内容を dev で検証済みのまま本番(main)へ反映します。\n\nCloses #${issueNumber}`,
    }),
  })
  if (res.ok) return { ok: true, pr: await res.json() as GithubPr }
  const detail = await res.text().catch(() => '')
  return { ok: false, error: `本番PRの作成に失敗しました (status=${res.status}): ${detail}` }
}

// GITHUB_TOKEN が実際にGitHubへアクセスできるかの簡易チェック。
// コメント取得・PR検索は失敗時に黙って空を返す設計のため、管理画面側で
// 「なぜ表示されないか」を示すために使う（トークン失効・権限不足の切り分け用）。
export async function checkGithubAuth(config: GithubConfig): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}`, { headers: headers(config.token) })
  if (res.ok) return { ok: true }
  const detail = await res.text().catch(() => '')
  return { ok: false, status: res.status, error: detail }
}

export interface GithubComment {
  id: number
  body: string
  author: string
  isBot: boolean
  created_at: string
}

// Issueのコメント欄を取得する。スーパー管理画面でのやり取りスレッド表示に使う。
export async function getIssueComments(config: GithubConfig, issueNumber: number): Promise<GithubComment[]> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}/issues/${issueNumber}/comments?per_page=50`, {
    headers: headers(config.token),
  })
  if (!res.ok) return []
  const list = await res.json() as Array<{ id: number; body: string; user: { login: string; type: string } | null; created_at: string }>
  return list.map(c => ({
    id: c.id,
    body: c.body,
    author: c.user?.login ?? '不明',
    isBot: c.user?.type === 'Bot',
    created_at: c.created_at,
  }))
}

export async function postIssueComment(config: GithubConfig, issueNumber: number, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}/issues/${issueNumber}/comments`, {
    method: 'POST', headers: headers(config.token), body: JSON.stringify({ body }),
  })
  if (res.ok) return { ok: true }
  const detail = await res.text().catch(() => '')
  return { ok: false, error: `コメント投稿に失敗しました (status=${res.status}): ${detail}` }
}

// 運用者がスーパー管理画面でコメントを送ったあと、Claudeに続きを検討させるための再実行トリガー。
export async function dispatchAutofixWorkflow(config: GithubConfig, issueNumber: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}/actions/workflows/feedback-autofix.yml/dispatches`, {
    method: 'POST', headers: headers(config.token),
    body: JSON.stringify({ ref: 'main', inputs: { issue_number: String(issueNumber) } }),
  })
  if (res.ok || res.status === 204) return { ok: true }
  const detail = await res.text().catch(() => '')
  return { ok: false, error: `ワークフロー再実行に失敗しました (status=${res.status}): ${detail}` }
}

export async function addLabel(config: GithubConfig, issueNumber: number, label: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let res = await fetch(`https://api.github.com/repos/${config.repo}/issues/${issueNumber}/labels`, {
    method: 'POST', headers: headers(config.token), body: JSON.stringify({ labels: [label] }),
  })
  if (res.status === 404) {
    // ラベル自体が未作成の場合は作成してから再試行する
    await fetch(`https://api.github.com/repos/${config.repo}/labels`, {
      method: 'POST', headers: headers(config.token),
      body: JSON.stringify({ name: label, color: '1a7f37', description: '承認済み・自動実装対象' }),
    })
    res = await fetch(`https://api.github.com/repos/${config.repo}/issues/${issueNumber}/labels`, {
      method: 'POST', headers: headers(config.token), body: JSON.stringify({ labels: [label] }),
    })
  }
  if (res.ok) return { ok: true }
  const detail = await res.text().catch(() => '')
  return { ok: false, error: `GitHub ラベル付与に失敗しました: ${detail}` }
}
