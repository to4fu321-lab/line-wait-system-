'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, Minus, Plus, ShoppingCart,
  ChevronDown, ChevronUp, Loader2, X, GraduationCap,
  ChevronRight, AlertCircle,
} from 'lucide-react'
import { useStoreTheme } from '@/lib/theme-context'
import { supabase } from '@/lib/supabase'
import { saveCustomer, placeEcOrder } from '@/lib/customerApi'
import { fetchSchools, fetchSchoolProducts, fetchVariants } from '@/lib/masterApi'
import type { CatalogSchool, CatalogProduct, CatalogVariant } from '@/lib/masterApi'
import type { LiffProfile } from '@/lib/liff'
import { GRADE_OPTIONS } from '@/types/crm'
import { canCustomerOrder } from '@/lib/customerFeatures'

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
  childSchoolId?:    string | null
  childSchoolName?:  string | null
  childGrade?:       string | null
  /** 学校・学年を変更したとき、呼び出し元の children / selectedChild を更新するため */
  onChildUpdated?:   (child: Record<string, unknown>) => void
  onBack: () => void
}

export default function ECShopView({
  lineProfile, storeId, storeName,
  customerId, childId,
  childName, childSchoolId: initialSchoolId, childSchoolName: initialSchoolName,
  childGrade: initialGrade,
  onChildUpdated,
  onBack,
}: Props) {
  const theme = useStoreTheme()

  // 学校・商品データ
  const [schools,      setSchools]      = useState<CatalogSchool[]>([])
  const [products,     setProducts]     = useState<CatalogProduct[]>([])
  const [variants,     setVariants]     = useState<Record<string, CatalogVariant[]>>({})
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [loadingVar,   setLoadingVar]   = useState<string | null>(null)
  const [dataLoading,  setDataLoading]  = useState(true)
  const [noSchool,     setNoSchool]     = useState(false)
  const [planGated,    setPlanGated]    = useState(false)

  // 表示中の学校 = 登録されている在籍校。
  // 他校の商品は注文できない（サーバー側でも弾く）ので、ここを勝手に切り替えさせない。
  // 進学・転校の場合は「学校・学年を変更」で登録そのものを更新する。
  const [activeSchoolId,   setActiveSchoolId]   = useState<string | null>(null)

  // 学校・学年（変更可能）
  const [childSchoolName, setChildSchoolName] = useState(initialSchoolName ?? null)
  const [childGrade,      setChildGrade]      = useState(initialGrade ?? null)
  const [showSchoolEdit,  setShowSchoolEdit]  = useState(false)
  const [editSchoolId,    setEditSchoolId]    = useState('')
  const [editGrade,       setEditGrade]       = useState(initialGrade ?? '')
  const [savingSchool,    setSavingSchool]    = useState(false)
  const [schoolError,     setSchoolError]     = useState('')
  // 学校変更は店舗だけが知っている合言葉を入れたときだけ許可する。
  // お客様が自由に在籍校を切り替えると、取扱いのない学校の商品を見に行ったり、
  // 進学していないのに学年・学校が書き換わる事故が起きるため。
  const [schoolKey,       setSchoolKey]       = useState('')

  // カート
  const [cart,        setCart]        = useState<CartItem[]>([])
  const [openCart,    setOpenCart]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [ordering,    setOrdering]    = useState(false)
  const [orderError,  setOrderError]  = useState('')
  const [ordered,     setOrdered]     = useState(false)

  const fetchProducts = useCallback(async (schoolId: string) => {
    setProducts(await fetchSchoolProducts(storeId, schoolId).catch(() => []))
    setVariants({})
    setExpanded(null)
  }, [storeId])

  // 初期ロード
  useEffect(() => {
    ;(async () => {
      setDataLoading(true)

      // プランチェック（入口のボタン側と同じ判定を使う）
      const { data: storeRow } = await (supabase as any)
        .from('stores').select('features').eq('id', storeId).single()
      const featuresData = (storeRow?.features ?? {}) as Record<string, unknown>
      if (!canCustomerOrder(featuresData)) {
        setPlanGated(true)
        setDataLoading(false)
        return
      }

      const schoolList = await fetchSchools(storeId).catch(() => [])
      setSchools(schoolList)

      // 在籍校の解決は school_id を優先し、未設定の古いレコードのみ学校名で照合する
      const matched =
        (initialSchoolId ? schoolList.find(s => s.id === initialSchoolId) : null)
        ?? (initialSchoolName ? schoolList.find(s => s.name === initialSchoolName) : null)
      if (matched) {
        setActiveSchoolId(matched.id)
        setChildSchoolName(matched.name)
        await fetchProducts(matched.id)
      } else if (initialSchoolName) {
        setNoSchool(true)
      }
      setDataLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadVariants = async (productId: string) => {
    if (variants[productId]) { setExpanded(expanded === productId ? null : productId); return }
    setLoadingVar(productId)
    const rows = await fetchVariants(storeId, [productId]).catch(() => [])
    setVariants(prev => ({ ...prev, [productId]: rows }))
    setExpanded(productId)
    setLoadingVar(null)
  }

  /**
   * 進学・転校時の学校変更。
   * 注文できるのは「登録されている学校」の商品だけ（サーバー側でも検証）なので、
   * 登録の更新に失敗したら画面上の学校も切り替えてはいけない。
   * 保存できていないのに商品だけ差し替わると、注文時に必ず弾かれてしまう。
   */
  const handleSaveSchool = async () => {
    const school = schools.find(s => s.id === editSchoolId)
    if (!school) { setSchoolError('学校を選択してください'); return }
    if (!schoolKey.trim()) { setSchoolError('パスキーを入力してください'); return }
    setSavingSchool(true); setSchoolError('')

    // 合言葉の照合はサーバーで行う（鍵をお客様の端末に置かないため）
    try {
      const res = await fetch('/api/school-change-key/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, key: schoolKey }),
      })
      const json = await res.json().catch(() => ({ ok: false }))
      if (!json.ok) {
        setSchoolError(json.configured === false
          ? 'この店舗では学校の変更を受け付けていません。店舗へお問い合わせください'
          : 'パスキーが違います。店舗へお問い合わせください')
        setSavingSchool(false)
        return
      }
    } catch {
      setSchoolError('通信に失敗しました。電波の良い場所でお試しください')
      setSavingSchool(false)
      return
    }

    try {
      const { child } = await saveCustomer(storeId, childId
        ? { childUpdate: { id: childId, school_id: school.id, school_name: school.name, grade: editGrade || null } }
        // お子様未登録の場合は顧客本人のレコードに学校を持たせる
        : { customer: { school_id: school.id, school_name: school.name } })
      if (childId && child) onChildUpdated?.(child as Record<string, unknown>)
    } catch (e) {
      setSchoolError(e instanceof Error ? e.message : '保存に失敗しました')
      setSavingSchool(false)
      return
    }
    setChildSchoolName(school.name)
    setChildGrade(editGrade || null)
    setCart([])          // 学校が変われば商品も変わるのでカートは破棄する
    setActiveSchoolId(school.id)
    setNoSchool(false)
    setDataLoading(true)
    await fetchProducts(school.id)
    setDataLoading(false)
    setSavingSchool(false)
    setSchoolKey('')
    setShowSchoolEdit(false)
  }

  const addToCart = (p: CatalogProduct, v: CatalogVariant) => {
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
      // purchase_orders への登録はサーバーAPI経由(価格はサーバー側で再解決)
      await placeEcOrder(storeId, {
        childId: childId ?? null,
        items: cart.map(i => ({ variantId: i.variantId, qty: i.qty })),
      })
      fetch('/api/push-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, type: 'purchase_new',
          title: '📦 ネット注文が届きました',
          body: cart.map(i => `${i.productName}${i.sizeLabel ? ` ${i.sizeLabel}` : ''}`).join('・'),
          url: `/${storeId}/admin/crm`,
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
  if (planGated) return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6 pb-10">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}22, ${theme.colors.accent}22)` }}>
        🔒
      </div>
      <div>
        <p className="text-xs font-bold mb-2" style={{ color: theme.colors.primary }}>{storeName}</p>
        <h2 className="text-xl font-black text-zinc-900 mb-3 leading-snug">
          この機能は現在のプランでは<br />ご利用いただけません
        </h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          ネット注文・商品カタログ機能は<br />上位プランでご利用いただけます。<br />
          詳しくは店頭スタッフにお問い合わせください。
        </p>
      </div>
      <button onClick={onBack}
        className="px-6 py-2.5 rounded-2xl border border-zinc-200 text-zinc-500 text-sm font-bold active:opacity-60 transition-opacity">
        ← 戻る
      </button>
    </main>
  )

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
          onClick={() => {
            setEditSchoolId(activeSchoolId ?? '')
            setEditGrade(childGrade ?? '')
            setSchoolError('')
            setSchoolKey('')
            setShowSchoolEdit(true)
          }}
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
                {/* 取扱いのある学校のみ選択可能（自由入力だと商品と紐づかず注文できない） */}
                {schools.length > 0 ? (
                  <select value={editSchoolId} onChange={e => setEditSchoolId(e.target.value)}
                    className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all">
                    <option value="">選択してください</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <p className="text-zinc-500 text-sm">
                    取扱学校が登録されていません。<br />店頭スタッフにお問い合わせください。
                  </p>
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
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">パスキー</label>
                <input
                  type="text" inputMode="text" autoComplete="off"
                  value={schoolKey} onChange={e => { setSchoolKey(e.target.value); setSchoolError('') }}
                  placeholder="店舗からお伝えした合言葉"
                  className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all"
                />
                <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
                  学校の変更にはパスキーが必要です。<br />
                  パスキーをお伝えしますので、店舗までお問い合わせください。
                </p>
              </div>
              {schoolError && <p className="text-red-500 text-xs text-center">{schoolError}</p>}
              <button onClick={handleSaveSchool} disabled={savingSchool || schools.length === 0}
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
