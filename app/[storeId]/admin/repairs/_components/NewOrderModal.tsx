'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Loader2, ChevronDown, ChevronLeft,
  User, Check, X, Search, Camera, ScanLine, Plus, ShoppingCart,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { compressImage } from './utils'
import type { CustResult, CartItem } from './types'

export function NewOrderModal({ storeId, onClose, onSave, onToast }: {
  storeId: string; onClose: () => void; onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  type OStep = 'customer' | 'products' | 'confirm'
  const [step,       setStep]       = useState<OStep>('customer')
  const [schools,    setSchools]    = useState<{ id: string; name: string }[]>([])
  const [schoolId,   setSchoolId]   = useState<string | null>(null)
  const [products,   setProducts]   = useState<{ id: string; item_name: string; category: string | null; gender: string | null; maker_code: string | null }[]>([])
  const [variants,   setVariants]   = useState<Record<string, { id: string; size_label: string; price: number }[]>>({})
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [cart,       setCart]       = useState<CartItem[]>([])
  const [loadingVar, setLoadingVar] = useState<string | null>(null)

  const [custSearch,    setCustSearch]    = useState('')
  const [custResults,   setCustResults]   = useState<CustResult[]>([])
  const [searching,     setSearching]     = useState(false)
  const [selectedCust,  setSelectedCust]  = useState<CustResult | null>(null)
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string; school_name: string | null } | null>(null)
  const [showReg,       setShowReg]       = useState(false)

  const [notes,        setNotes]        = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [prepaid,      setPrepaid]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [ocrLoading,   setOcrLoading]   = useState(false)
  const [ocrWarnings,  setOcrWarnings]  = useState<string[]>([])
  const orderFileRef = useRef<HTMLInputElement>(null)

  const handleOcrOrder = async (file: File) => {
    setOcrLoading(true); setOcrWarnings([])
    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', slipType: 'order' }),
      })
      const { ok, data, error } = await res.json()
      if (!ok || !data) { onToast('err', `OCR失敗: ${error ?? '不明なエラー'}`); return }

      if (data.customer_name) setCustSearch(data.customer_name)
      if (data.notes) setNotes(data.notes)
      if (data.warnings?.length) setOcrWarnings(data.warnings)
      if (data.items?.length) {
        const itemText = (data.items as { item_name: string; size_label?: string; quantity?: number }[])
          .map(i => `${i.item_name}${i.size_label ? ` ${i.size_label}` : ''}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ''}`)
          .join('、')
        setNotes(prev => [prev, itemText].filter(Boolean).join(' / '))
      }
      setStep('customer')
      onToast('ok', `📷 注文伝票を読み取りました（精度: ${data.confidence === 'high' ? '高' : data.confidence === 'medium' ? '中' : '低'}）`)
    } catch (e) {
      onToast('err', `OCRエラー: ${String(e)}`)
    } finally {
      setOcrLoading(false)
    }
  }

  useEffect(() => {
    ;(supabase as any).from('schools').select('id, name').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: { data: typeof schools }) => setSchools(data ?? []))
  }, [storeId])

  useEffect(() => {
    if (!selectedChild?.school_name || schools.length === 0) return
    const matched = schools.find(s => s.name === selectedChild.school_name)
    setSchoolId(matched?.id ?? schools[0]?.id ?? null)
  }, [selectedChild, schools])

  useEffect(() => {
    if (!schoolId) return
    setProducts([]); setExpanded(null)
    ;(supabase as any).from('school_products').select('id, item_name, category, gender, maker_code')
      .eq('store_id', storeId).eq('school_id', schoolId).eq('active', true).order('sort_order')
      .then(({ data }: { data: typeof products }) => setProducts(data ?? []))
  }, [storeId, schoolId])

  const loadVariants = async (productId: string) => {
    if (variants[productId]) { setExpanded(expanded === productId ? null : productId); return }
    setLoadingVar(productId)
    const { data } = await (supabase as any).from('school_product_variants')
      .select('id, size_label, price').eq('product_id', productId).eq('active', true).order('sort_order')
    setVariants(prev => ({ ...prev, [productId]: data ?? [] }))
    setExpanded(productId)
    setLoadingVar(null)
  }

  const addToCart = (p: typeof products[0], v: { id: string; size_label: string; price: number }) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.variantId === v.id)
      if (existing >= 0) return prev.map((i, idx) => idx === existing ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { variantId: v.id, productId: p.id, productName: p.item_name, category: p.category, sizeLabel: v.size_label, unitPrice: v.price, qty: 1 }]
    })
  }

  const removeFromCart = (variantId: string | null, idx: number) =>
    setCart(prev => prev.filter((_, i) => i !== idx))

  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0)

  useEffect(() => {
    if (custSearch.length < 1) { setCustResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const q = custSearch.trim()
      const qTel = q.replace(/[-\s]/g, '')
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId)
        .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q}%,tel.ilike.%${qTel}%,school_name.ilike.%${q}%`)
        .is('deleted_at', null).limit(8)
      setCustResults(data ?? []); setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch, storeId])

  const handleSave = async () => {
    if (!selectedCust) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const orderId = crypto.randomUUID()
    const { error: oErr } = await (supabase as any).from('uniform_orders').insert({
      id: orderId, store_id: storeId,
      customer_id: selectedCust.id, child_id: selectedChild?.id ?? null,
      status: 'confirmed', payment_status: prepaid ? 'paid' : 'unpaid',
      total_amount: cartTotal, notes: notes.trim() || null,
      expected_delivery_date: expectedDate || null,
    })
    if (oErr) { setSaving(false); onToast('err', '注文登録に失敗しました'); return }
    const items = cart.map(item => ({
      order_id: orderId, store_id: storeId,
      school_product_id: item.productId ?? null,
      item_name: `${item.productName}${item.sizeLabel ? ` ${item.sizeLabel}` : ''}`,
      size_label: item.sizeLabel, quantity: item.qty,
      unit_price: item.unitPrice, status: 'ordered',
    }))
    const { error: iErr } = await (supabase as any).from('uniform_order_items').insert(items)
    setSaving(false)
    if (iErr) { onToast('err', '明細登録に失敗しました'); return }
    fetch('/api/notify-uniform', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniformOrderId: orderId }),
    }).catch(console.error)
    onToast('ok', `${cart.length}点の注文を登録しました`)
    onSave()
  }

  const stepLabels: Record<OStep, string> = { customer: '顧客選択', products: '商品選択', confirm: '確認・登録' }
  const steps: OStep[] = ['customer', 'products', 'confirm']

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div className="bg-white sm:rounded-3xl sm:max-w-lg w-full flex flex-col rounded-t-3xl overflow-hidden" style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <input ref={orderFileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrOrder(f); e.target.value = '' }} />
          <div className="flex items-center gap-3 mb-3">
            <button onClick={step === 'customer' ? onClose : () => setStep(step === 'confirm' ? 'products' : 'customer')}
              className="p-2 -ml-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
              {step === 'customer' ? <X size={18} /> : <ChevronLeft size={18} />}
            </button>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-sm">📋 制服・用品注文</p>
              <p className="text-xs text-gray-400 font-medium">{stepLabels[step]}</p>
            </div>
            <button onClick={() => orderFileRef.current?.click()} disabled={ocrLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-60 shrink-0">
              {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              {ocrLoading ? '解析中...' : '伝票読取'}
            </button>
            {cart.length > 0 && step === 'products' && (
              <button onClick={() => setStep('confirm')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl">
                <ShoppingCart size={13} />{cart.length}点 次へ
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${step === s ? 'flex-1 bg-indigo-600' : i < steps.indexOf(step) ? 'w-6 bg-indigo-300' : 'w-4 bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* OCR 警告バナー（注文モーダル） */}
          {ocrWarnings.length > 0 && (
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 space-y-1">
              <p className="text-xs font-black text-amber-700 flex items-center gap-1.5"><ScanLine size={13} />確認が必要な箇所</p>
              {ocrWarnings.map((w, i) => <p key={i} className="text-xs text-amber-600 pl-4">・{w}</p>)}
            </div>
          )}

          {/* ── Step 1: 商品選択 ── */}
          {step === 'products' && (
            <div className="flex flex-col h-full">
              {/* 学校タブ */}
              <div className="flex gap-1 px-3 py-2 overflow-x-auto shrink-0 border-b border-gray-100">
                {schools.map(s => (
                  <button key={s.id} onClick={() => setSchoolId(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                      schoolId === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {s.name}
                  </button>
                ))}
              </div>
              {/* 商品リスト */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {products.length === 0 && (
                  <p className="text-sm text-center text-gray-400 py-8">この学校の商品がありません<br /><span className="text-xs">マスタページで商品を登録してください</span></p>
                )}
                {products.map(p => (
                  <div key={p.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <button onClick={() => loadVariants(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{p.item_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {p.category && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">{p.category}</span>}
                          {p.gender   && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{p.gender}</span>}
                          {p.maker_code && <span className="text-[10px] text-gray-400 font-mono">{p.maker_code}</span>}
                        </div>
                      </div>
                      {loadingVar === p.id
                        ? <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />
                        : <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${expanded === p.id ? 'rotate-180' : ''}`} />
                      }
                    </button>
                    {expanded === p.id && variants[p.id] && (
                      <div className="border-t border-gray-100 px-4 py-2 grid grid-cols-2 gap-1.5 bg-gray-50">
                        {variants[p.id].length === 0 && (
                          <p className="col-span-2 text-xs text-gray-400 py-2 text-center">サイズ未登録</p>
                        )}
                        {variants[p.id].map(v => {
                          const inCart = cart.find(c => c.variantId === v.id)
                          return (
                            <button key={v.id} onClick={() => addToCart(p, v)}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                                inCart ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-800 hover:border-indigo-300'
                              }`}>
                              <span>{v.size_label}</span>
                              <span className={`text-xs ${inCart ? 'text-indigo-200' : 'text-gray-500'}`}>
                                {inCart ? `×${inCart.qty}` : `¥${v.price.toLocaleString()}`}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* カートフッター */}
              {cart.length > 0 && (
                <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
                  <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1 text-xs font-bold text-indigo-700 whitespace-nowrap shrink-0">
                        {item.productName} {item.sizeLabel} ×{item.qty}
                        <button onClick={() => removeFromCart(item.variantId, idx)} className="ml-0.5 text-indigo-400 hover:text-indigo-700"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">{cart.length}点 合計</p>
                      <p className="font-black text-lg text-gray-900">¥{cartTotal.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setStep('confirm')}
                      className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl active:scale-95 transition-all">
                      次へ →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: 顧客選択 ── */}
          {step === 'customer' && (
            <div className="p-4 space-y-3">
              {!selectedCust ? (
                <>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)}
                      placeholder="顧客名で検索" autoFocus
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                  {searching && <div className="text-center py-4"><Loader2 size={20} className="animate-spin text-indigo-400 mx-auto" /></div>}
                  <div className="space-y-2">
                    {custResults.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCust(c); setShowReg(false) }}
                        className="w-full text-left px-4 py-3.5 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-2xl transition-all active:scale-[0.98]">
                        <p className="font-black text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{[c.school_name, c.tel].filter(Boolean).join(' · ')}</p>
                        {c.children && c.children.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">お子様: {c.children.map(ch => ch.name).join('、')}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* 新規顧客登録（常時表示） */}
                  {!showReg && (
                    <button onClick={() => setShowReg(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-amber-300 text-amber-600 text-xs font-bold rounded-xl hover:bg-amber-50 active:scale-[0.98] transition-all">
                      <Plus size={13} />新規顧客を登録する
                    </button>
                  )}
                  {showReg && (
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-center space-y-3">
                      <p className="text-xs font-black text-indigo-800">お客様にQRを読み取ってもらってください</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}/${storeId}`)}`}
                        alt="受付QR" width={200} height={200}
                        className="mx-auto rounded-xl bg-white p-1 shadow-sm"
                      />
                      <p className="text-[10px] text-indigo-500 leading-relaxed">
                        LINEで登録後、上の検索欄でお名前を検索してください
                      </p>
                      <button onClick={() => setShowReg(false)}
                        className="w-full py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-white active:scale-[0.98]">
                        閉じる
                      </button>
                    </div>
                  )}
                  {custSearch.length === 0 && !showReg && (
                    <p className="text-sm text-center text-gray-400 py-4">名前を入力して顧客を検索してください</p>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <User size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900">{selectedCust.name}</p>
                      {selectedCust.tel && <p className="text-xs text-gray-500">{selectedCust.tel}</p>}
                      {selectedCust.school_name && <p className="text-xs text-gray-400">{selectedCust.school_name}</p>}
                    </div>
                    <button onClick={() => { setSelectedCust(null); setSelectedChild(null); setCustSearch('') }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all">
                      <X size={15} />
                    </button>
                  </div>
                  {selectedCust.children && selectedCust.children.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-2">お子様（任意）</label>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedChild(null)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${!selectedChild ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                          選択しない
                        </button>
                        {selectedCust.children.map(ch => (
                          <button key={ch.id} onClick={() => setSelectedChild(ch)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${selectedChild?.id === ch.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                            {ch.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => setStep('products')}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]">
                    <Check size={18} />次へ：商品を選択する
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: 確認 ── */}
          {step === 'confirm' && (
            <div className="p-4 space-y-4">
              {/* カートサマリー */}
              <div className="bg-gray-50 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-200">
                  <p className="text-xs font-black text-gray-700">注文内容</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.sizeLabel} × {item.qty}</p>
                      </div>
                      <p className="font-black text-gray-900 text-sm shrink-0">¥{(item.unitPrice * item.qty).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 bg-indigo-50 flex justify-between">
                  <p className="text-sm font-bold text-indigo-700">合計</p>
                  <p className="text-lg font-black text-indigo-700">¥{cartTotal.toLocaleString()}</p>
                </div>
              </div>

              {/* 顧客表示 */}
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedCust?.name}</p>
                  {selectedChild && <p className="text-xs text-gray-500">お子様: {selectedChild.name}</p>}
                </div>
              </div>

              {/* 希望お渡し日 */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">希望お渡し日</label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {[{ label: '1週間後', days: 7 }, { label: '2週間後', days: 14 }, { label: '1ヶ月後', days: 30 }].map(({ label, days }) => {
                    const d = new Date(); d.setDate(d.getDate() + days)
                    const val = d.toISOString().slice(0, 10)
                    return (
                      <button key={days} type="button" onClick={() => setExpectedDate(val)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${expectedDate === val ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
                <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>

              {/* メモ */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">備考・メモ</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="申し送り事項など"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>

              {/* 支払い */}
              <button type="button" onClick={() => setPrepaid(v => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${prepaid ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-400 bg-red-50'}`}>
                <div className="text-left">
                  <p className={`font-bold text-sm ${prepaid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {prepaid ? '✅ 支払済み' : '⚠️ 未払い'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">受注時に頂いた場合は「支払済み」に</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${prepaid ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${prepaid ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </div>
              </button>

              <button onClick={handleSave} disabled={saving || cart.length === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                注文を登録する（{cart.length}点 ¥{cartTotal.toLocaleString()}）
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
