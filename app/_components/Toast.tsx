'use client'

import { useEffect, useState } from 'react'

// ============================================================
// トースト通知（共通コンポーネント）
//   - onClose を渡すと自動クローズ（undo あり 5s / なし 3s、duration で上書き可）
//   - onUndo を渡すと「取消し」ボタンを表示
//   - type 'undo' は 'ok' と同じ見た目（旧 delivery 実装との互換）
// ============================================================
export function Toast({ msg, type = 'ok', onUndo, onClose, duration, zIndex = 100 }: {
  msg: string
  type?: 'ok' | 'err' | 'undo'
  onUndo?: () => Promise<void> | void
  onClose?: () => void
  duration?: number
  zIndex?: number
}) {
  const [undoing, setUndoing] = useState(false)

  useEffect(() => {
    if (!onClose) return
    const t = setTimeout(onClose, duration ?? (onUndo ? 5000 : 3000))
    return () => clearTimeout(t)
  }, [onClose, onUndo, duration])

  const handleUndo = async () => {
    if (!onUndo || undoing) return
    setUndoing(true)
    await onUndo()
    onClose?.()
  }

  return (
    <div style={{ zIndex }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl max-w-xs ${
        type === 'err' ? 'bg-red-600' : 'bg-gray-900 border border-gray-700'
      }`}>
      <span className="flex-1">{msg}</span>
      {onUndo && (
        <button onClick={handleUndo} disabled={undoing}
          className="shrink-0 px-3 py-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-xs font-black active:scale-95 transition-all disabled:opacity-50">
          {undoing ? '…' : '取消し'}
        </button>
      )}
    </div>
  )
}
