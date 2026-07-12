'use client'

import { useRef, useState } from 'react'
import { Loader2, CheckCheck, ChevronLeft, Sparkles, Mic, Square, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtReqNo, compressImage } from './utils'
import type { InquiryRow, InquiryStatus, ResponseMethod } from '../../_components/InquiryModal'
import {
  INQ_TYPE_LABELS, INQ_TYPE_BADGE, INQ_TYPE_BORDER,
  INQ_STATUS_LABELS, INQ_STATUS_BADGE, INQ_METHOD_LABELS,
} from './constants'

// シンプルモードの対応ステップ: idle→（対応する）→compose→（記録して完了）→method
type SimpleStep = 'idle' | 'compose' | 'method'

export function InquiryTabCard({ item, storeId, onEdit, onStatusChange, isSimpleMode = false, onToast }: {
  item: InquiryRow; storeId: string; onEdit: (item: InquiryRow) => void
  onStatusChange: (id: string, s: InquiryStatus) => void
  isSimpleMode?: boolean
  onToast?: (t: 'ok' | 'err', m: string) => void
}) {
  const [updating,      setUpdating]      = useState(false)
  const [simpleStep,    setSimpleStep]    = useState<SimpleStep>('idle')
  const [replyText,     setReplyText]     = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [aiLoading,     setAiLoading]     = useState(false)
  const [recording,     setRecording]     = useState(false)
  const [ocrLoading,    setOcrLoading]    = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const ocrInputRef    = useRef<HTMLInputElement>(null)

  const today = new Date(); today.setHours(0,0,0,0)
  const isOverdue = item.due_date && item.status !== 'completed' && new Date(item.due_date) < today
  const reqNo = fmtReqNo('inquiry', item.request_no, item.id)

  async function advanceStatus(e: React.MouseEvent) {
    e.stopPropagation()
    const next: Record<InquiryStatus, InquiryStatus> = { pending:'in_progress', in_progress:'completed', completed:'pending' }
    setUpdating(true)
    const now = new Date().toISOString()
    const n = next[item.status]
    await (supabase as any).from('inquiries').update({ status: n, responded_at: n === 'completed' ? now : null, updated_at: now }).eq('id', item.id)
    setUpdating(false)
    onStatusChange(item.id, n)
  }

  // ✨ AI提案を取得（手入力欄にタップで挿入）
  async function loadAi() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/inquiry-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.content, type: item.type }),
      })
      if (res.ok) {
        const data = await res.json()
        const s: string[] = []
        if (data.sample_reply)       s.push(data.sample_reply)
        if (data.recommended_action) s.push(data.recommended_action)
        if (s.length === 0) s.push('担当者に確認してお返事します')
        setAiSuggestions(s.slice(0, 3))
      } else {
        setAiSuggestions(['担当者に確認してお返事します', 'ご不便をおかけして申し訳ございません'])
      }
    } catch {
      setAiSuggestions(['担当者に確認してお返事します', 'ご不便をおかけして申し訳ございません'])
    }
    setAiLoading(false)
  }

  // 🎤 音声入力（Web Speech API・端末非対応時はキーボードのマイクを案内）
  function toggleVoice() {
    const w = window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { onToast?.('err', 'この端末は音声入力に未対応です。キーボードのマイクをお使いください'); return }
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return }
    try {
      const rec = new SR()
      rec.lang = 'ja-JP'; rec.interimResults = false; rec.maxAlternatives = 1
      rec.onresult = (e: any) => {
        let text = ''
        for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript
        if (text) setReplyText(prev => (prev ? prev + ' ' : '') + text)
      }
      rec.onend   = () => setRecording(false)
      rec.onerror = () => setRecording(false)
      recognitionRef.current = rec
      setRecording(true)
      rec.start()
    } catch { setRecording(false); onToast?.('err', '音声入力を開始できませんでした') }
  }

  // 📷 写真から読み取り（手書きメモ→テキスト）
  async function handleOcr(file: File) {
    setOcrLoading(true)
    try {
      const base64 = await compressImage(file)
      const storePin = typeof window !== 'undefined' ? (sessionStorage.getItem(`admin_pin_${storeId}`) ?? '') : ''
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', slipType: 'inquiry', storeId, storePin }),
      })
      const json = await res.json()
      if (!json.ok || !json.data) { onToast?.('err', `読み取り失敗: ${json.error ?? '不明なエラー'}`); return }
      const text = String(json.data.content ?? '').trim()
      if (text) setReplyText(prev => [prev, text].filter(Boolean).join('\n'))
      onToast?.('ok', '📷 写真から読み取りました')
    } catch (e) {
      onToast?.('err', `読み取りエラー: ${String(e)}`)
    } finally {
      setOcrLoading(false)
    }
  }

  async function completeWithMethod(method: ResponseMethod | '') {
    setUpdating(true)
    const finalReply = replyText.trim()
    const now = new Date().toISOString()
    await (supabase as any).from('inquiries').update({
      status: 'completed',
      response_method: method || null,
      response_notes: finalReply || null,
      responded_at: now,
      updated_at: now,
    }).eq('id', item.id)
    setUpdating(false)
    onStatusChange(item.id, 'completed')
    setSimpleStep('idle')
    setReplyText('')
    setAiSuggestions([])
  }

  // ⚡ 即対応（受付時にその場で回答した想定 → 店頭対応で即完了）
  const immediateComplete = () => completeWithMethod('in_store')

  const resetCompose = () => { setSimpleStep('idle'); setReplyText(''); setAiSuggestions([]) }

  // ── シンプルモード ───────────────────────────────────────────────
  if (isSimpleMode) {

    // 完了済み
    if (item.status === 'completed') {
      return (
        <div onClick={() => onEdit(item)}
          className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm cursor-pointer active:scale-[0.99] transition-transform`}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className={`text-xs font-black px-2.5 py-1.5 rounded-lg ${INQ_TYPE_BADGE[item.type]}`}>
                {INQ_TYPE_LABELS[item.type]}
              </span>
              <span className={`text-xs font-black px-2.5 py-1.5 rounded-lg shrink-0 ${INQ_STATUS_BADGE[item.status]}`}>
                {INQ_STATUS_LABELS[item.status]}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base font-black text-indigo-500 font-mono shrink-0">{reqNo}</span>
              {item.customer_name && <p className="text-xl font-black text-gray-800">{item.customer_name}</p>}
            </div>
            <p className="text-base text-gray-600 leading-relaxed mb-3 line-clamp-2">{item.content}</p>
            {item.response_notes && <p className="text-sm text-gray-400 mb-3 leading-relaxed">💬 {item.response_notes}</p>}
            {item.response_method && (
              <p className="text-sm text-gray-400 mb-3">{INQ_METHOD_LABELS[item.response_method]}で対応済み</p>
            )}
            <button onClick={e => { e.stopPropagation(); advanceStatus(e) }} disabled={updating}
              className="text-sm text-gray-400 underline underline-offset-2">
              {updating ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}未対応に戻す
            </button>
          </div>
        </div>
      )
    }

    // 対応内容を記録（手入力＋AI＋音声＋OCR）
    if (simpleStep === 'compose') {
      return (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm`}>
          <input ref={ocrInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleOcr(f); e.target.value = '' }} />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={resetCompose} className="p-1.5 rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
                <ChevronLeft size={20} className="text-gray-500" />
              </button>
              <p className="text-base font-black text-gray-800">対応内容を記録</p>
            </div>

            {/* 問合せ内容の参照 */}
            <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3">
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{item.content}</p>
            </div>

            {/* 入力方法ツールバー: AI / 音声 / 写真 */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button onClick={loadAi} disabled={aiLoading}
                style={{ touchAction: 'manipulation' }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-violet-200 bg-violet-50 text-violet-700 text-xs font-black active:scale-95 transition-all disabled:opacity-50">
                {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}AI提案
              </button>
              <button onClick={toggleVoice}
                style={{ touchAction: 'manipulation' }}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-black active:scale-95 transition-all ${
                  recording ? 'border-red-300 bg-red-500 text-white animate-pulse' : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}>
                {recording ? <Square size={14} /> : <Mic size={15} />}{recording ? '停止' : '音声'}
              </button>
              <button onClick={() => ocrInputRef.current?.click()} disabled={ocrLoading}
                style={{ touchAction: 'manipulation' }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-teal-200 bg-teal-50 text-teal-700 text-xs font-black active:scale-95 transition-all disabled:opacity-50">
                {ocrLoading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}写真
              </button>
            </div>

            {/* AI提案チップ（タップで挿入） */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-1.5 mb-2">
                <p className="text-[10px] font-black text-violet-500">タップして挿入</p>
                {aiSuggestions.map((s, i) => (
                  <button key={i} onClick={() => setReplyText(prev => (prev ? prev + '\n' : '') + s)}
                    className="w-full text-left px-3 py-2 rounded-xl border-2 border-violet-200 bg-violet-50 text-sm leading-relaxed text-violet-900 active:scale-[0.99] transition-all">
                    <span className="text-xs font-black text-violet-500 mr-1">✨</span>{s}
                  </button>
                ))}
              </div>
            )}

            {/* 手入力欄（音声・写真の結果もここに入る） */}
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="対応内容を入力（手入力・音声・写真の読み取り結果もここに入ります）…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-base text-gray-800 focus:outline-none focus:border-violet-400 resize-none mb-3"
            />

            {/* 完了アクション */}
            <div className="space-y-2">
              <button onClick={immediateComplete} disabled={updating}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50 text-emerald-700 font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50">
                {updating ? <Loader2 size={16} className="animate-spin" /> : '⚡'}その場で対応済み（すぐ完了）
              </button>
              <button onClick={() => setSimpleStep('method')} disabled={updating}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md disabled:opacity-50">
                <CheckCheck size={18} />記録して完了 →
              </button>
            </div>
          </div>
        </div>
      )
    }

    // 対応方法選択
    if (simpleStep === 'method') {
      const methods: { value: ResponseMethod | ''; label: string; emoji: string }[] = [
        { value: 'phone',    label: '電話で対応した',    emoji: '📞' },
        { value: 'line',     label: 'LINEで対応した',   emoji: '💬' },
        { value: 'in_store', label: '店頭で対応した',    emoji: '🏪' },
        { value: 'email',    label: 'メールで対応した',  emoji: '📧' },
        { value: '',         label: 'その他',            emoji: '✅' },
      ]
      return (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => setSimpleStep('compose')}
                className="p-1.5 rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
                <ChevronLeft size={20} className="text-gray-500" />
              </button>
              <p className="text-base font-black text-gray-800">どのように対応しましたか？</p>
            </div>
            <div className="space-y-2.5">
              {methods.map(m => (
                <button key={m.value} onClick={() => completeWithMethod(m.value)} disabled={updating}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full py-5 rounded-2xl text-base font-black border-2 border-gray-200 bg-white text-gray-700 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 hover:border-emerald-400 hover:bg-emerald-50">
                  {updating ? <Loader2 size={20} className="animate-spin" /> : <span className="text-2xl leading-none">{m.emoji}</span>}
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // アイドル（pending / in_progress）
    return (
      <div onClick={() => onEdit(item)}
        className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm cursor-pointer active:scale-[0.99] transition-transform`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-black px-2.5 py-1.5 rounded-lg ${INQ_TYPE_BADGE[item.type]}`}>
                {INQ_TYPE_LABELS[item.type]}
              </span>
              {item.is_urgent && (
                <span className="text-xs font-black px-2.5 py-1.5 rounded-lg bg-red-500 text-white">🔴 急ぎ</span>
              )}
              {isOverdue && (
                <span className="text-xs font-black text-red-600">⚠️ 期限超過</span>
              )}
            </div>
            <span className={`text-xs font-black px-2.5 py-1.5 rounded-lg shrink-0 ${INQ_STATUS_BADGE[item.status]}`}>
              {INQ_STATUS_LABELS[item.status]}
            </span>
          </div>
          {item.customer_name && <p className="text-xl font-black text-gray-800 mb-2">{item.customer_name}</p>}
          <p className="text-base text-gray-700 leading-relaxed mb-3 line-clamp-3">{item.content}</p>
          <p className="text-xs text-gray-400 mb-4">
            {new Date(item.created_at).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}
            {item.response_method && ` · ${INQ_METHOD_LABELS[item.response_method]}`}
          </p>
          <button onClick={e => { e.stopPropagation(); setSimpleStep('compose') }}
            style={{ touchAction: 'manipulation' }}
            className="w-full py-5 rounded-2xl text-base font-black bg-violet-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-violet-600/20">
            <Sparkles size={18} />対応する
          </button>
        </div>
      </div>
    )
  }

  // ── 通常モード ───────────────────────────────────────────────────
  return (
    <div onClick={() => onEdit(item)}
      className={`bg-white rounded-xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm active:scale-[0.99] transition-transform cursor-pointer p-3`}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-0.5 shrink-0">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight ${INQ_TYPE_BADGE[item.type]}`}>{INQ_TYPE_LABELS[item.type]}</span>
          {item.is_urgent && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-500 text-white leading-tight text-center">急ぎ</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-[10px] font-black text-indigo-400 font-mono mr-1">{reqNo}</span>
            {item.customer_name && <span className="text-xs font-bold text-gray-700">{item.customer_name}</span>}
            {isOverdue && <span className="text-[10px] font-black text-red-600">期限超過</span>}
            {item.due_date && !isOverdue && item.status !== 'completed' && (
              <span className="text-[10px] text-gray-400">〆{new Date(item.due_date).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' })}</span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{item.content}</p>
          {item.response_notes && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">💬 {item.response_notes}</p>}
          <p className="text-[10px] text-gray-300 mt-1">
            {new Date(item.created_at).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}
            {item.response_method && ` · ${INQ_METHOD_LABELS[item.response_method]}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight ${INQ_STATUS_BADGE[item.status]}`}>{INQ_STATUS_LABELS[item.status]}</span>
          <button onClick={advanceStatus} disabled={updating} className="p-1 hover:bg-gray-100 rounded-lg transition-colors" title="ステータスを進める">
            {updating ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <CheckCheck size={14} className="text-gray-400" />}
          </button>
        </div>
      </div>
    </div>
  )
}
