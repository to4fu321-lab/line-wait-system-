'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, Check, Loader2, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { todayJst } from './utils'

interface Preset {
  id: string
  item_name: string
  repair_type: string
  default_price: number | null
  category_id: string | null
  sort_order: number
}

interface Category {
  id: string
  name: string
}

interface CustResult {
  id: string
  name: string
  tel: string | null
  line_user_id: string | null
}

interface Props {
  storeId: string
  onClose: () => void
  onCreated: () => void
}

export function SimpleReceiptModal({ storeId, onClose, onCreated }: Props) {
  const [categories,      setCategories]      = useState<Category[]>([])
  const [presets,         setPresets]         = useState<Preset[]>([])
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [customer,        setCustomer]        = useState<CustResult | null>(null)
  const [custSearch,      setCustSearch]      = useState('')
  const [custResults,     setCustResults]     = useState<CustResult[]>([])
  const [price,           setPrice]           = useState('')
  const [priceManual,     setPriceManual]     = useState(false)
  const [notes,           setNotes]           = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load presets + categories
  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: pres }] = await Promise.all([
        (supabase as any).from('repair_item_categories')
          .select('id, name')
          .eq('store_id', storeId).eq('is_active', true).order('sort_order'),
        (supabase as any).from('repair_price_presets')
          .select('id, item_name, repair_type, default_price, category_id, sort_order')
          .eq('store_id', storeId).eq('is_active', true).order('sort_order'),
      ])
      setCategories(cats ?? [])
      setPresets(pres ?? [])
    }
    load()
  }, [storeId])

  // Auto-update price when presets change (unless user has manually edited)
  useEffect(() => {
    if (priceManual) return
    const selected = presets.filter(p => selectedIds.has(p.id))
    const sum = selected.reduce((s, p) => s + (p.default_price ?? 0), 0)
    setPrice(sum > 0 ? String(sum) : '')
  }, [selectedIds, presets, priceManual])

  // Customer search debounced
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, line_user_id')
        .eq('store_id', storeId).is('deleted_at', null)
        .or(`name.ilike.%${custSearch}%,tel.ilike.%${custSearch}%`)
        .order('created_at', { ascending: false }).limit(8)
      setCustResults(data ?? [])
    }, 300)
  }, [custSearch, storeId])

  const togglePreset = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePriceChange = (v: string) => {
    setPriceManual(true)
    setPrice(v)
  }

  const handleSubmit = async () => {
    if (!customer)          { setError('お客様を選択してください'); return }
    if (selectedIds.size === 0) { setError('お直し内容を選択してください'); return }
    setError('')
    setSubmitting(true)
    try {
      const selected = presets.filter(p => selectedIds.has(p.id))
      const itemName  = selected.map(p => p.item_name).join(' / ')
      const repairType = selected[0]?.repair_type ?? 'other'
      const finalPrice = price ? parseInt(price, 10) : null

      const { error: insertErr } = await (supabase as any).from('repair_histories').insert({
        store_id:      storeId,
        customer_id:   customer.id,
        item_name:     itemName,
        content:       itemName,
        repair_type:   repairType,
        price:         finalPrice && !isNaN(finalPrice) ? finalPrice : null,
        notes:         notes.trim() || null,
        status:        'received',
        received_date: todayJst(),
      })
      if (insertErr) throw new Error(insertErr.message)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました')
      setSubmitting(false)
    }
  }

  // Group presets by category
  const groups: { cat: Category | null; items: Preset[] }[] = []
  categories.forEach(cat => {
    const items = presets.filter(p => p.category_id === cat.id)
    if (items.length > 0) groups.push({ cat, items })
  })
  const uncategorized = presets.filter(p => !p.category_id)
  if (uncategorized.length > 0) groups.push({ cat: null, items: uncategorized })

  const selectedList = presets.filter(p => selectedIds.has(p.id))
  const autoSum = selectedList.reduce((s, p) => s + (p.default_price ?? 0), 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-gray-900">✂️ お直し受付</h2>
            {selectedIds.size > 0 && (
              <p className="text-xs text-indigo-600 font-medium mt-0.5">
                {selectedIds.size}項目選択中
                {autoSum > 0 && ` · 合計 ¥${autoSum.toLocaleString()}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:scale-95">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── お客様 ── */}
          <section>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">お客様</p>
            {customer ? (
              <div className="flex items-center justify-between bg-indigo-50 border-2 border-indigo-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-white">{customer.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{customer.name}</p>
                    {customer.tel && <p className="text-xs text-gray-500">{customer.tel}</p>}
                    {customer.line_user_id && <p className="text-[10px] text-indigo-500 font-medium">LINE連携済み</p>}
                  </div>
                </div>
                <button onClick={() => setCustomer(null)} className="text-xs text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-indigo-100 active:scale-95 transition-all">変更</button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    placeholder="お客様名・電話番号で検索"
                    className="w-full pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                {custResults.length > 0 && (
                  <div className="mt-1.5 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {custResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCustomer(c); setCustSearch(''); setCustResults([]) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 active:bg-indigo-100 border-b border-gray-100 last:border-0 text-left transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-gray-600">{c.name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                          {c.tel && <p className="text-xs text-gray-400">{c.tel}</p>}
                        </div>
                        {c.line_user_id && <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-full shrink-0">LINE</span>}
                      </button>
                    ))}
                  </div>
                )}
                {custSearch.trim().length > 0 && custResults.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400 px-1">
                    <UserPlus size={13} />
                    <span>見つかりません。顧客管理から先に登録してください。</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── お直し内容 ── */}
          <section>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              お直し内容 <span className="text-gray-400 font-normal normal-case">複数選択できます</span>
            </p>

            {groups.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">
                設定 → お直し料金 からプリセットを追加してください
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map(({ cat, items }) => (
                  <div key={cat?.id ?? '_none'}>
                    {cat && (
                      <p className="text-xs font-black text-gray-700 mb-2 flex items-center gap-1.5">
                        <span className="w-1 h-3.5 bg-indigo-400 rounded-full inline-block" />
                        {cat.name}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {items.map(p => {
                        const sel = selectedIds.has(p.id)
                        return (
                          <button
                            key={p.id}
                            onClick={() => togglePreset(p.id)}
                            className={`relative flex flex-col items-start px-3.5 py-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                              sel
                                ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-200'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            {sel && (
                              <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                                <Check size={9} className="text-white" strokeWidth={3} />
                              </span>
                            )}
                            <span className={`text-sm font-bold leading-snug pr-5 ${sel ? 'text-indigo-700' : 'text-gray-800'}`}>
                              {p.item_name}
                            </span>
                            {p.default_price != null ? (
                              <span className={`text-xs mt-1 font-semibold ${sel ? 'text-indigo-500' : 'text-gray-400'}`}>
                                ¥{p.default_price.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-xs mt-1 text-gray-300">価格未設定</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 金額 ── */}
          <section>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">金額</p>
            <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-indigo-400 transition-colors">
              <span className="text-lg font-black text-gray-400">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={price}
                onChange={e => handlePriceChange(e.target.value)}
                placeholder="0"
                className="flex-1 text-xl font-black text-gray-900 bg-transparent focus:outline-none placeholder:text-gray-300"
              />
              {priceManual && autoSum > 0 && price !== String(autoSum) && (
                <button
                  onClick={() => { setPriceManual(false); setPrice(String(autoSum)) }}
                  className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-1 rounded-lg shrink-0"
                >
                  ¥{autoSum.toLocaleString()}に戻す
                </button>
              )}
            </div>
            {selectedIds.size > 0 && autoSum > 0 && !priceManual && (
              <p className="text-xs text-gray-400 mt-1 px-1">プリセットの合計金額が自動入力されました</p>
            )}
          </section>

          {/* ── メモ ── */}
          <section>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">メモ（任意）</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="仕上がりの目安・特記事項など"
              rows={2}
              className="w-full px-3.5 py-3 border-2 border-gray-200 rounded-2xl text-sm resize-none focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</p>
          )}
        </div>

        {/* ── 受付ボタン ── */}
        <div
          className="px-5 pt-3 pb-5 border-t border-gray-100 shrink-0"
          style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleSubmit}
            disabled={submitting || !customer || selectedIds.size === 0}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-base disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-indigo-600/30"
          >
            {submitting
              ? <><Loader2 size={18} className="animate-spin" />受付中...</>
              : <>受付する</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}
