'use client'

// ============================================================================
//  レジ（POS） v2 — モバイルファースト設計
//  フロー: 顧客選択(任意) → 商品追加 → カートシート → 支払確認 → レシート
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Search, Plus, Minus, Trash2, Loader2, X, Printer,
  ShoppingCart, User, Scissors, Package, Tag, Check, UserPlus,
  ChevronRight, RotateCcw, Coins, AlertTriangle, ScanLine, Link2,
  History, BarChart3, Wallet, Percent, UserCheck,
} from 'lucide-react'
import { BarcodeScannerSheet } from '../_components/BarcodeScannerSheet'
import { ReceiptView, ReceiptPrintStyle } from './_components/ReceiptView'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { fetchOpenSession } from '@/lib/registerSession'
import type { RegisterSession } from '@/types/register'
import { BottomNav } from '../_components/BottomNav'
import {
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS,
  lineTotal, makeSaleNumber, calcTotalsWithDiscount,
  type PaymentMethod, type CartLine, type ReceiptData,
} from '@/types/sales'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

type ProductRow  = { id: string; name: string; price: number; category: string | null; barcode: string | null; stock: number | null }
type CustomerRow = { id: string; name: string; tel: string | null; school_name: string | null }
type StaffRow    = { id: string; name: string; color: string | null }
type UnpaidRepair = { id: string; label: string; price: number }
// total=注文総額 / paid=入金済み合計 / remaining=残額
type UnpaidOrder  = { id: string; label: string; total: number; paid: number; remaining: number }

type PosScreen = 'pos' | 'cart' | 'payment' | 'receipt'

export default function RegisterPage() {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const { hasFeature, loaded: featLoaded } = useStoreFeatures(storeId)

  // ── マスタ ──────────────────────────────────────────────────
  const [storeName,     setStoreName]     = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [taxRate,       setTaxRate]       = useState(10)
  const [taxInclusive,  setTaxInclusive]  = useState(true)
  const [products,      setProducts]      = useState<ProductRow[]>([])
  const [customers,     setCustomers]     = useState<CustomerRow[]>([])
  const [staffList,     setStaffList]     = useState<StaffRow[]>([])
  const [loading,       setLoading]       = useState(true)

  // ── レジセッション（会計はオープン中セッションへ紐付け）──────
  const [regSession, setRegSession] = useState<RegisterSession | null>(null)
  const refreshSession = useCallback(async () => {
    if (!storeId) return
    setRegSession(await fetchOpenSession(supabase as any, storeId))
  }, [storeId])

  // ── 顧客 ──────────────────────────────────────────────────
  const [custMode,      setCustMode]      = useState<'walkin' | 'search'>('walkin')
  const [walkInName,    setWalkInName]    = useState('')
  const [custQuery,     setCustQuery]     = useState('')
  const [selectedCust,  setSelectedCust]  = useState<CustomerRow | null>(null)
  const [unpaidRepairs, setUnpaidRepairs] = useState<UnpaidRepair[]>([])
  const [unpaidOrders,  setUnpaidOrders]  = useState<UnpaidOrder[]>([])
  const [custLoading,   setCustLoading]   = useState(false)

  // ── 商品 ──────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [prodQuery,      setProdQuery]      = useState('')

  // ── カート ────────────────────────────────────────────────
  const [cart,   setCart]   = useState<CartLine[]>([])

  // ── 手入力 ────────────────────────────────────────────────
  const [manName,  setManName]  = useState('')
  const [manPrice, setManPrice] = useState('')

  // ── 支払 ──────────────────────────────────────────────────
  const [payment,      setPayment]      = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [note,         setNote]         = useState('')
  const [discountStr,  setDiscountStr]  = useState('')   // 値引き(円・税込)
  const [staffId,      setStaffId]      = useState<string | null>(null) // 会計担当者
  const [saving,       setSaving]       = useState(false)

  // ── 画面遷移 ──────────────────────────────────────────────
  const [screen, setScreen] = useState<PosScreen>('pos')
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [receiptKind, setReceiptKind] = useState<'receipt' | 'invoice'>('receipt')
  const [receiptName, setReceiptName] = useState('')  // 領収書 宛名
  const [receiptNote, setReceiptNote] = useState('')  // 領収書 但し書き

  // ── Toast ──────────────────────────────────────────────────
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (ok: boolean, text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ ok, text })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  // ── 初期ロード ──────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const db = supabase as any
      const [{ data: store }, { data: prods }, { data: custs }, { data: stf }] = await Promise.all([
        db.from('stores').select('name, tax_rate, tax_inclusive, invoice_number').eq('id', storeId).single(),
        db.from('products')
          .select('id, name, base_price_tax_in, base_price_tax_out, category, barcode, stock, active')
          .eq('store_id', storeId).eq('active', true).order('category').order('name'),
        db.from('customers').select('id, name, tel, school_name').eq('store_id', storeId).order('name'),
        db.from('staff').select('id, name, color').eq('store_id', storeId).eq('active', true).order('sort_order'),
      ])
      if (store) {
        setStoreName(store.name ?? '')
        setInvoiceNumber(store.invoice_number ?? null)
        if (store.tax_rate != null) setTaxRate(Number(store.tax_rate))
        if (store.tax_inclusive != null) setTaxInclusive(!!store.tax_inclusive)
      }
      setProducts(((prods ?? []) as any[]).map(p => ({
        id: p.id, name: p.name, category: p.category, barcode: p.barcode ?? null,
        stock: p.stock ?? null,
        price: Number(p.base_price_tax_in ?? p.base_price_tax_out ?? 0),
      })))
      setCustomers((custs ?? []) as CustomerRow[])
      const staffRows = (stf ?? []) as StaffRow[]
      setStaffList(staffRows)
      // 前回選択した担当者を復元
      try {
        const savedStaff = localStorage.getItem(`pos_staff_${storeId}`)
        if (savedStaff && staffRows.some(s => s.id === savedStaff)) setStaffId(savedStaff)
      } catch { /* localStorage 不可の環境は未選択のまま */ }
      await refreshSession()
      setLoading(false)
    })()
  }, [storeId, refreshSession])

  // レジのオープン/締めをリアルタイム反映
  useEffect(() => {
    if (!storeId) return
    const ch = supabase
      .channel(`reg_sess_${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'register_sessions', filter: `store_id=eq.${storeId}` }, () => refreshSession())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [storeId, refreshSession])

  // ── 顧客選択 → 未払い取得（注文は入金済み額を差し引いた残額を出す）──
  const selectCustomer = useCallback(async (c: CustomerRow) => {
    setSelectedCust(c); setCustQuery(''); setCustLoading(true)
    const db = supabase as any
    const [{ data: reps }, { data: ords }] = await Promise.all([
      db.from('repair_histories').select('id, item_name, content, price, payment_status')
        .eq('store_id', storeId).eq('customer_id', c.id),
      db.from('uniform_orders').select('id, total_amount, payment_status, order_number')
        .eq('store_id', storeId).eq('customer_id', c.id),
    ])
    setUnpaidRepairs(((reps ?? []) as any[])
      .filter(r => r.payment_status !== 'paid' && (r.price ?? 0) > 0)
      .map(r => ({ id: r.id, label: r.item_name || r.content || 'お直し', price: r.price ?? 0 })))

    const openOrders = ((ords ?? []) as any[])
      .filter(o => o.payment_status !== 'paid' && (o.total_amount ?? 0) > 0)
    let paidByOrder = new Map<string, number>()
    if (openOrders.length > 0) {
      const { data: pays } = await db.from('order_payments')
        .select('order_id, amount').in('order_id', openOrders.map(o => o.id))
      paidByOrder = ((pays ?? []) as any[]).reduce((m, p) => {
        m.set(p.order_id, (m.get(p.order_id) ?? 0) + (Number(p.amount) || 0))
        return m
      }, new Map<string, number>())
    }
    setUnpaidOrders(openOrders.map(o => {
      const total = o.total_amount ?? 0
      const paid = paidByOrder.get(o.id) ?? 0
      return {
        id: o.id, label: `制服注文 ${o.order_number ?? ''}`.trim(),
        total, paid, remaining: Math.max(0, total - paid),
      }
    }).filter(o => o.remaining > 0))
    setCustLoading(false)
  }, [storeId])

  const clearCustomer = () => {
    setSelectedCust(null); setUnpaidRepairs([]); setUnpaidOrders([])
    setWalkInName(''); setCustQuery('')
  }

  // 未収一覧などからの遷移: ?customerId=xxx で顧客を自動選択（初回のみ）
  const preselectDone = useRef(false)
  useEffect(() => {
    if (loading || preselectDone.current || typeof window === 'undefined') return
    const cid = new URLSearchParams(window.location.search).get('customerId')
    if (!cid) return
    preselectDone.current = true
    const c = customers.find(x => x.id === cid)
    if (c) { setCustMode('search'); selectCustomer(c) }
  }, [loading, customers, selectCustomer])

  // ── カート操作 ──────────────────────────────────────────────
  // 商品はタップ/スキャンのたびに数量+1。お直し・注文は1件1行（重複追加しない）
  const addLine = (l: Omit<CartLine, 'key'>) => {
    setCart(prev => {
      if (l.source_id) {
        const idx = prev.findIndex(x => x.source_type === l.source_type && x.source_id === l.source_id)
        if (idx >= 0) {
          if (l.source_type !== 'product') return prev
          return prev.map((x, i) => i === idx ? { ...x, qty: x.qty + 1 } : x)
        }
      }
      return [...prev, { ...l, key: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }]
    })
  }
  const setQty   = (key: string, qty: number) => setCart(prev => prev.map(l => l.key === key ? { ...l, qty: Math.max(1, qty) } : l))
  const removeLine = (key: string) => setCart(prev => prev.filter(l => l.key !== key))
  const clearAll   = () => {
    setCart([]); setCashReceived(''); setNote(''); setDiscountStr(''); setPayment('cash')
    setReceiptName(''); setReceiptNote('')
    clearCustomer(); setScreen('pos')
  }
  // 商品タイル/カート内の数量減算（1→0で行削除）
  const decProduct = (productId: string) => {
    setCart(prev => prev.flatMap(l => {
      if (l.source_type !== 'product' || l.source_id !== productId) return [l]
      return l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []
    }))
  }
  const productQty = (productId: string) =>
    cart.find(l => l.source_type === 'product' && l.source_id === productId)?.qty ?? 0

  // ── バーコード/QRスキャン ──────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false)
  // 未登録コードの紐付けシート（コード保持 + 商品検索）
  const [linkCode, setLinkCode]   = useState<string | null>(null)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)

  const productsRef = useRef<ProductRow[]>([])
  useEffect(() => { productsRef.current = products }, [products])

  const handleScan = useCallback((code: string) => {
    const hit = productsRef.current.find(p => p.barcode && p.barcode === code)
    if (hit) {
      addLine({ source_type: 'product', source_id: hit.id, name: hit.name, unit_price: hit.price, qty: 1 })
      showToast(true, `追加: ${hit.name}`)
    } else {
      // 未登録コード → スキャナーを閉じて紐付けシートへ
      setScannerOpen(false)
      setLinkCode(code)
      setLinkQuery('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // コードを商品に紐付けて保存 → カートに追加
  const linkCodeToProduct = async (p: ProductRow) => {
    if (!linkCode) return
    setLinkSaving(true)
    const { data, error } = await (supabase as any)
      .from('products').update({ barcode: linkCode }).eq('id', p.id).select('id')
    setLinkSaving(false)
    if (error || !data || data.length === 0) {
      showToast(false, error?.message ?? '紐付けに失敗しました（スタッフ認証をご確認ください）')
      return
    }
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, barcode: linkCode } : x))
    addLine({ source_type: 'product', source_id: p.id, name: p.name, unit_price: p.price, qty: 1 })
    showToast(true, `「${p.name}」にコードを登録し、カートに追加しました`)
    setLinkCode(null)
  }

  // ── 集計（値引きは税込合計から差し引く）──────────────────────
  const grossSum = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart])
  const { subtotal, tax, total, discount } = useMemo(
    () => calcTotalsWithDiscount(grossSum, Number(discountStr) || 0, taxRate, taxInclusive),
    [grossSum, discountStr, taxRate, taxInclusive],
  )
  const received = Number(cashReceived) || 0
  const change   = payment === 'cash' ? received - total : null

  // ── 内金（注文への一部入金）────────────────────────────────
  const [depositFor, setDepositFor] = useState<UnpaidOrder | null>(null)
  const [depositStr, setDepositStr] = useState('')
  const confirmDeposit = () => {
    if (!depositFor) return
    const amt = Math.round(Number(depositStr) || 0)
    if (amt <= 0) { showToast(false, '金額を入力してください'); return }
    if (amt > depositFor.remaining) { showToast(false, `残額 ${yen(depositFor.remaining)} を超えています`); return }
    addLine({ source_type: 'deposit', source_id: depositFor.id, name: `内金: ${depositFor.label}`, unit_price: amt, qty: 1 })
    setDepositFor(null); setDepositStr('')
  }

  // ── 商品フィルタ ─────────────────────────────────────────
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    let list = products
    if (activeCategory) list = list.filter(p => p.category === activeCategory)
    const q = prodQuery.trim()
    if (q) list = list.filter(p => p.name.includes(q) || (p.category ?? '').includes(q) || (p.barcode ?? '').includes(q))
    return list.slice(0, 60)
  }, [products, activeCategory, prodQuery])

  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim()
    if (!q) return [] as CustomerRow[]
    return customers.filter(c => c.name.includes(q) || (c.tel ?? '').includes(q)).slice(0, 8)
  }, [customers, custQuery])

  const custDisplayName = selectedCust?.name ?? (walkInName.trim() || null)

  // ── 会計確定 ────────────────────────────────────────────────
  const checkout = async () => {
    if (cart.length === 0) return showToast(false, '明細がありません')
    if (!regSession) return showToast(false, 'レジがオープンしていません。先にレジをオープンしてください')
    if (payment === 'cash' && received < total) return showToast(false, '預かり金額が不足しています')
    setSaving(true)
    const db = supabase as any
    try {
      // オープン中セッションを再確認（締め済みへの計上を防止）
      const live = await fetchOpenSession(db, storeId)
      if (!live) { setSaving(false); return showToast(false, 'レジが締められています。再度オープンしてください') }

      const start = new Date(); start.setHours(0, 0, 0, 0)
      const { count } = await db.from('sales').select('id', { count: 'exact', head: true })
        .eq('store_id', storeId).gte('created_at', start.toISOString())
      const saleNumber = makeSaleNumber((count ?? 0) + 1)

      const { data: sale, error: saleErr } = await db.from('sales').insert({
        store_id: storeId, sale_number: saleNumber,
        customer_id: selectedCust?.id ?? null,
        staff_id: staffId,
        register_session_id: live.id,
        subtotal, tax, total, discount, tax_rate: taxRate, tax_inclusive: taxInclusive,
        payment_method: payment,
        cash_received: payment === 'cash' ? received : null,
        change: payment === 'cash' ? Math.max(0, received - total) : null,
        status: 'completed',
        note: [note.trim(), !selectedCust && walkInName.trim() ? `来客: ${walkInName.trim()}` : ''].filter(Boolean).join(' / ') || null,
      }).select('id').single()
      if (saleErr || !sale) throw saleErr || new Error('sale insert failed')

      const { error: itemsErr } = await db.from('sale_items').insert(cart.map(l => ({
        sale_id: sale.id, store_id: storeId,
        source_type: l.source_type, source_id: l.source_id,
        name: l.name, unit_price: l.unit_price, qty: l.qty, line_total: lineTotal(l),
      })))
      if (itemsErr) throw itemsErr

      // お直し: 支払済みへ
      const repairIds = cart.filter(l => l.source_type === 'repair' && l.source_id).map(l => l.source_id)
      if (repairIds.length) await db.from('repair_histories').update({ payment_status: 'paid' }).in('id', repairIds)

      // 注文: 入金履歴を記録し、入金累計に応じて paid / partial を更新
      const orderLines   = cart.filter(l => (l.source_type === 'order' || l.source_type === 'deposit') && l.source_id)
      if (orderLines.length > 0) {
        await db.from('order_payments').insert(orderLines.map(l => ({
          store_id: storeId, order_id: l.source_id, sale_id: sale.id,
          amount: lineTotal(l), method: payment,
          kind: l.source_type === 'deposit' ? 'deposit' : 'balance',
        })))
        for (const l of orderLines) {
          const ord = unpaidOrders.find(o => o.id === l.source_id)
          const nowPaid = (ord?.paid ?? 0) + lineTotal(l)
          const covered = l.source_type === 'order' || (ord != null && nowPaid >= ord.total)
          await db.from('uniform_orders')
            .update({ payment_status: covered ? 'paid' : 'partial' })
            .eq('id', l.source_id)
        }
      }

      // 在庫連動: 在庫管理中の商品（stock が数値）だけ減算
      const stockLines = cart.filter(l =>
        l.source_type === 'product' && l.source_id &&
        productsRef.current.find(p => p.id === l.source_id)?.stock != null)
      if (stockLines.length > 0) {
        await Promise.all(stockLines.map(l =>
          db.rpc('adjust_product_stock', { p_product_id: l.source_id, p_delta: -l.qty })))
        setProducts(prev => prev.map(p => {
          const line = stockLines.find(l => l.source_id === p.id)
          return line && p.stock != null ? { ...p, stock: p.stock - line.qty } : p
        }))
      }

      setReceiptData({
        saleId: sale.id, saleNumber, createdAt: new Date(),
        lines: cart.map(l => ({ key: l.key, name: l.name, qty: l.qty, unit_price: l.unit_price })),
        subtotal, tax, total, discount, taxRate,
        payment, cashReceived: payment === 'cash' ? received : null,
        change: payment === 'cash' ? Math.max(0, received - total) : null,
        custName: custDisplayName,
      })
      setReceiptKind('receipt')
      setReceiptName(custDisplayName ?? ''); setReceiptNote('')
      setCart([]); setCashReceived(''); setNote(''); setDiscountStr(''); clearCustomer()
      setScreen('receipt')
    } catch (e) {
      showToast(false, `会計に失敗しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  // ── 機能ガード ───────────────────────────────────────────
  if (featLoaded && !hasFeature('pos')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <ShoppingCart size={36} className="text-gray-300" />
        <p className="text-gray-500 font-bold">レジ（会計）機能は無効です</p>
        <Link href={`/${storeId}/admin`} className="mt-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold">管理画面へ戻る</Link>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-300" /></div>
  }

  // ============================================================
  // レシート画面
  // ============================================================
  if (screen === 'receipt' && receiptData) {
    // 宛名・但し書きを会計レコードへ保存（再発行時にも同じ内容が出る）
    const saveReceiptFields = async () => {
      if (!receiptData.saleId) return
      await (supabase as any).from('sales')
        .update({ receipt_name: receiptName.trim() || null, receipt_note: receiptNote.trim() || null })
        .eq('id', receiptData.saleId)
    }
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <div className="flex gap-2">
            {(['receipt', 'invoice'] as const).map(k => (
              <button key={k} onClick={() => setReceiptKind(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${receiptKind === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {k === 'receipt' ? 'レシート' : '領収書'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-bold text-gray-600">
            <Printer size={14} />印刷
          </button>
          <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 rounded-xl text-xs font-bold text-white">
            <RotateCcw size={14} />次の会計
          </button>
        </div>

        {/* 領収書の宛名・但し書き（インボイス） */}
        {receiptKind === 'invoice' && (
          <div className="max-w-sm mx-auto w-full px-5 pt-4 space-y-2">
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-500"
              placeholder="宛名（空欄なら「上様」）" value={receiptName}
              onChange={e => setReceiptName(e.target.value)} onBlur={saveReceiptFields}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-500"
              placeholder="但し書き（空欄なら「お品代」）" value={receiptNote}
              onChange={e => setReceiptNote(e.target.value)} onBlur={saveReceiptFields}
            />
            {!invoiceNumber && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
                インボイス登録番号が未設定です。設定するとレシート・領収書に自動印字されます（設定 → レジ）。
              </p>
            )}
          </div>
        )}

        <div className="flex-1">
          <ReceiptView
            storeName={storeName} invoiceNumber={invoiceNumber}
            kind={receiptKind} data={receiptData}
            receiptName={receiptName} receiptNote={receiptNote}
          />
        </div>

        <BottomNav />
        <ReceiptPrintStyle />
      </div>
    )
  }

  // ============================================================
  // 支払確認画面
  // ============================================================
  if (screen === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* ヘッダー */}
        <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setScreen('cart')} className="p-1 -ml-1 text-gray-500"><ChevronLeft size={22} /></button>
          <h1 className="font-black text-base">お支払い</h1>
          <div className="flex-1" />
          <span className="text-xl font-black text-gray-900">{yen(total)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">
          {!regSession && (
            <Link href={`/${storeId}/admin/register/cash`}
              className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 text-sm">
              <AlertTriangle size={18} className="text-amber-500 shrink-0" />
              <span className="flex-1 font-bold text-amber-800">レジが未オープンです。会計するにはオープンが必要です</span>
              <ChevronRight size={16} className="text-amber-500" />
            </Link>
          )}
          {/* 会計担当者 */}
          {staffList.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1"><UserCheck size={13} />担当者</p>
              <div className="flex flex-wrap gap-2">
                {staffList.map(s => (
                  <button key={s.id}
                    onClick={() => {
                      const next = staffId === s.id ? null : s.id
                      setStaffId(next)
                      try {
                        if (next) localStorage.setItem(`pos_staff_${storeId}`, next)
                        else localStorage.removeItem(`pos_staff_${storeId}`)
                      } catch { /* localStorage 不可の環境では記憶しない */ }
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border-2 transition-all ${staffId === s.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 支払方法 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">お支払い方法</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setPayment(m)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all ${payment === m ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                  <span className="text-2xl">{PAYMENT_METHOD_ICONS[m]}</span>
                  <span className={`text-[11px] font-bold ${payment === m ? 'text-indigo-600' : 'text-gray-500'}`}>{PAYMENT_METHOD_LABELS[m]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 現金: お預かり */}
          {payment === 'cash' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">お預かり金額</p>
              <input
                type="number" inputMode="numeric"
                value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                placeholder="0"
                className="w-full text-right text-3xl font-black text-gray-900 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500"
              />
              <div className="grid grid-cols-4 gap-2">
                {[total, 1000, 5000, 10000].map((v, i) => (
                  <button key={i} onClick={() => setCashReceived(String(v))}
                    className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold active:scale-95">
                    {i === 0 ? 'ちょうど' : yen(v)}
                  </button>
                ))}
              </div>
              {change != null && (
                <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${change >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <span className="font-bold text-sm text-gray-600">おつり</span>
                  <span className={`text-2xl font-black ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{yen(Math.max(0, change))}</span>
                </div>
              )}
            </div>
          )}

          {/* メモ */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">メモ（任意）</p>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="備考など" value={note} onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* 合計確認 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2 text-sm">
            {custDisplayName && (
              <div className="flex justify-between text-gray-500">
                <span>お客様</span><span className="font-bold text-gray-800">{custDisplayName}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-rose-500 font-bold"><span>値引き</span><span>-{yen(discount)}</span></div>
            )}
            <div className="flex justify-between text-gray-500"><span>小計（税抜）</span><span>{yen(subtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>消費税（{taxRate}%）</span><span>{yen(tax)}</span></div>
            <div className="flex justify-between font-black text-2xl text-gray-900 pt-2 border-t"><span>合計</span><span>{yen(total)}</span></div>
          </div>
        </div>

        {/* 会計ボタン */}
        <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <button onClick={checkout} disabled={saving || !regSession || (payment === 'cash' && received < total)}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/30">
            {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
            {regSession ? `${yen(total)} を会計する` : 'レジをオープンしてください'}
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // カートシート画面
  // ============================================================
  if (screen === 'cart') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setScreen('pos')} className="p-1 -ml-1 text-gray-500"><ChevronLeft size={22} /></button>
          <h1 className="font-black text-base">カート</h1>
          <span className="text-xs text-gray-400">{cart.length}点</span>
          <div className="flex-1" />
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500">クリア</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-40">
          {cart.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">カートは空です</p>
            </div>
          ) : (
            <>
              {cart.map(l => (
                <div key={l.key} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{l.name}</p>
                    <p className="text-xs text-gray-400">{yen(l.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(l.key, l.qty - 1)}
                      className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-black text-gray-900">{l.qty}</span>
                    <button onClick={() => setQty(l.key, l.qty + 1)}
                      className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-sm font-black text-gray-900 w-16 text-right">{yen(lineTotal(l))}</span>
                  <button onClick={() => removeLine(l.key)} className="p-1 text-gray-300 hover:text-red-500 ml-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              {/* 値引き */}
              <div className="bg-white rounded-2xl p-4 shadow-sm mt-2 space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1"><Percent size={12} />値引き（税込・会計全体）</p>
                <div className="flex gap-2">
                  <input
                    type="number" inputMode="numeric" placeholder="0"
                    value={discountStr} onChange={e => setDiscountStr(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-right text-lg font-black text-rose-600 focus:outline-none focus:border-indigo-500"
                  />
                  {[5, 10].map(pct => (
                    <button key={pct}
                      onClick={() => setDiscountStr(String(Math.round(grossSum * pct / 100)))}
                      className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold active:scale-95 shrink-0">
                      {pct}%引き
                    </button>
                  ))}
                  {discount > 0 && (
                    <button onClick={() => setDiscountStr('')} className="px-2.5 py-2 rounded-xl bg-gray-100 text-gray-400 shrink-0"><X size={15} /></button>
                  )}
                </div>
              </div>

              {/* 小計 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm mt-2 space-y-1.5 text-sm">
                {discount > 0 && (
                  <div className="flex justify-between text-rose-500 font-bold"><span>値引き</span><span>-{yen(discount)}</span></div>
                )}
                <div className="flex justify-between text-gray-400"><span>小計（税抜）</span><span>{yen(subtotal)}</span></div>
                <div className="flex justify-between text-gray-400"><span>消費税（{taxRate}%）</span><span>{yen(tax)}</span></div>
                <div className="flex justify-between font-black text-xl text-gray-900 pt-2 border-t"><span>合計</span><span>{yen(total)}</span></div>
              </div>
            </>
          )}
        </div>

        <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <button onClick={() => setScreen('payment')} disabled={cart.length === 0}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all">
            <ChevronRight size={20} />
            支払いへ進む
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // メイン POS 画面
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom) + 72px)' }}>
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl whitespace-nowrap ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.text}
        </div>
      )}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white border-b" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <Link href={`/${storeId}/admin`} className="p-1 -ml-1 text-gray-400"><ChevronLeft size={22} /></Link>
          <ShoppingCart size={18} className="text-indigo-500" />
          <h1 className="font-black text-base flex-1 text-gray-900">{storeName || 'レジ'}</h1>
          <span className="text-[11px] text-gray-400">{taxInclusive ? '内税' : '外税'} {taxRate}%</span>
          <Link href={`/${storeId}/admin/register/cash`}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black ${regSession ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <Coins size={13} />{regSession ? 'オープン中' : 'レジ締'}
          </Link>
        </div>
        {/* サブメニュー */}
        <div className="px-4 pb-2 flex gap-1.5">
          {([
            ['history', '取引履歴', History],
            ['report',  '売上日報', BarChart3],
            ['unpaid',  '未収一覧', Wallet],
          ] as const).map(([path, label, Icon]) => (
            <Link key={path} href={`/${storeId}/admin/register/${path}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold active:bg-gray-200">
              <Icon size={12} />{label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-3">

          {!regSession && (
            <Link href={`/${storeId}/admin/register/cash`}
              className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 text-sm">
              <AlertTriangle size={18} className="text-amber-500 shrink-0" />
              <span className="flex-1 font-bold text-amber-800">レジが未オープンです。タップしてオープン</span>
              <ChevronRight size={16} className="text-amber-500" />
            </Link>
          )}

          {/* ── スキャンボタン ────────────────────────────────── */}
          <button onClick={() => setScannerOpen(true)}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-emerald-600 text-white font-black text-base shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all">
            <ScanLine size={22} />
            バーコード / QR をスキャンして追加
          </button>

          {/* ── 顧客セクション ────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            {/* モード切替 */}
            <div className="flex gap-1 mb-3">
              <button onClick={() => setCustMode('walkin')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${custMode === 'walkin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <UserPlus size={13} />当日来客
              </button>
              <button onClick={() => setCustMode('search')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${custMode === 'search' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <User size={13} />登録顧客
              </button>
            </div>

            {/* 当日来客 */}
            {custMode === 'walkin' && !selectedCust && (
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="お名前（任意）"
                value={walkInName} onChange={e => setWalkInName(e.target.value)}
              />
            )}

            {/* 登録顧客検索 */}
            {custMode === 'search' && !selectedCust && (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="名前・電話で検索" value={custQuery} onChange={e => setCustQuery(e.target.value)} />
                {filteredCustomers.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredCustomers.map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-gray-100 last:border-0 text-sm">
                        <span className="font-bold text-gray-800">{c.name}</span>
                        {c.school_name && <span className="text-gray-400 ml-1.5 text-xs">{c.school_name}</span>}
                        {c.tel && <span className="text-gray-400 ml-1.5 text-xs">{c.tel}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 選択済み顧客 */}
            {selectedCust && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5">
                <User size={16} className="text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{selectedCust.name}</p>
                  {selectedCust.school_name && <p className="text-xs text-gray-400">{selectedCust.school_name}</p>}
                </div>
                {custLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                <button onClick={clearCustomer} className="p-1 text-gray-400"><X size={16} /></button>
              </div>
            )}

            {/* 未払いアイテム */}
            {(unpaidRepairs.length > 0 || unpaidOrders.length > 0) && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">未払い（タップで追加）</p>
                {unpaidRepairs.map(r => (
                  <button key={r.id}
                    onClick={() => addLine({ source_type: 'repair', source_id: r.id, name: `お直し: ${r.label}`, unit_price: r.price, qty: 1 })}
                    className={`w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 text-sm active:scale-[0.98] transition-all ${
                      cart.some(l => l.source_type === 'repair' && l.source_id === r.id)
                        ? 'bg-gray-100 border-gray-200 opacity-50'
                        : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                    }`}>
                    <Scissors size={13} className="text-amber-500 shrink-0" />
                    <span className="flex-1 text-left text-gray-700 truncate">{r.label}</span>
                    <span className="font-bold text-gray-900">{yen(r.price)}</span>
                    {cart.some(l => l.source_type === 'repair' && l.source_id === r.id)
                      ? <Check size={14} className="text-emerald-500" />
                      : <Plus size={14} className="text-amber-500" />}
                  </button>
                ))}
                {unpaidOrders.map(o => {
                  const inCart = cart.some(l => (l.source_type === 'order' || l.source_type === 'deposit') && l.source_id === o.id)
                  return (
                    <div key={o.id}
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm transition-all ${inCart ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-teal-50 border-teal-200'}`}>
                      <button
                        onClick={() => addLine({ source_type: 'order', source_id: o.id, name: `${o.label}${o.paid > 0 ? '（残金）' : ''}`, unit_price: o.remaining, qty: 1 })}
                        disabled={inCart}
                        className="w-full flex items-center gap-2 active:scale-[0.98] transition-all">
                        <Package size={13} className="text-teal-500 shrink-0" />
                        <span className="flex-1 text-left text-gray-700 truncate">{o.label}</span>
                        <span className="font-bold text-gray-900">{yen(o.remaining)}</span>
                        {inCart ? <Check size={14} className="text-emerald-500" /> : <Plus size={14} className="text-teal-500" />}
                      </button>
                      <div className="flex items-center justify-between mt-1 pl-5">
                        <span className="text-[10px] text-gray-400">
                          総額 {yen(o.total)}{o.paid > 0 ? ` ／ 入金済 ${yen(o.paid)}` : ''}
                        </span>
                        {!inCart && (
                          <button onClick={() => { setDepositFor(o); setDepositStr('') }}
                            className="text-[11px] font-bold text-teal-700 bg-teal-100 rounded-lg px-2 py-1 active:scale-95">
                            内金で支払う
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 手入力 ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">手入力</p>
            <div className="flex gap-2">
              <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="品名" value={manName} onChange={e => setManName(e.target.value)} />
              <input className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-right"
                type="number" inputMode="numeric" placeholder="金額" value={manPrice} onChange={e => setManPrice(e.target.value)} />
              <button
                onClick={() => {
                  if (!manName.trim() || !(Number(manPrice) > 0)) return
                  addLine({ source_type: 'manual', source_id: null, name: manName.trim(), unit_price: Number(manPrice), qty: 1 })
                  setManName(''); setManPrice('')
                }}
                className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 active:scale-95">
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* ── 商品マスタ ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">商品マスタ</p>

            {/* カテゴリタブ */}
            {categories.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
                <button onClick={() => setActiveCategory(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${!activeCategory ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  すべて
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Tag size={10} />{cat}
                  </button>
                ))}
              </div>
            )}

            {/* 検索 */}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="商品名・バーコードで検索" value={prodQuery} onChange={e => setProdQuery(e.target.value)} />
            </div>

            {/* 商品グリッド（タップで数量+1。数量バッジと−ボタン付き） */}
            {filteredProducts.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-6">
                {products.length === 0 ? '商品マスタが未登録です' : '該当なし'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {filteredProducts.map(p => {
                  const qty = productQty(p.id)
                  return (
                    <div key={p.id} className="relative">
                      <button
                        onClick={() => addLine({ source_type: 'product', source_id: p.id, name: p.name, unit_price: p.price, qty: 1 })}
                        className={`w-full text-left rounded-xl px-3 py-2.5 border active:scale-[0.97] transition-all ${qty > 0 ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50'}`}>
                        <p className="text-xs font-bold text-gray-800 leading-snug pr-6" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {p.category ?? ''}{p.barcode ? ' ・ 🏷' : ''}
                          {p.stock != null && (
                            <span className={`ml-1 font-bold ${p.stock <= 0 ? 'text-red-500' : p.stock <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                              {p.stock <= 0 ? '在庫切れ' : `在庫${p.stock}`}
                            </span>
                          )}
                        </p>
                        <div className="flex items-end justify-between mt-1">
                          <p className="text-indigo-600 font-black text-sm">{yen(p.price)}</p>
                          {qty > 0 && (
                            <span className="min-w-6 h-6 px-1.5 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                              {qty}
                            </span>
                          )}
                        </div>
                      </button>
                      {qty > 0 && (
                        <button onClick={() => decProduct(p.id)}
                          aria-label={`${p.name} を1つ減らす`}
                          className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border border-gray-300 shadow flex items-center justify-center text-gray-600 active:scale-90">
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── カートバー（固定） ──────────────────────────────── */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-0 px-4 pb-2 z-20">
        <button
          onClick={() => setScreen(cart.length > 0 ? 'cart' : 'pos')}
          disabled={cart.length === 0}
          className={`w-full max-w-lg mx-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl transition-all ${
            cart.length > 0
              ? 'bg-indigo-600 text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-default'
          }`}>
          <ShoppingCart size={20} />
          <span className="font-black flex-1 text-left">
            {cart.length > 0 ? `${cart.length}点` : 'カートは空'}
          </span>
          {cart.length > 0 && (
            <>
              <span className="font-black text-lg">{yen(total)}</span>
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>

      {/* ── 内金の金額入力 ──────────────────────────────────── */}
      {depositFor && (
        <div className="fixed inset-0 z-[85] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setDepositFor(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="font-black text-gray-900">内金を受け取る</p>
            <p className="text-xs text-gray-500">{depositFor.label} ／ 残額 {yen(depositFor.remaining)}</p>
            <input
              type="number" inputMode="numeric" autoFocus placeholder="0"
              value={depositStr} onChange={e => setDepositStr(e.target.value)}
              className="w-full text-right text-3xl font-black text-gray-900 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500"
            />
            <div className="grid grid-cols-3 gap-2">
              {[Math.round(depositFor.remaining / 2), 5000, 10000].map((v, i) => (
                <button key={i} onClick={() => setDepositStr(String(Math.min(v, depositFor.remaining)))}
                  className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold active:scale-95">
                  {i === 0 ? '半額' : yen(v)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDepositFor(null)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 text-sm font-bold">キャンセル</button>
              <button onClick={confirmDeposit} className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold">カートに追加</button>
            </div>
          </div>
        </div>
      )}

      {/* ── スキャナー ──────────────────────────────────────── */}
      {scannerOpen && (
        <BarcodeScannerSheet
          title="商品スキャン"
          hint="商品のバーコード・QRを枠に合わせると自動でカートに入ります（連続スキャンOK）"
          continuous
          onDetect={handleScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* ── 未登録コードの紐付けシート ─────────────────────── */}
      {linkCode && (
        <div className="fixed inset-0 z-[85] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setLinkCode(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <Link2 size={18} className="text-indigo-500" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900">未登録のコードです</p>
                <p className="text-xs text-gray-400 truncate">コード: {linkCode}</p>
              </div>
              <button onClick={() => setLinkCode(null)} className="p-1 text-gray-400"><X size={22} /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-500 leading-relaxed">
                このコードを商品に紐付けると、次回からスキャンだけでカートに入ります。紐付ける商品を選んでください。
              </p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="商品名で検索" value={linkQuery} onChange={e => setLinkQuery(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                {products
                  .filter(p => !linkQuery.trim() || p.name.includes(linkQuery.trim()) || (p.category ?? '').includes(linkQuery.trim()))
                  .slice(0, 30)
                  .map(p => (
                    <button key={p.id} disabled={linkSaving} onClick={() => linkCodeToProduct(p)}
                      className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 active:bg-indigo-50 text-left disabled:opacity-50">
                      <Package size={15} className="text-gray-400 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-gray-800 truncate">{p.name}</span>
                        <span className="block text-[10px] text-gray-400 truncate">
                          {p.category ?? ''}{p.barcode ? ` ・ 登録済コードを上書き: ${p.barcode}` : ''}
                        </span>
                      </span>
                      <span className="text-sm font-black text-indigo-600 shrink-0">{yen(p.price)}</span>
                    </button>
                  ))}
                {products.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">商品マスタが未登録です。マスタ管理から商品を追加してください。</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => { setScannerOpen(true); setLinkCode(null) }}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">
                紐付けずにスキャンへ戻る
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
