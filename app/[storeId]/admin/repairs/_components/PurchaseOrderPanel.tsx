'use client'

import { useState, useMemo } from 'react'
import {
  Loader2, ChevronDown, ChevronUp, Check, CheckCheck, ClipboardList,
  AlertCircle, X, Pencil, ShoppingBag,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildMakerHierarchy } from './utils'
import type { PurchaseRow, MakerEntry } from './types'

function OrderGuideModal({ maker, orders, onClose, onComplete }: {
  maker: string
  orders: PurchaseRow[]
  onClose: () => void
  onComplete: (ids: string[]) => Promise<void>
}) {
  const checklistItems = useMemo(() => {
    const map = new Map<string, { school: string; item: string; size: string | null; count: number; ids: string[] }>()
    for (const o of orders) {
      const school = o.child?.school_name ?? '（学校未設定）'
      const key = `${school}|${o.item_name.trim()}|${o.notes ?? ''}`
      if (!map.has(key)) map.set(key, { school, item: o.item_name, size: o.notes ?? null, count: 0, ids: [] })
      const g = map.get(key)!; g.count++; g.ids.push(o.id)
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }))
  }, [orders])

  const [checked,      setChecked]      = useState<Set<string>>(new Set())
  const [step,         setStep]         = useState<'list' | 'confirm'>('list')
  const [confirmInput, setConfirmInput] = useState('')
  const [completing,   setCompleting]   = useState(false)

  const totalCount = orders.length
  const allChecked = checked.size === checklistItems.length && checklistItems.length > 0
  const inputNum   = parseInt(confirmInput, 10)
  const matches    = confirmInput !== '' && inputNum === totalCount

  function toggleItem(key: string) {
    setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  async function handleComplete() {
    if (!matches) return
    setCompleting(true)
    await onComplete(orders.map(o => o.id))
    setCompleting(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition-all">
              <X size={18} />
            </button>
            <h2 className="flex-1 text-base font-black text-gray-900">📋 {maker} — 発注ガイド</h2>
          </div>
          {step === 'list' && (
            <>
              <p className="text-xs text-gray-500 mb-2.5">外部サイトで入力しながら 1行ずつチェックしてください</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${checklistItems.length ? (checked.size / checklistItems.length) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-black text-indigo-600 tabular-nums">{checked.size}/{checklistItems.length}</span>
              </div>
            </>
          )}
          {step === 'confirm' && (
            <p className="text-xs text-gray-500">外部サイトに入力した合計数量を確認してください</p>
          )}
        </div>

        {/* Body */}
        {step === 'list' ? (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {checklistItems.map(item => (
              <button key={item.key} onClick={() => toggleItem(item.key)}
                className={`w-full flex items-center gap-3 px-5 py-4 transition-all text-left active:scale-[0.99] ${
                  checked.has(item.key) ? 'bg-emerald-50' : 'hover:bg-gray-50'
                }`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  checked.has(item.key) ? 'border-emerald-500 bg-emerald-500 scale-110' : 'border-gray-300'
                }`}>
                  {checked.has(item.key) && <Check size={13} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-amber-600">{item.school}</p>
                  <p className={`text-sm font-bold leading-snug ${checked.has(item.key) ? 'text-emerald-600 line-through' : 'text-gray-900'}`}>
                    {item.item}
                    {item.size && <span className="ml-1.5 text-indigo-600 not-italic">{item.size}</span>}
                  </p>
                </div>
                <span className={`text-2xl font-black tabular-nums shrink-0 ${checked.has(item.key) ? 'text-emerald-400' : 'text-orange-600'}`}>
                  ×{item.count}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 px-5 py-6 space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-center">
              <p className="text-xs font-bold text-indigo-600 mb-1">システム集計（発注すべき合計）</p>
              <p className="text-5xl font-black text-indigo-700 tabular-nums">{totalCount}</p>
              <p className="text-sm font-bold text-indigo-500 mt-1">件</p>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-2">
                外部サイトで入力した合計数量を入力
              </label>
              <input type="number" value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
                autoFocus inputMode="numeric"
                className="w-full text-center text-4xl font-black border-2 border-gray-300 rounded-2xl py-5 focus:border-indigo-500 focus:outline-none tabular-nums"
                placeholder="0" />
            </div>
            {confirmInput !== '' && !matches && (
              <div className="bg-red-50 border border-red-300 rounded-2xl px-4 py-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-sm font-bold text-red-700">
                  システム集計（{totalCount}件）と一致しません。発注画面を再確認してください。
                </p>
              </div>
            )}
            {matches && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <p className="text-sm font-black text-emerald-700">数量一致！発注完了できます</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
          {step === 'list' ? (
            <button onClick={() => setStep('confirm')} disabled={!allChecked}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25">
              {allChecked
                ? <><Check size={16} />全件チェック完了 — 数量確認へ</>
                : `残り ${checklistItems.length - checked.size} 件をチェックしてください`}
            </button>
          ) : (
            <>
              <button onClick={handleComplete}
                disabled={completing || !matches}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25">
                {completing ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
                発注済みにする（{totalCount}件）
              </button>
              <button onClick={() => setStep('list')}
                className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors">
                ← チェックリストに戻る
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MakerCard({ maker, onGuide, onEdit }: {
  maker: MakerEntry
  onGuide: () => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [open, setOpen] = useState(false)
  const itemCount = maker.schools.reduce((s, sc) => s + sc.items.length, 0)

  return (
    <div className="rounded-2xl border-2 border-orange-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button className="flex-1 text-left min-w-0" onClick={() => setOpen(v => !v)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black text-gray-900">📦 {maker.maker}</span>
            <span className="text-xs font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {maker.totalCount}件
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {maker.schools.length}校 · {itemCount}品目
          </p>
        </button>
        <button onClick={onGuide}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl active:scale-95 transition-all shadow-md shadow-orange-200">
          <ClipboardList size={13} />発注ガイド
        </button>
        <button onClick={() => setOpen(v => !v)} className="shrink-0 text-gray-400 p-1">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-orange-100 divide-y divide-gray-50">
          {maker.schools.map(school => (
            <div key={school.school_name} className="px-4 py-3">
              <p className="text-[10px] font-black text-amber-600 mb-2">🏫 {school.school_name}</p>
              {school.items.map(item => (
                <div key={item.item_name} className="ml-2 mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-sm font-bold text-gray-800">{item.item_name}</p>
                    <span className="text-[10px] text-gray-400">計{item.totalCount}件</span>
                  </div>
                  {item.sizes.map(sz => (
                    <div key={sz.size ?? '_none'} className="flex items-center gap-2 ml-3 py-1">
                      <span className="text-xs font-bold text-indigo-600 min-w-[64px] shrink-0">
                        {sz.size || '（サイズ未設定）'}
                      </span>
                      <span className="text-xl font-black text-orange-600 tabular-nums shrink-0">×{sz.count}</span>
                      <p className="text-[10px] text-gray-400 truncate">
                        {sz.orders.map(o => o.child?.name ?? o.customer?.name ?? '?').join('、')}
                      </p>
                      {onEdit && sz.orders.map(o => (
                        <button key={o.id} onClick={() => onEdit(o)}
                          className="shrink-0 p-1 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all">
                          <Pencil size={10} />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MakerOrderPanel({ orders, onRefresh, onToast, onEdit }: {
  orders: PurchaseRow[]
  onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [guideFor, setGuideFor] = useState<MakerEntry | null>(null)
  const makers = useMemo(() => buildMakerHierarchy(orders), [orders])

  async function completeOrdering(ids: string[]) {
    const prevMap = Object.fromEntries(orders.filter(o => ids.includes(o.id)).map(o => [o.id, o.status]))
    const { error } = await (supabase as any)
      .from('purchase_orders')
      .update({ status: 'on_order', updated_at: new Date().toISOString() })
      .in('id', ids)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', `${ids.length}件を発注済みにしました`, async () => {
      await Promise.all(Object.entries(prevMap).map(([id, st]) =>
        (supabase as any).from('purchase_orders').update({ status: st, updated_at: new Date().toISOString() }).eq('id', id)
      ))
      onRefresh()
    })
    setGuideFor(null)
  }

  if (orders.length === 0) return (
    <div className="text-center py-6 text-gray-400">
      <ShoppingBag size={24} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">未発注の追加購入はありません</p>
    </div>
  )

  return (
    <>
      <div className="space-y-3">
        {makers.map(m => (
          <MakerCard key={m.maker} maker={m} onGuide={() => setGuideFor(m)} onEdit={onEdit} />
        ))}
      </div>
      {guideFor && (
        <OrderGuideModal
          maker={guideFor.maker}
          orders={guideFor.allOrders}
          onClose={() => setGuideFor(null)}
          onComplete={completeOrdering}
        />
      )}
    </>
  )
}
