import type { TakeoutOrderStatus } from '@/types/takeout'

// 音声ファイルは public/sounds/ に配置してください
// ファイルがなくても無音で動作します
const SOUND_MAP: Partial<Record<TakeoutOrderStatus, string>> = {
  pending:   '/sounds/order-in.mp3',      // 新規注文受付音
  preparing: '/sounds/cooking-start.mp3', // 調理開始音
  ready:     '/sounds/order-ready.mp3',   // 完成音
  completed: '/sounds/complete.mp3',      // お渡し完了音
}

const cache = new Map<string, HTMLAudioElement>()

export function triggerSound(status: TakeoutOrderStatus): void {
  if (typeof window === 'undefined') return
  const src = SOUND_MAP[status]
  if (!src) return
  try {
    if (!cache.has(src)) cache.set(src, new Audio(src))
    const audio = cache.get(src)!
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {}
}
