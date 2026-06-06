'use client'

import { useState, useCallback } from 'react'
import {
  Loader2, Plus, GraduationCap, Scissors, ShoppingBag,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Child, RepairHistory, PurchaseOrder } from '@/types/crm'
import type { IntakeFormType } from './types'
import { RepairItem } from './RepairItem'
import { PurchaseItem } from './PurchaseItem'
import { NewIntakeForm } from './NewIntakeForm'

// ============================================================
// お子様カード（展開可能）
// ============================================================
export function ChildCard({
  child, customerId, storeId,
  onRepairComplete, onRepairDeliver, onRepairRevert,
  onPurchaseStock, onPurchaseBackOrder,
  onPurchaseArrive, onPurchaseDeliver, onPurchaseRevert,
  onRefreshStats,
  showToast, defaultIntakeType, reservationUrl,
}: {
  child: Child
  customerId: string
  storeId: string
  defaultIntakeType?: IntakeFormType
  reservationUrl?: string | null
  onRepairComplete:    (id: string) => Promise<void>
  onRepairDeliver:     (id: string) => Promise<void>
  onRepairRevert:      (id: string) => Promise<void>
  onPurchaseStock:     (id: string) => Promise<void>
  onPurchaseBackOrder: (id: string) => Promise<void>
  onPurchaseArrive:    (id: string) => Promise<void>
  onPurchaseDeliver:   (id: string) => Promise<void>
  onPurchaseRevert:    (id: string) => Promise<void>
  onRefreshStats:      () => void
  showToast:           (type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => void
  schoolOptions?:      string[]
}) {
  const [expanded,       setExpanded]       = useState(false)
  const [repairs,        setRepairs]        = useState<RepairHistory[]>([])
  const [purchases,      setPurchases]      = useState<PurchaseOrder[]>([])
  const [loading,        setLoading]        = useState(false)
  const [showNewIntake,  setShowNewIntake]  = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('repair_histories').select('*').eq('child_id', child.id).order('received_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('child_id', child.id).order('ordered_date', { ascending: false }),
    ])
    setRepairs(r ?? [])
    setPurchases(p ?? [])
    setLoading(false)
  }, [child.id])

  const handleExpand = () => {
    if (!expanded) fetchData()
    setExpanded(v => !v)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={handleExpand} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
          <GraduationCap size={16} className="text-indigo-700" />
        </div>
        <div className="flex-1 min-w-0">
          {child.school_name && (
            <p className="font-black text-amber-600 text-xs leading-tight truncate">
              {[child.school_name, child.grade].filter(Boolean).join(' ')}
            </p>
          )}
          <p className="font-black text-gray-900 text-xl leading-tight truncate">{child.name}</p>
          {!child.school_name && child.grade && (
            <p className="text-gray-500 text-xs">{child.grade}</p>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-indigo-600" /></div>
          ) : (
            <>
              {/* 依頼受付ボタン（統一） */}
              {showNewIntake ? (
                <div>
                  <NewIntakeForm storeId={storeId} customerId={customerId} childId={child.id}
                    defaultType={defaultIntakeType ?? 'repair'}
                    reservationUrl={reservationUrl}
                    onSaved={() => { setShowNewIntake(false); fetchData(); onRefreshStats(); showToast('ok', '依頼を受け付けました') }}
                    onCancel={() => setShowNewIntake(false)} />
                </div>
              ) : (
                <button onClick={() => setShowNewIntake(true)}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40">
                  <Plus size={16} />依頼を受け付ける
                </button>
              )}

              {/* お直し履歴 */}
              <div className="border-t border-gray-200 pt-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Scissors size={11} />依頼履歴 ({repairs.length}件)
                </p>
                {repairs.length === 0 ? (
                  <p className="text-gray-300 text-xs text-center py-3">履歴はありません</p>
                ) : (
                  <div className="space-y-2">
                    {repairs.map(r => (
                      <RepairItem key={r.id} repair={r}
                        onComplete={onRepairComplete} onDeliver={onRepairDeliver} onRevert={onRepairRevert} />
                    ))}
                  </div>
                )}
              </div>

              {/* 追加購入履歴 */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShoppingBag size={11} />追加購入 ({purchases.length}件)
                </p>
                {purchases.length === 0 ? (
                  <p className="text-gray-300 text-xs text-center py-3">追加購入履歴はありません</p>
                ) : (
                  <div className="space-y-2">
                    {purchases.map(o => (
                      <PurchaseItem key={o.id} order={o}
                        onStock={onPurchaseStock} onBackOrder={onPurchaseBackOrder}
                        onArrive={onPurchaseArrive} onDeliver={onPurchaseDeliver} onRevert={onPurchaseRevert} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
