'use client'

// ── 置くだけスキャン ──────────────────────────────────────────
// タブレットを定位置に固定し、トレーに紙（承り書・伝票・メモ）を
// 置くと自動で撮影 → AIが種別判定・内容抽出 → 特大ボタンで確認登録。

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveFeature } from '@/lib/features'
import { PinScreen, verifyStorePinApi } from '@/app/_components/PinScreen'
import {
  SLIP_TYPE_LABELS, summarizeScan, promoteScan,
  type ScanSlipType,
} from '@/lib/scanPromote'

type View = 'loading' | 'pin' | 'ready' | 'disabled'
type ScanState = 'starting' | 'watching' | 'holding' | 'processing' | 'confirm' | 'saved' | 'remove' | 'error'

interface ScanResult {
  inboxId: string
  slipType: ScanSlipType
  data: Record<string, unknown>
  confidence: string
  warnings: string[]
}

const TH_PAPER  = 14  // ベースラインとの平均差: 紙が置かれたと判定
const TH_STABLE = 5   // 前フレームとの平均差: 静止したと判定
const TH_EMPTY  = 9   // ベースラインに戻った（紙が回収された）と判定

export default function TrayScanPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [view, setView] = useState<View>('loading')
  const [store, setStore] = useState<{ id: string; name: string } | null>(null)
  const [scanState, setScanState] = useState<ScanState>('starting')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const [savedMsg, setSavedMsg] = useState('')

  const videoRef    = useRef<HTMLVideoElement>(null)
  const baseline    = useRef<Uint8ClampedArray | null>(null)
  const prevFrame   = useRef<Uint8ClampedArray | null>(null)
  const stableTicks = useRef(0)
  const stateRef    = useRef<ScanState>('starting')
  stateRef.current = scanState

  // ── 店舗ロード & PIN ────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    fetch(`/api/admin/stores?storeId=${storeId}`)
      .then(res => res.json())
      .then(async ({ stores }: { stores?: { id: string; name: string; features: Record<string, unknown> }[] }) => {
        const data = stores?.[0]
        if (!data) { setView('disabled'); return }
        if (!resolveFeature('tray_scan', data.features ?? {})) { setView('disabled'); return }
        setStore(data)
        // 保存済みPINがあればサーバーで再照合してPIN入力をスキップ
        const saved = typeof window !== 'undefined' ? sessionStorage.getItem(`admin_pin_${storeId}`) : null
        if (saved && await verifyStorePinApi(storeId, saved)) { setView('ready'); return }
        setView('pin')
      })
  }, [storeId])

  const refreshPending = useCallback(() => {
    if (!storeId) return
    ;(supabase as any).from('scan_inbox')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).eq('status', 'pending')
      .then(({ count }: { count: number | null }) => setPendingCount(count ?? 0))
  }, [storeId])

  useEffect(() => { if (view === 'ready') refreshPending() }, [view, refreshPending])

  // ── カメラ起動 ──────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'ready') return
    let stream: MediaStream | null = null
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          baseline.current = null
          prevFrame.current = null
          setScanState('watching')
        }
      } catch {
        setScanState('error')
        setErrorMsg('カメラを起動できませんでした。カメラの使用を許可してください。')
      }
    })()
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [view])

  // ── フレーム取得（縮小グレースケール） ──────────────────────
  const grabFrame = useCallback((): Uint8ClampedArray | null => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return null
    const c = document.createElement('canvas')
    c.width = 64; c.height = 48
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, 64, 48)
    const img = ctx.getImageData(0, 0, 64, 48).data
    const gray = new Uint8ClampedArray(64 * 48)
    for (let i = 0; i < gray.length; i++) {
      gray[i] = (img[i * 4] + img[i * 4 + 1] + img[i * 4 + 2]) / 3
    }
    return gray
  }, [])

  const meanDiff = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
    return sum / a.length
  }

  // ── 撮影 → OCR → 受信箱へ ──────────────────────────────────
  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !store) return
    setScanState('processing')

    const makeJpeg = (maxW: number, q: number): string => {
      const scale = Math.min(1, maxW / video.videoWidth)
      const c = document.createElement('canvas')
      c.width = Math.round(video.videoWidth * scale)
      c.height = Math.round(video.videoHeight * scale)
      c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height)
      return c.toDataURL('image/jpeg', q)
    }

    const fullDataUrl  = makeJpeg(1280, 0.85)
    const thumbDataUrl = makeJpeg(480, 0.6)
    const base64 = fullDataUrl.split(',')[1]

    try {
      const storePin = sessionStorage.getItem(`admin_pin_${storeId}`) ?? ''
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', slipType: 'auto', storeId, storePin }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '読み取りに失敗しました')

      const slipType = json.slipType as ScanSlipType
      const data = (json.data ?? {}) as Record<string, unknown>

      const { data: inserted, error } = await (supabase as any).from('scan_inbox').insert({
        store_id: storeId,
        slip_type: slipType,
        extracted: data,
        confidence: (data.confidence as string) ?? 'medium',
        warnings: (data.warnings as string[]) ?? [],
        image_data: thumbDataUrl,
        status: 'pending',
      }).select('id').single()
      if (error) throw new Error(error.message)

      setResult({
        inboxId: inserted.id,
        slipType,
        data,
        confidence: (data.confidence as string) ?? 'medium',
        warnings: (data.warnings as string[]) ?? [],
      })
      setScanState('confirm')
      refreshPending()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setScanState('error')
    }
  }, [store, storeId, refreshPending])

  // ── 検知ループ ──────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'ready') return
    const timer = setInterval(() => {
      const st = stateRef.current
      if (st !== 'watching' && st !== 'holding' && st !== 'remove') return
      const frame = grabFrame()
      if (!frame) return

      if (!baseline.current) {
        // 起動直後: 数フレーム静止していたらベースライン（空のトレー）を記録
        if (prevFrame.current && meanDiff(frame, prevFrame.current) < TH_STABLE) {
          stableTicks.current++
          if (stableTicks.current >= 2) {
            baseline.current = frame
            stableTicks.current = 0
          }
        } else {
          stableTicks.current = 0
        }
        prevFrame.current = frame
        return
      }

      const diffBase = meanDiff(frame, baseline.current)

      if (st === 'remove') {
        // 紙の回収待ち → トレーが空に戻ったら監視再開
        if (diffBase < TH_EMPTY) {
          baseline.current = frame
          setScanState('watching')
        }
        prevFrame.current = frame
        return
      }

      if (diffBase > TH_PAPER) {
        // 何かが置かれている → 静止を待って撮影
        const stable = prevFrame.current && meanDiff(frame, prevFrame.current) < TH_STABLE
        if (st === 'watching') { setScanState('holding'); stableTicks.current = 0 }
        if (stable) {
          stableTicks.current++
          if (stableTicks.current >= 2) {
            stableTicks.current = 0
            capture()
          }
        } else {
          stableTicks.current = 0
        }
      } else {
        if (st === 'holding') setScanState('watching')
        // 照明変化へゆっくり追従
        for (let i = 0; i < frame.length; i++) {
          baseline.current[i] = baseline.current[i] * 0.95 + frame[i] * 0.05
        }
      }
      prevFrame.current = frame
    }, 600)
    return () => clearInterval(timer)
  }, [view, grabFrame, capture])

  // ── 確認カードの操作 ────────────────────────────────────────
  const handleConfirm = async () => {
    if (!result || !storeId) return
    setScanState('processing')
    const r = await promoteScan({
      id: result.inboxId, store_id: storeId,
      slip_type: result.slipType, extracted: result.data,
    })
    if (!r.ok) {
      setErrorMsg(r.error ?? '登録に失敗しました')
      setScanState('error')
      return
    }
    setSavedMsg(`${SLIP_TYPE_LABELS[result.slipType]} を登録しました`)
    setResult(null)
    setScanState('saved')
    refreshPending()
    setTimeout(() => setScanState('remove'), 2200)
  }

  const handleLater = () => {
    // pending のまま受信箱に残す
    setResult(null)
    setSavedMsg('受信箱に保存しました（あとで直せます）')
    setScanState('saved')
    refreshPending()
    setTimeout(() => setScanState('remove'), 2200)
  }

  const handleRetry = async () => {
    if (result) {
      await (supabase as any).from('scan_inbox').delete().eq('id', result.inboxId)
      setResult(null)
      refreshPending()
    }
    capture()
  }

  // ── 画面 ────────────────────────────────────────────────────
  if (view === 'loading') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">読み込み中...</div>
  )
  if (view === 'disabled') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 p-8 text-center">
      この店舗では「置くだけスキャン」は有効になっていません
    </div>
  )
  if (view === 'pin' && store) return (
    <PinScreen title="スタッフ専用" emoji="🔒"
      headerExtra={<p className="text-indigo-600 font-bold mt-1 text-lg">{store.name}</p>}
      verify={pin => verifyStorePinApi(store.id, pin)}
      onAuth={() => setView('ready')} onBack={() => router.push(`/${storeId}/admin`)} />
  )

  const confidenceBadge = result?.confidence === 'high'
    ? { text: 'しっかり読めました', cls: 'bg-emerald-100 text-emerald-700' }
    : result?.confidence === 'low'
      ? { text: '読み取りに自信がありません', cls: 'bg-red-100 text-red-700' }
      : { text: '一部推測があります', cls: 'bg-amber-100 text-amber-700' }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <p className="font-black text-lg">📥 置くだけスキャン <span className="text-gray-500 text-sm font-bold ml-2">{store?.name}</span></p>
        <button
          onClick={() => router.push(`/${storeId}/admin/tray-scan/inbox`)}
          className="relative bg-gray-800 rounded-xl px-4 py-2 text-sm font-bold active:scale-95 transition-all"
        >
          受信箱
          {pendingCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-black rounded-full w-6 h-6 flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* カメラプレビュー */}
      <div className="relative flex-1 mx-4 mb-4 rounded-3xl overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />

        {/* 状態オーバーレイ */}
        {scanState === 'watching' && (
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-center">
            <p className="text-3xl font-black">伝票・メモをトレーに置いてください</p>
            <p className="text-gray-300 mt-2 font-bold">自動で読み取ります（さわらなくて大丈夫です）</p>
          </div>
        )}
        {scanState === 'holding' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <p className="text-3xl font-black animate-pulse">そのまま動かさないでください...</p>
          </div>
        )}
        {scanState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4">
            <div className="w-14 h-14 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-2xl font-black">読み取っています...</p>
          </div>
        )}
        {scanState === 'saved' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-600/90 gap-3">
            <p className="text-6xl">✅</p>
            <p className="text-3xl font-black">{savedMsg}</p>
          </div>
        )}
        {scanState === 'remove' && (
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-center">
            <p className="text-3xl font-black">伝票を回収してください</p>
            <p className="text-gray-300 mt-2 font-bold">トレーが空になると次の読み取りができます</p>
          </div>
        )}
        {scanState === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-xl font-bold text-gray-300">カメラを起動しています...</p>
          </div>
        )}
        {scanState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-5 p-8 text-center">
            <p className="text-5xl">⚠️</p>
            <p className="text-xl font-bold text-red-300">{errorMsg}</p>
            <button
              onClick={() => { setErrorMsg(''); setScanState('remove') }}
              className="bg-white text-gray-900 rounded-2xl px-8 py-4 text-xl font-black active:scale-95 transition-all"
            >
              やり直す
            </button>
          </div>
        )}

        {/* 確認カード */}
        {scanState === 'confirm' && result && (
          <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white text-gray-900 rounded-3xl w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-3xl font-black">{SLIP_TYPE_LABELS[result.slipType]}</p>
                <span className={`text-sm font-black px-3 py-1.5 rounded-lg ${confidenceBadge.cls}`}>
                  {confidenceBadge.text}
                </span>
              </div>

              <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
                {summarizeScan(result.slipType, result.data).map((row, i) => (
                  <div key={i} className="flex gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <span className="text-gray-500 font-bold w-28 shrink-0">{row.label}</span>
                    <span className="font-black text-lg">{row.value}</span>
                  </div>
                ))}
                {result.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-amber-700 text-sm font-bold">⚠️ {w}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button onClick={handleConfirm}
                  className="bg-emerald-500 text-white rounded-2xl py-5 text-2xl font-black active:scale-95 transition-all shadow-lg">
                  ✓ これで登録
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleLater}
                    className="bg-gray-100 text-gray-700 rounded-2xl py-4 text-lg font-black active:scale-95 transition-all">
                    あとで直す
                  </button>
                  <button onClick={handleRetry}
                    className="bg-gray-100 text-gray-700 rounded-2xl py-4 text-lg font-black active:scale-95 transition-all">
                    📷 やり直す
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
