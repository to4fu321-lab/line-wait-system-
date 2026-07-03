'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConnectionStatus } from '@/lib/useConnectionStatus'

/**
 * オフライン中／接続復帰時に画面上部へ固定表示するバナー。
 * - オフライン中: 黄色背景で「表示中のデータは最後に取得したもの」である旨を警告
 * - 復帰直後: 緑背景で「接続が回復しました」を数秒表示し、router.refresh() で最新化
 *
 * 管理画面レイアウト（シンプルモード含む）に組み込んで全画面共通で表示する。
 */
export default function OfflineBanner() {
  const { isOnline } = useConnectionStatus()
  const router = useRouter()
  const [recovered, setRecovered] = useState(false)
  const prevOnlineRef = useRef(isOnline)

  useEffect(() => {
    const wasOnline = prevOnlineRef.current
    prevOnlineRef.current = isOnline

    // オフライン → オンラインへ復帰した瞬間
    if (!wasOnline && isOnline) {
      setRecovered(true)
      router.refresh()
      const timer = setTimeout(() => setRecovered(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [isOnline, router])

  // オンラインかつ復帰メッセージ表示中でなければ何も出さない
  if (isOnline && !recovered) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-xs font-bold shadow-md transition-colors ${
        isOnline
          ? 'bg-emerald-500 text-white'
          : 'bg-amber-400 text-amber-950'
      }`}
      style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
    >
      {isOnline
        ? '✅ 接続が回復しました — データを更新しています…'
        : '⚠️ オフライン中 — 表示中のデータは最後に取得したものです'}
    </div>
  )
}
