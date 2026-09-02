'use client'

// ============================================================================
//  「戻る」の行き先を呼び出し元から指定できるようにする
//
//  初期設定ウィザードの完了画面から各マスタへ飛ぶと、そのページの「戻る」は
//  設定画面へ固定されていて、ウィザードのチェックリストに帰れなかった。
//  リンクに ?back=/... を付けておけば、そこへ戻れるようにする。
//
//  useSearchParams は Suspense 境界を要求してビルドに影響が出るので、
//  マウント後に window.location から読む。初回描画は fallback のままで、
//  戻り先が変わるだけなので不都合はない。
// ============================================================================

import { useEffect, useState } from 'react'

export function useBackHref(fallback: string): string {
  const [href, setHref] = useState(fallback)

  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('back')
      // 自サイト内の絶対パスだけ許可する（//evil.com のような外部飛ばしを弾く）
      if (raw && raw.startsWith('/') && !raw.startsWith('//')) setHref(raw)
      else setHref(fallback)
    } catch { /* URL が読めない環境では fallback のまま */ }
  }, [fallback])

  return href
}

/** リンクに ?back= を足す（既にクエリがあっても壊さない） */
export function withBack(href: string, back: string): string {
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}back=${encodeURIComponent(back)}`
}
