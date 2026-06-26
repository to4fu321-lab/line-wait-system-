'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Loader2, ChevronDown, ChevronLeft,
  User, Check, X, Search, Camera, ScanLine, Plus, ShoppingCart,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { compressImage } from './utils'
import type { CustResult, CartItem } from './types'
import { CustomerLinkSheet } from './CustomerLinkSheet'
import { RecentCustomers, type RecentCust } from '../../_components/RecentCustomers'

export function NewOrderModal({ storeId, onClose, onSave, onToast }: {
  storeId: string; onClose: () => void; onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  type OStep = 'customer' | 'products' | 'confirm'
  const [step,       setStep]       = useState<OStep>('customer')
  const [confirmStep, setConfirmStep] = useState(0) // confirm内サブステップ
  const [linkSheetOpen, setLinkSheetOpen] = useState(false) // 顧客インライン紐付け
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
  // 電話番号で登録（いつでも・電話番号でOK）
  const [phoneMode, setPhoneMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTel, setNewTel] = useState('')
  const [registering, setRegistering] = useState(false)

  const handlePhoneRegister = async () => {
    const tel = newTel.trim()
    const digits = tel.replace(/[-\s]/g, '')
    if (!newName.trim()) { onToast('err', 'お名前を入力してください'); return }
    if (!/^\d{10,11}$/.test(digits)) { onToast('err', '電話番号は10〜11桁で入力してください'); return }
    setRegistering(true)
    const sel = 'id, name, tel, school_name, children:children(id, name, school_name)'
    const { data: rows } = await (supabase as any).from('customers')
      .select(sel).eq('store_id', storeId).eq('tel', tel).is('deleted_at', null).limit(1)
    let cust: CustResult | undefined = rows?.[0]
    if (!cust) {
      const { data: c, error } = await (supabase as any).from('customers')
        .insert({ store_id: storeId, name: newName.trim(), tel }).select(sel).single()
      if (error) { setRegistering(false); onToast('err', error.message ?? '登録に失敗しました'); return }
      cust = c as CustResult
    }
    setSelectedCust(cust!); setSelectedChild(null)
    setShowReg(false); setPhoneMode(false); setNewName(''); setNewTel(''); setRegistering(false)
  }
  const [showReg,       setShowReg]       = useState(false)

  const [priority,     setPriority]     = useState<'normal' | 'new_student'>('normal')
  const [maker,        setMaker]        = useState('')
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
      const base64    = await compressImage(file)
      const storePin  = sessionStorage.getItem(`admin_pin_${storeId}`) ?? ''
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', slipType: 'order', storeId, storePin }),
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
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const orderId = crypto.randomUUID()
    const { error: oErr } = await (supabase as any).from('uniform_orders').insert({
      id: orderId, store_id: storeId,
      customer_id: selectedCust?.id ?? null, child_id: selectedChild?.id ?? null,
      maker: maker.trim() || null,
      priority,
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
  const progressPercent = step === 'confirm'
    ? Math.round(((2 + curConfirmIdx + 1) / (2 + confirmStepDefs.length)) * 100)
    : Math.round(((steps.indexOf(step) + 1) / (2 + confirmStepDefs.length)) * 100)

  // confirm サブステップ（区分→納期→支払/メモ→確認）
  const confirmStepDefs = [
    { key: 'priority', label: '区分' },
    { key: 'delivery', label: '納期' },
    { key: 'pay',      label: '支払・メモ' },
    { key: 'review',   label: '確認' },
  ] as const
  const curConfirmIdx = Math.min(confirmStep, confirmStepDefs.length - 1)
  const curConfirmKey = confirmStepDefs[curConfirmIdx].key
  const isLastConfirm = curConfirmKey === 'review'
  const goBackConfirm = () => { if (curConfirmIdx <= 0) setStep('products'); else setConfirmStep(curConfirmIdx - 1) }
  const goNextConfirm = () => { if (curConfirmIdx < confirmStepDefs.length - 1) setConfirmStep(curConfirmIdx + 1) }

  return (
    <>
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full flex flex-col" style={{ maxHeight: '95dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <input ref={orderFileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrOrder(f); e.target.value = '' }} />
          <div className="flex items-center gap-3">
            <button onClick={step === 'customer' ? onClose : step === 'confirm' ? goBackConfirm : () => setStep('customer')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors active:scale-95">
              {step === 'customer' ? <X size={22} className="text-gray-600" /> : <ChevronLeft size={22} className="text-gray-600" />}
            </button>
            <div>
              <h2 className="text-lg font-black text-gray-800">📋 制服・用品注文</h2>
              <p className="text-sm text-gray-400">
                {step === 'confirm' ? confirmStepDefs[curConfirmIdx].label : stepLabels[step]}{'　'}
                {step === 'confirm' ? (2 + curConfirmIdx + 1) : (steps.indexOf(step) + 1)} / {2 + confirmStepDefs.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step !== 'customer' && selectedCust && (
              <button onClick={() => setLinkSheetOpen(true)}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 max-w-[80px] truncate shrink-0">
                👤 {selectedChild?.name ?? selectedCust.name}
              </button>
            )}
            <button onClick={() => orderFileRef.current?.click()} disabled={ocrLoading}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-violet-100 hover:bg-violet-200 active:scale-95 transition-all disabled:opacity-60">
              {ocrLoading ? <Loader2 size={16} className="text-violet-600 animate-spin" /> : <Camera size={16} className="text-violet-600" />}
            </button>
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 shrink-0">
          <div className="h-full bg-teal-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* OCR 警告バナー（注文モーダル） */}
          {ocrWarnings.length > 0 && (
            <div className="mx-5 mt-4 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 space-y-1">
              <p className="text-xs font-black text-amber-700 flex items-center gap-1.5"><ScanLine size={13} />確認が必要な箇所</p>
              {ocrWarnings.map((w, i) => <p key={i} className="text-xs text-amber-600 pl-4">・{w}</p>)}
            </div>
          )}

          {/* ── Step 1: 商品選択 ── */}
          {step === 'products' && (
            <div className="flex flex-col h-full">
              <div className="px-5 pt-5 pb-3">
                <p className="text-xl font-black text-gray-800">商品を選択してください</p>
              </div>
              {/* 学校タブ */}
              <div className="flex gap-1 px-3 py-2 overflow-x-auto shrink-0 border-b border-gray-100">
                {schools.map(s => (
                  <button key={s.id} onClick={() => setSchoolId(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                      schoolId === s.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                                inCart ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-800 hover:border-teal-300'
                              }`}>
                              <span>{v.size_label}</span>
                              <span className={`text-xs ${inCart ? 'text-teal-200' : 'text-gray-500'}`}>
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
            </div>
          )}

          {/* ── Step 2: 顧客選択 ── */}
          {step === 'customer' && (
            <div className="px-5 py-6 space-y-3">
              <p className="text-xl font-black text-gray-800 mb-1">どのお客様ですか？</p>
              {!selectedCust ? (
                <>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)}
                      placeholder="顧客名で検索" autoFocus
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:border-teal-500 focus:outline-none" />
                  </div>
                  {searching && <div className="text-center py-4"><Loader2 size={20} className="animate-spin text-teal-400 mx-auto" /></div>}
                  <RecentCustomers
                    storeId={storeId}
                    visible={custSearch.trim() === '' && !showReg}
                    withChildren
                    onPick={(c: RecentCust, ch) => { setSelectedCust({ id: c.id, name: c.name, tel: c.tel, school_name: c.school_name ?? null, children: c.children }); setSelectedChild(ch); setShowReg(false) }}
                  />
                  <div className="space-y-2">
                    {custResults.map(c => (
                      (c.children && c.children.length > 0) ? (
                        c.children.map(ch => (
                          <button key={ch.id} onClick={() => { setSelectedCust(c); setSelectedChild(ch); setShowReg(false) }}
                            className="w-full text-left px-4 py-3.5 bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 rounded-2xl transition-all active:scale-[0.98]">
                            {ch.school_name && <p className="text-[10px] font-black text-amber-600">{ch.school_name}</p>}
                            <p className="font-black text-gray-900">{ch.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">保護者: {c.name}{c.tel ? ` · ${c.tel}` : ''}</p>
                          </button>
                        ))
                      ) : (
                        <button key={c.id} onClick={() => { setSelectedCust(c); setSelectedChild(null); setShowReg(false) }}
                          className="w-full text-left px-4 py-3.5 bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 rounded-2xl transition-all active:scale-[0.98]">
                          <p className="font-black text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{[c.school_name, c.tel].filter(Boolean).join(' · ')}</p>
                        </button>
                      )
                    ))}
                  </div>
                  {!showReg && (
                    <button onClick={() => setShowReg(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-amber-300 text-amber-600 text-xs font-bold rounded-xl hover:bg-amber-50 active:scale-[0.98] transition-all">
                      <Plus size={13} />新規顧客を登録する
                    </button>
                  )}
                  {showReg && (
                    <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4 space-y-3">
                      {phoneMode ? (
                        <div className="space-y-2 text-left">
                          <p className="text-xs font-black text-teal-800">電話番号で登録・紐付け</p>
                          <input className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-teal-500" placeholder="お名前" value={newName} onChange={e => setNewName(e.target.value)} />
                          <input className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-teal-500" type="tel" inputMode="numeric" placeholder="電話番号（携帯可）" value={newTel} onChange={e => setNewTel(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={() => { setPhoneMode(false); setNewName(''); setNewTel('') }} className="flex-1 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                            <button onClick={handlePhoneRegister} disabled={registering} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
                              {registering ? <Loader2 size={16} className="animate-spin" /> : '✓'}登録して選択
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setPhoneMode(true); if (!newName && custSearch && !/\d/.test(custSearch)) setNewName(custSearch.trim()) }}
                          className="w-full py-3 rounded-xl bg-teal-600 text-white text-sm font-black flex items-center justify-center gap-1.5">
                          📞 電話番号で登録する
                        </button>
                      )}
                      <div className="border-t border-teal-200 pt-3 text-center space-y-3">
                        <p className="text-xs font-black text-teal-800">またはLINEで登録（QRを読み取ってもらう）</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}/${storeId}`)}`}
                          alt="受付QR" width={200} height={200}
                          className="mx-auto rounded-xl bg-white p-1 shadow-sm"
                        />
                        <p className="text-[10px] text-teal-500 leading-relaxed">LINEで登録後、上の検索欄でお名前を検索してください</p>
                        <button onClick={() => setShowReg(false)}
                          className="w-full py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-white active:scale-[0.98]">
                          閉じる
                        </button>
                      </div>
                    </div>
                  )}
                  {custSearch.length === 0 && !showReg && (
                    <p className="text-sm text-center text-gray-400 py-4">名前を入力して顧客を検索してください</p>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                      <User size={18} className="text-teal-600" />
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
                          className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${!selectedChild ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                          選択しない
                        </button>
                        {selectedCust.children.map(ch => (
                          <button key={ch.id} onClick={() => setSelectedChild(ch)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${selectedChild?.id === ch.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                            {ch.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step 3: 確認 ── */}
          {step === 'confirm' && (
            <div className="px-5 py-6 space-y-4">
              <p className="text-xl font-black text-gray-800 mb-1">
                {curConfirmKey === 'priority' ? '注文区分は？' :
                 curConfirmKey === 'delivery' ? '希望お渡し日は？' :
                 curConfirmKey === 'pay' ? '支払い・備考' : '内容を確認'}
              </p>

              {curConfirmKey === 'review' && (<>
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
                  <div className="px-4 py-2.5 bg-teal-50 flex justify-between">
                    <p className="text-sm font-bold text-teal-700">合計</p>
                    <p className="text-lg font-black text-teal-700">¥{cartTotal.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <div>
                    {selectedCust ? (
                      <p className="text-sm font-bold text-gray-900">{selectedCust.name}</p>
                    ) : (
                      <button onClick={() => setStep('customer')} className="text-sm font-bold text-amber-600">＋ 顧客を紐付け（任意）</button>
                    )}
                    {selectedChild && <p className="text-xs text-gray-500">お子様: {selectedChild.name}</p>}
                  </div>
                </div>
              </>)}

              {curConfirmKey === 'priority' && (
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { val: 'normal' as const, icon: '🎒', label: '在校生・追加', desc: '通常の追加注文' },
                    { val: 'new_student' as const, icon: '🌸', label: '新入生', desc: '納期優先で対応' },
                  ]).map(({ val, icon, label, desc }) => (
                    <button key={val} type="button" onClick={() => setPriority(val)}
                      className={`py-7 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all active:scale-[0.97] ${
                        priority === val
                          ? val === 'new_student' ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-teal-50 border-teal-400 text-teal-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}>
                      <span className="text-3xl">{icon}</span>
                      <span className="text-sm font-black">{label}</span>
                      <span className="text-xs opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>
              )}

              {curConfirmKey === 'delivery' && (
                <div>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {[{ label: '1週間後', days: 7 }, { label: '2週間後', days: 14 }, { label: '1ヶ月後', days: 30 }].map(({ label, days }) => {
                      const d = new Date(); d.setDate(d.getDate() + days)
                      const val = d.toISOString().slice(0, 10)
                      return (
                        <button key={days} type="button" onClick={() => setExpectedDate(val)}
                          className={`text-sm px-4 py-2.5 rounded-xl border-2 font-bold transition-all ${expectedDate === val ? 'bg-teal-600 border-teal-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:border-teal-500 focus:outline-none" />
                </div>
              )}

              {curConfirmKey === 'pay' && (<>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1.5">発注メーカー</label>
                  <input type="text" value={maker} onChange={e => setMaker(e.target.value)}
                    placeholder="例: 菅公学生服、明石スクールユニフォームカンパニー"
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:border-teal-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1.5">備考・メモ</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="申し送り事項など"
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:border-teal-500 focus:outline-none" />
                </div>
                <button type="button" onClick={() => setPrepaid(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all ${prepaid ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-400 bg-red-50'}`}>
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
              </>)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          {step === 'customer' && (
            selectedCust ? (
              <button onClick={() => setStep('products')} style={{ touchAction: 'manipulation' }}
                className="w-full py-5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <Check size={22} />商品を選択する
              </button>
            ) : (
              <button onClick={() => setStep('products')} style={{ touchAction: 'manipulation' }}
                className="w-full py-4 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold text-sm active:scale-[0.98] transition-all hover:bg-gray-50">
                顧客は後で紐付け → 先に商品を選ぶ
              </button>
            )
          )}
          {step === 'products' && cart.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1 text-xs font-bold text-teal-700 whitespace-nowrap shrink-0">
                    {item.productName} {item.sizeLabel} ×{item.qty}
                    <button onClick={() => removeFromCart(item.variantId, idx)} className="ml-0.5 text-teal-400 hover:text-teal-700"><X size={11} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => { setStep('confirm'); setConfirmStep(0) }} style={{ touchAction: 'manipulation' }}
                className="w-full py-5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm shadow-teal-600/25">
                <ShoppingCart size={20} />確認へ（{cart.length}点 ¥{cartTotal.toLocaleString()}）
              </button>
            </div>
          )}
          {step === 'confirm' && (
            <div className="flex gap-2">
              <button onClick={goBackConfirm} style={{ touchAction: 'manipulation' }}
                className="flex-1 py-5 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 font-black text-lg active:scale-[0.98] transition-all">
                戻る
              </button>
              {isLastConfirm ? (
                <button onClick={handleSave} disabled={saving || cart.length === 0} style={{ touchAction: 'manipulation' }}
                  className="flex-[2] py-5 bg-teal-600 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-teal-600/25 active:scale-[0.98] transition-all">
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  登録（{cart.length}点）
                </button>
              ) : (
                <button onClick={goNextConfirm} style={{ touchAction: 'manipulation' }}
                  className="flex-[2] py-5 bg-teal-600 text-white font-black text-lg rounded-2xl active:scale-[0.98] transition-all">
                  次へ
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
    {linkSheetOpen && (
      <CustomerLinkSheet
        storeId={storeId}
        selectedCust={selectedCust}
        selectedChild={selectedChild}
        onSelect={(c, ch) => { setSelectedCust(c); setSelectedChild(ch) }}
        onClear={() => { setSelectedCust(null); setSelectedChild(null) }}
        onClose={() => setLinkSheetOpen(false)}
      />
    )}
    </>
  )
}
