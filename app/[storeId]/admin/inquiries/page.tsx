'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { MessageSquarePlus, Loader2, CheckCheck, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDeviceMode } from '@/lib/useDeviceMode'
import {
  InquiryModal,
  type InquiryRow,
  type InquiryType,
  type InquiryStatus,
  type ResponseMethod,
} from '../_components/InquiryModal'

const TYPE_LABELS: Record<InquiryType, string> = {
  inquiry: '問合せ', complaint: 'クレーム', request: '要望', other: 'その他',
}
const TYPE_BADGE: Record<InquiryType, string> = {
  inquiry:   'bg-blue-100 text-blue-700 border border-blue-200',
  complaint: 'bg-red-100 text-red-700 border border-red-200',
  request:   'bg-purple-100 text-purple-700 border border-purple-200',
  other:     'bg-gray-100 text-gray-500 border border-gray-200',
}
const TYPE_LEFT_BORDER: Record<InquiryType, string> = {
  inquiry: 'border-l-blue-400', complaint: 'border-l-red-500',
  request: 'border-l-purple-400', other: 'border-l-gray-300',
}
const STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: '未対応', in_progress: '対応中', completed: '完了',
}
const STATUS_BADGE: Record<InquiryStatus, string> = {
  pending: 'bg-red-100 text-red-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700',
}
const METHOD_LABELS: Record<ResponseMethod, string> = {
  line: 'LINE', phone: '電話', in_store: '店頭', email: 'メール',
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
      status: n, responded_at: n === 'completed' ? now : null, updated_at: now,
    }).eq('id', item.id)
    setUpdating(false)
    onStatusChange(item.id, n)
  }

  return (
    <div onClick={() => onEdit(item)}
      className={`bg-white rounded-xl border border-gray-100 border-l-4 ${TYPE_LEFT_BORDER[item.type]} shadow-sm active:scale-[0.99] transition-transform cursor-pointer p-3`}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-0.5 shrink-0">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight ${TYPE_BADGE[item.type]}`}>
            {TYPE_LABELS[item.type]}
          </span>
          {item.is_urgent && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-500 text-white leading-tight text-center">急ぎ</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {item.customer_name && <span className="text-xs font-bold text-gray-700">{item.customer_name}</span>}
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
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight ${STATUS_BADGE[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
          <button onClick={advanceStatus} disabled={updating}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors" title="ステータスを進める">
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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

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
    if (filter     !== 'all' && i.status !== filter)     return false
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
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(['all', 'inquiry', 'complaint', 'request', 'other'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-colors ${
                typeFilter === t ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
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
              <InquiryCard key={item.id} item={item} onEdit={openEdit} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </div>

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

      {toast && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center z-[300] pointer-events-none">
          <div className="bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  )
}
