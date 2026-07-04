'use client'

// ============================================================================
//  レジ締め履歴・ジャーナル
//   過去のレジ締め（違算金含む）を一覧・詳細で確認。
//   決済種別ごとの理論/実績/過不足の内訳をひと目で把握できる。
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, History, X, Coins, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, type PaymentMethod,
} from '@/types/sales'
import {
  varianceLabel, DENOMINATIONS,
  type RegisterSession, type MethodTally, type CashMovement, type DenominationCounts,
} from '@/types/register'
import { BottomNav } from '../../../_components/BottomNav'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
const vColor = (v: number) => v === 0 ? 'text-emerald-600' : v > 0 ? 'text-amber-600' : 'text-red-500'
const dt = (s: string | null) => s ? new Date(s).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function CashHistoryPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<RegisterSession[]>([])
  const [detail, setDetail] = useState<RegisterSession | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [mvLoading, setMvLoading] = useState(false)

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const { data } = await (supabase as any).from('register_sessions')
        .select('*').eq('store_id', storeId).eq('status', 'closed')
        .order('closed_at', { ascending: false }).limit(100)
      setSessions((data ?? []) as RegisterSession[])
      setLoading(false)
    })()
  }, [storeId])

  const openDetail = useCallback(async (s: RegisterSession) => {
    setDetail(s); setMvLoading(true)
    const { data } = await (supabase as any).from('register_cash_movements')
      .select('*').eq('session_id', s.id).order('created_at')
    setMovements((data ?? []) as CashMovement[])
    setMvLoading(false)
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <Link href={`/${storeId}/admin/register/cash`} className="p-1 -ml-1 text-gray-400"><ChevronLeft size={22} /></Link>
        <History size={18} className="text-indigo-500" />
        <h1 className="font-black text-base flex-1 text-gray-900">レジ締め履歴</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">締め済みのレジはまだありません</p>
            </div>
          ) : sessions.map(s => (
            <button key={s.id} onClick={() => openDetail(s)}
              className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm text-left active:scale-[0.99] transition-all">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-gray-800">{s.session_number}</span>
                <span className="text-[11px] text-gray-400">{dt(s.closed_at)}</span>
                <span className="flex-1" />
                <span className={`text-xs font-black tabular-nums ${vColor(s.total_variance ?? 0)}`}>
                  {(s.total_variance ?? 0) === 0 ? '過不足なし' : `${(s.total_variance ?? 0) > 0 ? '+' : ''}${yen(s.total_variance ?? 0)}`}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span>売上 {yen(s.total_sales ?? 0)}</span>
                <span className="flex items-center gap-0.5"><Coins size={11} />現金 {yen(s.cash_actual ?? 0)}</span>
                {s.closed_by_name && <span>{s.closed_by_name}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 詳細モーダル */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-2">
              <h2 className="font-black text-base flex-1">{detail.session_number} の締め</h2>
              <button onClick={() => setDetail(null)} className="p-1 text-gray-400"><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              {/* 概要 */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info label="オープン" value={dt(detail.opened_at)} />
                <Info label="クローズ" value={dt(detail.closed_at)} />
                <Info label="担当（開）" value={detail.opened_by_name ?? '—'} />
                <Info label="担当（締）" value={detail.closed_by_name ?? '—'} />
                <Info label="釣銭準備金" value={yen(detail.opening_float)} />
                <Info label="総売上" value={yen(detail.total_sales ?? 0)} />
              </div>

              {/* 決済別 内訳 */}
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">決済別 内訳</p>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1.5 text-sm items-center">
                  <span className="text-[11px] font-bold text-gray-400"></span>
                  <span className="text-[11px] font-bold text-gray-400 text-right">理論</span>
                  <span className="text-[11px] font-bold text-gray-400 text-right">実績</span>
                  <span className="text-[11px] font-bold text-gray-400 text-right">過不足</span>
                  {(detail.closing_report ?? []).map((r: MethodTally) => (
                    <RowTally key={r.method} r={r} />
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200">
                  <span className="text-sm font-black text-gray-700">合計 過不足</span>
                  <span className={`text-sm font-black tabular-nums ${vColor(detail.total_variance ?? 0)}`}>
                    {varianceLabel(detail.total_variance ?? 0)}
                  </span>
                </div>
              </div>

              {/* 締め時 金種 */}
              {detail.closing_denominations && Object.keys(detail.closing_denominations).length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">締め時 現金計数</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {DENOMINATIONS.filter(d => (detail.closing_denominations as DenominationCounts)[String(d)]).map(d => (
                      <div key={d} className="flex justify-between">
                        <span className="text-gray-500">{yen(d)}</span>
                        <span className="font-bold text-gray-800">×{(detail.closing_denominations as DenominationCounts)[String(d)]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 入出金 */}
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">営業中 入出金</p>
                {mvLoading ? (
                  <Loader2 size={16} className="animate-spin text-gray-300 mx-auto" />
                ) : movements.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">記録なし</p>
                ) : (
                  <div className="space-y-1.5">
                    {movements.map(mv => (
                      <div key={mv.id} className="flex items-center gap-2 text-sm">
                        {mv.direction === 'in'
                          ? <ArrowDownCircle size={14} className="text-emerald-500 shrink-0" />
                          : <ArrowUpCircle size={14} className="text-red-500 shrink-0" />}
                        <span className="text-gray-600 truncate flex-1">{mv.reason || (mv.direction === 'in' ? '入金' : '出金')}{mv.memo ? ` / ${mv.memo}` : ''}</span>
                        <span className={`font-bold tabular-nums ${mv.direction === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {mv.direction === 'in' ? '+' : '−'}{yen(mv.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail.note && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-800">
                  {detail.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="font-bold text-gray-800 truncate">{value}</p>
    </div>
  )
}

function RowTally({ r }: { r: MethodTally }) {
  return (
    <>
      <span className="flex items-center gap-1.5 text-gray-700">
        <span>{PAYMENT_METHOD_ICONS[r.method as PaymentMethod]}</span>{PAYMENT_METHOD_LABELS[r.method as PaymentMethod]}
      </span>
      <span className="text-right tabular-nums text-gray-500">{yen(r.theoretical)}</span>
      <span className="text-right tabular-nums text-gray-800 font-bold">{yen(r.actual)}</span>
      <span className={`text-right tabular-nums font-bold ${vColor(r.variance)}`}>
        {r.variance === 0 ? '0' : `${r.variance > 0 ? '+' : ''}${r.variance.toLocaleString()}`}
      </span>
    </>
  )
}
