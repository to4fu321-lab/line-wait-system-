// GitHub REST API 呼び出しの共通ヘルパー。
// フィードバックの自動実装フロー（Issue作成・承認ラベル・PR確認・マージ・
// devのmainへの反映）で使う最小限のラッパー。

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
  mergeable: boolean | null
}

// ブランチ名からPRを検索する（auto/feedback-<issue番号> の命名規則に依存）。
export async function findPrByBranch(config: GithubConfig, branch: string): Promise<GithubPr | null> {
  const owner = config.repo.split('/')[0]
  const res = await fetch(
    `https://api.github.com/repos/${config.repo}/pulls?head=${owner}:${branch}&state=all`,
    { headers: headers(config.token) },
  )
  if (!res.ok) return null
  const list = await res.json() as GithubPr[]
  return list[0] ?? null
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

export interface BranchCompare {
  ahead_by: number
  behind_by: number
}

export async function compareBranches(config: GithubConfig, base: string, head: string): Promise<BranchCompare | null> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}/compare/${base}...${head}`, {
    headers: headers(config.token),
  })
  if (!res.ok) return null
  const data = await res.json() as BranchCompare
  return data
}

// dev を main へ反映する（fast-forward可能ならfast-forward、そうでなければmergeコミット）。
export async function mergeBranchIntoMain(config: GithubConfig, head: string, base = 'main'): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`https://api.github.com/repos/${config.repo}/merges`, {
    method: 'POST',
    headers: headers(config.token),
    body: JSON.stringify({ base, head, commit_message: `merge: ${head}を${base}へ反映（スーパー管理画面から）` }),
  })
  if (res.ok || res.status === 204) return { ok: true }
  const detail = await res.text().catch(() => '')
  return { ok: false, error: `${base}への反映に失敗しました (status=${res.status}): ${detail}` }
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
