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

// ── 白ノイズバースト（ジュー音） ──────────────────────────
function noiseBurst(startTime: number, duration: number, vol = 0.30, filterFreq = 3500) {
  const c = getCtx(); if (!c || c.state !== 'running') return
  const bufLen = Math.floor(c.sampleRate * (duration + 0.05))
  const buf    = c.createBuffer(1, bufLen, c.sampleRate)
  const data   = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

  const source = c.createBufferSource()
  source.buffer = buf

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  filter.Q.value = 0.8

  const gain = c.createGain()
  gain.gain.setValueAtTime(vol, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  source.start(startTime)
  source.stop(startTime + duration + 0.05)
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

  // 調理開始 — ジュー（白ノイズ）＋試合開始パンチ
  preparing: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    noiseBurst(t, 0.22, 0.32, 3500)                             // ジュー
    note(220.00, t + 0.04, 0.10, 0.30, 'sawtooth')             // A3 パンチ
    note(440.00, t + 0.13, 0.09, 0.28, 'sawtooth')             // A4
    note(659.25, t + 0.21, 0.28, 0.38, 'square')               // E5 GO!
    vibrate([20, 10, 80])
  },

  // 出来上がり — 料理タイマー（3短音＋1長音）
  ready: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(1046.5, t,        0.07, 0.32, 'sine')   // C6
    note(1046.5, t + 0.13, 0.07, 0.32, 'sine')   // C6
    note(1046.5, t + 0.26, 0.07, 0.32, 'sine')   // C6
    note(1318.5, t + 0.38, 0.60, 0.50, 'sine')   // E6（長め・伸ばす）
    vibrate([30, 20, 30, 20, 100])
  },

  // お渡し完了 — ゲームクリア（スケールラン＋フィナーレ和音）
  completed: () => {
    const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime
    note(523.25, t,        0.07, 0.18)            // C5
    note(587.33, t + 0.07, 0.07, 0.18)           // D5
    note(659.25, t + 0.14, 0.07, 0.20)           // E5
    note(698.46, t + 0.21, 0.07, 0.20)           // F5
    note(783.99, t + 0.28, 0.07, 0.22)           // G5
    note(880.00, t + 0.35, 0.07, 0.22)           // A5
    note(987.77, t + 0.42, 0.07, 0.22)           // B5
    note(1046.5, t + 0.50, 0.70, 0.40)           // C6 ─┐
    note(1318.5, t + 0.50, 0.70, 0.30)           // E6  │ フィナーレ和音
    note(1568.0, t + 0.50, 0.70, 0.25)           // G6 ─┘
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
 * iOS では AudioContext をユーザー操作の中で resume() + 無音再生しないと
 * 以降の音が鳴らない。最初のタップ/クリック時に必ず呼ぶこと。
 */
export function unlockAudio(): void {
  if (_unlocked) return
  const c = getCtx(); if (!c) return
  try {
    const buf    = c.createBuffer(1, 1, 22050)
    const source = c.createBufferSource()
    source.buffer = buf
    source.connect(c.destination)
    source.start(0)
    c.resume().then(() => { _unlocked = true }).catch(() => {})
  } catch {}
}
