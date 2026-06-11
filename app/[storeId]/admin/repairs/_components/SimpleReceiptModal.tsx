'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, Check, Loader2, QrCode, Phone } from 'lucide-react'
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

// 未登録お客様の新規登録モード
type NewCustMode = null | 'qr' | 'phone'

interface Props {
  storeId: string
  onClose: () => void
  onCreated: () => void
}

export function SimpleReceiptModal({ storeId, onClose, onCreated }: Props) {
  const [categories,   setCategories]   = useState<Category[]>([])
  const [presets,      setPresets]      = useState<Preset[]>([])
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [customer,     setCustomer]     = useState<CustResult | null>(null)
  const [custSearch,   setCustSearch]   = useState('')
  const [custResults,  setCustResults]  = useState<CustResult[]>([])
  const [searchDone,   setSearchDone]   = useState(false)
  const [newCustMode,  setNewCustMode]  = useState<NewCustMode>(null)
  const [newName,      setNewName]      = useState('')
  const [newTel,       setNewTel]       = useState('')
  const [regLoading,   setRegLoading]   = useState(false)
  const [price,        setPrice]        = useState('')
  const [priceManual,  setPriceManual]  = useState(false)
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const liffId   = process.env.NEXT_PUBLIC_LIFF_ID ?? ''
  const liffUrl  = `https://liff.line.me/${liffId}/${storeId}`
  const qrSrc    = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(liffUrl)}`

  // Load presets + categories
  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: pres }] = await Promise.all([
        (supabase as any).from('repair_item_categories')
          .select('id, name').eq('store_id', storeId).eq('is_active', true).order('sort_order'),
        (supabase as any).from('repair_price_presets')
          .select('id, item_name, repair_type, default_price, category_id, sort_order')
          .eq('store_id', storeId).eq('is_active', true).order('sort_order'),
      ])
      setCategories(cats ?? [])
      setPresets(pres ?? [])
    }
    load()
  }, [storeId])

  // Auto-update price from selected presets (unless manually edited)
  useEffect(() => {
    if (priceManual) return
    const sum = presets.filter(p => selectedIds.has(p.id)).reduce((s, p) => s + (p.default_price ?? 0), 0)
    setPrice(sum > 0 ? String(sum) : '')
  }, [selectedIds, presets, priceManual])

  // Customer search with debounce
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); setSearchDone(false); return }
    setSearchDone(false)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, line_user_id')
        .eq('store_id', storeId).is('deleted_at', null)
        .or(`name.ilike.%${custSearch}%,tel.ilike.%${custSearch}%`)
        .order('created_at', { ascending: false }).limit(8)
      setCustResults(data ?? [])
      setSearchDone(true)
    }, 350)
  }, [custSearch, storeId])

  const togglePreset = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // 電話番号で新規顧客登録
  const handleRegisterPhone = async () => {
    if (!newName.trim()) return
    setRegLoading(true)
    try {
      const { data: c, error: err } = await (supabase as any).from('customers').insert({
        store_id: storeId,
        name: newName.trim(),
        tel:  newTel.trim() || null,
      }).select('id, name, tel, line_user_id').single()
      if (err) throw new Error(err.message)
      setCustomer(c as CustResult)
      setNewCustMode(null)
      setNewName(''); setNewTel('')
      setCustSearch('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setRegLoading(false)
    }
  }

  // 受付登録（電話モード中の場合は先に顧客登録してから受付）
  const handleSubmit = async () => {
    if (selectedIds.size === 0) { setError('お直し内容を選択してください'); return }
    setError('')
    setSubmitting(true)
    try {
      // 電話モードで未登録の場合はここで顧客を作成
      let finalCustomer = customer
      if (!finalCustomer && newCustMode === 'phone') {
        if (!newName.trim()) { setError('お名前を入力してください'); setSubmitting(false); return }
        const { data: c, error: regErr } = await (supabase as any).from('customers').insert({
          store_id: storeId,
          name: newName.trim(),
          tel:  newTel.trim() || null,
        }).select('id, name, tel, line_user_id').single()
        if (regErr) throw new Error(regErr.message)
        finalCustomer = c as CustResult
        setCustomer(finalCustomer)
      }
      if (!finalCustomer) { setError('お客様を選択してください'); setSubmitting(false); return }

      const selected   = presets.filter(p => selectedIds.has(p.id))
      const itemName   = selected.map(p => p.item_name).join(' / ')
      const repairType = selected[0]?.repair_type ?? 'other'
      const finalPrice = price ? parseInt(price, 10) : null
      const { error: insertErr } = await (supabase as any).from('repair_histories').insert({
        store_id:      storeId,
        customer_id:   finalCustomer.id,
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

  // Preset grouping
  const groups: { cat: Category | null; items: Preset[] }[] = []
  categories.forEach(cat => {
    const items = presets.filter(p => p.category_id === cat.id)
    if (items.length > 0) groups.push({ cat, items })
  })
  const uncategorized = presets.filter(p => !p.category_id)
  if (uncategorized.length > 0) groups.push({ cat: null, items: uncategorized })

  const selectedList = presets.filter(p => selectedIds.has(p.id))
  const autoSum = selectedList.reduce((s, p) => s + (p.default_price ?? 0), 0)
  const noResults = searchDone && custSearch.trim().length > 0 && custResults.length === 0

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
                {selectedIds.size}項目 · 合計 ¥{autoSum.toLocaleString()}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:scale-95">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── お客様 ── */}
          <section>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">お客様</p>

            {customer ? (
              /* 選択済み */
              <div className="flex items-center justify-between bg-indigo-50 border-2 border-indigo-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-white">{customer.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{customer.name}</p>
                    {customer.tel && <p className="text-xs text-gray-500">{customer.tel}</p>}
                    <p className="text-[10px] font-medium mt-0.5">
                      {customer.line_user_id
                        ? <span className="text-green-600">LINE連携済み</span>
                        : <span className="text-gray-400">電話受付</span>}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setCustomer(null); setNewCustMode(null) }}
                  className="text-xs text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-indigo-100 active:scale-95">
                  変更
                </button>
              </div>
            ) : (
              /* 検索 */
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" value={custSearch}
                    onChange={e => { setCustSearch(e.target.value); setNewCustMode(null) }}
                    placeholder="お客様名・電話番号で検索"
                    className="w-full pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>

                {/* 検索結果 */}
                {custResults.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {custResults.map(c => (
                      <button key={c.id}
                        onClick={() => { setCustomer(c); setCustSearch(''); setCustResults([]) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 active:bg-indigo-100 border-b border-gray-100 last:border-0 text-left transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-gray-600">{c.name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                          {c.tel && <p className="text-xs text-gray-400">{c.tel}</p>}
                        </div>
                        {c.line_user_id
                          ? <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-full shrink-0">LINE</span>
                          : <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">電話</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* 見つからない時 → 2択 */}
                {noResults && newCustMode === null && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <p className="text-xs font-bold text-amber-800 mb-2">「{custSearch}」は見つかりませんでした</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setNewCustMode('qr')}
                        className="flex flex-col items-center gap-1.5 px-3 py-3 bg-white border-2 border-green-300 rounded-xl active:scale-95 transition-all">
                        <QrCode size={20} className="text-green-600" />
                        <span className="text-xs font-bold text-green-700">LINEで登録</span>
                        <span className="text-[10px] text-gray-400">QRコードを表示</span>
                      </button>
                      <button onClick={() => { setNewCustMode('phone'); setNewName(custSearch) }}
                        className="flex flex-col items-center gap-1.5 px-3 py-3 bg-white border-2 border-indigo-300 rounded-xl active:scale-95 transition-all">
                        <Phone size={20} className="text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-700">電話で受付</span>
                        <span className="text-[10px] text-gray-400">LINE不要</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* QRコード表示 */}
                {newCustMode === 'qr' && (
                  <div className="bg-white border-2 border-green-200 rounded-2xl px-4 py-4 text-center">
                    <p className="text-xs font-bold text-gray-700 mb-3">お客様のスマホでQRコードを読み取ってもらい、LINEで友達登録＋会員登録を完了させてください</p>
                    <img src={qrSrc} alt="登録QR" width={180} height={180}
                      className="mx-auto rounded-xl bg-white p-1 shadow-sm border border-gray-100" />
                    <p className="text-[10px] text-gray-400 mt-2">登録後、名前または電話番号で検索してください</p>
                    <button onClick={() => setNewCustMode(null)}
                      className="mt-2 text-xs text-gray-500 underline">戻る</button>
                  </div>
                )}

                {/* 電話受付フォーム */}
                {newCustMode === 'phone' && (
                  <div className="bg-white border-2 border-indigo-200 rounded-2xl px-4 py-4 space-y-3">
                    <p className="text-xs font-bold text-gray-700">お名前と電話番号を入力して仮登録します</p>
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">お名前 <span className="text-red-500">*</span></label>
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                        placeholder="例：山田 太郎"
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">電話番号（任意）</label>
                      <input type="tel" inputMode="tel" value={newTel} onChange={e => setNewTel(e.target.value)}
                        placeholder="例：090-1234-5678"
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setNewCustMode(null)}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold active:scale-95">
                        戻る
                      </button>
                      <button onClick={handleRegisterPhone} disabled={regLoading || !newName.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 flex items-center justify-center gap-1.5 active:scale-95">
                        {regLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                        登録して選択
                      </button>
                    </div>
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
                          <button key={p.id} onClick={() => togglePreset(p.id)}
                            className={`relative flex flex-col items-start px-3.5 py-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                              sel ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-200' : 'border-gray-200 bg-white'
                            }`}>
                            {sel && (
                              <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                                <Check size={9} className="text-white" strokeWidth={3} />
                              </span>
                            )}
                            <span className={`text-sm font-bold leading-snug pr-5 ${sel ? 'text-indigo-700' : 'text-gray-800'}`}>
                              {p.item_name}
                            </span>
                            {p.default_price != null
                              ? <span className={`text-xs mt-1 font-semibold ${sel ? 'text-indigo-500' : 'text-gray-400'}`}>¥{p.default_price.toLocaleString()}</span>
                              : <span className="text-xs mt-1 text-gray-300">価格未設定</span>}
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
              <input type="number" inputMode="numeric" value={price}
                onChange={e => { setPriceManual(true); setPrice(e.target.value) }}
                placeholder="0"
                className="flex-1 text-xl font-black text-gray-900 bg-transparent focus:outline-none placeholder:text-gray-300" />
              {priceManual && autoSum > 0 && price !== String(autoSum) && (
                <button onClick={() => { setPriceManual(false); setPrice(String(autoSum)) }}
                  className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-1 rounded-lg shrink-0">
                  ¥{autoSum.toLocaleString()}に戻す
                </button>
              )}
            </div>
            {selectedIds.size > 0 && autoSum > 0 && !priceManual && (
              <p className="text-xs text-gray-400 mt-1 px-1">プリセットの合計が自動入力されました</p>
            )}
          </section>

          {/* ── メモ ── */}
          <section>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">メモ（任意）</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="仕上がりの目安・特記事項など" rows={2}
              className="w-full px-3.5 py-3 border-2 border-gray-200 rounded-2xl text-sm resize-none focus:outline-none focus:border-indigo-400 transition-colors" />
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</p>
          )}
        </div>

        {/* ── 受付ボタン ── */}
        <div className="px-5 pt-3 pb-5 border-t border-gray-100 shrink-0"
          style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
          {(() => {
            const phoneReady = newCustMode === 'phone' && newName.trim().length > 0
            const canSubmit  = (!!customer || phoneReady) && selectedIds.size > 0
            return (
              <button onClick={handleSubmit} disabled={submitting || !canSubmit}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-base disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-indigo-600/30">
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" />受付中...</>
                  : phoneReady && !customer ? '登録して受付する' : '受付する'}
              </button>
            )
          })()}
        </div>

      </div>
    </div>
  )
}
