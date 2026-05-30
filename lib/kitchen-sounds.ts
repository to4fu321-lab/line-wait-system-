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

  // 注文着信 — シンプルな2音コール（ドアベル）
  pending: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(1174.66, t,        0.09, 0.22, 'sine')  // D6
    note(880.00,  t + 0.14, 0.22, 0.28, 'sine')  // A5
    vibrate([20, 10, 40])
  },

  // 調理開始 — トルルン（高音アタック→急速トリル→着地）
  preparing: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(1318.5, t + 0.00, 0.04, 0.26, 'sine')  // E6  ト
    note(1174.7, t + 0.05, 0.04, 0.23, 'sine')  // D6  ル
    note(1318.5, t + 0.09, 0.04, 0.23, 'sine')  // E6  ル
    note(1174.7, t + 0.13, 0.04, 0.23, 'sine')  // D6  ル
    note(1046.5, t + 0.17, 0.04, 0.21, 'sine')  // C6  ン
    note(880.00,  t + 0.22, 0.18, 0.30, 'sine')  // A5  ～
    vibrate([15, 5, 30])
  },

  // 出来上がり — 料理タイマー（3短音＋1長音）
  ready: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(1046.5, t,        0.07, 0.32, 'sine')
    note(1046.5, t + 0.13, 0.07, 0.32, 'sine')
    note(1046.5, t + 0.26, 0.07, 0.32, 'sine')
    note(1318.5, t + 0.38, 0.60, 0.50, 'sine')
    vibrate([30, 20, 30, 20, 100])
  },

  // お渡し完了 — ゲームクリア（スケールラン＋フィナーレ和音）
  completed: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(523.25, t,        0.07, 0.18)
    note(587.33, t + 0.07, 0.07, 0.18)
    note(659.25, t + 0.14, 0.07, 0.20)
    note(698.46, t + 0.21, 0.07, 0.20)
    note(783.99, t + 0.28, 0.07, 0.22)
    note(880.00, t + 0.35, 0.07, 0.22)
    note(987.77, t + 0.42, 0.07, 0.22)
    note(1046.5, t + 0.50, 0.70, 0.40)
    note(1318.5, t + 0.50, 0.70, 0.30)
    note(1568.0, t + 0.50, 0.70, 0.25)
    vibrate([50, 20, 50, 20, 150])
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
 * AudioContext を解除し、準備完了後に onReady を呼ぶ。
 * 既に running なら即座に呼ぶ。iOS 対応。
 */
export function unlockAudio(onReady?: () => void): void {
  const c = getCtx(); if (!c) return
  if (c.state === 'running') {
    onReady?.()
    return
  }
  try {
    if (!_unlocked) {
      // iOS Safari: 無音バッファでアンロック
      const buf = c.createBuffer(1, 1, 22050)
      const src = c.createBufferSource()
      src.buffer = buf
      src.connect(c.destination)
      src.start(0)
    }
    c.resume()
      .then(() => { _unlocked = true; onReady?.() })
      .catch(() => {})
  } catch {}
}
