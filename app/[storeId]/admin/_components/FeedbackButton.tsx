'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { MessageSquarePlus, X, Loader2, Check } from 'lucide-react'

type Kind = 'request' | 'bug' | 'question'

const KINDS: { value: Kind; label: string; emoji: string }[] = [
  { value: 'request',  label: '要望',   emoji: '💡' },
  { value: 'bug',      label: '不具合', emoji: '🐞' },
  { value: 'question', label: '質問',   emoji: '❓' },
]

// 現場からの要望・不具合・質問をその場で投稿するフローティングボタン。
// 管理画面レイアウトに常設し、思った瞬間に送れるようにする。
export function FeedbackButton() {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [open, setOpen]     = useState(false)
  const [kind, setKind]     = useState<Kind>('request')
  const [body, setBody]     = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const reset = () => { setKind('request'); setBody(''); setError(null); setDone(false) }

  const submit = async () => {
    if (!body.trim()) { setError('内容を入力してください'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId:   storeId || null,
          kind,
          body:      body.trim(),
          pageUrl:   typeof window !== 'undefined' ? window.location.pathname : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
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
      {/* フローティングボタン */}
      <button
        onClick={() => { reset(); setOpen(true) }}
        title="要望・不具合を送る"
        style={{ touchAction: 'manipulation' }}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-gray-900/90 hover:bg-gray-900 text-white shadow-lg backdrop-blur active:scale-95 transition-all">
        <MessageSquarePlus size={18} />
        <span className="text-xs font-bold">要望・不具合</span>
      </button>

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

                {error && <p className="text-red-600 text-sm font-bold">{error}</p>}

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  送信内容と画面情報（ページ・端末）が運営に届きます。個人情報は書かないでください。
                </p>

                <button onClick={submit} disabled={saving}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-black text-white font-black text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-colors active:scale-[0.99]">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <MessageSquarePlus size={18} />}
                  送信する
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
