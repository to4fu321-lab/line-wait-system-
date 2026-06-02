'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, Minus, Plus, ShoppingCart,
  ChevronDown, ChevronUp, Loader2, X, GraduationCap, Pencil,
} from 'lucide-react'
import { useStoreTheme } from '@/lib/theme-context'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/products'
import type { LiffProfile } from '@/lib/liff'
import { GRADE_OPTIONS } from '@/types/crm'

// カテゴリに対応する絵文字
const CATEGORY_EMOJI: Record<string, string> = {
  '制服': '👔',
  '体操着': '🩳',
  '上靴': '👟',
  'カバン': '🎒',
  'その他': '📦',
}

interface CartItem { productId: string; size: string; qty: number }

interface Props {
  lineProfile: LiffProfile | null
  storeId: string
  storeName?: string
  customerId?: string | null
  childId?: string | null
  childName?: string | null
  childSchoolName?: string | null
  childGrade?: string | null
  onBack: () => void
}

export default function ECShopView({
  lineProfile, storeId, storeName,
  customerId, childId,
  childName, childSchoolName: initialSchoolName, childGrade: initialGrade,
  onBack,
}: Props) {
  const theme = useStoreTheme()

  const [products,       setProducts]       = useState<Product[]>([])
  const [loading,        setLoading]        = useState(true)
  const [cart,           setCart]           = useState<CartItem[]>([])
  const [selSize,        setSelSize]        = useState<Record<string, string>>({})
  const [ordered,        setOrdered]        = useState(false)
  const [ordering,       setOrdering]       = useState(false)
  const [orderError,     setOrderError]     = useState('')

  // 学校・学年（ローカルで変更可能）
  const [childSchoolName, setChildSchoolName] = useState(initialSchoolName ?? null)
  const [childGrade,      setChildGrade]      = useState(initialGrade ?? null)

  // 学校変更モーダル
  const [showSchoolEdit,  setShowSchoolEdit]  = useState(false)
  const [editSchool,      setEditSchool]      = useState(initialSchoolName ?? '')
  const [editGrade,       setEditGrade]       = useState(initialGrade ?? '')
  const [schoolOptions,   setSchoolOptions]   = useState<string[]>([])
  const [savingSchool,    setSavingSchool]    = useState(false)
  const [openCart,    setOpenCart]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // 商品取得
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name',     { ascending: true })
    const rows: Product[] = data ?? []
    setProducts(rows)
    // 商品に紐付いた学校名一覧を抽出してドロップダウン用に保存
    const allSchools = Array.from(
      new Set(rows.flatMap(p => p.school_names ?? []))
    ).sort()
    setSchoolOptions(allSchools)
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // 学校・学年を更新（お子様 DB レコード更新）
  const handleSaveSchool = async () => {
    if (!childId) {
      // childId がない場合はローカル state だけ更新
      setChildSchoolName(editSchool || null)
      setChildGrade(editGrade || null)
      setShowSchoolEdit(false)
      return
    }
    setSavingSchool(true)
    await (supabase as any).from('children').update({
      school_name: editSchool.trim() || null,
      grade: editGrade || null,
      updated_at: new Date().toISOString(),
    }).eq('id', childId)
    setChildSchoolName(editSchool.trim() || null)
    setChildGrade(editGrade || null)
    setSavingSchool(false)
    setShowSchoolEdit(false)
  }

  // 学校に応じた商品フィルタリング
  // 定番商品: school_names が空配列 or null
  // 学校別商品: school_names に childSchoolName が含まれる
  const standardProducts = products.filter(
    p => !p.school_names || p.school_names.length === 0
  )
  const schoolProducts = childSchoolName
    ? products.filter(p => p.school_names && p.school_names.includes(childSchoolName))
    : []

  const totalQty   = cart.reduce((s, c) => s + c.qty, 0)
  const totalPrice = cart.reduce((s, c) => {
    const p = products.find(p => p.id === c.productId)
    return s + (p?.price ?? 0) * c.qty
  }, 0)

  const getQty = (productId: string, size: string) =>
    cart.find(c => c.productId === productId && c.size === size)?.qty ?? 0

  const changeQty = (productId: string, size: string, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.productId === productId && c.size === size)
      if (idx < 0) return delta > 0 ? [...prev, { productId, size, qty: delta }] : prev
      const next = prev[idx].qty + delta
      if (next <= 0) return prev.filter((_, i) => i !== idx)
      return prev.map((c, i) => i === idx ? { ...c, qty: next } : c)
    })
  }

  const submitOrder = async () => {
    if (!customerId) return
    setOrdering(true); setOrderError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const records = cart.map(c => {
        const p = products.find(p => p.id === c.productId)!
        return {
          store_id: storeId, customer_id: customerId, child_id: childId ?? null,
          item_name: `${p.name}（${c.size}）`,
          notes: `数量：${c.qty}点`,
          price: (p.price ?? 0) * c.qty,
          status: 'ordered',
          ordered_date: today,
        }
      })
      const { error } = await (supabase.from('purchase_orders') as any).insert(records)
      if (error) throw new Error(error.message)
      const itemNames = records.map(r => r.item_name).join('・')
      fetch('/api/push-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          type:  'purchase_new',
          title: '📦 取置き依頼が届きました',
          body:  itemNames,
          url:   `/${storeId}/admin/crm`,
        }),
      }).catch(console.error)
      setOrdered(true)
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : String(e))
    } finally {
      setOrdering(false)
    }
  }

  const handleOrder = () => {
    if (totalQty === 0 || ordering) return
    setShowConfirm(true)
  }

  // ── 未登録の場合 ──────────────────────────────────────────
  if (!customerId) return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6 pb-10">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl bg-gray-100">🛍️</div>
      <div>
        <h2 className="text-2xl font-black text-zinc-900 mb-2">会員登録が必要です</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          ご注文には会員登録が必要です。<br />
          スタッフにお声がけいただくか、<br />
          受付QRから登録をお願いします。
        </p>
      </div>
      <button onClick={onBack}
        className="text-zinc-400 text-sm underline active:opacity-60">
        ← 戻る
      </button>
    </main>
  )

  // ── ローディング ──────────────────────────────────────────
  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin" style={{ color: theme.colors.primary }} />
    </main>
  )

  // ── 注文完了 ──────────────────────────────────────────────
  if (ordered) return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6 pb-10">
      <div className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
          boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
        <CheckCircle2 size={60} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{storeName}</p>
        <h2 className="text-3xl font-black text-zinc-900 mb-3">在庫確認リクエスト完了！</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          在庫確認のリクエストを受け付けました。<br />
          スタッフが在庫を確認し、<br />
          <span className="font-bold text-zinc-700">「ご用意できました」のLINE通知</span>が<br />
          届きましたら店頭にてお受け取りください。
        </p>
      </div>
      <div className="bg-zinc-50 rounded-2xl p-5 w-full max-w-sm text-left">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">ご注文内容</p>
        <div className="space-y-2">
          {cart.map(c => {
            const p = products.find(p => p.id === c.productId)!
            return (
              <div key={`${c.productId}-${c.size}`} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700">
                  {CATEGORY_EMOJI[p.category ?? ''] ?? '📦'} {p.name}
                  <span className="text-zinc-400 ml-1">({c.size})</span>
                </span>
                <span className="font-bold text-zinc-900">
                  ×{c.qty}　¥{((p.price ?? 0) * c.qty).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
        <div className="border-t border-zinc-200 mt-3 pt-3 flex justify-between">
          <span className="font-bold text-zinc-600">合計 {totalQty}点</span>
          <span className="text-xl font-black" style={{ color: theme.colors.primary }}>
            ¥{totalPrice.toLocaleString()}
          </span>
        </div>
      </div>
      <button onClick={onBack} className="text-zinc-400 text-sm underline active:opacity-60">
        ← トップへ戻る
      </button>
    </main>
  )

  // ── 商品セクション ──────────────────────────────────────
  const ProductSection = ({ title, items, accent }: { title: string; items: Product[]; accent: string }) => {
    if (items.length === 0) return null
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className={`w-2 h-6 rounded-full shrink-0 ${accent}`} />
          <p className="text-sm font-black text-zinc-900 flex-1">{title}</p>
          <span className="text-xs font-black text-zinc-400">{items.length}点</span>
        </div>
        <div className="space-y-4">
          {items.map(item => {
            const emoji = CATEGORY_EMOJI[item.category ?? ''] ?? '📦'
            const currentSize = selSize[item.id]
            const currentQty  = currentSize ? getQty(item.id, currentSize) : 0
            const totalItemQty = (item.sizes ?? []).reduce((s, sz) => s + getQty(item.id, sz), 0)
            return (
              <div key={item.id} className="bg-white rounded-3xl border border-zinc-100 p-5"
                style={{ boxShadow: totalItemQty > 0
                  ? `0 0 0 2px rgb(${theme.colors.primaryRgb} / 0.3), 0 8px 24px -8px rgb(${theme.colors.primaryRgb} / 0.15)`
                  : '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-zinc-50 shrink-0">
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-zinc-900 leading-tight">{item.name}</p>
                        {item.maker && <p className="text-zinc-400 text-xs mt-0.5">{item.maker}</p>}
                        {item.notes && <p className="text-zinc-400 text-xs mt-0.5">{item.notes}</p>}
                      </div>
                      {totalItemQty > 0 && (
                        <div className="shrink-0 text-xs font-bold px-2 py-1 rounded-full"
                          style={{ background: `rgb(${theme.colors.primaryRgb} / 0.1)`, color: theme.colors.primary }}>
                          {totalItemQty}点
                        </div>
                      )}
                    </div>
                    {item.price != null && (
                      <p className="text-base font-black mt-1.5" style={{ color: theme.colors.primary }}>
                        ¥{item.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* サイズ選択 */}
                {item.sizes && item.sizes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-zinc-400 font-bold mb-2">サイズを選択</p>
                    <div className="flex flex-wrap gap-2">
                      {item.sizes.map(sz => {
                        const qtyForSz = getQty(item.id, sz)
                        const isSelected = selSize[item.id] === sz
                        return (
                          <button key={sz}
                            onClick={() => setSelSize(prev => ({ ...prev, [item.id]: sz }))}
                            className="relative px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all active:scale-95"
                            style={isSelected ? {
                              borderColor: theme.colors.primary,
                              background: `rgb(${theme.colors.primaryRgb} / 0.08)`,
                              color: theme.colors.primary,
                            } : {
                              borderColor: qtyForSz > 0 ? `rgb(${theme.colors.primaryRgb} / 0.4)` : '#e5e7eb',
                              color: qtyForSz > 0 ? theme.colors.primary : '#71717a',
                            }}>
                            {sz}
                            {qtyForSz > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                                style={{ background: theme.colors.primary }}>
                                {qtyForSz}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 数量コントロール */}
                {currentSize && (
                  <div className="mt-4 flex items-center justify-between bg-zinc-50 rounded-xl px-4 py-3">
                    <span className="text-sm text-zinc-600 font-bold">{currentSize} × 数量</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => changeQty(item.id, currentSize, -1)}
                        disabled={currentQty === 0}
                        className="w-10 h-10 rounded-xl border-2 border-zinc-200 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
                        <Minus size={14} className="text-zinc-500" />
                      </button>
                      <span className="text-2xl font-black text-zinc-900 w-8 text-center">{currentQty}</span>
                      <button onClick={() => changeQty(item.id, currentSize, 1)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all"
                        style={{ background: theme.colors.primary }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── ショッピング画面 ──────────────────────────────────────
  return (
    <main className="min-h-screen" style={{ paddingBottom: totalQty > 0 ? 140 : 32 }}>
      {/* ヘッダー */}
      <div className="px-5 pt-8 pb-5 text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
            boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          🛍️
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">制服・用品のご注文</h1>
        <p className="text-zinc-500 text-sm mt-1">在庫確認のリクエストを送れます</p>
      </div>

      {/* お子様情報バナー */}
      <div className="px-4 mb-4 max-w-md mx-auto">
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
              <p className="text-zinc-500 text-xs truncate">
                {childSchoolName}{childGrade ? ` · ${childGrade}` : ''}
              </p>
            ) : (
              <p className="text-amber-600 text-xs font-bold">学校を登録 → 関連商品を表示</p>
            )}
          </div>
          <Pencil size={14} className="text-zinc-400 shrink-0" />
        </button>
      </div>

      {/* 商品リスト */}
      <div className="px-4 space-y-8 max-w-md mx-auto">
        {standardProducts.length === 0 && schoolProducts.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-12">
            現在登録されている商品はありません
          </p>
        )}

        <ProductSection
          title={childSchoolName ? `${childSchoolName}の商品` : '学校別商品'}
          items={schoolProducts}
          accent="bg-indigo-500"
        />
        <ProductSection
          title="定番商品（全校共通）"
          items={standardProducts}
          accent="bg-amber-400"
        />

        <button onClick={onBack} className="w-full py-3 text-center text-zinc-400 text-sm underline active:opacity-60">
          ← 戻る
        </button>
      </div>

      {/* カートバー（固定フッター）*/}
      {totalQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          {openCart && (
            <div className="bg-white border-t border-zinc-100 px-4 py-3 max-h-48 overflow-y-auto">
              <div className="max-w-md mx-auto space-y-2">
                {cart.map(c => {
                  const p = products.find(p => p.id === c.productId)!
                  return (
                    <div key={`${c.productId}-${c.size}`} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700 truncate">
                        {CATEGORY_EMOJI[p?.category ?? ''] ?? '📦'} {p?.name} <span className="text-zinc-400">({c.size})</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button onClick={() => changeQty(c.productId, c.size, -1)}
                          className="w-6 h-6 rounded-full border border-zinc-200 flex items-center justify-center">
                          <Minus size={10} />
                        </button>
                        <span className="font-bold w-4 text-center">{c.qty}</span>
                        <button onClick={() => changeQty(c.productId, c.size, 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                          style={{ background: theme.colors.primary }}>
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className="bg-white/95 backdrop-blur-xl border-t border-zinc-100 px-4 pt-3 pb-6"
            style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.1)' }}>
            <div className="max-w-md mx-auto">
              <button onClick={() => setOpenCart(v => !v)}
                className="w-full flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <ShoppingCart size={20} className="text-zinc-600" />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                      style={{ background: theme.colors.primary }}>
                      {totalQty}
                    </span>
                  </div>
                  <span className="text-zinc-600 font-bold text-sm">{totalQty}点 選択中</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black" style={{ color: theme.colors.primary }}>
                    ¥{totalPrice.toLocaleString()}
                  </span>
                  {openCart ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronUp size={16} className="text-zinc-400" />}
                </div>
              </button>
              <button onClick={handleOrder} disabled={ordering}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                  boxShadow: `0 8px 24px -6px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
                {ordering ? '送信中...' : '在庫確認を依頼する  →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注文確認モーダル */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
              <div>
                <p className="font-black text-zinc-900 text-base">注文内容の確認</p>
                <p className="text-zinc-500 text-xs mt-0.5">内容をご確認のうえ依頼してください</p>
              </div>
              <button onClick={() => setShowConfirm(false)} className="p-1.5 rounded-xl bg-zinc-100 text-zinc-500">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="space-y-2">
                {cart.map(c => {
                  const p = products.find(p => p.id === c.productId)!
                  return (
                    <div key={`${c.productId}-${c.size}`}
                      className="flex items-center justify-between text-sm bg-zinc-50 rounded-xl px-3 py-2.5">
                      <span className="text-zinc-700">
                        {CATEGORY_EMOJI[p?.category ?? ''] ?? '📦'} {p?.name}
                        <span className="text-zinc-400 ml-1">({c.size})</span>
                      </span>
                      <span className="font-bold text-zinc-900 shrink-0 ml-2">
                        ×{c.qty}　¥{((p?.price ?? 0) * c.qty).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between items-center border-t border-zinc-100 pt-3">
                <span className="font-bold text-zinc-600">合計 {totalQty}点</span>
                <span className="text-xl font-black" style={{ color: theme.colors.primary }}>
                  ¥{totalPrice.toLocaleString()}
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
                📦 在庫確認のリクエストを送信します。在庫確認後、スタッフからLINEでご連絡します。
              </div>
              {orderError && (
                <p className="text-red-500 text-xs text-center">送信失敗: {orderError}</p>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={() => setShowConfirm(false)}
                  className="py-3.5 rounded-2xl border-2 border-zinc-200 text-zinc-600 font-bold text-sm active:scale-95 transition-transform">
                  修正する
                </button>
                <button onClick={submitOrder} disabled={ordering}
                  className="py-3.5 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
                  {ordering ? <><Loader2 size={14} className="animate-spin" />送信中...</> : 'この内容で依頼する →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 学校・学年 変更モーダル */}
      {showSchoolEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100">
              <div>
                <p className="font-black text-zinc-900 text-base">学校・学年を変更</p>
                <p className="text-zinc-500 text-xs mt-0.5">進学・転校の際に更新してください</p>
              </div>
              <button onClick={() => setShowSchoolEdit(false)} className="p-1.5 rounded-xl bg-zinc-100 text-zinc-500">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 pb-8">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">学校名</label>
                {schoolOptions.length > 0 ? (
                  <select value={editSchool} onChange={e => setEditSchool(e.target.value)}
                    className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all">
                    <option value="">選択してください</option>
                    {schoolOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__custom">その他（直接入力）</option>
                  </select>
                ) : (
                  <input type="text" value={editSchool} onChange={e => setEditSchool(e.target.value)}
                    placeholder="例：○○高等学校"
                    className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all" />
                )}
                {editSchool === '__custom' && (
                  <input type="text" onChange={e => setEditSchool(e.target.value)}
                    placeholder="学校名を入力"
                    className="mt-1.5 w-full text-base text-zinc-900 border-2 border-zinc-200 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all"
                    autoFocus />
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
