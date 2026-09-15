'use client'

// ============================================================
//  同じ物理アイテム（例: スラックス1本）にかける複数加工を一覧で1枠にまとめる
//
//  完了ボタンは加工ごとに独立して押せるよう、展開すると各加工が個別の
//  RepairCard としてそのまま並ぶ（既存の完了・作業開始・外注などの操作は
//  RepairCard 側にすべて任せる）。折りたたみ時は合算のサマリだけを出す。
// ============================================================

import { useState } from 'react'
import { ChevronDown, ChevronUp, Shirt } from 'lucide-react'
import { fmtDate, fmtReqNo } from './utils'
import type { RepairRow } from './types'
import { RepairCard } from './RepairCard'

export function PhysicalItemGroupCard({
  rows, storeId, storeName, onRefresh, onToast, onEdit, isSelected, onToggleSelect, isSimpleMode = false, isTablet = false,
}: {
  rows: RepairRow[]
  storeId: string
  storeName?: string
  onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: RepairRow) => void
  isSelected?: (id: string) => boolean
  onToggleSelect?: (id: string) => void
  isSimpleMode?: boolean
  isTablet?: boolean
}) {
  const [open, setOpen] = useState(false)
  const first = rows[0]
  const doneCount = rows.filter(r => ['completed', 'delivered'].includes(r.status)).length
  const name = first.child?.name ?? first.customer?.name ?? '（顧客不明）'
  const total = rows.reduce((sum, r) => sum + (r.final_price ?? r.price ?? 0), 0)
  const hasPending = rows.some(r => r.quote_status === 'pending')

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${doneCount === rows.length ? 'border-emerald-300' : 'border-violet-300'}`}>
      <button onClick={() => setOpen(v => !v)}
        className={`w-full text-left p-3.5 flex items-center gap-3 ${doneCount === rows.length ? 'bg-emerald-50' : 'bg-violet-50'}`}>
        <div className="shrink-0 w-9 h-9 rounded-full bg-white border flex items-center justify-center">
          <Shirt size={16} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-600 text-white">
              同じ商品 {doneCount}/{rows.length}完了
            </span>
            {first.child?.school_name && (
              <span className="text-xs font-black text-amber-600">{first.child.school_name}</span>
            )}
          </div>
          <p className="font-black text-gray-900 leading-tight truncate">{name} ／ {first.garment_name ?? ''}</p>
          <p className="text-xs text-gray-500 truncate">{rows.map(r => r.item_name).join('＋')}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            合算 ¥{total.toLocaleString()}{hasPending && '〜（見積もり含む）'}
            {first.desired_completion_date && ` ・希望 ${fmtDate(first.desired_completion_date)}`}
          </p>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400 shrink-0" /> : <ChevronDown size={18} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className={`border-t-2 ${doneCount === rows.length ? 'border-emerald-200 bg-emerald-50/30' : 'border-violet-200 bg-violet-50/30'} p-2 space-y-1.5`}>
          {rows.map(r => (
            <RepairCard key={r.id} item={r} storeId={storeId} storeName={storeName} onRefresh={onRefresh} onToast={onToast}
              onEdit={onEdit}
              selected={isSelected ? isSelected(r.id) : false}
              onToggle={onToggleSelect ? () => onToggleSelect(r.id) : undefined}
              isSimpleMode={isSimpleMode} isTablet={isTablet} />
          ))}
        </div>
      )}
    </div>
  )
}
