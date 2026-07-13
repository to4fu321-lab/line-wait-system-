'use client'

// ============================================================
// 取引履歴 — 会計の一覧 / 明細 / 取消（レジ訂正） / レシート再発行
//   取消時は関連データも巻き戻す:
//     ・お直し/注文の支払ステータスを未払いへ
//     ・注文の入金履歴(order_payments)を削除し paid/partial を再計算
//     ・在庫管理中の商品在庫を戻す
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Loader2, Printer, X, Ban, RotateCcw, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../../_components/BottomNav'
import { ReceiptView, ReceiptPrintStyle } from '../_components/ReceiptView'
import {
  PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, SOURCE_TYPE_LABELS,
  type Sale, type SaleItem, type ReceiptData, type PaymentMethod,
} from '@/types/sales'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
const dateStr = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

type SaleRow = Sale & { items: SaleItem[] }

export default function SalesHistoryPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [day, setDay] = useState(() => dateStr(new Date()))
  const [sales, setSales] = useState<SaleRow[]>([])
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map())
  const [custNames, setCustNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<SaleRow | null>(null)
  const [voidTarget, setVoidTarget] = useState<SaleRow | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [reprint, setReprint] = useState<{ data: ReceiptData; sale: SaleRow } | null>(null)
  const [reprintKind, setReprintKind] = useState<'receipt' | 'invoice'>('receipt')
  const [storeName, setStoreName] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const db = supabase as any
    const from = new Date(`${day}T00:00:00`)
    const to = new Date(from); to.setDate(to.getDate() + 1)
    const [{ data: rows }, { data: store }] = await Promise.all([
      db.from('sales').select('*, items:sale_items(*)')
        .eq('store_id', storeId)
        .gte('created_at', from.toISOString()).lt('created_at', to.toISOString())
        .order('created_at', { ascending: false }),
      db.from('stores').select('name, invoice_number').eq('id', storeId).single(),
    ])
    const list = (rows ?? []) as SaleRow[]
    setSales(list)
    setStoreName(store?.name ?? '')
    setInvoiceNumber(store?.invoice_number ?? null)

    // 担当者・顧客の名前解決
    const staffIds = Array.from(new Set(list.map(s => s.staff_id).filter(Boolean))) as string[]
    const custIds  = Array.from(new Set(list.map(s => s.customer_id).filter(Boolean))) as string[]
    const [stf, cst] = await Promise.all([
      staffIds.length ? db.from('staff').select('id, name').in('id', staffIds) : Promise.resolve({ data: [] }),
      custIds.length ? db.from('customers').select('id, name').in('id', custIds) : Promise.resolve({ data: [] }),
    ])
    setStaffNames(new Map(((stf.data ?? []) as any[]).map(r => [r.id, r.name])))
    setCustNames(new Map(((cst.data ?? []) as any[]).map(r => [r.id, r.name])))
    setLoading(false)
  }, [storeId, day])

  useEffect(() => { load() }, [load])

  const shiftDay = (delta: number) => {
    const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + delta)
    setDay(dateStr(d))
  }

  const summary = useMemo(() => {
    const ok = sales.filter(s => s.status === 'completed')
    return { count: ok.length, total: ok.reduce((s, x) => s + (x.total || 0), 0), voided: sales.length - ok.length }
  }, [sales])

  // ── 取消 ────────────────────────────────────────────────────
  const doVoid = async () => {
    if (!voidTarget) return
    setVoiding(true)
    const db = supabase as any
    try {
      // 1. 会計を取消状態へ（実際に更新できたか検証）
      const { data: upd, error } = await db.from('sales')
        .update({ status: 'voided', voided_at: new Date().toISOString(), void_reason: voidReason.trim() || null })
        .eq('id', voidTarget.id).eq('status', 'completed').select('id')
      if (error) throw error
      if (!upd || upd.length === 0) throw new Error('更新できませんでした（既に取消済み、またはスタッフ認証切れ）')

      const items = voidTarget.items ?? []

      // 2. お直しを未払いへ戻す
      const repairIds = items.filter(i => i.source_type === 'repair' && i.source_id).map(i => i.source_id)
      if (repairIds.length) await db.from('repair_histories').update({ payment_status: 'unpaid' }).in('id', repairIds)

      // 3. 注文: この会計の入金履歴を消し、残りの入金で paid/partial/unpaid を再計算
      const orderIds = Array.from(new Set(
        items.filter(i => (i.source_type === 'order' || i.source_type === 'deposit') && i.source_id).map(i => i.source_id)
      )) as string[]
      if (orderIds.length) {
        await db.from('order_payments').delete().eq('sale_id', voidTarget.id)
        const [{ data: ords }, { data: pays }] = await Promise.all([
          db.from('uniform_orders').select('id, total_amount').in('id', orderIds),
          db.from('order_payments').select('order_id, amount').in('order_id', orderIds),
        ])
        const paidBy = ((pays ?? []) as any[]).reduce((m: Map<string, number>, p: any) => {
          m.set(p.order_id, (m.get(p.order_id) ?? 0) + (Number(p.amount) || 0)); return m
        }, new Map<string, number>())
        for (const o of (ords ?? []) as any[]) {
          const paid = paidBy.get(o.id) ?? 0
          const st = paid <= 0 ? 'unpaid' : paid >= (o.total_amount ?? 0) ? 'paid' : 'partial'
          await db.from('uniform_orders').update({ payment_status: st }).eq('id', o.id)
        }
      }

      // 4. 在庫を戻す（在庫管理中の商品のみ。RPC側で stock IS NULL は無視される）
      const prodLines = items.filter(i => i.source_type === 'product' && i.source_id)
      if (prodLines.length) {
        await Promise.all(prodLines.map(i =>
          db.rpc('adjust_product_stock', { p_product_id: i.source_id, p_delta: i.qty })))
      }

      setToast(`${voidTarget.sale_number ?? ''} を取り消しました`)
      setVoidTarget(null); setVoidReason(''); setDetail(null)
      load()
    } catch (e) {
      setToast(`取消に失敗: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setVoiding(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  // ── 再発行 ──────────────────────────────────────────────────
  const openReprint = (s: SaleRow) => {
    setReprint({
      sale: s,
      data: {
        saleId: s.id, saleNumber: s.sale_number ?? '', createdAt: new Date(s.created_at),
        lines: (s.items ?? []).map(i => ({ key: i.id, name: i.name, qty: i.qty, unit_price: i.unit_price })),
        subtotal: s.subtotal, tax: s.tax, total: s.total, discount: s.discount ?? 0,
        taxRate: Number(s.tax_rate), payment: s.payment_method as PaymentMethod,
        cashReceived: s.cash_received, change: s.change,
        custName: s.customer_id ? (custNames.get(s.customer_id) ?? null) : null,
      },
    })
    setReprintKind('receipt')
  }

  // ============================================================
  // 再発行ビュー
  // ============================================================
  if (reprint) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setReprint(null)} className="p-1 -ml-1 text-gray-500"><ChevronLeft size={22} /></button>
          <div className="flex gap-2">
            {(['receipt', 'invoice'] as const).map(k => (
              <button key={k} onClick={() => setReprintKind(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${reprintKind === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {k === 'receipt' ? 'レシート' : '領収書'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 rounded-xl text-xs font-bold text-white">
            <Printer size={14} />印刷
          </button>
        </div>
        {reprint.sale.status === 'voided' && (
          <p className="max-w-sm mx-auto w-full px-5 pt-3 text-xs font-bold text-red-500">
            ⚠ この会計は取消済みです（再発行しないでください）
          </p>
        )}
        <div className="flex-1">
          <ReceiptView
            storeName={storeName} invoiceNumber={invoiceNumber}
            kind={reprintKind} data={reprint.data}
            receiptName={reprint.sale.receipt_name ?? reprint.data.custName ?? ''}
            receiptNote={reprint.sale.receipt_note ?? ''}
          />
        </div>
        <BottomNav />
        <ReceiptPrintStyle />
      </div>
    )
  }

  // ============================================================
  // 一覧
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm font-bold shadow-2xl whitespace-nowrap">
          {toast}
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <Link href={`/${storeId}/admin/register`} className="p-1 -ml-1 text-gray-400"><ChevronLeft size={22} /></Link>
        <h1 className="font-black text-base text-gray-900">取引履歴</h1>
        <div className="flex-1" />
        <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
        <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 bg-white" />
        <button onClick={() => shiftDay(1)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 py-3 space-y-2 flex-1">
        {/* サマリ */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-4 text-sm">
          <div><p className="text-[10px] text-gray-400 font-bold">会計数</p><p className="font-black text-gray-900">{summary.count}件</p></div>
          <div><p className="text-[10px] text-gray-400 font-bold">売上（税込）</p><p className="font-black text-gray-900">{yen(summary.total)}</p></div>
          {summary.voided > 0 && (
            <div><p className="text-[10px] text-gray-400 font-bold">取消</p><p className="font-black text-red-500">{summary.voided}件</p></div>
          )}
        </div>

        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 size={26} className="animate-spin text-gray-300" /></div>
        ) : sales.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">この日の会計はありません</p>
        ) : (
          sales.map(s => (
            <button key={s.id} onClick={() => setDetail(s)}
              className={`w-full bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 text-left active:scale-[0.99] transition-all ${s.status === 'voided' ? 'opacity-50' : ''}`}>
              <span className="text-xl shrink-0">{PAYMENT_METHOD_ICONS[s.payment_method as PaymentMethod] ?? '💴'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {(s.items ?? []).map(i => i.name).join('、') || '(明細なし)'}
                </p>
                <p className="text-[11px] text-gray-400">
                  {new Date(s.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  {' ・ '}{s.sale_number}
                  {s.customer_id && custNames.get(s.customer_id) ? ` ・ ${custNames.get(s.customer_id)}様` : ''}
                  {s.staff_id && staffNames.get(s.staff_id) ? ` ・ 担当:${staffNames.get(s.staff_id)}` : ''}
                </p>
              </div>
              {s.status === 'voided' && <span className="text-[10px] font-black text-red-500 bg-red-50 rounded-md px-1.5 py-0.5 shrink-0">取消済</span>}
              <span className={`font-black shrink-0 ${s.status === 'voided' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{yen(s.total)}</span>
            </button>
          ))
        )}
      </div>

      {/* ── 明細シート ──────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900">{detail.sale_number}</p>
                <p className="text-xs text-gray-400">{new Date(detail.created_at).toLocaleString('ja-JP')}</p>
              </div>
              {detail.status === 'voided' && <span className="text-[11px] font-black text-red-500 bg-red-50 rounded-md px-2 py-1">取消済</span>}
              <button onClick={() => setDetail(null)} className="p-1 text-gray-400"><X size={22} /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              {detail.customer_id && custNames.get(detail.customer_id) && (
                <p className="text-sm text-gray-600 flex items-center gap-1.5"><User size={14} className="text-gray-400" />{custNames.get(detail.customer_id)} 様</p>
              )}
              <div className="space-y-1">
                {(detail.items ?? []).map(i => (
                  <div key={i.id} className="flex justify-between text-sm py-0.5">
                    <span className="min-w-0 truncate pr-2">
                      <span className="text-[10px] text-gray-400 mr-1">[{SOURCE_TYPE_LABELS[i.source_type] ?? i.source_type}]</span>
                      {i.name}{i.qty > 1 ? ` ×${i.qty}` : ''}
                    </span>
                    <span className="shrink-0 font-bold">{yen(i.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 space-y-1 text-sm">
                {(detail.discount ?? 0) > 0 && <div className="flex justify-between text-rose-500"><span>値引き</span><span>-{yen(detail.discount)}</span></div>}
                <div className="flex justify-between text-gray-500"><span>消費税（{Number(detail.tax_rate)}%）</span><span>{yen(detail.tax)}</span></div>
                <div className="flex justify-between font-black text-lg"><span>合計</span><span>{yen(detail.total)}</span></div>
                <div className="flex justify-between text-gray-500">
                  <span>{PAYMENT_METHOD_LABELS[detail.payment_method as PaymentMethod]}</span>
                  <span>{detail.cash_received != null ? `預 ${yen(detail.cash_received)} / 釣 ${yen(detail.change ?? 0)}` : ''}</span>
                </div>
                {detail.staff_id && staffNames.get(detail.staff_id) && (
                  <div className="flex justify-between text-gray-400 text-xs"><span>担当</span><span>{staffNames.get(detail.staff_id)}</span></div>
                )}
                {detail.note && <p className="text-xs text-gray-400">メモ: {detail.note}</p>}
                {detail.status === 'voided' && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">
                    {new Date(detail.voided_at ?? '').toLocaleString('ja-JP')} に取消{detail.void_reason ? ` ／ 理由: ${detail.void_reason}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex gap-2" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => { openReprint(detail); setDetail(null) }}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Printer size={15} />再発行
              </button>
              {detail.status === 'completed' && (
                <button onClick={() => { setVoidTarget(detail); setVoidReason('') }}
                  className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold flex items-center justify-center gap-1.5 border border-red-200">
                  <Ban size={15} />取消（レジ訂正）
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 取消確認 ────────────────────────────────────────── */}
      {voidTarget && (
        <div className="fixed inset-0 z-[75] bg-black/60 flex items-center justify-center p-5" onClick={() => !voiding && setVoidTarget(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="font-black text-gray-900 flex items-center gap-2"><Ban size={18} className="text-red-500" />会計を取り消しますか？</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {voidTarget.sale_number}（{yen(voidTarget.total)}）を取消します。
              レジ締めの集計から除外され、お直し・注文の支払状態や在庫も元に戻ります。この操作は取り消せません。
            </p>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400"
              placeholder="取消理由（例: 打ち間違い・返品）" value={voidReason} onChange={e => setVoidReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button disabled={voiding} onClick={() => setVoidTarget(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 text-sm font-bold">やめる</button>
              <button disabled={voiding} onClick={doVoid}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {voiding ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}取り消す
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
