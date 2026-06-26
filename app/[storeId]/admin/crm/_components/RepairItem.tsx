'use client'

import { useState } from 'react'
import {
  Package, CheckCheck, Loader2, CalendarDays,
  AlertCircle, RotateCcw, Scissors, Camera, ChevronRight,
} from 'lucide-react'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
} from '@/types/crm'
import type { RepairHistory } from '@/types/crm'
import type { RepairWithCustomer } from './types'
import { fmtDate } from './utils'
import { CustomerInfoPanel } from './CustomerForms'
import { supabase } from '@/lib/supabase'
import { REPAIR_PHOTOS_BUCKET } from '@/types/repair'

export function RepairItem({ repair, showCustomer = false, storeId, onComplete, onDeliver, onRevert, alertDays }: {
  repair: RepairHistory | RepairWithCustomer
  showCustomer?: boolean
  storeId?: string
  onComplete: (id: string) => Promise<void>
  onDeliver:  (id: string) => Promise<void>
  onRevert:   (id: string) => Promise<void>
  alertDays?: number
}) {
  const [loading,  setLoading]  = useState<string | null>(null)
  const [custOpen, setCustOpen] = useState(false)
  const [photosOpen, setPhotosOpen] = useState(false)
  const [photos, setPhotos] = useState<{ phase: string; url: string }[] | null>(null)

  async function loadPhotos() {
    if (photos !== null) return
    const { data } = await (supabase as any)
      .from('repair_photos')
      .select('phase, url')
      .eq('repair_id', repair.id)
      .order('created_at', { ascending: true })
    setPhotos(data ?? [])
  }
  const customerName = showCustomer ? (repair as RepairWithCustomer).customer?.name : null
  const childName    = showCustomer ? (repair as RepairWithCustomer).child?.name    : null
  const isOverdue = alertDays != null && repair.status === 'completed' && repair.completed_date &&
    (Date.now() - new Date(repair.completed_date).getTime()) / 86400000 > alertDays
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - new Date(repair.completed_date!).getTime()) / 86400000)
    : 0

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      repair.status === 'delivered'
        ? 'bg-gray-50 border-gray-200'
        : repair.status === 'completed'
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${
          repair.status === 'delivered' ? 'bg-gray-100'
          : repair.status === 'completed' ? 'bg-emerald-100'
          : 'bg-amber-100'
        }`}>
          {repair.status === 'delivered' ? <Package size={14} className="text-gray-500" />
          : repair.status === 'completed' ? <CheckCheck size={14} className="text-emerald-600" />
          : <Scissors size={14} className="text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          {(customerName || childName) && (
            <button onClick={() => repair.customer_id && setCustOpen(v => !v)}
              className="w-full text-left active:opacity-70 mb-2">
              <p className={`font-black text-lg leading-tight truncate ${childName ? 'text-gray-900' : 'text-gray-800'}`}>
                {childName ?? customerName} 様
              </p>
              {childName && customerName && (
                <p className="text-gray-500 text-xs truncate">保護者: {customerName}</p>
              )}
            </button>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${REPAIR_STATUS_COLORS[repair.status]}`}>
              {REPAIR_STATUS_LABELS[repair.status]}
            </span>
            {repair.slip_number && (
              <span className="text-xs text-gray-500 font-mono">#{repair.slip_number}</span>
            )}
            {repair.notified && (
              <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                LINE通知済み
              </span>
            )}
            {isOverdue && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-300 flex items-center gap-1">
                <AlertCircle size={10} />お渡し{overdueDays}日超過
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900 text-sm">{repair.item_name}</p>
          <p className="text-gray-600 text-xs mt-0.5">{repair.content}</p>
          {repair.price != null && <p className="text-gray-500 text-xs mt-0.5">¥{repair.price.toLocaleString()}</p>}
          {repair.notes && <p className="text-gray-400 text-xs mt-1 italic">📝 {repair.notes}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />受付 {fmtDate(repair.received_date)}</span>
            {repair.completed_date && <span className="flex items-center gap-1"><CheckCheck size={10} />完了 {fmtDate(repair.completed_date)}</span>}
            {repair.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(repair.delivered_date)}</span>}
          </div>
          {/* 写真トグル */}
          <button
            onClick={() => { setPhotosOpen(v => !v); if (!photosOpen) loadPhotos() }}
            className="flex items-center gap-1 text-[11px] text-gray-400 font-bold mt-1 active:opacity-70">
            <Camera size={11} />写真
            {photos && photos.length > 0 && <span className="text-[10px] text-indigo-400 font-black">({photos.length})</span>}
            <ChevronRight size={10} className={`transition-transform ${photosOpen ? 'rotate-90' : ''}`} />
          </button>
          {photosOpen && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {photos == null ? (
                <Loader2 size={14} className="animate-spin text-gray-300" />
              ) : photos.length === 0 ? (
                <p className="text-[10px] text-gray-300">写真なし</p>
              ) : photos.map((p, i) => (
                <div key={i} className="relative w-16 h-16 shrink-0">
                  <img src={p.url} alt="" className={`w-full h-full object-cover rounded-xl border-2 ${p.phase === 'after' ? 'border-emerald-400' : 'border-gray-200'}`} />
                  <span className={`absolute bottom-0 left-0 right-0 text-center text-[8px] py-0.5 rounded-b-xl font-bold ${p.phase === 'after' ? 'bg-emerald-600/80 text-white' : 'bg-black/40 text-white'}`}>
                    {p.phase === 'after' ? '完了時' : '受付時'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {custOpen && repair.customer_id && storeId && (
        <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
          <CustomerInfoPanel customerId={repair.customer_id} storeId={storeId} />
        </div>
      )}

      {repair.status === 'received' && (
        <button onClick={async () => { setLoading('complete'); await onComplete(repair.id); setLoading(null) }}
          disabled={!!loading}
          className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading === 'complete' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><CheckCheck size={14} />お直し完了・LINE通知を送る</>}
        </button>
      )}

      {repair.status === 'completed' && (
        <div className="mt-3 space-y-2">
          <button onClick={async () => { setLoading('deliver'); await onDeliver(repair.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
          <button onClick={async () => { setLoading('revert'); await onRevert(repair.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2 rounded-xl font-bold text-xs border border-amber-200 text-amber-600 hover:text-amber-600 hover:border-amber-300 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
            {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />預かり中に戻す</>}
          </button>
        </div>
      )}
    </div>
  )
}
