'use client'

import { useState } from 'react'
import { Loader2, Check, PackageCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtDate, fmtReqNo } from './utils'
import type { PurchaseRow } from './types'

export function ArrivalCard({ item, storeId, onRefresh, onToast, onEdit, selected, onToggle }: {
  item: PurchaseRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
  selected?: boolean
  onToggle?: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function arrive() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await (supabase as any)
      .from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today, notified: true, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', '入荷完了・お渡し待ちへ移動しました', async () => {
      await (supabase as any).from('purchase_orders')
        .update({ status: item.status, arrived_date: item.arrived_date, notified: item.notified, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      onRefresh()
    })
  }

  const name = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  return (
    <div className={`relative border rounded-2xl overflow-hidden shadow-sm bg-white transition-all ${
      selected ? 'border-blue-400 ring-2 ring-blue-300/50' : 'border-blue-200'
    }`}>
      <div className="h-1 w-full bg-blue-400" />
      <div className="flex items-stretch">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-10 shrink-0 hover:bg-blue-50 transition-colors"
          aria-label="選択">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            selected ? 'border-blue-500 bg-blue-500 scale-110' : 'border-gray-300'
          }`}>
            {selected && <Check size={9} className="text-white" />}
          </div>
        </button>
        {/* Main content */}
        <button
          className="flex-1 min-w-0 text-left px-3 py-2.5"
          onClick={() => onEdit?.(item)}>
          {/* Row 1: item_name + status */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-sm font-black text-gray-900 leading-tight truncate flex-1">{item.item_name}</p>
            {item.maker && (
              <span className="text-[10px] px-1.5 py-0 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-bold leading-5 shrink-0">
                {item.maker}
              </span>
            )}
          </div>
          {/* Row 2: notes */}
          {item.notes && (
            <p className="text-xs text-gray-400 truncate leading-tight mb-0.5">{item.notes}</p>
          )}
          {/* Row 3: school + name + date + request no */}
          <div className="flex items-center gap-1.5">
            {item.child?.school_name && (
              <span className="text-[10px] font-black text-amber-600 truncate max-w-[7rem]">{item.child.school_name}</span>
            )}
            <span className="text-xs font-bold text-gray-700 truncate flex-1">
              {name}
              {item.child?.name && item.customer?.name && (
                <span className="text-[10px] text-gray-400 font-normal ml-1">({item.customer.name})</span>
              )}
            </span>
            {item.ordered_date && (
              <span className="text-[10px] text-gray-400 shrink-0">発注{fmtDate(item.ordered_date)}</span>
            )}
            <span className="text-[10px] font-black text-blue-400 shrink-0 font-mono">{fmtReqNo('purchase', item.request_no, item.id)}</span>
          </div>
        </button>
        {/* Arrive button */}
        <button
          onClick={arrive}
          disabled={loading}
          className="flex items-center justify-center w-14 shrink-0 bg-emerald-50 hover:bg-emerald-100 border-l border-emerald-200 transition-colors disabled:opacity-50 rounded-r-2xl">
          {loading
            ? <Loader2 size={14} className="text-emerald-600 animate-spin" />
            : <span className="text-center">
                <PackageCheck size={16} className="text-emerald-600 mx-auto" />
                <span className="text-[9px] font-black text-emerald-700 block leading-tight mt-0.5">入荷</span>
              </span>
          }
        </button>
      </div>
    </div>
  )
}
