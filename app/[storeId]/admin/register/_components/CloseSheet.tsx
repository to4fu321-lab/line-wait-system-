'use client'

// ──────────────────────────────────────────────────────────────
//  レジ締め（精算）シート
//   現金は金種計数、キャッシュレスは実績値を入力。
//   決済種別ごとに理論値 vs 実績の過不足をリアルタイム表示 → 確定。
// ──────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { ChevronLeft, Loader2, Check, Coins } from 'lucide-react'
import {
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS,
  type PaymentMethod,
} from '@/types/sales'
import {
  buildClosingReport, sumDenominations, emptyMethodMap,
  varianceLabel, type DenominationCounts, type SessionSummary,
} from '@/types/register'
import { DenominationGrid } from './DenominationGrid'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

const CASHLESS: PaymentMethod[] = PAYMENT_METHODS.filter(m => m !== 'cash')

export function CloseSheet({
  summary,
  onBack,
  onConfirm,
  saving,
}: {
  summary: SessionSummary
  onBack: () => void
  onConfirm: (payload: {
    closingDenominations: DenominationCounts
    cashActual: number
    actuals: Record<PaymentMethod, number>
    note: string
  }) => void
  saving: boolean
}) {
  const [denoms, setDenoms] = useState<DenominationCounts>({})
  const [cashless, setCashless] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [useDenoms, setUseDenoms] = useState(true)
  const [cashTotal, setCashTotal] = useState('')

  const cashActual = useDenoms ? sumDenominations(denoms) : (Number(cashTotal) || 0)

  const actuals = useMemo(() => {
    const map = emptyMethodMap()
    map.cash = cashActual
    for (const m of CASHLESS) map[m] = Number(cashless[m]) || 0
    return map
  }, [cashActual, cashless])

  const report = useMemo(
    () => buildClosingReport(summary.salesByMethod, summary.cashExpected, actuals),
    [summary, actuals],
  )
  const totalVariance = report.reduce((s, r) => s + r.variance, 0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1 text-gray-500"><ChevronLeft size={22} /></button>
        <h1 className="font-black text-base">レジ締め（精算）</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
        {/* 現金 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-gray-800 flex items-center gap-1.5"><Coins size={16} className="text-amber-500" />現金の計数</p>
            <button onClick={() => setUseDenoms(v => !v)} className="text-xs font-bold text-indigo-600">
              {useDenoms ? '総額で入力' : '金種で入力'}
            </button>
          </div>
          {useDenoms ? (
            <DenominationGrid value={denoms} onChange={setDenoms} />
          ) : (
            <input
              type="number" inputMode="numeric" value={cashTotal}
              onChange={e => setCashTotal(e.target.value)} placeholder="現金 実査 総額"
              className="w-full text-right text-2xl font-black border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
            />
          )}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>理論値（システム）</span><span className="tabular-nums">{yen(summary.cashExpected)}</span></div>
            <div className="flex justify-between text-gray-500"><span>実査値</span><span className="tabular-nums">{yen(cashActual)}</span></div>
            <VarianceRow v={cashActual - summary.cashExpected} />
          </div>
        </div>

        {/* キャッシュレス */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-black text-gray-800">キャッシュレス実績（端末控え）</p>
          {CASHLESS.map(m => {
            const theo = summary.salesByMethod[m] ?? 0
            const act = Number(cashless[m]) || 0
            return (
              <div key={m} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg w-6 text-center">{PAYMENT_METHOD_ICONS[m]}</span>
                  <span className="text-sm font-bold text-gray-700 flex-1">{PAYMENT_METHOD_LABELS[m]}</span>
                  <span className="text-xs text-gray-400">理論 {yen(theo)}</span>
                </div>
                <input
                  type="number" inputMode="numeric"
                  value={cashless[m] ?? ''}
                  onChange={e => setCashless(prev => ({ ...prev, [m]: e.target.value }))}
                  placeholder={String(theo)}
                  className="w-full text-right text-lg font-bold border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
                />
                {(cashless[m] ?? '') !== '' && (
                  <div className="text-right"><VarianceInline v={act - theo} /></div>
                )}
              </div>
            )
          })}
        </div>

        {/* メモ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">締めメモ（任意）</p>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="引継ぎ事項・違算の理由など" value={note} onChange={e => setNote(e.target.value)}
          />
        </div>

        {/* 総合過不足 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-sm font-black text-gray-800">全体の過不足</span>
            <span className={`text-lg font-black tabular-nums ${totalVariance === 0 ? 'text-emerald-600' : totalVariance > 0 ? 'text-amber-600' : 'text-red-500'}`}>
              {totalVariance === 0 ? '一致' : `${totalVariance > 0 ? '+' : ''}${yen(totalVariance)}`}
            </span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => onConfirm({ closingDenominations: useDenoms ? denoms : {}, cashActual, actuals, note })}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black text-lg flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all">
          {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
          レジ締めを確定する
        </button>
      </div>
    </div>
  )
}

function VarianceRow({ v }: { v: number }) {
  const cls = v === 0 ? 'text-emerald-600' : v > 0 ? 'text-amber-600' : 'text-red-500'
  return (
    <div className="flex justify-between font-black pt-1 border-t border-gray-100">
      <span className="text-gray-700">過不足</span>
      <span className={`tabular-nums ${cls}`}>{varianceLabel(v)}</span>
    </div>
  )
}

function VarianceInline({ v }: { v: number }) {
  const cls = v === 0 ? 'text-emerald-600' : v > 0 ? 'text-amber-600' : 'text-red-500'
  return <span className={`text-xs font-bold ${cls}`}>{varianceLabel(v)}</span>
}
