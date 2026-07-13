'use client'

// ============================================================
// 売上日報・集計 — 日 / 月 の売上サマリと内訳、CSV出力
//   集計対象は status='completed' のみ（取消は件数だけ表示）。
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Download, BarChart3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../../_components/BottomNav'
import {
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SOURCE_TYPE_LABELS,
  type Sale, type SaleItem, type PaymentMethod, type SaleSourceType,
} from '@/types/sales'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
const dateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

type SaleRow = Sale & { items: SaleItem[] }
type Mode = 'day' | 'month'

export default function SalesReportPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [mode, setMode] = useState<Mode>('day')
  const [day, setDay] = useState(() => dateStr(new Date()))
  const [month, setMonth] = useState(() => monthStr(new Date()))
  const [sales, setSales] = useState<SaleRow[]>([])
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map())
  const [prodCategory, setProdCategory] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const range = useMemo((): { from: Date; to: Date; label: string } => {
    if (mode === 'day') {
      const from = new Date(`${day}T00:00:00`)
      const to = new Date(from); to.setDate(to.getDate() + 1)
      return { from, to, label: day }
    }
    const from = new Date(`${month}-01T00:00:00`)
    const to = new Date(from); to.setMonth(to.getMonth() + 1)
    return { from, to, label: month }
  }, [mode, day, month])

  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const db = supabase as any
    const [{ data: rows }, { data: prods }] = await Promise.all([
      db.from('sales').select('*, items:sale_items(*)')
        .eq('store_id', storeId)
        .gte('created_at', range.from.toISOString()).lt('created_at', range.to.toISOString())
        .order('created_at', { ascending: true }),
      db.from('products').select('id, category').eq('store_id', storeId),
    ])
    const list = (rows ?? []) as SaleRow[]
    setSales(list)
    setProdCategory(new Map(((prods ?? []) as any[]).map(p => [p.id, p.category ?? '未分類'])))
    const staffIds = Array.from(new Set(list.map(s => s.staff_id).filter(Boolean))) as string[]
    if (staffIds.length) {
      const { data: stf } = await db.from('staff').select('id, name').in('id', staffIds)
      setStaffNames(new Map(((stf ?? []) as any[]).map(r => [r.id, r.name])))
    } else {
      setStaffNames(new Map())
    }
    setLoading(false)
  }, [storeId, range])

  useEffect(() => { load() }, [load])

  const shift = (delta: number) => {
    if (mode === 'day') {
      const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + delta); setDay(dateStr(d))
    } else {
      const d = new Date(`${month}-01T00:00:00`); d.setMonth(d.getMonth() + delta); setMonth(monthStr(d))
    }
  }

  // ── 集計 ────────────────────────────────────────────────────
  const agg = useMemo(() => {
    const done = sales.filter(s => s.status === 'completed')
    const total = done.reduce((s, x) => s + (x.total || 0), 0)
    const discount = done.reduce((s, x) => s + (x.discount || 0), 0)
    const byMethod = new Map<PaymentMethod, { amount: number; count: number }>()
    const byStaff = new Map<string, { amount: number; count: number }>()
    const byCategory = new Map<string, { amount: number; qty: number }>()
    const byItem = new Map<string, { amount: number; qty: number }>()
    for (const s of done) {
      const m = s.payment_method as PaymentMethod
      const bm = byMethod.get(m) ?? { amount: 0, count: 0 }
      bm.amount += s.total || 0; bm.count += 1; byMethod.set(m, bm)
      const sk = s.staff_id ?? ''
      const bs = byStaff.get(sk) ?? { amount: 0, count: 0 }
      bs.amount += s.total || 0; bs.count += 1; byStaff.set(sk, bs)
      for (const i of s.items ?? []) {
        const cat = i.source_type === 'product'
          ? (i.source_id ? (prodCategory.get(i.source_id) ?? '未分類') : '未分類')
          : (SOURCE_TYPE_LABELS[i.source_type as SaleSourceType] ?? i.source_type)
        const bc = byCategory.get(cat) ?? { amount: 0, qty: 0 }
        bc.amount += i.line_total || 0; bc.qty += i.qty || 0; byCategory.set(cat, bc)
        const bi = byItem.get(i.name) ?? { amount: 0, qty: 0 }
        bi.amount += i.line_total || 0; bi.qty += i.qty || 0; byItem.set(i.name, bi)
      }
    }
    return {
      count: done.length, total, discount,
      avg: done.length ? Math.round(total / done.length) : 0,
      voided: sales.length - done.length,
      byMethod, byStaff,
      byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1].amount - a[1].amount),
      topItems: Array.from(byItem.entries()).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10),
    }
  }, [sales, prodCategory])

  // ── CSV出力（明細単位）──────────────────────────────────────
  const exportCsv = () => {
    const rows: string[][] = [[
      '会計番号', '日時', '状態', '支払方法', '担当者', '顧客ID',
      '明細種別', '品名', '単価', '数量', '行合計', '会計値引', '会計合計',
    ]]
    for (const s of sales) {
      const base = [
        s.sale_number ?? '', new Date(s.created_at).toLocaleString('ja-JP'),
        s.status === 'voided' ? '取消' : '完了',
        PAYMENT_METHOD_LABELS[s.payment_method as PaymentMethod] ?? s.payment_method,
        s.staff_id ? (staffNames.get(s.staff_id) ?? '') : '',
        s.customer_id ?? '',
      ]
      const items = s.items ?? []
      if (items.length === 0) {
        rows.push([...base, '', '', '', '', '', String(s.discount ?? 0), String(s.total)])
      }
      for (const i of items) {
        rows.push([
          ...base,
          SOURCE_TYPE_LABELS[i.source_type as SaleSourceType] ?? i.source_type,
          i.name, String(i.unit_price), String(i.qty), String(i.line_total),
          String(s.discount ?? 0), String(s.total),
        ])
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    // Excel で文字化けしないよう BOM を付ける
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `売上明細_${range.label}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      <div className="sticky top-0 z-30 bg-white border-b" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <Link href={`/${storeId}/admin/register`} className="p-1 -ml-1 text-gray-400"><ChevronLeft size={22} /></Link>
          <BarChart3 size={18} className="text-indigo-500" />
          <h1 className="font-black text-base text-gray-900 flex-1">売上日報</h1>
          <button onClick={exportCsv} disabled={sales.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-40">
            <Download size={13} />CSV
          </button>
        </div>
        <div className="px-4 pb-2.5 flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([['day', '日'], ['month', '月']] as [Mode, string][]).map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${mode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
          {mode === 'day' ? (
            <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 bg-white" />
          ) : (
            <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 bg-white" />
          )}
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 grid place-items-center"><Loader2 size={26} className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="max-w-lg mx-auto w-full px-4 py-3 space-y-3">
          {/* サマリ */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] text-gray-400 font-bold">売上（税込）</p>
              <p className="text-2xl font-black text-gray-900">{yen(agg.total)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] text-gray-400 font-bold">会計数 / 客単価</p>
              <p className="text-2xl font-black text-gray-900">{agg.count}<span className="text-xs font-bold text-gray-400 ml-1">件</span></p>
              <p className="text-[11px] text-gray-400 font-bold">{yen(agg.avg)}/件{agg.voided > 0 ? ` ・ 取消${agg.voided}件` : ''}{agg.discount > 0 ? ` ・ 値引計 ${yen(agg.discount)}` : ''}</p>
            </div>
          </div>

          {/* 支払方法別 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">支払方法別</p>
            {PAYMENT_METHODS.filter(m => agg.byMethod.has(m)).map(m => {
              const v = agg.byMethod.get(m)!
              return (
                <div key={m} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 font-bold">{PAYMENT_METHOD_LABELS[m]}<span className="text-[10px] text-gray-400 ml-1.5">{v.count}件</span></span>
                  <span className="font-black text-gray-900">{yen(v.amount)}</span>
                </div>
              )
            })}
            {agg.byMethod.size === 0 && <p className="text-xs text-gray-400 text-center py-3">データなし</p>}
          </div>

          {/* 担当者別 */}
          {agg.byStaff.size > 0 && agg.count > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">担当者別</p>
              {Array.from(agg.byStaff.entries()).sort((a, b) => b[1].amount - a[1].amount).map(([sid, v]) => (
                <div key={sid || 'none'} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 font-bold">{sid ? (staffNames.get(sid) ?? '不明') : '未選択'}<span className="text-[10px] text-gray-400 ml-1.5">{v.count}件</span></span>
                  <span className="font-black text-gray-900">{yen(v.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* カテゴリ別 */}
          {agg.byCategory.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">カテゴリ別（明細ベース）</p>
              {agg.byCategory.map(([cat, v]) => (
                <div key={cat} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 font-bold">{cat}<span className="text-[10px] text-gray-400 ml-1.5">{v.qty}点</span></span>
                  <span className="font-black text-gray-900">{yen(v.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 売れ筋 */}
          {agg.topItems.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">売れ筋（数量順）</p>
              {agg.topItems.map(([name, v], i) => (
                <div key={name} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 font-bold truncate pr-2"><span className="text-gray-300 mr-1.5">{i + 1}</span>{name}</span>
                  <span className="shrink-0 text-gray-500 text-xs font-bold">{v.qty}点<span className="font-black text-gray-900 ml-2">{yen(v.amount)}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
