'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, Phone, ChevronRight } from 'lucide-react'
import { fmtReqNo } from '../../repairs/_components/utils'
import type { RepairRow, DeliveryItem } from '../../repairs/_components/types'
import type { Task } from '../_lib/task'
import {
  startRepair, completeRepair, completeRepairOther, markArrived, deliver, completeInquiry,
  type NotifyMode,
} from '../_lib/advance'

const BUCKET_CHIP: Record<Task['bucket'], string> = {
  now:   'bg-red-100 text-red-700',
  today: 'bg-amber-100 text-amber-700',
  week:  'bg-emerald-100 text-emerald-700',
}

export function TodayTaskCard({ task, storeId, storeName, smsEnabled, onDone, onToast, onOpenInquiry }: {
  task: Task
  storeId: string
  storeName: string
  smsEnabled: boolean
  onDone: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
  onOpenInquiry: (row: import('../../_components/InquiryModal').InquiryRow) => void
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(false)

  const isOrder = task.kind === 'purchase_order' || task.kind === 'uniform_order'

  // お直し完了の通知手段
  const repairNotify = (): { mode: NotifyMode; row: RepairRow } => {
    const row = (task.source as { type: 'repair'; row: RepairRow }).row
    const hasLine = !!row.customer?.line_user_id
    const hasTel = !!row.customer?.tel
    const mode: NotifyMode = hasLine ? 'line' : hasTel ? (smsEnabled ? 'sms' : 'phone_manual') : 'none'
    return { mode, row }
  }

  const handlePrimary = () => {
    if (isOrder) { router.push(`/${storeId}/admin/repairs`); return }
    if (task.kind === 'inquiry' && (task.source as any).row.status === 'pending') {
      onOpenInquiry((task.source as { type: 'inquiry'; row: any }).row); return
    }
    setConfirming(true)
  }

  const run = async () => {
    setLoading(true)
    let res: { ok: boolean; error?: string }
    switch (task.kind) {
      case 'repair_start': res = await startRepair(task.rowId); break
      case 'repair_complete': {
        const { mode, row } = repairNotify()
        res = await completeRepair(task.rowId, {
          notify: mode, lineUserId: row.customer?.line_user_id ?? null, tel: row.customer?.tel ?? null,
          customerName: row.customer?.name ?? '', itemName: row.item_name,
          storeName, reqNo: fmtReqNo('repair', row.request_no, row.id),
        }); break
      }
      case 'repair_other': res = await completeRepairOther(task.rowId); break
      case 'arrival': res = await markArrived(task.rowId); break
      case 'delivery': res = await deliver((task.source as { type: 'delivery'; row: DeliveryItem }).row, paid); break
      case 'inquiry': res = await completeInquiry(task.rowId); break
      default: res = { ok: false, error: '不明な操作' }
    }
    setLoading(false); setConfirming(false)
    if (!res.ok) { onToast('err', res.error ?? '更新に失敗しました'); return }
    onToast('ok', `${task.name} 様：${task.actionLabel}を記録しました`)
    onDone()
  }

  const phoneManual = task.kind === 'repair_complete' && repairNotify().mode === 'phone_manual'
  const tel = task.kind === 'repair_complete' ? repairNotify().row.customer?.tel : null

  return (
    <div className={`bg-white rounded-2xl border p-4 space-y-2.5 ${task.bucket === 'now' ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {task.schoolName && <p className="text-[11px] font-black text-amber-600 leading-none mb-0.5">{task.schoolName}</p>}
          <p className="text-lg font-black text-gray-900 leading-tight">{task.name} 様</p>
          <p className="text-sm text-gray-500 truncate">{task.itemLabel}</p>
        </div>
        {task.deadlineLabel && (
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-black ${BUCKET_CHIP[task.bucket]}`}>{task.deadlineLabel}</span>
        )}
      </div>

      {confirming ? (
        phoneManual ? (
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 space-y-2">
            <p className="text-sm text-center text-emerald-800 font-black">📞 お客様へ電話連絡をしてください</p>
            {tel && <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 py-2 rounded-xl bg-white border-2 border-emerald-200 text-emerald-700 text-base font-black"><Phone size={16} /> {tel} に発信</a>}
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black">戻る</button>
              <button onClick={run} disabled={loading} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-1 disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}電話連絡完了</button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 px-3 py-2.5 space-y-2">
            {task.kind === 'delivery' && (
              <button onClick={() => setPaid(v => !v)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 ${paid ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                <span className="text-sm font-bold">{paid ? '✅ 支払い済み' : '支払いは未受領'}</span>
                <span className={`w-10 h-5 rounded-full relative ${paid ? 'bg-emerald-500' : 'bg-gray-300'}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${paid ? 'left-5' : 'left-0.5'}`} /></span>
              </button>
            )}
            <p className="text-sm text-center text-indigo-800 font-black">「{task.actionLabel}」にしますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black">戻る</button>
              <button onClick={run} disabled={loading} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-1 disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}確定</button>
            </div>
          </div>
        )
      ) : (
        <button onClick={handlePrimary}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-base flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all">
          {task.actionLabel}{isOrder && <ChevronRight size={18} />}
        </button>
      )}
    </div>
  )
}
