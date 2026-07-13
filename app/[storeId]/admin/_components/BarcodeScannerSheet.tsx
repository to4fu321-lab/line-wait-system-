'use client'

// ============================================================
// バーコード / QRコード スキャナー（カメラ読み取り）
//   @zxing/browser を動的importして使用（開いた時のみロード）。
//   JAN/EAN・CODE128・QR など主要フォーマットに対応。
//   iPhone Safari でも動作（HTTPS必須・カメラ許可が必要）。
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, CameraOff, ScanLine } from 'lucide-react'

type Props = {
  title?: string
  hint?: string
  /** 読み取り成功時。continuous=true の場合は開いたまま連続で呼ばれる */
  onDetect: (code: string) => void
  onClose: () => void
  /** 連続読み取りモード（同一コードは cooldown 内で重複無視） */
  continuous?: boolean
}

export function BarcodeScannerSheet({ title = 'スキャン', hint, onDetect, onClose, continuous = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)

  // 最新のコールバックを保持（クリーンアップ地獄を避ける）
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const lastHitRef = useRef<{ code: string; at: number } | null>(null)

  useEffect(() => {
    let stopped = false
    let controls: { stop: () => void } | null = null

    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (stopped) return
        const reader = new BrowserMultiFormatReader()
        // 背面カメラ優先
        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }
        controls = await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
          if (!result) return /* 未検出フレームは無視（読み取り継続） */
          const code = result.getText().trim()
          if (!code) return
          const now = Date.now()
          // 同一コードの連続ヒットは2.5秒抑制（連続モードの多重加算防止）
          if (lastHitRef.current && lastHitRef.current.code === code && now - lastHitRef.current.at < 2500) return
          lastHitRef.current = { code, at: now }
          setLastCode(code)
          try { navigator.vibrate?.(80) } catch { /* 非対応端末は無視 */ }
          onDetectRef.current(code)
          if (!continuous) {
            controls?.stop()
            onCloseRef.current()
          }
        })
        if (stopped) { controls.stop(); return }
        setStarting(false)
      } catch (e) {
        if (stopped) return
        setStarting(false)
        const msg = e instanceof Error ? e.message : String(e)
        if (/permission|notallowed/i.test(msg)) {
          setError('カメラの使用が許可されていません。ブラウザの設定でカメラを許可してください。')
        } else if (/not ?found|no video/i.test(msg)) {
          setError('カメラが見つかりませんでした。')
        } else {
          setError(`カメラを起動できませんでした: ${msg}`)
        }
      }
    })()

    return () => {
      stopped = true
      controls?.stop()
    }
  }, [continuous])

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <ScanLine size={18} className="text-emerald-400" />
        <p className="font-bold flex-1">{title}</p>
        <button onClick={onClose} className="p-2 -mr-2 rounded-xl active:bg-white/10"><X size={22} /></button>
      </div>

      {/* カメラプレビュー */}
      <div className="relative flex-1 min-h-0">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        {/* 照準枠 */}
        {!error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[78%] max-w-sm aspect-[4/3] rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {starting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm font-bold">カメラを起動しています…</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white/90">
            <CameraOff size={32} className="text-red-400" />
            <p className="text-sm font-bold leading-relaxed">{error}</p>
            <button onClick={onClose} className="mt-2 px-5 py-2.5 rounded-xl bg-white/15 text-sm font-bold">閉じる</button>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="px-5 py-4 text-center" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {lastCode ? (
          <p className="text-emerald-400 text-sm font-black truncate">読み取り: {lastCode}</p>
        ) : (
          <p className="text-white/60 text-xs font-bold">{hint ?? 'バーコード・QRコードを枠内に合わせてください'}</p>
        )}
      </div>
    </div>
  )
}
