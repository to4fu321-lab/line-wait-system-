'use client'

import { useState } from 'react'
import { Loader2, CheckCheck, ChevronLeft, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtReqNo } from './utils'
import type { InquiryRow, InquiryStatus, ResponseMethod } from '../../_components/InquiryModal'
import {
  INQ_TYPE_LABELS, INQ_TYPE_BADGE, INQ_TYPE_BORDER,
  INQ_STATUS_LABELS, INQ_STATUS_BADGE, INQ_METHOD_LABELS,
} from './constants'

type SimpleStep = 'idle' | 'loading' | 'advice' | 'completing'

export function InquiryTabCard({ item, onEdit, onStatusChange, isSimpleMode = false }: {
  item: InquiryRow; onEdit: (item: InquiryRow) => void; onStatusChange: (id: string, s: InquiryStatus) => void
  isSimpleMode?: boolean
}) {
  const [updating,      setUpdating]      = useState(false)
  const [simpleStep,    setSimpleStep]    = useState<SimpleStep>('idle')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [selectedReply, setSelectedReply] = useState('')
  const [showCustom,    setShowCustom]    = useState(false)
  const [customReply,   setCustomReply]   = useState('')

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

  async function fetchAdvice() {
    setSimpleStep('loading')
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
        if (s.length < 3) s.push('担当者に確認してお返事します')
        if (s.length < 3) s.push('ご不便をおかけして申し訳ございません')
        setAiSuggestions(s.slice(0, 3))
      } else {
        setAiSuggestions(['担当者に確認してお返事します', 'ご不便をおかけして申し訳ございません'])
      }
    } catch {
      setAiSuggestions(['担当者に確認してお返事します', 'ご不便をおかけして申し訳ございません'])
    }
    setSimpleStep('advice')
  }

  async function completeWithMethod(method: ResponseMethod | '') {
    setUpdating(true)
    const finalReply = showCustom ? customReply.trim() : selectedReply.trim()
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
    setSelectedReply('')
    setCustomReply('')
    setShowCustom(false)
  }

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
              <span className="text-[10px] font-black text-indigo-400 font-mono shrink-0">{reqNo}</span>
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

    // AI読み込み中
    if (simpleStep === 'loading') {
      return (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm`}>
          <div className="p-6 flex flex-col items-center gap-4">
            <Loader2 size={36} className="animate-spin text-violet-500" />
            <p className="text-base font-bold text-gray-600">AIが対応案を考えています…</p>
          </div>
        </div>
      )
    }

    // 対応案選択
    if (simpleStep === 'advice') {
      const canProceed = selectedReply.trim().length > 0 || (showCustom && customReply.trim().length > 0)
      return (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => { setSimpleStep('idle'); setSelectedReply(''); setShowCustom(false) }}
                className="p-1.5 rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
                <ChevronLeft size={20} className="text-gray-500" />
              </button>
              <p className="text-base font-black text-gray-800">対応案を選んでください</p>
            </div>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed line-clamp-2">{item.content}</p>
            <div className="space-y-2.5 mb-5">
              {aiSuggestions.map((s, i) => (
                <button key={i} onClick={() => { setSelectedReply(s); setShowCustom(false) }}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 text-sm leading-relaxed transition-all active:scale-[0.99] ${
                    selectedReply === s && !showCustom
                      ? 'border-violet-500 bg-violet-50 text-violet-900 font-bold'
                      : 'border-gray-200 text-gray-700 bg-white'
                  }`}>
                  {i === 0 && <span className="text-xs font-black text-violet-500 mr-1.5">✨ AI</span>}
                  {s}
                </button>
              ))}
              <button onClick={() => { setShowCustom(true); setSelectedReply('') }}
                className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 text-sm transition-all active:scale-[0.99] ${
                  showCustom
                    ? 'border-violet-500 bg-violet-50 text-violet-900 font-bold'
                    : 'border-gray-200 text-gray-500 bg-white'
                }`}>
                ✏️ 自分で入力する
              </button>
              {showCustom && (
                <textarea
                  value={customReply}
                  onChange={e => setCustomReply(e.target.value)}
                  placeholder="対応内容を入力…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-violet-300 text-base text-gray-800 focus:outline-none focus:border-violet-500 resize-none"
                  autoFocus
                />
              )}
            </div>
            <button onClick={() => setSimpleStep('completing')} disabled={!canProceed}
              className="w-full py-5 rounded-2xl text-base font-black bg-emerald-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 shadow-md">
              <CheckCheck size={18} />完了する
            </button>
          </div>
        </div>
      )
    }

    // 対応方法選択
    if (simpleStep === 'completing') {
      const methods: { value: ResponseMethod | ''; label: string; emoji: string }[] = [
        { value: 'phone',    label: '電話で対応した',    emoji: '📞' },
        { value: 'line',     label: 'LINEで対応した',   emoji: '💬' },
        { value: 'in_store', label: '店頭で対応した',    emoji: '🏪' },
        { value: 'email',    label: 'メールで対応した',  emoji: '📧' },
        { value: '',         label: 'その他',            emoji: '✅' },
      ]
      const backStep: SimpleStep = item.status === 'pending' ? 'advice' : 'idle'
      return (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => setSimpleStep(backStep)}
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
          {item.status === 'pending' ? (
            <button onClick={e => { e.stopPropagation(); fetchAdvice() }}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-5 rounded-2xl text-base font-black bg-violet-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-violet-600/20">
              <Sparkles size={18} />対応する
            </button>
          ) : (
            <button onClick={e => { e.stopPropagation(); setSimpleStep('completing') }}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-5 rounded-2xl text-base font-black bg-emerald-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-emerald-600/20">
              <CheckCheck size={18} />完了にする
            </button>
          )}
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
