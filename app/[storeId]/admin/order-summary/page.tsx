'use client'

// ============================================================
// 発注数量集計ページ
// uniform_orders を メーカー→学校→商品→サイズ で集計し
// 発注書作成に使える一覧を表示する
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Package, RefreshCw, Copy, Check, Filter,
  ChevronDown, ChevronUp, School, ClipboardList, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../_components/BottomNav'
import type { UniformOrderRow } from '../repairs/_components/types'
import { buildUniformMakerHierarchy } from '../repairs/_components/utils'

const STATUS_LABELS: Record<string, string> = {
  pending:    '受付中',
  confirmed:  '確定',
  on_order:   '発注済み',
  arrived:    '入荷済み',
  delivered:  '渡し済み',
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'on_order', 'arrived']

export default function OrderSummaryPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [orders, setOrders]           = useState<UniformOrderRow[]>([])
  const [loading, setLoading]         = useState(false)
  const [filterStatus, setFilterStatus] = useState<'active' | 'all'>('active')
  const [filterMaker, setFilterMaker] = useState<string>('all')
  const [openMakers, setOpenMakers]   = useState<Set<string>>(new Set())
  const [copied, setCopied]           = useState(false)
  const [yearFilter, setYearFilter]   = useState<string>('all')

  const fetchOrders = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const query = (supabase as any)
        .from('uniform_orders')
        .select(`
          id, store_id, customer_id, child_id, maker, priority, status,
          payment_status, total_amount, notes, expected_delivery_date,
          created_at, updated_at,
          customer:customers(id, name, tel),
          child:children(name, school_name),
          items:uniform_order_items(item_name, size_label, quantity, unit_price)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (filterStatus === 'active') {
        query.in('status', ACTIVE_STATUSES)
      }

      const { data } = await query
      setOrders(data ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [storeId, filterStatus])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // メーカー一覧
  const makerOptions = useMemo(() => {
    const set = new Set<string>()
    orders.forEach(o => set.add(o.maker?.trim() || '（メーカー未設定）'))
    return Array.from(set).sort()
  }, [orders])

  // 年度一覧（created_at の年度）
  const yearOptions = useMemo(() => {
    const set = new Set<string>()
    orders.forEach(o => {
      const y = new Date(o.created_at).getFullYear()
      const m = new Date(o.created_at).getMonth() + 1
      // 4月始まりの年度
      const fy = m >= 4 ? y : y - 1
      set.add(`${fy}`)
    })
    return Array.from(set).sort().reverse()
  }, [orders])

  // フィルタ済み orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filterMaker !== 'all') {
        const mk = o.maker?.trim() || '（メーカー未設定）'
        if (mk !== filterMaker) return false
      }
      if (yearFilter !== 'all') {
        const y = new Date(o.created_at).getFullYear()
        const m = new Date(o.created_at).getMonth() + 1
        const fy = m >= 4 ? y : y - 1
        if (`${fy}` !== yearFilter) return false
      }
      return true
    })
  }, [orders, filterMaker, yearFilter])

  const hierarchy = useMemo(() => buildUniformMakerHierarchy(filteredOrders), [filteredOrders])

  const totalItems = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (o.items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0), 0),
    [filteredOrders]
  )

  const toggleMaker = (mk: string) => {
    setOpenMakers(prev => {
      const next = new Set(prev)
      next.has(mk) ? next.delete(mk) : next.add(mk)
      return next
    })
  }

  const expandAll = () => setOpenMakers(new Set(hierarchy.map(m => m.maker)))
  const collapseAll = () => setOpenMakers(new Set())

  // テキストコピー用
  const buildSummaryText = () => {
    const lines: string[] = [
      `【発注数量集計】${new Date().toLocaleDateString('ja-JP')} 現在`,
      `対象: ${filterStatus === 'active' ? '手配中' : '全件'} / 件数: ${filteredOrders.length}受注 (${totalItems}点)`,
      '',
    ]
    for (const me of hierarchy) {
      lines.push(`■ ${me.maker}（合計 ${me.totalCount}点）`)
      for (const se of me.schools) {
        lines.push(`  ▼ ${se.school_name}（${se.totalCount}点）`)
        for (const ie of se.items) {
          const sizeStr = ie.sizes.map(z => `${z.size ?? 'サイズ未定'}×${z.count}`).join(' / ')
          lines.push(`    ${ie.item_name}: ${sizeStr}  合計${ie.totalCount}点`)
        }
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-28">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-gray-900">発注数量集計</h1>
            <p className="text-[11px] text-gray-500">制服注文の集計・発注書作成</p>
          </div>
          <button onClick={fetchOrders} className="p-2 rounded-xl hover:bg-gray-100" title="更新">
            <RefreshCw size={15} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-3 max-w-lg mx-auto">

        {/* フィルター */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-700">絞り込み</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* ステータス */}
            <div className="col-span-3 sm:col-span-1">
              <label className="text-[11px] text-gray-500 font-bold mb-1 block">対象</label>
              <div className="flex gap-1.5">
                {(['active', 'all'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`flex-1 text-xs font-bold py-1.5 rounded-xl transition-colors ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {s === 'active' ? '手配中のみ' : '全件'}
                  </button>
                ))}
              </div>
            </div>
            {/* メーカー */}
            <div>
              <label className="text-[11px] text-gray-500 font-bold mb-1 block">メーカー</label>
              <select value={filterMaker} onChange={e => setFilterMaker(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl px-2 py-1.5 bg-gray-50">
                <option value="all">すべて</option>
                {makerOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {/* 年度 */}
            <div>
              <label className="text-[11px] text-gray-500 font-bold mb-1 block">年度</label>
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl px-2 py-1.5 bg-gray-50">
                <option value="all">すべて</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}年度</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* サマリーバー */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Package size={16} className="text-indigo-500 shrink-0" />
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-indigo-700">
                <Loader2 size={14} className="animate-spin" />集計中...
              </div>
            ) : (
              <>
                <p className="text-sm font-black text-indigo-800">
                  {filteredOrders.length}受注 / 合計 {totalItems}点
                </p>
                <p className="text-[11px] text-indigo-600">{hierarchy.length}メーカー</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={expandAll} className="text-[10px] font-bold text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-100">全開</button>
            <button onClick={collapseAll} className="text-[10px] font-bold text-gray-500 px-2 py-1 rounded-lg hover:bg-gray-100">全閉</button>
            <button onClick={handleCopy}
              className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? '済' : 'コピー'}
            </button>
          </div>
        </div>

        {/* 集計テーブル: メーカー別 */}
        {!loading && hierarchy.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <ClipboardList size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">対象の制服注文がありません</p>
          </div>
        )}

        {hierarchy.map(me => (
          <div key={me.maker} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* メーカーヘッダー */}
            <button
              onClick={() => toggleMaker(me.maker)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-left">
              <Package size={14} className="text-indigo-400 shrink-0" />
              <span className="text-sm font-black text-gray-900 flex-1">{me.maker}</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {me.totalCount}点
              </span>
              {openMakers.has(me.maker)
                ? <ChevronUp size={14} className="text-gray-400" />
                : <ChevronDown size={14} className="text-gray-400" />
              }
            </button>

            {openMakers.has(me.maker) && (
              <div className="border-t border-gray-100">
                {me.schools.map(se => (
                  <div key={se.school_name} className="px-4 py-3 border-b border-gray-50 last:border-b-0">
                    <div className="flex items-center gap-2 mb-2">
                      <School size={12} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-700">{se.school_name}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{se.totalCount}点</span>
                    </div>
                    <div className="space-y-1.5 pl-4">
                      {se.items.map(ie => (
                        <div key={ie.item_name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-800">{ie.item_name}</span>
                            <span className="text-[10px] font-black text-gray-600">{ie.totalCount}点</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {ie.sizes
                              .sort((a, b) => (a.size ?? '').localeCompare(b.size ?? '', 'ja'))
                              .map(ze => (
                                <div key={ze.size ?? '__none__'}
                                  className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1">
                                  <span className="text-[10px] text-indigo-700 font-bold">{ze.size ?? 'サイズ未定'}</span>
                                  <span className="text-[11px] font-black text-indigo-900">×{ze.count}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 注文一覧（コンパクト） */}
        {!loading && filteredOrders.length > 0 && (
          <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700 hover:bg-gray-50">
              <ClipboardList size={14} className="text-gray-400" />
              個別注文一覧（{filteredOrders.length}件）
            </summary>
            <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {filteredOrders.map(o => (
                <div key={o.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 truncate">{o.customer?.name ?? '—'}</span>
                      {o.child && (
                        <span className="text-[10px] text-gray-500 truncate">{o.child.name} / {o.child.school_name}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(o.items ?? []).map((item, i) => (
                        <span key={i} className="text-[10px] bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">
                          {item.item_name} {item.size_label ? `(${item.size_label})` : ''} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    o.status === 'arrived' ? 'bg-emerald-100 text-emerald-700' :
                    o.status === 'on_order' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

      </div>

      <BottomNav />
    </div>
  )
}
