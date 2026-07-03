'use client'

import { useState } from 'react'
import { Loader2, Banknote, Phone, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from './utils'
import type { UniformOrderRow } from './types'

// ── シンプルモード用「追加購入」カード ─────────────────────────────
// 受付（NewOrderModal）で作られる uniform_orders(confirmed) を、
// お直しカードと同じ分かりやすいUIで「お渡し完了」まで進められるようにする。
export function SimplePurchaseCard({ item, onRefresh, onToast }: {
  item: UniformOrderRow
  onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
}) {
  const [loading,     setLoading]     = useState(false)
  const [confirmDone, setConfirmDone] = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [open,        setOpen]        = useState(false)

  const name = item.child?.name ?? item.customer?.name ?? '（顧客不明）'
  const paid = item.payment_status === 'paid'
  const itemsLabel = item.items && item.items.length > 0
    ? item.items.map(i => `${i.item_name}${i.quantity > 1 ? `×${i.quantity}` : ''}`).join('、')
    : (item.notes || '商品未登録')
  const amount = item.total_amount

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = item.expected_delivery_date ? new Date(item.expected_delivery_date) : null
  if (due) due.setHours(0, 0, 0, 0)
  const isOverdue = due != null && due < today

  async function markDelivered() {
    setLoading(true)
    const { error } = await (supabase as any).from('uniform_orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', 'お渡し完了に失敗しました'); return }
    onRefresh()
    onToast('ok', '🎁 お渡し完了にしました', async () => {
      await (supabase as any).from('uniform_orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', item.id)
      onRefresh()
    })
  }

  async function togglePayment() {
    const next = paid ? 'unpaid' : 'paid'
    setLoading(true)
    const { error } = await (supabase as any).from('uniform_orders')
      .update({ payment_status: next, updated_at: new Date().toISOString() }).eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '支払状態の更新に失敗しました'); return }
    onRefresh()
    onToast('ok', next === 'paid' ? '💰 支払い済みにしました' : '⚠️ 未払いに戻しました')
  }

  async function del() {
    setLoading(true)
    await (supabase as any).from('uniform_order_items').delete().eq('order_id', item.id)
    const { error } = await (supabase as any).from('uniform_orders').delete().eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '削除に失敗しました'); return }
    onRefresh()
    onToast('ok', '削除しました')
  }

  const leftBorder = isOverdue ? 'border-l-red-500' : 'border-l-sky-400'

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${leftBorder}`}>
      <div className="p-3.5 space-y-2">
        {/* バッジ */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-sky-100 text-sky-700">📦 追加購入</span>
          {item.priority === 'new_student' && <span className="text-xs font-black text-orange-600">🌸 新入生</span>}
          {isOverdue && <span className="text-xs font-black text-red-600">⚠️ 納期超過</span>}
        </div>

        {/* 顧客名 ｜ 商品 */}
        <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
          {item.child?.school_name && (
            <span className="text-xs font-black text-amber-600">{item.child.school_name}</span>
          )}
          <span className="text-lg font-black text-gray-900 leading-tight">{name}</span>
          <span className="text-gray-300 font-black">｜</span>
          <span className="text-base font-black text-gray-900 leading-tight">{itemsLabel}</span>
        </div>
        {item.maker && <p className="text-sm font-bold text-gray-500">メーカー: {item.maker}</p>}

        {/* 支払い ＋ 納期 */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
          {amount != null && amount > 0 && (
            <button onClick={togglePayment} disabled={loading} style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 font-black transition-all active:scale-[0.98] disabled:opacity-50 ${
                paid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-300 text-red-700'
              }`}>
              <Banknote size={16} className="shrink-0" />
              <span className="text-base">¥{amount.toLocaleString()}</span>
              <span className={`text-[11px] px-1.5 py-0 rounded font-black leading-5 ${
                paid ? 'bg-emerald-200/60 text-emerald-800' : 'bg-red-200/60 text-red-800'
              }`}>{paid ? '支払済' : '未払い'}</span>
            </button>
          )}
          {item.expected_delivery_date && (
            <span className={`text-sm font-black ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
              {isOverdue ? '🚨' : '📅'} 納期 {fmtDate(item.expected_delivery_date)}
            </span>
          )}
        </div>

        {/* お渡し完了 */}
        <div className="border-t border-gray-100 pt-2">
          {confirmDone ? (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 space-y-2">
              <p className="text-sm text-center text-emerald-800 font-black">お渡し完了にしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDone(false)} style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black active:scale-95 transition-all">
                  戻る
                </button>
                <button onClick={() => { setConfirmDone(false); markDelivered() }} disabled={loading} style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : '🎁'} お渡し完了
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDone(true)} disabled={loading} style={{ touchAction: 'manipulation' }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-base rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50">
              {loading ? <Loader2 size={18} className="animate-spin" /> : '🎁'} お渡し完了
            </button>
          )}
        </div>

        {/* 詳細トグル: 電話・削除 */}
        <button onClick={() => setOpen(v => !v)} style={{ touchAction: 'manipulation' }}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-gray-400 font-bold pt-0.5 active:opacity-60">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {open ? '閉じる' : '電話・削除'}
        </button>
        {open && (
          <div className="space-y-2.5 pt-2 border-t border-gray-100">
            {item.customer?.tel && (
              <a href={`tel:${item.customer.tel}`}
                className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
                <Phone size={14} className="shrink-0" />{item.customer.tel}
              </a>
            )}
            {item.notes && <p className="text-sm text-gray-500">{item.notes}</p>}
            {confirmDel ? (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 space-y-2">
                <p className="text-sm font-black text-red-700 text-center">本当に削除しますか？</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDel(false)} style={{ touchAction: 'manipulation' }}
                    className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black active:scale-95 transition-all">
                    戻る
                  </button>
                  <button onClick={del} disabled={loading} style={{ touchAction: 'manipulation' }}
                    className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={14} />削除する</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button onClick={() => setConfirmDel(true)} disabled={loading} style={{ touchAction: 'manipulation' }}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-red-100 bg-red-50 text-red-400 font-bold text-xs rounded-lg active:scale-95 transition-all">
                  <Trash2 size={11} />削除
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
