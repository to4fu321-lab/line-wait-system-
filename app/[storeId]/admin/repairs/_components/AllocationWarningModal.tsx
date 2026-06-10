'use client'

import { AlertTriangle, X } from 'lucide-react'
import type { ConflictItem } from '@/lib/uniformAllocation'

export function AllocationWarningModal({
  conflicts,
  onProceed,
  onCancel,
}: {
  conflicts: ConflictItem[]
  onProceed: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onCancel}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="bg-amber-50 border-b border-amber-200 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm leading-snug">新入生分が未引当です</p>
              <p className="text-xs text-amber-700 mt-0.5">同アイテムに未引当の新入生注文があります</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="space-y-2 mb-4">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span className="text-xs font-black text-orange-600 shrink-0">新入生 {c.count}件</span>
                <span className="text-xs font-bold text-gray-800">
                  {c.item_name}{c.size_label ? ` ${c.size_label}` : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            新入生の注文を先に引き当ててから、この注文の入荷完了にすることを推奨します。
            それでも続行する場合は「続行する」を押してください。
          </p>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl font-bold text-sm border border-gray-200 bg-gray-50 text-gray-700 active:scale-95 transition-all">
            戻る
          </button>
          <button onClick={onProceed}
            className="flex-1 py-3 rounded-2xl font-black text-sm bg-amber-500 hover:bg-amber-400 text-white active:scale-95 transition-all shadow-md shadow-amber-200">
            続行する
          </button>
        </div>
      </div>
    </div>
  )
}
