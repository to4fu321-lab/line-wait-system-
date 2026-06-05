'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  MessageSquarePlus, X, Loader2, CheckCheck, Plus, Check, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDeviceMode } from '@/lib/useDeviceMode'

type InquiryType    = 'inquiry' | 'complaint' | 'request' | 'other'
type InquiryStatus  = 'pending' | 'in_progress' | 'completed'
type ResponseMethod = 'line' | 'phone' | 'in_store' | 'email'

interface InquiryRow {
  id: string
  customer_name: string | null
  content: string
  type: InquiryType
  is_urgent: boolean
  due_date: string | null
  status: InquiryStatus
  response_method: ResponseMethod | null
  response_notes: string | null
  responded_at: string | null
  created_at: string
}

const TYPE_LABELS: Record<InquiryType, string> = {
  inquiry:   '問合せ',
  complaint: 'クレーム',
  request:   '要望',
  other:     'その他',
}

const TYPE_BADGE: Record<InquiryType, string> = {
  inquiry:   'bg-blue-100 text-blue-700 border border-blue-200',
  complaint: 'bg-red-100 text-red-700 border border-red-200',
  request:   'bg-purple-100 text-purple-700 border border-purple-200',
  other:     'bg-gray-100 text-gray-500 border border-gray-200',
}

const TYPE_LEFT_BORDER: Record<InquiryType, string> = {
  inquiry:   'border-l-blue-400',
  complaint: 'border-l-red-500',
  request:   'border-l-purple-400',
  other:     'border-l-gray-300',
}

const STATUS_LABELS: Record<InquiryStatus, string> = {
  pending:     '未対応',
  in_progress: '対応中',
  completed:   '完了',
}

const STATUS_BADGE: Record<InquiryStatus, string> = {
  pending:     'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
}

const METHOD_LABELS: Record<ResponseMethod, string> = {
  line:     'LINE',
  phone:    '電話',
  in_store: '店頭',
  email:    'メール',
}

// ── Modal ──────────────────────────────────────────────────────────
function InquiryModal({
  storeId, item, onClose, onSave,
}: {
  storeId: string
  item: InquiryRow | null
  onClose: () => void
  onSave: () => void
}) {
  const [type,         setType]         = useState<InquiryType>(item?.type ?? 'inquiry')
  const [customerName, setCustomerName] = useState(item?.customer_name ?? '')
  const [content,      setContent]      = useState(item?.content ?? '')
  const [isUrgent,     setIsUrgent]     = useState(item?.is_urgent ?? false)
  const [dueDate,      setDueDate]      = useState(item?.due_date ?? '')
  const [status,       setStatus]       = useState<InquiryStatus>(item?.status ?? 'pending')
  const [method,       setMethod]       = useState<ResponseMethod | ''>(item?.response_method ?? '')
  const [notes,        setNotes]        = useState(item?.response_notes ?? '')
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiAdvice,     setAiAdvice]     = useState<{
    priority: string
    priority_reason: string
    recommended_action: string
    sample_reply: string
    notes: string | null
  } | null>(null)
  const [showAdvice,   setShowAdvice]   = useState(false)

  const isEdit = !!item

  async function handleAiAdvice() {
    if (!content.trim()) return
    setAiLoading(true)
    setAiAdvice(null)
    setShowAdvice(false)
    try {
      const res = await fetch('/api/inquiry-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, isUrgent, customerName }),
      })
      const json = await res.json()
      if (json.ok) {
        setAiAdvice(json.advice)
        setShowAdvice(true)
      }
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSave() {
    if (!content.trim()) { setFormError('内容を入力してください'); return }
    setSaving(true)
    setFormError(null)
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      store_id:        storeId,
      customer_name:   customerName.trim() || null,
      content:         content.trim(),
      type,
      is_urgent:       isUrgent,
      due_date:        dueDate || null,
      status,
      response_method: method || null,
      response_notes:  notes.trim() || null,
      responded_at:    status === 'completed' && !item?.responded_at ? now : (item?.responded_at ?? null),
      updated_at:      now,
    }
    const q = isEdit
      ? (supabase as any).from('inquiries').update(payload).eq('id', item.id)
      : (supabase as any).from('inquiries').insert({ ...payload, created_at: now })
    const { error } = await q
    setSaving(false)
    if (error) { setFormError('保存に失敗しました'); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90dvh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-black text-gray-800">{isEdit ? '問合せ編集' : '問合せ追加'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {/* Type + Urgent */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">種別</label>
              <select value={type} onChange={e => setType(e.target.value as InquiryType)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                {(Object.entries(TYPE_LABELS) as [InquiryType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-xs font-bold text-gray-600 mb-1 block">急ぎ</label>
              <button onClick={() => setIsUrgent(u => !u)}
                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  isUrgent
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-red-300'
                }`}>
                🔴 急ぎ
              </button>
            </div>
          </div>

          {/* Customer name */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">お客様名</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="例：山田 太郎"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">
              内容 <span className="text-red-500">*</span>
            </label>
            <textarea value={content} onChange={e => { setContent(e.target.value); setAiAdvice(null) }}
              placeholder="問合せ・クレームの内容を入力..."
              rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
            <button
              type="button"
              onClick={handleAiAdvice}
              disabled={!content.trim() || aiLoading}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-40 bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-transparent hover:from-violet-400 hover:to-indigo-400 shadow-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:from-transparent disabled:to-transparent disabled:shadow-none"
            >
              {aiLoading
                ? <><Loader2 size={12} className="animate-spin" />AIが分析中...</>
                : <><Sparkles size={12} />AIアドバイスを取得</>}
            </button>
          </div>

          {/* AI Advice Panel */}
          {aiAdvice && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvice(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-black text-violet-700"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles size={12} />
                  AIアドバイス
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    aiAdvice.priority === '高' ? 'bg-red-100 text-red-700' :
                    aiAdvice.priority === '中' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    優先度：{aiAdvice.priority}
                  </span>
                </span>
                {showAdvice ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showAdvice && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-violet-100">
                  <p className="text-[11px] text-violet-600 pt-2">{aiAdvice.priority_reason}</p>
                  <div>
                    <p className="text-[10px] font-black text-violet-500 mb-0.5">推奨対応</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{aiAdvice.recommended_action}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-violet-500 mb-0.5">返答例</p>
                    <p className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg px-2.5 py-2 border border-violet-100">
                      「{aiAdvice.sample_reply}」
                    </p>
                  </div>
                  {aiAdvice.notes && (
                    <div>
                      <p className="text-[10px] font-black text-violet-500 mb-0.5">注意点</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{aiAdvice.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Due date + Status */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">期日</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">ステータス</label>
              <select value={status} onChange={e => setStatus(e.target.value as InquiryStatus)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                {(Object.entries(STATUS_LABELS) as [InquiryStatus, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Response info */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-bold text-gray-500">対応情報</p>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">対応方法</label>
              <div className="flex flex-wrap gap-1.5">
                {(['', 'line', 'phone', 'in_store', 'email'] as const).map(m => (
                  <button key={m} onClick={() => setMethod(m as ResponseMethod | '')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      method === m
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                    }`}>
                    {m === '' ? '未定' : METHOD_LABELS[m as ResponseMethod]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">対応メモ</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="対応内容・返答内容を記録..."
                rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none bg-white" />
            </div>
          </div>

          {formError && <p className="text-xs text-red-600 font-bold">{formError}</p>}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            保存する
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────
function InquiryCard({
  item, onEdit, onStatusChange,
}: {
  item: InquiryRow
  onEdit: (item: InquiryRow) => void
  onStatusChange: (id: string, status: InquiryStatus) => void
}) {
  const [updating, setUpdating] = useState(false)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue = item.due_date && item.status !== 'completed' && new Date(item.due_date) < today

  async function advanceStatus(e: React.MouseEvent) {
    e.stopPropagation()
    const next: Record<InquiryStatus, InquiryStatus> = {
      pending: 'in_progress', in_progress: 'completed', completed: 'pending',
    }
    setUpdating(true)
    const now = new Date().toISOString()
    const n = next[item.status]
    await (supabase as any).from('inquiries').update({
      status: n,
      responded_at: n === 'completed' ? now : null,
      updated_at: now,
    }).eq('id', item.id)
    setUpdating(false)
    onStatusChange(item.id, n)
  }

  return (
    <div onClick={() => onEdit(item)}
      className={`bg-white rounded-xl border border-gray-100 border-l-4 ${TYPE_LEFT_BORDER[item.type]} shadow-sm active:scale-[0.99] transition-transform cursor-pointer p-3`}>
      <div className="flex items-start gap-2">
        {/* Left: type + urgent badges */}
        <div className="flex flex-col gap-1 pt-0.5 shrink-0">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight ${TYPE_BADGE[item.type]}`}>
            {TYPE_LABELS[item.type]}
          </span>
          {item.is_urgent && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-500 text-white leading-tight text-center">急ぎ</span>
          )}
        </div>

        {/* Center: content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {item.customer_name && (
              <span className="text-xs font-bold text-gray-700">{item.customer_name}</span>
            )}
            {isOverdue && <span className="text-[10px] font-black text-red-600">期限超過</span>}
            {item.due_date && !isOverdue && item.status !== 'completed' && (
              <span className="text-[10px] text-gray-400">
                〆{new Date(item.due_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{item.content}</p>
          {item.response_notes && (
            <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">💬 {item.response_notes}</p>
          )}
          <p className="text-[10px] text-gray-300 mt-1">
            {new Date(item.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {item.response_method && ` · ${METHOD_LABELS[item.response_method]}`}
          </p>
        </div>

        {/* Right: status + advance */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight ${STATUS_BADGE[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
          <button onClick={advanceStatus} disabled={updating}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="ステータスを進める">
            {updating
              ? <Loader2 size={14} className="animate-spin text-gray-400" />
              : <CheckCheck size={14} className="text-gray-400" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────
export default function InquiriesPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const { isTablet } = useDeviceMode()

  const [inquiries,  setInquiries]  = useState<InquiryRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<InquiryStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<InquiryType | 'all'>('all')
  const [showModal,  setShowModal]  = useState(false)
  const [editItem,   setEditItem]   = useState<InquiryRow | null>(null)
  const [toast,      setToast]      = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const fetchInquiries = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('inquiries')
      .select('id, customer_name, content, type, is_urgent, due_date, status, response_method, response_notes, responded_at, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (!error) setInquiries(data ?? [])
  }, [storeId])

  useEffect(() => { fetchInquiries() }, [fetchInquiries])

  const filtered = inquiries.filter(i => {
    if (filter     !== 'all' && i.status !== filter)    return false
    if (typeFilter !== 'all' && i.type   !== typeFilter) return false
    return true
  })

  const pendingCount    = inquiries.filter(i => i.status === 'pending').length
  const inProgressCount = inquiries.filter(i => i.status === 'in_progress').length

  function openAdd()               { setEditItem(null); setShowModal(true) }
  function openEdit(i: InquiryRow) { setEditItem(i);    setShowModal(true) }

  function handleStatusChange(id: string, status: InquiryStatus) {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    showToast('ステータスを更新しました')
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className={`${isTablet ? 'px-6' : 'max-w-2xl mx-auto px-4'} pt-3 pb-3`}>
          <div className="flex items-center gap-2 mb-3">
            <h1 className="text-sm font-black text-gray-800 flex-1">問合せ管理</h1>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-violet-600/20">
              <Plus size={12} />新規追加
            </button>
          </div>

          {/* Summary chips */}
          {(pendingCount > 0 || inProgressCount > 0) && (
            <div className="flex gap-2 mb-3">
              {pendingCount > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold">未対応 {pendingCount}件</span>
              )}
              {inProgressCount > 0 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">対応中 {inProgressCount}件</span>
              )}
            </div>
          )}

          {/* Status filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {(['all', 'pending', 'in_progress', 'completed'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
                  filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {s === 'all'
                  ? `全て (${inquiries.length})`
                  : STATUS_LABELS[s] + (s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : s === 'in_progress' && inProgressCount > 0 ? ` (${inProgressCount})` : '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${isTablet ? 'px-6' : 'max-w-2xl mx-auto px-4'} py-4`}>
        {/* Type filter */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(['all', 'inquiry', 'complaint', 'request', 'other'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-colors ${
                typeFilter === t
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}>
              {t === 'all' ? '全種別' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <MessageSquarePlus size={32} className="mb-2 opacity-30" />
            <p className="text-sm mb-4">問合せはありません</p>
            <button onClick={openAdd}
              className="px-4 py-2 bg-violet-600 text-white text-xs font-black rounded-xl hover:bg-violet-500 transition-colors">
              問合せを追加
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <InquiryCard
                key={item.id}
                item={item}
                onEdit={openEdit}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <InquiryModal
          storeId={storeId}
          item={editItem}
          onClose={() => setShowModal(false)}
          onSave={() => {
            fetchInquiries()
            showToast(editItem ? '更新しました' : '追加しました')
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center z-[300] pointer-events-none">
          <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
