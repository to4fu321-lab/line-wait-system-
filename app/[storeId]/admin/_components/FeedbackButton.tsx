'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { MessageSquarePlus, X, Loader2, Check, ImagePlus, PartyPopper } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const FEEDBACK_IMAGES_BUCKET = 'feedback-images'
const MAX_IMAGES = 4
const NOTICE_POLL_MS = 2 * 60 * 1000

type Kind = 'request' | 'bug' | 'question'

const KINDS: { value: Kind; label: string; emoji: string }[] = [
  { value: 'request',  label: '要望',   emoji: '💡' },
  { value: 'bug',      label: '不具合', emoji: '🐞' },
  { value: 'question', label: '質問',   emoji: '❓' },
]

interface FeedbackNotice {
  id: string
  message: string
  created_at: string
}

// 既読状態は端末ローカルで管理する（全店舗向けのお知らせはサーバー側で削除すると
// 他店の未読も消えてしまうため、サーバーでは既読を管理しない設計）。
const seenKey = (storeId: string) => `feedback_notice_seen_${storeId}`
const loadSeen = (storeId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(seenKey(storeId))
    return new Set(raw ? JSON.parse(raw) as string[] : [])
  } catch {
    return new Set()
  }
}
const saveSeen = (storeId: string, ids: Set<string>) => {
  try { localStorage.setItem(seenKey(storeId), JSON.stringify(Array.from(ids))) } catch { /* ストレージ不可時は既読が保存されないだけ */ }
}

// 現場からの要望・不具合・質問をその場で投稿するフローティングボタン。
// 管理画面レイアウトに常設し、思った瞬間に送れるようにする。
export function FeedbackButton() {
  const params   = useParams<{ storeId: string }>()
  const storeId  = params?.storeId ?? ''
  const pathname = usePathname()
  // レジ画面はフローティングのカートバー（合計金額表示）が画面下部に常設されるため、
  // ボタンをその上に逃がして合計金額と重ならないようにする。
  const onRegister = /\/admin\/register\/?$/.test(pathname ?? '')

  const [open, setOpen]     = useState(false)
  const [kind, setKind]     = useState<Kind>('request')
  const [body, setBody]     = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [images, setImages] = useState<{ file: File; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [notices, setNotices]   = useState<FeedbackNotice[]>([])
  const [noticeOpen, setNoticeOpen] = useState(false)

  // 送った要望・不具合が対応完了すると運営が feedback_notices にお知らせを書く
  // （Webプッシュも飛ぶが、LINEアプリ内ブラウザ等プッシュが届かない環境の受け皿として
  // ここでもポーリングして未読をバッジ表示する）。
  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    const fetchNotices = async () => {
      try {
        const res = await fetch(`/api/feedback?storeId=${encodeURIComponent(storeId)}`)
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && json.ok) {
          const seen = loadSeen(storeId)
          setNotices((json.notices ?? []).filter((n: FeedbackNotice) => !seen.has(n.id)))
        }
      } catch {
        /* ポーリング再試行で回復 */
      }
    }
    fetchNotices()
    const timer = setInterval(fetchNotices, NOTICE_POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [storeId])

  const ackNotice = (id: string) => {
    const seen = loadSeen(storeId)
    seen.add(id)
    saveSeen(storeId, seen)
    setNotices(prev => prev.filter(n => n.id !== id))
  }

  const reset = () => {
    setKind('request'); setBody(''); setError(null); setDone(false)
    images.forEach(i => URL.revokeObjectURL(i.url))
    setImages([])
  }

  const addImages = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files).slice(0, MAX_IMAGES - images.length)
      .map(file => ({ file, url: URL.createObjectURL(file) }))
    setImages(prev => [...prev, ...next].slice(0, MAX_IMAGES))
  }
  const removeImage = (i: number) => {
    setImages(prev => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, j) => j !== i) })
  }

  const submit = async () => {
    if (!body.trim()) { setError('内容を入力してください'); return }
    setSaving(true); setError(null)
    try {
      // 画像は先にアップロードし、公開URLだけをフィードバック本体と一緒に送る
      let imageUrls: string[] = []
      if (images.length > 0) {
        setUploading(true)
        try {
          const uploaded = await Promise.all(images.map(async ({ file }, i) => {
            const ext = file.name.split('.').pop() || 'jpg'
            const path = `feedback/${storeId || 'no-store'}/${Date.now()}_${i}.${ext}`
            const { error: upErr } = await supabase.storage.from(FEEDBACK_IMAGES_BUCKET).upload(path, file, { upsert: true })
            if (upErr) return null
            return supabase.storage.from(FEEDBACK_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
          }))
          imageUrls = uploaded.filter((u): u is string => !!u)
        } finally {
          setUploading(false)
        }
      }

      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId:   storeId || null,
          kind,
          body:      body.trim(),
          pageUrl:   typeof window !== 'undefined' ? window.location.pathname : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          imageUrls,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) { setError('送信に失敗しました。時間をおいて再度お試しください'); setSaving(false); return }
    } catch {
      setError('送信に失敗しました。通信環境をご確認ください'); setSaving(false); return
    }
    setSaving(false)
    setDone(true)
    setTimeout(() => { setOpen(false); reset() }, 1400)
  }

  return (
    <>
      {/* 対応完了バッジ */}
      {notices.length > 0 && (
        <button
          onClick={() => setNoticeOpen(true)}
          title="対応完了のお知らせ"
          style={{ touchAction: 'manipulation' }}
          className={`fixed ${onRegister ? 'bottom-[calc(13.5rem+env(safe-area-inset-bottom))]' : 'bottom-[9.5rem]'} right-4 z-40 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all animate-pulse`}>
          <PartyPopper size={16} />
          <span className="text-xs font-bold">対応完了 {notices.length}件</span>
        </button>
      )}

      {/* フローティングボタン */}
      <button
        onClick={() => { reset(); setOpen(true) }}
        title="要望・不具合を送る"
        style={{ touchAction: 'manipulation' }}
        className={`fixed ${onRegister ? 'bottom-[calc(10rem+env(safe-area-inset-bottom))]' : 'bottom-24'} right-4 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-gray-900/90 hover:bg-gray-900 text-white shadow-lg backdrop-blur active:scale-95 transition-all`}>
        <MessageSquarePlus size={18} />
        <span className="text-xs font-bold">要望・不具合</span>
      </button>

      {/* 対応完了一覧モーダル */}
      {noticeOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setNoticeOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5">
                <PartyPopper size={18} className="text-emerald-600" /> 対応完了のお知らせ
              </h2>
              <button onClick={() => setNoticeOpen(false)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              {notices.map(n => (
                <div key={n.id} className="border-2 border-emerald-100 bg-emerald-50/50 rounded-2xl px-4 py-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{n.message}</p>
                  <button onClick={() => ackNotice(n.id)}
                    style={{ touchAction: 'manipulation' }}
                    className="mt-2 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 rounded-full px-3 py-1.5 active:scale-95 transition-all">
                    確認しました
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* モーダル */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => !saving && setOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-black text-gray-900">要望・不具合を送る</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600">
                <X size={18} />
              </button>
            </div>

            {done ? (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-emerald-600" />
                </div>
                <p className="font-black text-gray-800 text-lg">送信しました</p>
                <p className="text-sm text-gray-500 mt-1">ありがとうございます。改善の参考にします。</p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                {/* 種別 */}
                <div className="grid grid-cols-3 gap-2">
                  {KINDS.map(k => (
                    <button key={k.value} onClick={() => setKind(k.value)}
                      style={{ touchAction: 'manipulation' }}
                      className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 active:scale-95 transition-all ${
                        kind === k.value ? 'border-gray-900 bg-gray-100' : 'border-gray-200 bg-white'
                      }`}>
                      <span className="text-2xl leading-none">{k.emoji}</span>
                      <span className="text-xs font-bold text-gray-700">{k.label}</span>
                    </button>
                  ))}
                </div>

                {/* 本文 */}
                <textarea value={body} onChange={e => { setBody(e.target.value); setError(null) }}
                  rows={6} autoFocus
                  placeholder="例：受付の画面で○○が分かりにくい／△△の機能が欲しい／□□が表示されない など"
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base resize-none focus:border-gray-900 focus:outline-none leading-relaxed" />

                {/* 画像添付 */}
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={img.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="w-16 h-16 object-cover rounded-xl border-2 border-gray-200" />
                      <button onClick={() => removeImage(i)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer text-gray-400 gap-0.5 active:bg-gray-50">
                      <ImagePlus size={18} />
                      <span className="text-[9px] font-bold">画像</span>
                      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={e => { addImages(e.target.files); e.target.value = '' }} />
                    </label>
                  )}
                </div>

                {error && <p className="text-red-600 text-sm font-bold">{error}</p>}

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  送信内容と画面情報（ページ・端末）が運営に届きます。個人情報は書かないでください。
                </p>

                <button onClick={submit} disabled={saving}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-black text-white font-black text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-colors active:scale-[0.99]">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <MessageSquarePlus size={18} />}
                  {uploading ? '画像をアップロード中...' : saving ? '送信中...' : '送信する'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
