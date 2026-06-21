'use client'

// ============================================================
// 予約カード（当日タイムライン／全予約一覧で共用）
//   showDate=true で時刻バッジに日付も併記（全予約一覧用）。
// ============================================================
import { useState } from 'react'
import {
  Loader2, X, Phone, CheckCheck, BellRing, UserX, Ruler,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS,
  type Reservation, type ReservationStatus,
} from '@/types/reservations'

export type ReservationFull = Reservation & {
  customer: { name: string; kana: string | null; tel: string | null } | null
  child:    { name: string; school_name: string | null; grade: string | null } | null
}

function fmtTime(isoStr: string) {
  return new Date(new Date(isoStr).getTime() + 9 * 3600000).toISOString().slice(11, 16)
}
function fmtMd(isoStr: string) {
  const d = new Date(new Date(isoStr).getTime() + 9 * 3600000).toISOString().slice(0, 10)
  const [, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
}

export function ReservationCard({ res, storeId, onUpdate, onDelete, showDate }: {
  res: ReservationFull
  storeId: string
  onUpdate: (id: string, status: ReservationStatus, prevStatus: ReservationStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
  showDate?: boolean
}) {
  const [loading,        setLoading]        = useState<string | null>(null)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  const act = async (s: ReservationStatus) => {
    setLoading(s); await onUpdate(res.id, s, res.status); setLoading(null)
  }
  const inactive = res.status === 'completed' || res.status === 'cancelled' || res.status === 'no_show'
  // 採寸系の予約か（LINE予約は service_type=uniform/jersey、手動予約は目的に「採寸」）
  const isFitting = (res.purpose ?? '').includes('採寸')
    || ['uniform', 'jersey', 'fitting'].includes(res.service_type ?? '')

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      inactive
        ? 'bg-gray-100 border-gray-200'
        : res.status === 'called'
        ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-200'
        : res.status === 'arrived'
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-3">
        {/* 時刻バッジ */}
        <div className="shrink-0 text-center w-12">
          {showDate && <p className="text-[10px] font-bold text-gray-500 tabular-nums leading-tight">{fmtMd(res.reserved_at)}</p>}
          <p className={`text-xl font-black tabular-nums leading-tight ${
            inactive ? 'text-gray-500'
            : res.status === 'called' ? 'text-amber-600 animate-pulse'
            : res.status === 'arrived' ? 'text-emerald-600'
            : 'text-indigo-600'
          }`}>{fmtTime(res.reserved_at)}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">予約</p>
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              RESERVATION_STATUS_COLORS[res.status]
            }`}>{RESERVATION_STATUS_LABELS[res.status]}</span>
          </div>
          {res.child?.school_name && (
            <p className="text-sm font-black text-amber-600 truncate leading-tight">
              {res.child.school_name}{res.child.grade && ` ${res.child.grade}`}
            </p>
          )}
          <p className={`font-black text-xl leading-tight truncate mt-0.5 ${inactive ? 'text-gray-500' : 'text-gray-900'}`}>
            {res.child?.name ?? res.customer?.name ?? res.customer_name ?? '（未記名）'} 様
          </p>
          {res.child && (
            <p className="text-xs text-gray-500 truncate">
              保護者: {res.customer?.name ?? '（未登録）'}
            </p>
          )}
          {res.customer?.tel && (
            <a href={`tel:${res.customer.tel}`}
              className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
              <Phone size={10} />{res.customer.tel}
            </a>
          )}
          {res.purpose && <p className="text-xs text-gray-600 mt-1">📋 {res.purpose}</p>}
          {res.notes   && <p className="text-xs text-gray-500 mt-0.5 italic">📝 {res.notes}</p>}
        </div>

        {/* 削除ボタン（確定前のみ） */}
        {res.status === 'confirmed' && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-500/10 transition-all shrink-0">
            <X size={13} />
          </button>
        )}
      </div>

      {/* 採寸へ進む（採寸系予約のみ・採寸ページで来店チェックインも実行） */}
      {!inactive && isFitting && (
        <a href={`/${storeId}/admin/fitting?reservationId=${res.id}`}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-teal-600 hover:bg-teal-500 text-white active:scale-95 transition-all">
          <Ruler size={15} />採寸へ進む
        </a>
      )}

      {/* アクションボタン */}
      {!inactive && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {res.status === 'confirmed' && (
            <>
              <button onClick={() => act('arrived')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'arrived' ? <Loader2 size={12} className="animate-spin" /> : '✅ 来店チェックイン'}
              </button>
              <button onClick={() => act('no_show')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-gray-300/80 hover:bg-gray-400 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                <UserX size={12} />無断欠席
              </button>
            </>
          )}
          {res.status === 'arrived' && (
            <>
              <button onClick={() => act('called')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-amber-500/80 hover:bg-amber-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'called' ? <Loader2 size={12} className="animate-spin" /> : <><BellRing size={12} />呼出す</>}
              </button>
              <button onClick={() => act('completed')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-gray-300/80 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                <CheckCheck size={12} />対応完了
              </button>
            </>
          )}
          {res.status === 'called' && (
            <>
              <button onClick={() => act('completed')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'completed' ? <Loader2 size={12} className="animate-spin" /> : <><CheckCheck size={12} />対応完了</>}
              </button>
              <button onClick={() => act('arrived')} disabled={!!loading}
                className="py-2.5 rounded-xl font-bold text-xs bg-gray-300/80 text-gray-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                呼出に戻す
              </button>
            </>
          )}
        </div>
      )}

      {/* 完了済みを戻す */}
      {(res.status === 'no_show' || res.status === 'cancelled') && (
        <button onClick={() => act('confirmed')} disabled={!!loading}
          className="mt-3 w-full py-2 rounded-xl font-bold text-xs border border-indigo-300 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400 transition-all flex items-center justify-center gap-1">
          予約確定に戻す
        </button>
      )}

      {/* 削除確認 */}
      {confirmDelete && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-center text-red-700 font-bold">この予約を削除しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-gray-300 text-gray-700 active:scale-95">
              キャンセル
            </button>
            <button onClick={async () => { await onDelete(res.id); setConfirmDelete(false) }} disabled={!!loading}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-red-600 text-white active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
              {loading === 'delete' ? <Loader2 size={12} className="animate-spin" /> : '削除する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
