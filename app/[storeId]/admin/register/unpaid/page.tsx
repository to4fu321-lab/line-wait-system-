'use client'

// ============================================================
// 未収一覧 — 支払いが完了していない 注文（前受金/内金の残額）と
//   お直し を顧客ごとに一覧化。レジへの導線付き（回収漏れ防止）。
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Wallet, Package, Scissors, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../../_components/BottomNav'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

type UnpaidOrderRow = {
  id: string; order_number: string | null; customer_id: string | null
  customer_name: string; total: number; paid: number; remaining: number
  payment_status: string; created_at: string
}
type UnpaidRepairRow = {
  id: string; customer_id: string | null; customer_name: string
  label: string; price: number; status: string; created_at: string
}

export default function UnpaidPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const router = useRouter()

  const [tab, setTab] = useState<'orders' | 'repairs'>('orders')
  const [orders, setOrders] = useState<UnpaidOrderRow[]>([])
  const [repairs, setRepairs] = useState<UnpaidRepairRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const db = supabase as any
    const [{ data: ords }, { data: reps }] = await Promise.all([
      db.from('uniform_orders')
        .select('id, order_number, customer_id, total_amount, payment_status, created_at, customer:customers(name)')
        .eq('store_id', storeId).neq('payment_status', 'paid').gt('total_amount', 0)
        .order('created_at', { ascending: false }),
      db.from('repair_histories')
        .select('id, customer_id, item_name, content, price, payment_status, status, created_at, customer:customers(name)')
        .eq('store_id', storeId).neq('payment_status', 'paid').gt('price', 0)
        .order('created_at', { ascending: false }),
    ])

    const orderRows = (ords ?? []) as any[]
    let paidByOrder = new Map<string, number>()
    if (orderRows.length > 0) {
      const { data: pays } = await db.from('order_payments')
        .select('order_id, amount').in('order_id', orderRows.map(o => o.id))
      paidByOrder = ((pays ?? []) as any[]).reduce((m, p) => {
        m.set(p.order_id, (m.get(p.order_id) ?? 0) + (Number(p.amount) || 0)); return m
      }, new Map<string, number>())
    }
    setOrders(orderRows.map(o => {
      const total = o.total_amount ?? 0
      const paid = paidByOrder.get(o.id) ?? 0
      return {
        id: o.id, order_number: o.order_number, customer_id: o.customer_id,
        customer_name: o.customer?.name ?? '（顧客未設定）',
        total, paid, remaining: Math.max(0, total - paid),
        payment_status: o.payment_status ?? 'unpaid', created_at: o.created_at,
      }
    }).filter(o => o.remaining > 0))

    setRepairs(((reps ?? []) as any[]).map(r => ({
      id: r.id, customer_id: r.customer_id,
      customer_name: r.customer?.name ?? '（顧客未設定）',
      label: r.item_name || r.content || 'お直し', price: r.price ?? 0,
      status: r.status ?? '', created_at: r.created_at,
    })))
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const sums = useMemo(() => ({
    orders: orders.reduce((s, o) => s + o.remaining, 0),
    repairs: repairs.reduce((s, r) => s + r.price, 0),
  }), [orders, repairs])

  // レジへ（顧客を自動選択して未払いをすぐ会計に載せられるように）
  const toRegister = (customerId: string | null) => {
    router.push(customerId ? `/${storeId}/admin/register?customerId=${customerId}` : `/${storeId}/admin/register`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      <div className="sticky top-0 z-30 bg-white border-b" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <Link href={`/${storeId}/admin/register`} className="p-1 -ml-1 text-gray-400"><ChevronLeft size={22} /></Link>
          <Wallet size={18} className="text-indigo-500" />
          <h1 className="font-black text-base text-gray-900 flex-1">未収一覧</h1>
        </div>
        <div className="px-4 pb-2 flex gap-1.5">
          <button onClick={() => setTab('orders')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${tab === 'orders' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            <Package size={13} />注文 {orders.length}件{sums.orders > 0 ? `（${yen(sums.orders)}）` : ''}
          </button>
          <button onClick={() => setTab('repairs')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${tab === 'repairs' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            <Scissors size={13} />お直し {repairs.length}件{sums.repairs > 0 ? `（${yen(sums.repairs)}）` : ''}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 grid place-items-center"><Loader2 size={26} className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="max-w-lg mx-auto w-full px-4 py-3 space-y-2">
          {tab === 'orders' && (orders.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-16">未収の注文はありません 🎉</p>
          ) : orders.map(o => (
            <button key={o.id} onClick={() => toRegister(o.customer_id)}
              className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 text-left active:scale-[0.99] transition-all">
              <Package size={16} className="text-teal-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{o.customer_name}</p>
                <p className="text-[11px] text-gray-400">
                  注文 {o.order_number ?? '-'} ・ {new Date(o.created_at).toLocaleDateString('ja-JP')}
                  {o.paid > 0 ? ` ・ 入金済 ${yen(o.paid)} / 総額 ${yen(o.total)}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-gray-900">{yen(o.remaining)}</p>
                {o.paid > 0 && <p className="text-[10px] font-bold text-teal-600">内金あり</p>}
              </div>
              <ChevronRight size={15} className="text-gray-300 shrink-0" />
            </button>
          )))}

          {tab === 'repairs' && (repairs.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-16">未収のお直しはありません 🎉</p>
          ) : repairs.map(r => (
            <button key={r.id} onClick={() => toRegister(r.customer_id)}
              className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 text-left active:scale-[0.99] transition-all">
              <Scissors size={16} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{r.customer_name}</p>
                <p className="text-[11px] text-gray-400 truncate">{r.label} ・ {new Date(r.created_at).toLocaleDateString('ja-JP')}</p>
              </div>
              <p className="font-black text-gray-900 shrink-0">{yen(r.price)}</p>
              <ChevronRight size={15} className="text-gray-300 shrink-0" />
            </button>
          )))}

          <p className="text-[11px] text-gray-400 text-center pt-2">タップするとレジが開き、顧客が自動選択されます</p>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
