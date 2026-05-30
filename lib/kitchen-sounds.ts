import type { TakeoutOrderStatus } from '@/types/takeout'

// ── Web Audio API コンテキスト ─────────────────────────────
let _ctx:      AudioContext | null = null
let _unlocked: boolean             = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!_ctx) {
      const W = window as never as { webkitAudioContext?: typeof AudioContext }
      _ctx = new (window.AudioContext || W.webkitAudioContext!)()
    }
    return _ctx
  } catch { return null }
}

// ── 単音生成ヘルパー ──────────────────────────────────────
function note(
  freq:      number,
  startTime: number,
  duration:  number,
  vol:       number         = 0.25,
  wave:      OscillatorType = 'sine'
) {
  const c = getCtx(); if (!c || c.state !== 'running') return
  const osc  = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain); gain.connect(c.destination)
  osc.type = wave
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

// ── ハプティクス ──────────────────────────────────────────
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch {}
  }
}

// ── サウンド定義 ──────────────────────────────────────────
const SOUNDS: Partial<Record<TakeoutOrderStatus, () => void>> = {

  // 新規注文 — 明るい上昇アルペジオ (C5→E5→G5)
  pending: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(523.25, t,        0.13)
    note(659.25, t + 0.10, 0.13)
    note(783.99, t + 0.20, 0.20)
    vibrate([30, 20, 60])
  },

  // 調理開始 — 短いポップ×2
  preparing: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(880, t,        0.06, 0.22, 'square')
    note(660, t + 0.06, 0.09, 0.16, 'square')
    vibrate(40)
  },

  // 完成 — 4音ファンファーレ
  ready: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(523.25, t,        0.10)
    note(659.25, t + 0.08, 0.10)
    note(783.99, t + 0.16, 0.10)
    note(1046.5, t + 0.24, 0.30)
    vibrate([80, 40, 80])
  },

  // お渡し完了 — チャイム (C6→E6→G6)
  completed: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(1046.5, t,        0.12)
    note(1318.5, t + 0.10, 0.12)
    note(1568.0, t + 0.20, 0.22)
    vibrate(50)
  },
}

// ── ミュート状態 ─────────────────────────────────────────
let _muted = false

export function setSoundMuted(muted: boolean): void { _muted = muted }
export function isSoundMuted(): boolean             { return _muted  }

// ── 公開 API ─────────────────────────────────────────────

export function triggerSound(status: TakeoutOrderStatus): void {
  if (_muted) return
  try { SOUNDS[status]?.() } catch {}
}

/** 汎用ハプティクス */
export function triggerHaptic(type: 'success' | 'error' | 'light' = 'success') {
  if (_muted) return
  switch (type) {
    case 'success': vibrate(50);              break
    case 'error':   vibrate([200, 100, 200]); break
    case 'light':   vibrate(20);              break
  }
}

/**
 * iOS では AudioContext をユーザー操作の中で resume() + 無音再生しないと
 * 以降の音が鳴らない。最初のタップ/クリック時に必ず呼ぶこと。
 */
export function unlockAudio(): void {
  if (_unlocked) return
  const c = getCtx(); if (!c) return
  try {
    // 無音の1サンプルバッファを再生 — iOS Safari のアンロック定石
    const buf    = c.createBuffer(1, 1, 22050)
    const source = c.createBufferSource()
    source.buffer = buf
    source.connect(c.destination)
    source.start(0)
    c.resume().then(() => { _unlocked = true }).catch(() => {})
  } catch {}
}
