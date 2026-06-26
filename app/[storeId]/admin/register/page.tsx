'use client'

// ============================================================================
//  簡易レジ（POS）— 会計画面
//  商品/お直し/制服注文/手入力をカートに入れて会計 → sales/sale_items に記録、
//  取り込んだお直し・注文は payment_status='paid' に更新。レシート/領収書を印刷。
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Search, Plus, Minus, Trash2, Loader2, X, Printer,
  ShoppingCart, User, Scissors, Package, Tag, Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import {
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS,
  calcTax, lineTotal, makeSaleNumber,
  type PaymentMethod, type CartLine, type SaleSourceType,
} from '@/types/sales'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'
const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

type ProductRow  = { id: string; name: string; price: number | null; category: string | null }
type CustomerRow = { id: string; name: string; tel: string | null; school_name: string | null }
type UnpaidRepair = { id: string; item_name: string | null; content: string | null; price: number | null }
type UnpaidOrder  = { id: string; total_amount: number | null; order_number?: string | null }

export default function RegisterPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const { hasFeature, loaded: featLoaded } = useStoreFeatures(storeId)

  const [storeName, setStoreName] = useState('')
  const [taxRate, setTaxRate] = useState(10)
  const [taxInclusive, setTaxInclusive] = useState(true)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)

  const [prodQuery, setProdQuery] = useState('')
  const [custQuery, setCustQuery] = useState('')
  const [selectedCust, setSelectedCust] = useState<CustomerRow | null>(null)
  const [unpaidRepairs, setUnpaidRepairs] = useState<UnpaidRepair[]>([])
  const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([])

  const [cart, setCart] = useState<CartLine[]>([])
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  // 手入力
  const [manName, setManName] = useState('')
  const [manPrice, setManPrice] = useState('')

  // 完了レシート
  const [receipt, setReceipt] = useState<null | {
    saleNumber: string; createdAt: Date; lines: CartLine[]
    subtotal: number; tax: number; total: number; taxRate: number
    payment: PaymentMethod; cashReceived: number | null; change: number | null
    custName: string | null
  }>(null)
  const [receiptKind, setReceiptKind] = useState<'receipt' | 'invoice'>('receipt')

  const showToast = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 2600) }

  // ── 初期ロード ──────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const db = supabase as any
      const [{ data: store }, { data: prods }, { data: custs }] = await Promise.all([
        db.from('stores').select('name, tax_rate, tax_inclusive').eq('id', storeId).single(),
        db.from('products').select('id, name, price, category').eq('store_id', storeId).eq('is_active', true).order('name'),
        db.from('customers').select('id, name, tel, school_name').eq('store_id', storeId).order('name'),
      ])
      if (store) {
        setStoreName(store.name ?? '')
        if (store.tax_rate != null) setTaxRate(Number(store.tax_rate))
        if (store.tax_inclusive != null) setTaxInclusive(!!store.tax_inclusive)
      }
      setProducts((prods ?? []) as ProductRow[])
      setCustomers((custs ?? []) as CustomerRow[])
      setLoading(false)
    })()
  }, [storeId])

  // ── 顧客選択 → 未会計のお直し・注文を取得 ───────────────────
  const selectCustomer = useCallback(async (c: CustomerRow) => {
    setSelectedCust(c); setCustQuery('')
    const db = supabase as any
    const [{ data: reps }, { data: ords }] = await Promise.all([
      db.from('repair_histories').select('id, item_name, content, price, payment_status')
        .eq('store_id', storeId).eq('customer_id', c.id),
      db.from('uniform_orders').select('id, total_amount, payment_status, order_number')
        .eq('store_id', storeId).eq('customer_id', c.id),
    ])
    setUnpaidRepairs(((reps ?? []) as any[])
      .filter(r => r.payment_status !== 'paid' && (r.price ?? 0) > 0)
      .map(r => ({ id: r.id, item_name: r.item_name, content: r.content, price: r.price })))
    setUnpaidOrders(((ords ?? []) as any[])
      .filter(o => o.payment_status !== 'paid' && (o.total_amount ?? 0) > 0)
      .map(o => ({ id: o.id, total_amount: o.total_amount, order_number: o.order_number })))
  }, [storeId])

  const clearCustomer = () => { setSelectedCust(null); setUnpaidRepairs([]); setUnpaidOrders([]) }

  // ── カート操作 ──────────────────────────────────────────────
  const addLine = (l: Omit<CartLine, 'key'>) => {
    setCart(prev => {
      // 取り込み(お直し/注文)は重複防止
      if (l.source_id && prev.some(x => x.source_type === l.source_type && x.source_id === l.source_id)) return prev
      return [...prev, { ...l, key: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }]
    })
  }
  const setQty = (key: string, qty: number) =>
    setCart(prev => prev.map(l => l.key === key ? { ...l, qty: Math.max(1, qty) } : l))
  const removeLine = (key: string) => setCart(prev => prev.filter(l => l.key !== key))
  const clearCart = () => { setCart([]); setCashReceived(''); setNote(''); setPayment('cash') }

  const grossSum = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart])
  const { subtotal, tax, total } = useMemo(() => calcTax(grossSum, taxRate, taxInclusive), [grossSum, taxRate, taxInclusive])
  const received = Number(cashReceived) || 0
  const change = payment === 'cash' ? received - total : null

  const filteredProducts = useMemo(() => {
    const q = prodQuery.trim()
    if (!q) return products.slice(0, 40)
    return products.filter(p => p.name.includes(q) || (p.category ?? '').includes(q)).slice(0, 40)
  }, [products, prodQuery])

  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim()
    if (!q) return [] as CustomerRow[]
    return customers.filter(c => c.name.includes(q) || (c.tel ?? '').includes(q)).slice(0, 8)
  }, [customers, custQuery])

  // ── 会計確定 ────────────────────────────────────────────────
  const checkout = async () => {
    if (cart.length === 0) return showToast(false, '明細がありません')
    if (payment === 'cash' && received < total) return showToast(false, '預かり金額が不足しています')
    setSaving(true)
    const db = supabase as any
    try {
      // 当日連番
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const { count } = await db.from('sales').select('id', { count: 'exact', head: true })
        .eq('store_id', storeId).gte('created_at', start.toISOString())
      const saleNumber = makeSaleNumber((count ?? 0) + 1)

      const { data: sale, error: saleErr } = await db.from('sales').insert({
        store_id: storeId, sale_number: saleNumber,
        customer_id: selectedCust?.id ?? null,
        subtotal, tax, total, tax_rate: taxRate, tax_inclusive: taxInclusive,
        payment_method: payment,
        cash_received: payment === 'cash' ? received : null,
        change: payment === 'cash' ? Math.max(0, received - total) : null,
        status: 'completed', note: note.trim() || null,
      }).select('id').single()
      if (saleErr || !sale) throw saleErr || new Error('sale insert failed')

      const items = cart.map(l => ({
        sale_id: sale.id, store_id: storeId,
        source_type: l.source_type, source_id: l.source_id,
        name: l.name, unit_price: l.unit_price, qty: l.qty, line_total: lineTotal(l),
      }))
      const { error: itemErr } = await db.from('sale_items').insert(items)
      if (itemErr) throw itemErr

      // 取り込んだお直し・注文を入金済みに
      const repairIds = cart.filter(l => l.source_type === 'repair' && l.source_id).map(l => l.source_id)
      const orderIds  = cart.filter(l => l.source_type === 'order'  && l.source_id).map(l => l.source_id)
      if (repairIds.length) await db.from('repair_histories').update({ payment_status: 'paid' }).in('id', repairIds)
      if (orderIds.length)  await db.from('uniform_orders').update({ payment_status: 'paid' }).in('id', orderIds)

      setReceipt({
        saleNumber, createdAt: new Date(), lines: cart,
        subtotal, tax, total, taxRate,
        payment, cashReceived: payment === 'cash' ? received : null,
        change: payment === 'cash' ? Math.max(0, received - total) : null,
        custName: selectedCust?.name ?? null,
      })
      setReceiptKind('receipt')
      clearCart(); clearCustomer()
      showToast(true, `会計完了 ${saleNumber}`)
    } catch (e) {
      showToast(false, `会計に失敗しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  // 機能ガード（pos は既定OFF。直リンク防止）
  if (featLoaded && !hasFeature('pos')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <ShoppingCart size={36} className="text-gray-300" />
        <p className="text-gray-500 font-bold">レジ（会計）機能は無効です</p>
        <p className="text-gray-400 text-xs">総管理メニューで「レジ（会計）」をONにすると利用できます。</p>
        <Link href={`/${storeId}/admin`} className="mt-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold">管理画面へ戻る</Link>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>{toast.text}</div>
      )}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
        <Link href={`/${storeId}/admin`} className="p-1 -ml-1 text-white/80"><ChevronLeft size={22} /></Link>
        <ShoppingCart size={18} />
        <h1 className="font-black text-base flex-1">レジ（会計）</h1>
        <span className="text-[11px] text-white/70">{taxInclusive ? '内税' : '外税'}{taxRate}%</span>
      </div>

      <div className="max-w-5xl mx-auto p-3 grid md:grid-cols-2 gap-3">
        {/* ── 左: 品目を追加 ── */}
        <div className="space-y-3">
          {/* 顧客 */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">顧客（任意・未会計の取り込みに使用）</p>
            {selectedCust ? (
              <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2">
                <User size={16} className="text-indigo-500" />
                <span className="font-bold text-gray-800 text-sm flex-1">{selectedCust.name}{selectedCust.school_name && <span className="text-gray-400 font-normal ml-1">/ {selectedCust.school_name}</span>}</span>
                <button onClick={clearCustomer} className="p-1 text-gray-400"><X size={15} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={INPUT + ' pl-9'} placeholder="名前・電話で検索" value={custQuery} onChange={e => setCustQuery(e.target.value)} />
                {filteredCustomers.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredCustomers.map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm">
                        <span className="font-bold text-gray-800">{c.name}</span>
                        {c.tel && <span className="text-gray-400 ml-2 text-xs">{c.tel}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 未会計の取り込み */}
            {(unpaidRepairs.length > 0 || unpaidOrders.length > 0) && (
              <div className="mt-2 space-y-1.5">
                {unpaidRepairs.map(r => (
                  <button key={r.id} onClick={() => addLine({ source_type: 'repair', source_id: r.id, name: `お直し: ${r.item_name || r.content || '一式'}`, unit_price: r.price ?? 0, qty: 1 })}
                    className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm hover:bg-amber-100">
                    <Scissors size={13} className="text-amber-500" />
                    <span className="flex-1 text-left text-gray-700 truncate">{r.item_name || r.content || 'お直し'}</span>
                    <span className="font-bold text-gray-800">{yen(r.price ?? 0)}</span>
                    <Plus size={14} className="text-amber-500" />
                  </button>
                ))}
                {unpaidOrders.map(o => (
                  <button key={o.id} onClick={() => addLine({ source_type: 'order', source_id: o.id, name: `制服注文 ${o.order_number ?? ''}`.trim(), unit_price: o.total_amount ?? 0, qty: 1 })}
                    className="w-full flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-sm hover:bg-teal-100">
                    <Package size={13} className="text-teal-500" />
                    <span className="flex-1 text-left text-gray-700 truncate">制服注文 {o.order_number ?? ''}</span>
                    <span className="font-bold text-gray-800">{yen(o.total_amount ?? 0)}</span>
                    <Plus size={14} className="text-teal-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 手入力 */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">手入力で追加</p>
            <div className="flex gap-2">
              <input className={INPUT + ' flex-1'} placeholder="品名" value={manName} onChange={e => setManName(e.target.value)} />
              <input className={INPUT + ' w-24'} type="number" inputMode="numeric" placeholder="金額" value={manPrice} onChange={e => setManPrice(e.target.value)} />
              <button onClick={() => { if (!manName.trim() || !(Number(manPrice) > 0)) return; addLine({ source_type: 'manual', source_id: null, name: manName.trim(), unit_price: Number(manPrice), qty: 1 }); setManName(''); setManPrice('') }}
                className="px-3 rounded-xl bg-indigo-600 text-white shrink-0"><Plus size={18} /></button>
            </div>
          </div>

          {/* 商品マスタ */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">商品から追加</p>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={INPUT + ' pl-9'} placeholder="商品名・カテゴリで検索" value={prodQuery} onChange={e => setProdQuery(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <p className="col-span-2 text-center text-gray-400 text-xs py-4">該当なし</p>
              ) : filteredProducts.map(p => (
                <button key={p.id} onClick={() => addLine({ source_type: 'product', source_id: p.id, name: p.name, unit_price: p.price ?? 0, qty: 1 })}
                  className="text-left border border-gray-200 rounded-xl px-2.5 py-2 hover:border-indigo-300 hover:bg-indigo-50">
                  <span className="block text-xs font-bold text-gray-800 truncate">{p.name}</span>
                  <span className="text-indigo-600 font-black text-sm">{yen(p.price ?? 0)}</span>
                  {p.category && <span className="ml-1 text-[10px] text-gray-400 inline-flex items-center gap-0.5"><Tag size={9} />{p.category}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 右: カート・会計 ── */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">明細（{cart.length}）</p>
              {cart.length > 0 && <button onClick={clearCart} className="text-[11px] text-gray-400 hover:text-red-500">クリア</button>}
            </div>
            {cart.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">左から品目を追加してください</p>
            ) : (
              <div className="space-y-1.5">
                {cart.map(l => (
                  <div key={l.key} className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{l.name}</p>
                      <p className="text-[11px] text-gray-400">{yen(l.unit_price)} × {l.qty} = <span className="text-gray-700 font-bold">{yen(lineTotal(l))}</span></p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(l.key, l.qty - 1)} className="w-7 h-7 rounded-lg bg-white border flex items-center justify-center"><Minus size={13} /></button>
                      <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} className="w-7 h-7 rounded-lg bg-white border flex items-center justify-center"><Plus size={13} /></button>
                    </div>
                    <button onClick={() => removeLine(l.key)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* 合計 */}
            <div className="border-t mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500"><span>小計（税抜）</span><span>{yen(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>消費税（{taxRate}%）</span><span>{yen(tax)}</span></div>
              <div className="flex justify-between font-black text-gray-900 text-lg"><span>合計</span><span>{yen(total)}</span></div>
            </div>
          </div>

          {/* 支払 */}
          <div className="bg-white rounded-2xl p-3 shadow-sm space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setPayment(m)}
                  className={`py-2 rounded-xl text-xs font-bold border-2 ${payment === m ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-500'}`}>
                  <span className="mr-0.5">{PAYMENT_METHOD_ICONS[m]}</span>{PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>

            {payment === 'cash' && (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 shrink-0">お預かり</span>
                  <input className={INPUT} type="number" inputMode="numeric" placeholder="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[total, 1000, 5000, 10000].map((v, i) => (
                    <button key={i} onClick={() => setCashReceived(String(v))} className="flex-1 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">
                      {i === 0 ? 'ちょうど' : `¥${v.toLocaleString()}`}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-sm font-black">
                  <span className="text-gray-500">おつり</span>
                  <span className={change != null && change < 0 ? 'text-red-500' : 'text-emerald-600'}>{change != null ? yen(Math.max(0, change)) : '—'}</span>
                </div>
              </div>
            )}

            <input className={INPUT} placeholder="メモ（任意）" value={note} onChange={e => setNote(e.target.value)} />

            <button onClick={checkout} disabled={saving || cart.length === 0}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {yen(total)} を会計する
            </button>
          </div>
        </div>
      </div>

      {/* 会計完了レシート */}
      {receipt && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 print:bg-white print:p-0" onClick={() => setReceipt(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto print:max-h-full print:rounded-none" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between print:hidden">
              <div className="flex gap-1">
                {(['receipt', 'invoice'] as const).map(k => (
                  <button key={k} onClick={() => setReceiptKind(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${receiptKind === k ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {k === 'receipt' ? 'レシート' : '領収書'}
                  </button>
                ))}
              </div>
              <button onClick={() => setReceipt(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            {/* 印刷対象 */}
            <div id="receipt-print" className="p-5 text-gray-900" style={{ fontFamily: 'monospace' }}>
              <div className="text-center mb-3">
                <p className="font-black text-base">{storeName || 'お店'}</p>
                <p className="text-xs">{receiptKind === 'invoice' ? '領収書' : 'レシート'}</p>
              </div>
              {receiptKind === 'invoice' && (
                <p className="text-sm mb-2">{receipt.custName ? `${receipt.custName} 様` : '上様'}</p>
              )}
              <p className="text-[11px] text-gray-500">{receipt.saleNumber}　{receipt.createdAt.toLocaleString('ja-JP')}</p>
              <div className="border-t border-dashed my-2" />
              {receipt.lines.map(l => (
                <div key={l.key} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{l.name} ×{l.qty}</span>
                  <span>{yen(lineTotal(l))}</span>
                </div>
              ))}
              <div className="border-t border-dashed my-2" />
              <div className="flex justify-between text-sm"><span>小計（税抜）</span><span>{yen(receipt.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span>消費税（{receipt.taxRate}%）</span><span>{yen(receipt.tax)}</span></div>
              <div className="flex justify-between font-black text-base mt-1"><span>合計</span><span>{yen(receipt.total)}</span></div>
              <div className="flex justify-between text-sm mt-1"><span>{PAYMENT_METHOD_LABELS[receipt.payment]}</span><span>{receipt.cashReceived != null ? yen(receipt.cashReceived) : ''}</span></div>
              {receipt.change != null && <div className="flex justify-between text-sm"><span>おつり</span><span>{yen(receipt.change)}</span></div>}
              <p className="text-center text-[11px] text-gray-500 mt-4">ありがとうございました</p>
            </div>

            <div className="p-4 print:hidden">
              <button onClick={() => window.print()} className="w-full py-3 rounded-2xl bg-gray-900 text-white font-black flex items-center justify-center gap-2">
                <Printer size={16} />印刷 / PDF保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 印刷スタイル */}
      <style>{`@media print { body * { visibility: hidden !important; } #receipt-print, #receipt-print * { visibility: visible !important; } #receipt-print { position: absolute; left: 0; top: 0; width: 80mm; } }`}</style>
    </div>
  )
}
