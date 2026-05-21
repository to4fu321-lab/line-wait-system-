'use client'

import { useState } from 'react'
import { CheckCircle2, Minus, Plus, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import { useStoreTheme } from '@/lib/theme-context'
import { supabase } from '@/lib/supabase'
import type { LiffProfile } from '@/lib/liff'

// ── モック商品データ ──────────────────────────────────────
const ITEMS = [
  {
    id: 1, name: 'ワイシャツ（長袖）', price: 3200, emoji: '👔',
    sizes: ['150', '155', '160', '165', '170'],
    desc: 'スクールシャツ 形態安定加工',
  },
  {
    id: 2, name: 'ワイシャツ（半袖）', price: 2800, emoji: '👕',
    sizes: ['150', '155', '160', '165', '170'],
    desc: 'スクールシャツ 形態安定加工',
  },
  {
    id: 3, name: 'スクールポロシャツ', price: 2400, emoji: '🎽',
    sizes: ['S', 'M', 'L', 'XL'],
    desc: 'UVカット・吸水速乾素材',
  },
  {
    id: 4, name: '通学用ソックス（3足組）', price: 780, emoji: '🧦',
    sizes: ['23–25cm', '25–27cm', '27–29cm'],
    desc: '白 リブソックス',
  },
  {
    id: 5, name: 'スクールベルト', price: 1200, emoji: '🪢',
    sizes: ['S / M', 'L / XL'],
    desc: '通学用 黒 合皮',
  },
  {
    id: 6, name: '体操着（上下セット）', price: 4800, emoji: '🩳',
    sizes: ['150', '160', '170', 'XL'],
    desc: '吸汗速乾・ストレッチ',
  },
]

interface CartItem { itemId: number; size: string; qty: number }

interface Props {
  lineProfile: LiffProfile | null
  storeId: string
  storeName?: string
  customerId?: string | null
  childId?: string | null
  onBack: () => void
}

export default function ECShopView({ lineProfile, storeId, storeName, customerId, childId, onBack }: Props) {
  const theme = useStoreTheme()
  const [cart, setCart]     = useState<CartItem[]>([])
  const [selSize, setSelSize] = useState<Record<number, string>>({})
  const [ordered, setOrdered] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [openCart, setOpenCart] = useState(false)

  const totalQty   = cart.reduce((s, c) => s + c.qty, 0)
  const totalPrice = cart.reduce((s, c) => {
    const item = ITEMS.find(i => i.id === c.itemId)
    return s + (item?.price ?? 0) * c.qty
  }, 0)

  const getQty = (itemId: number, size: string) =>
    cart.find(c => c.itemId === itemId && c.size === size)?.qty ?? 0

  const changeQty = (itemId: number, size: string, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.itemId === itemId && c.size === size)
      if (idx < 0) return delta > 0 ? [...prev, { itemId, size, qty: delta }] : prev
      const next = prev[idx].qty + delta
      if (next <= 0) return prev.filter((_, i) => i !== idx)
      return prev.map((c, i) => i === idx ? { ...c, qty: next } : c)
    })
  }

  const handleOrder = async () => {
    if (totalQty === 0 || ordering) return
    if (!customerId) {
      setOrderError('ご注文には会員登録が必要です。一度戻って会員登録してからお試しください。')
      return
    }
    setOrdering(true)
    setOrderError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const records = cart.map(c => {
        const item = ITEMS.find(i => i.id === c.itemId)!
        return {
          store_id:     storeId,
          customer_id:  customerId ?? null,
          child_id:     childId ?? null,
          item_name:    `${item.name}（${c.size}）`,
          notes:        `数量：${c.qty}点`,
          price:        item.price * c.qty,
          status:       'received',
          ordered_date: today,
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('purchase_orders') as any).insert(records)
      if (error) throw new Error(error.message)
      setOrdered(true)
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : String(e))
    } finally {
      setOrdering(false)
    }
  }

  // ── 注文完了画面 ──────────────────────────────────────
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

      {/* 注文内容サマリー */}
      <div className="bg-zinc-50 rounded-2xl p-5 w-full max-w-sm text-left">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">ご注文内容</p>
        <div className="space-y-2">
          {cart.map(c => {
            const item = ITEMS.find(i => i.id === c.itemId)!
            return (
              <div key={`${c.itemId}-${c.size}`}
                className="flex items-center justify-between text-sm">
                <span className="text-zinc-700">
                  {item.emoji} {item.name}
                  <span className="text-zinc-400 ml-1">({c.size})</span>
                </span>
                <span className="font-bold text-zinc-900">
                  ×{c.qty}　¥{(item.price * c.qty).toLocaleString()}
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

      <button onClick={onBack}
        className="text-zinc-400 text-sm underline active:opacity-60">
        ← トップへ戻る
      </button>
    </main>
  )

  // ── ショッピング画面 ──────────────────────────────────
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
        <h1 className="text-2xl font-black text-zinc-900">かんたんネット注文</h1>
        <p className="text-zinc-500 text-sm mt-1">アイテムを選んでお家から注文できます</p>
      </div>

      {/* 商品リスト */}
      <div className="px-4 space-y-4 max-w-md mx-auto">
        {ITEMS.map(item => {
          const currentSize = selSize[item.id]
          const currentQty  = currentSize ? getQty(item.id, currentSize) : 0
          const totalItemQty = item.sizes.reduce((s, sz) => s + getQty(item.id, sz), 0)

          return (
            <div key={item.id}
              className="bg-white rounded-3xl border border-zinc-100 p-5"
              style={{ boxShadow: totalItemQty > 0
                ? `0 0 0 2px rgb(${theme.colors.primaryRgb} / 0.3), 0 8px 24px -8px rgb(${theme.colors.primaryRgb} / 0.15)`
                : '0 2px 12px rgba(0,0,0,0.06)' }}>
              {/* 商品ヘッダー */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-zinc-50 shrink-0">
                  {item.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-zinc-900 leading-tight">{item.name}</p>
                      <p className="text-zinc-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                    {totalItemQty > 0 && (
                      <div className="shrink-0 text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: `rgb(${theme.colors.primaryRgb} / 0.1)`, color: theme.colors.primary }}>
                        {totalItemQty}点
                      </div>
                    )}
                  </div>
                  <p className="text-base font-black mt-1.5" style={{ color: theme.colors.primary }}>
                    ¥{item.price.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* サイズ選択 */}
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

              {/* 数量コントロール */}
              {currentSize && (
                <div className="mt-4 flex items-center justify-between bg-zinc-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-zinc-600 font-bold">
                    {currentSize} × 数量
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => changeQty(item.id, currentSize, -1)}
                      disabled={currentQty === 0}
                      className="w-10 h-10 rounded-xl border-2 border-zinc-200 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
                      <Minus size={14} className="text-zinc-500" />
                    </button>
                    <span className="text-2xl font-black text-zinc-900 w-8 text-center">
                      {currentQty}
                    </span>
                    <button
                      onClick={() => changeQty(item.id, currentSize, 1)}
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

        <button onClick={onBack} className="w-full py-3 text-center text-zinc-400 text-sm underline active:opacity-60">
          ← 戻る
        </button>
      </div>

      {/* カートバー（固定フッター）*/}
      {totalQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          {/* カート詳細（展開時）*/}
          {openCart && (
            <div className="bg-white border-t border-zinc-100 px-4 py-3 max-h-48 overflow-y-auto">
              <div className="max-w-md mx-auto space-y-2">
                {cart.map(c => {
                  const item = ITEMS.find(i => i.id === c.itemId)!
                  return (
                    <div key={`${c.itemId}-${c.size}`}
                      className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700 truncate">
                        {item.emoji} {item.name} <span className="text-zinc-400">({c.size})</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button onClick={() => changeQty(c.itemId, c.size, -1)}
                          className="w-6 h-6 rounded-full border border-zinc-200 flex items-center justify-center">
                          <Minus size={10} />
                        </button>
                        <span className="font-bold w-4 text-center">{c.qty}</span>
                        <button onClick={() => changeQty(c.itemId, c.size, 1)}
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
              {orderError && (
                <p className="text-red-500 text-xs text-center mb-2">送信失敗: {orderError}</p>
              )}
              <button onClick={handleOrder} disabled={ordering}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                  boxShadow: `0 8px 24px -6px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
                {ordering ? '送信中...' : `在庫確認を依頼する  →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
