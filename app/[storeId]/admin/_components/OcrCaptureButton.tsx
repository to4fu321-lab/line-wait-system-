'use client'

// ============================================================
// OCR読み取りボタン — 共通コンポーネント
//   受付票・メモ・名刺などを撮影/選択し、/api/ocr-receipt で
//   氏名・電話番号・内容・希望納期を抽出して呼び出し元に渡す。
//   入力が必要な受付フォーム（お直し・問合せ等）で使い回す。
// ============================================================
import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'

export interface OcrResult {
  name: string | null
  tel: string | null
  items: string[]
  desiredDate: string | null
}

export function OcrCaptureButton({
  onResult,
  onError,
  label,
  title = '受付票・メモを撮影して自動入力',
}: {
  onResult: (r: OcrResult) => void
  onError?: (message: string) => void
  /** 文字付きボタンにする場合のラベル（未指定なら丸アイコンのみ） */
  label?: string
  title?: string
}) {
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setLoading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/ocr-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const json = await res.json()
      if (!json.ok) { onError?.(json.error ? `OCR失敗: ${json.error}` : 'OCRに失敗しました'); return }
      onResult({
        name:        json.name ?? null,
        tel:         json.tel ?? null,
        items:       Array.isArray(json.items) ? json.items : [],
        desiredDate: json.desiredDate ?? null,
      })
    } catch (err) {
      console.error('[OCR]', err)
      onError?.(`OCRエラー: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <label title={title} className={`cursor-pointer ${loading ? 'pointer-events-none' : ''}`}>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleCapture} />
      {label ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          {loading ? '解析中...' : label}
        </span>
      ) : (
        <span className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 ${loading ? 'bg-violet-100' : 'bg-violet-100 hover:bg-violet-200'}`}>
          {loading
            ? <Loader2 size={16} className="text-violet-600 animate-spin" />
            : <Camera size={16} className="text-violet-600" />}
        </span>
      )}
    </label>
  )
}
