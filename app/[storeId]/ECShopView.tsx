'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, Minus, Plus, ShoppingCart,
  ChevronDown, ChevronUp, Loader2, X, GraduationCap,
  ChevronRight, AlertCircle,
} from 'lucide-react'
import { useStoreTheme } from '@/lib/theme-context'
import { supabase } from '@/lib/supabase'
import type { School, SchoolProduct, SchoolProductVariant } from '@/types/master'
import type { LiffProfile } from '@/lib/liff'
import { GRADE_OPTIONS } from '@/types/crm'

interface CartItem {
  variantId:   string
  productId:   string
  productName: string
  category:    string | null
  sizeLabel:   string
  unitPrice:   number
  qty:         number
}

interface Props {
  lineProfile:       LiffProfile | null
  storeId:           string
  storeName?:        string
  customerId?:       string | null
  childId?:          string | null
  childName?:        string | null
  childSchoolName?:  string | null
  childGrade?:       string | null
  onBack: () => void
}

export default function ECShopView({
  lineProfile, storeId, storeName,
  customerId, childId,
  childName, childSchoolName: initialSchoolName, childGrade: initialGrade,
  onBack,
}: Props) {
  const theme = useStoreTheme()

  // 学校・商品データ
  const [schools,      setSchools]      = useState<School[]>([])
  const [products,     setProducts]     = useState<SchoolProduct[]>([])
  const [variants,     setVariants]     = useState<Record<string, SchoolProductVariant[]>>({})
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [loadingVar,   setLoadingVar]   = useState<string | null>(null)
  const [dataLoading,  setDataLoading]  = useState(true)
  const [noSchool,     setNoSchool]     = useState(false)

  // 選択中の学校
  const [activeSchoolId,   setActiveSchoolId]   = useState<string | null>(null)

  // 学校・学年（変更可能）
  const [childSchoolName, setChildSchoolName] = useState(initialSchoolName ?? null)
  const [childGrade,      setChildGrade]      = useState(initialGrade ?? null)
  const [showSchoolEdit,  setShowSchoolEdit]  = useState(false)
  const [editSchool,      setEditSchool]      = useState(initialSchoolName ?? '')
  const [editGrade,       setEditGrade]       = useState(initialGrade ?? '')
  const [savingSchool,    setSavingSchool]    = useState(false)

  // カート
  const [cart,        setCart]        = useState<CartItem[]>([])
  const [openCart,    setOpenCart]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [ordering,    setOrdering]    = useState(false)
  const [orderError,  setOrderError]  = useState('')
  const [ordered,     setOrdered]     = useState(false)

  const fetchProducts = useCallback(async (schoolId: string) => {
    const { data } = await (supabase as any)
      .from('school_products').select('*')
      .eq('store_id', storeId).eq('school_id', schoolId).eq('active', true).order('sort_order')
    setProducts(data ?? [])
    setVariants({})
    setExpanded(null)
  }, [storeId])

  // 初期ロード
  useEffect(() => {
    ;(async () => {
      setDataLoading(true)
      const { data: schoolData } = await (supabase as any)
        .from('schools').select('*').eq('store_id', storeId).eq('active', true).order('sort_order')
      const schoolList: School[] = schoolData ?? []
      setSchools(schoolList)

      const matched = initialSchoolName
        ? schoolList.find(s => s.name === initialSchoolName)
        : null
      if (matched) {
        setActiveSchoolId(matched.id)
        await fetchProducts(matched.id)
      } else if (initialSchoolName) {
        setNoSchool(true)
      }
      setDataLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSchoolTab = async (school: School) => {
    if (activeSchoolId === school.id) return
    setActiveSchoolId(school.id)
    setNoSchool(false)
    setDataLoading(true)
    await fetchProducts(school.id)
    setDataLoading(false)
  }

  const loadVariants = async (productId: string) => {
    if (variants[productId]) { setExpanded(expanded === productId ? null : productId); return }
    setLoadingVar(productId)
    const { data } = await (supabase as any)
      .from('school_product_variants').select('*')
      .eq('product_id', productId).eq('active', true).order('sort_order')
    setVariants(prev => ({ ...prev, [productId]: data ?? [] }))
    setExpanded(productId)
    setLoadingVar(null)
  }

  const handleSaveSchool = async () => {
    setSavingSchool(true)
    if (childId) {
      await (supabase as any).from('children').update({
        school_name: editSchool.trim() || null,
        grade: editGrade || null,
        updated_at: new Date().toISOString(),
      }).eq('id', childId)
    }
    setChildSchoolName(editSchool.trim() || null)
    setChildGrade(editGrade || null)
    const matched = schools.find(s => s.name === editSchool.trim())
    if (matched) {
      setActiveSchoolId(matched.id)
      setNoSchool(false)
      setDataLoading(true)
      await fetchProducts(matched.id)
      setDataLoading(false)
    } else {
      setNoSchool(!!editSchool.trim())
    }
    setSavingSchool(false)
    setShowSchoolEdit(false)
  }

  const addToCart = (p: SchoolProduct, v: SchoolProductVariant) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.variantId === v.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, {
        variantId: v.id, productId: p.id, productName: p.item_name,
        category: p.category, sizeLabel: v.size_label, unitPrice: v.price, qty: 1,
      }]
    })
  }

  const changeQty = (variantId: string, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.variantId === variantId)
      if (idx < 0) return prev
      const next = prev[idx].qty + delta
      if (next <= 0) return prev.filter((_, i) => i !== idx)
      return prev.map((i, n) => n === idx ? { ...i, qty: next } : i)
    })
  }

  const totalQty   = cart.reduce((s, i) => s + i.qty, 0)
  const totalPrice = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0)

  const submitOrder = async () => {
    if (!customerId) return
    setOrdering(true); setOrderError('')
    try {
      const orderId = crypto.randomUUID()
      const { error: oErr } = await (supabase as any).from('uniform_orders').insert({
        id: orderId, store_id: storeId,
        customer_id: customerId, child_id: childId ?? null,
        status: 'confirmed', payment_status: 'unpaid',
        total_amount: totalPrice,
      })
      if (oErr) throw new Error(oErr.message)
      const items = cart.map(i => ({
        order_id: orderId, store_id: storeId,
        school_product_id: i.productId,
        item_name: `${i.productName} ${i.sizeLabel}`,
        size_label: i.sizeLabel, quantity: i.qty,
        unit_price: i.unitPrice, status: 'ordered',
      }))
      const { error: iErr } = await (supabase as any).from('uniform_order_items').insert(items)
      if (iErr) throw new Error(iErr.message)
      fetch('/api/push-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, type: 'purchase_new',
          title: '📦 制服注文が届きました',
          body: cart.map(i => `${i.productName} ${i.sizeLabel}`).join('・'),
          url: `/${storeId}/admin/repairs`,
        }),
      }).catch(console.error)
      setOrdered(true)
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : String(e))
    } finally {
      setOrdering(false)
    }
  }

  // ── 未登録 ─────────────────────────────────────────────────
  if (!customerId) return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6 pb-10">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl bg-gray-100">🛍️</div>
      <div>
        <h2 className="text-2xl font-black text-zinc-900 mb-2">会員登録が必要です</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          ご注文には会員登録が必要です。<br />スタッフにお声がけいただくか、<br />受付QRから登録をお願いします。
        </p>
      </div>
      <button onClick={onBack} className="text-zinc-400 text-sm underline active:opacity-60">← 戻る</button>
    </main>
  )

  // ── 注文完了 ───────────────────────────────────────────────
  if (ordered) return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center gap-6 pb-10">
      <div className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
          boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
        <CheckCircle2 size={60} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{storeName}</p>
        <h2 className="text-3xl font-black text-zinc-900 mb-3">注文を受け付けました！</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          スタッフが手配を進めます。<br />準備ができましたら<br />
          <span className="font-bold text-zinc-700">LINEでご連絡</span>します。
        </p>
      </div>
      <div className="bg-zinc-50 rounded-2xl p-5 w-full max-w-sm text-left">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">ご注文内容</p>
        <div className="space-y-2">
          {cart.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-zinc-700">{i.productName} <span className="text-zinc-400">({i.sizeLabel})</span></span>
              <span className="font-bold text-zinc-900">×{i.qty}　¥{(i.unitPrice * i.qty).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-200 mt-3 pt-3 flex justify-between">
          <span className="font-bold text-zinc-600">合計 {totalQty}点</span>
          <span className="text-xl font-black" style={{ color: theme.colors.primary }}>¥{totalPrice.toLocaleString()}</span>
        </div>
      </div>
      <button onClick={onBack} className="text-zinc-400 text-sm underline active:opacity-60">← トップへ戻る</button>
    </main>
  )

  return (
    <main className="min-h-[100dvh]" style={{ paddingBottom: totalQty > 0 ? 148 : 32 }}>
      {/* ヘッダー */}
      <div className="px-5 pt-8 pb-4 text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
            boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          👔
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">制服・用品のご注文</h1>
        <p className="text-zinc-500 text-sm mt-1">お子様の学校の商品をご注文できます</p>
      </div>

      {/* お子様情報バナー（タップで学校変更） */}
      <div className="px-4 mb-3 max-w-md mx-auto">
        <button
          onClick={() => { setEditSchool(childSchoolName ?? ''); setEditGrade(childGrade ?? ''); setShowSchoolEdit(true) }}
          className="w-full bg-white border border-zinc-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm active:scale-[0.99] transition-transform text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `rgb(${theme.colors.primaryRgb} / 0.1)` }}>
            <GraduationCap size={18} style={{ color: theme.colors.primary }} />
          </div>
          <div className="flex-1 min-w-0">
            {childName && <p className="font-black text-zinc-900 text-sm truncate">{childName} さん</p>}
            {childSchoolName ? (
              <p className="text-zinc-500 text-xs truncate">{childSchoolName}{childGrade ? ` · ${childGrade}` : ''}</p>
            ) : (
              <p className="text-amber-600 text-xs font-bold">タップして学校を登録 →</p>
            )}
          </div>
          <span className="text-xs text-zinc-400 shrink-0">変更 ›</span>
        </button>
      </div>

      {/* 学校タブ（複数校対応・進学時の切り替え） */}
      {schools.length > 1 && (
        <div className="px-4 mb-3 max-w-md mx-auto">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {schools.map(s => (
              <button key={s.id} onClick={() => handleSchoolTab(s)}
                className={`flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeSchoolId === s.id ? 'text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-500'
                }`}
                style={activeSchoolId === s.id ? { background: theme.colors.primary } : {}}>
                {s.short_name ?? s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 商品エリア */}
      <div className="px-4 max-w-md mx-auto space-y-3">
        {dataLoading && (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin" style={{ color: theme.colors.primary }} />
          </div>
        )}

        {!dataLoading && !activeSchoolId && !noSchool && (
          <div className="text-center py-12 space-y-3">
            <p className="text-4xl">🏫</p>
            <p className="text-zinc-500 text-sm">上のバナーをタップして<br />学校を登録すると商品が表示されます</p>
          </div>
        )}

        {!dataLoading && noSchool && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-700 text-sm font-bold">「{childSchoolName}」の商品が見つかりません</p>
              <p className="text-amber-600 text-xs mt-0.5">スタッフにご確認ください。</p>
            </div>
          </div>
        )}

        {!dataLoading && activeSchoolId && products.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-12">この学校の商品はまだ登録されていません</p>
        )}

        {!dataLoading && products.map(p => {
          const pVariants = variants[p.id] ?? []
          const isExpanded = expanded === p.id
          const cartQty = cart.filter(i => i.productId === p.id).reduce((s, i) => s + i.qty, 0)
          return (
            <div key={p.id} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm"
              style={cartQty > 0 ? {
                outline: `2px solid rgb(${theme.colors.primaryRgb} / 0.4)`,
                boxShadow: `0 4px 20px -4px rgb(${theme.colors.primaryRgb} / 0.2)`,
              } : {}}>
              <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left" onClick={() => loadVariants(p.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    {p.category && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">{p.category}</span>
                    )}
                    {p.gender && p.gender !== '男女共通' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-500">{p.gender}</span>
                    )}
                    {p.maker_code && <span className="text-[10px] font-mono text-zinc-400">{p.maker_code}</span>}
                  </div>
                  <p className="font-black text-zinc-900 text-sm">{p.item_name}</p>
                  {p.notes && <p className="text-zinc-400 text-xs mt-0.5">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cartQty > 0 && (
                    <span className="text-xs font-black px-2 py-1 rounded-full text-white"
                      style={{ background: theme.colors.primary }}>{cartQty}点</span>
                  )}
                  {loadingVar === p.id
                    ? <Loader2 size={16} className="animate-spin text-zinc-400" />
                    : isExpanded
                      ? <ChevronUp size={16} className="text-zinc-400" />
                      : <ChevronRight size={16} className="text-zinc-400" />
                  }
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-100 px-4 py-3 space-y-2">
                  {pVariants.length === 0 && <p className="text-zinc-400 text-xs text-center py-2">サイズ情報なし</p>}
                  {pVariants.map(v => {
                    const cartItem = cart.find(i => i.variantId === v.id)
                    return (
                      <div key={v.id} className="flex items-center justify-between py-1">
                        <div>
                          <span className="font-bold text-zinc-900 text-sm">{v.size_label}</span>
                          <span className="ml-2 font-black text-sm" style={{ color: theme.colors.primary }}>
                            ¥{v.price.toLocaleString()}
                          </span>
                          {v.stock > 0 && (
                            <span className="ml-2 text-[10px] text-emerald-600 font-bold">在庫{v.stock}</span>
                          )}
                        </div>
                        {cartItem ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => changeQty(v.id, -1)}
                              className="w-8 h-8 rounded-xl border-2 border-zinc-200 flex items-center justify-center active:scale-95 transition-all">
                              <Minus size={12} className="text-zinc-500" />
                            </button>
                            <span className="text-lg font-black text-zinc-900 w-6 text-center">{cartItem.qty}</span>
                            <button onClick={() => changeQty(v.id, 1)}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all"
                              style={{ background: theme.colors.primary }}>
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(p, v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
                            style={{ background: theme.colors.primary }}>
                            <Plus size={13} />追加
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <button onClick={onBack} className="w-full py-3 text-center text-zinc-400 text-sm underline active:opacity-60">← 戻る</button>
      </div>

      {/* カートバー */}
      {totalQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          {openCart && (
            <div className="bg-white border-t border-zinc-100 px-4 py-3 max-h-48 overflow-y-auto">
              <div className="max-w-md mx-auto space-y-2">
                {cart.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700 truncate">{i.productName} <span className="text-zinc-400">({i.sizeLabel})</span></span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button onClick={() => changeQty(i.variantId, -1)}
                        className="w-6 h-6 rounded-full border border-zinc-200 flex items-center justify-center">
                        <Minus size={10} />
                      </button>
                      <span className="font-bold w-4 text-center">{i.qty}</span>
                      <button onClick={() => changeQty(i.variantId, 1)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                        style={{ background: theme.colors.primary }}>
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white/95 backdrop-blur-xl border-t border-zinc-100 px-4 pt-3 pb-6"
            style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.1)' }}>
            <div className="max-w-md mx-auto">
              <button onClick={() => setOpenCart(v => !v)} className="w-full flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <ShoppingCart size={20} className="text-zinc-600" />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                      style={{ background: theme.colors.primary }}>{totalQty}</span>
                  </div>
                  <span className="text-zinc-600 font-bold text-sm">{totalQty}点 選択中</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black" style={{ color: theme.colors.primary }}>¥{totalPrice.toLocaleString()}</span>
                  {openCart ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronUp size={16} className="text-zinc-400" />}
                </div>
              </button>
              <button onClick={() => setShowConfirm(true)} disabled={ordering}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                  boxShadow: `0 8px 24px -6px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
                注文する →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注文確認モーダル */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-[60]">
          <div className="bg-white rounded-t-3xl w-full max-w-md overflow-y-auto" style={{ maxHeight: '85dvh' }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
              <div>
                <p className="font-black text-zinc-900 text-base">注文内容の確認</p>
                <p className="text-zinc-500 text-xs mt-0.5">内容をご確認のうえ注文してください</p>
              </div>
              <button onClick={() => setShowConfirm(false)} className="p-1.5 rounded-xl bg-zinc-100 text-zinc-500"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="space-y-2">
                {cart.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-zinc-50 rounded-xl px-3 py-2.5">
                    <span className="text-zinc-700">{i.productName} <span className="text-zinc-400">({i.sizeLabel})</span></span>
                    <span className="font-bold text-zinc-900 shrink-0 ml-2">×{i.qty}　¥{(i.unitPrice * i.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center border-t border-zinc-100 pt-3">
                <span className="font-bold text-zinc-600">合計 {totalQty}点</span>
                <span className="text-xl font-black" style={{ color: theme.colors.primary }}>¥{totalPrice.toLocaleString()}</span>
              </div>
              {orderError && <p className="text-red-500 text-xs text-center">{orderError}</p>}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={() => setShowConfirm(false)}
                  className="py-3.5 rounded-2xl border-2 border-zinc-200 text-zinc-600 font-bold text-sm active:scale-95 transition-transform">
                  修正する
                </button>
                <button onClick={submitOrder} disabled={ordering}
                  className="py-3.5 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
                  {ordering ? <><Loader2 size={14} className="animate-spin" />送信中...</> : 'この内容で注文する →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 学校・学年 変更モーダル */}
      {showSchoolEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-[60]">
          <div className="bg-white rounded-t-3xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
              <div>
                <p className="font-black text-zinc-900 text-base">学校・学年を変更</p>
                <p className="text-zinc-500 text-xs mt-0.5">進学・転校の際に更新してください</p>
              </div>
              <button onClick={() => setShowSchoolEdit(false)} className="p-1.5 rounded-xl bg-zinc-100 text-zinc-500"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-4 pb-8">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">学校名</label>
                {schools.length > 0 ? (
                  <select value={editSchool} onChange={e => setEditSchool(e.target.value)}
                    className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all">
                    <option value="">選択してください</option>
                    {schools.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                ) : (
                  <input type="text" value={editSchool} onChange={e => setEditSchool(e.target.value)}
                    placeholder="例：○○高等学校"
                    className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all" />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">学年</label>
                <select value={editGrade} onChange={e => setEditGrade(e.target.value)}
                  className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all">
                  <option value="">選択してください</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <button onClick={handleSaveSchool} disabled={savingSchool}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
                {savingSchool ? <><Loader2 size={18} className="animate-spin" />保存中...</> : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
