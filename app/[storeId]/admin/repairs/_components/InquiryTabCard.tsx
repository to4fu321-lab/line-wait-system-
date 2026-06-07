'use client'

import { useState } from 'react'
import { Loader2, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { InquiryRow, InquiryType, InquiryStatus } from '../../_components/InquiryModal'
import {
  INQ_TYPE_LABELS, INQ_TYPE_BADGE, INQ_TYPE_BORDER,
  INQ_STATUS_LABELS, INQ_STATUS_BADGE, INQ_METHOD_LABELS,
} from './constants'

export function InquiryTabCard({ item, onEdit, onStatusChange, isSimpleMode = false }: {
  item: InquiryRow; onEdit: (item: InquiryRow) => void; onStatusChange: (id: string, s: InquiryStatus) => void
  isSimpleMode?: boolean
}) {
  const [updating, setUpdating] = useState(false)
  const today = new Date(); today.setHours(0,0,0,0)
  const isOverdue = item.due_date && item.status !== 'completed' && new Date(item.due_date) < today

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

  // ── シンプルモード ───────────────────────────────────────────────
  if (isSimpleMode) {
    const advanceLabel: Record<InquiryStatus, string> = {
      pending: '対応中にする',
      in_progress: '完了にする',
      completed: '未対応に戻す',
    }
    const advanceColor: Record<InquiryStatus, string> = {
      pending:     'bg-blue-600 text-white',
      in_progress: 'bg-emerald-600 text-white',
      completed:   'bg-gray-400 text-white',
    }
    return (
      <div onClick={() => onEdit(item)}
        className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${INQ_TYPE_BORDER[item.type]} shadow-sm cursor-pointer active:scale-[0.99] transition-transform`}>
        <div className="p-4">
          {/* バッジ行 */}
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

          {/* お名前 */}
          {item.customer_name && (
            <p className="text-xl font-black text-gray-800 mb-2">{item.customer_name}</p>
          )}

          {/* 内容 */}
          <p className="text-base text-gray-700 leading-relaxed mb-3 line-clamp-3">{item.content}</p>

          {/* 日時 */}
          <p className="text-xs text-gray-400 mb-4">
            {new Date(item.created_at).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}
            {item.response_method && ` · ${INQ_METHOD_LABELS[item.response_method]}`}
          </p>

          {/* ステータス進めるボタン */}
          <button onClick={advanceStatus} disabled={updating}
            style={{ touchAction: 'manipulation' }}
            className={`w-full py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 ${advanceColor[item.status]}`}>
            {updating ? <Loader2 size={18} className="animate-spin" /> : <CheckCheck size={18} />}
            {advanceLabel[item.status]}
          </button>
        </div>
      </div>
    )
  }

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
