'use client'

import { useEffect } from 'react'

// ── 新しいデプロイ後、古い画面のままタブが切り替わらなくなる問題への対処 ──
//
//  ホーム画面に追加したPWAは閉じずに何日も開いたままになる。その間に
//  デプロイが走ると、開いている画面が覚えている /_next/static/chunks/... の
//  URLはサーバ上から消える。そこでまだ一度も開いていないページ（例:
//  お仕事タブから順番待ちタブ）へ移ろうとすると、Next.jsはそのページの
//  チャンクを取りに行って404を受け取り、ChunkLoadError で遷移を中断する。
//  エラーは画面に出ないため、利用者からは「タブを押しても反応しない／
//  元のタブのままになる」という症状に見える。
//
//  復旧方法は新しいHTMLを取り直すこと＝リロードだけなので、検知して自動で行う。
//  リロード後も同じエラーが出る場合（本当にサーバが壊れている等）に
//  無限ループしないよう、一度きりに制限する。

const RELOADED_KEY = 'chunk_reload_done'

function isChunkLoadFailure(message: string): boolean {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i
    .test(message)
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === '1') return
    sessionStorage.setItem(RELOADED_KEY, '1')
  } catch {
    /* sessionStorage が使えない環境では毎回リロードしてしまうため何もしない */
    return
  }
  window.location.reload()
}

export default function ChunkReloader() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isChunkLoadFailure(e.message ?? '')) reloadOnce()
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason
      const msg = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? '')
      if (isChunkLoadFailure(msg)) reloadOnce()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
