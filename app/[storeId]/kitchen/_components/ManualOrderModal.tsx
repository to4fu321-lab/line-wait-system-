'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Menu } from '@/types/takeout'

interface Props {
  storeId:   string
  onClose:   () => void
  onCreated: () => void
}

interface CartItem {
  key:      string
  menuId:   string | null
  name:     string
  quantity: number
}

type PickupOption = 'now' | '15' | '30' | 'custom'
type Source       = 'walkin' | 'phone'

export default function ManualOrderModal({ storeId, onClose, onCreated }: Props) {
  const [menus,         setMenus]         = useState<Menu[]>([])
  const [customerName,  setCustomerName]  = useState('')
  const [source,        setSource]        = useState<Source>('walkin')
  const [pickupOption,  setPickupOption]  = useState<PickupOption>('now')
  const [customTime,    setCustomTime]    = useState(() => {
    const d = new Date(Date.now() + 30 * 60000)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  })
  const [cart,          setCart]          = useState<CartItem[]>([])
  const [freeText,      setFreeText]      = useState('')
  const [notes,         setNotes]         = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')

  // メニューを読み込む
  useEffect(() => {
    supabase
      .from('menus')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_available', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setMenus(data as Menu[]) })
  }, [storeId])

  // メニューチップをタップ → カートに追加 or 数量増加
  const tapMenu = (menu: Menu) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuId === menu.id)
      if (existing) {
        return prev.map(i => i.menuId === menu.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { key: menu.id, menuId: menu.id, name: menu.name, quantity: 1 }]
    })
  }

  // カートの数量変更
  const setQty = (key: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.key !== key))
    } else {
      setCart(prev => prev.map(i => i.key === key ? { ...i, quantity: qty } : i))
    }
  }

  // フリーテキスト追加
  const addFreeText = () => {
    const name = freeText.trim()
    if (!name) return
    setCart(prev => {
      const existing = prev.find(i => i.name === name && i.menuId === null)
      if (existing) return prev.map(i => i.name === name && i.menuId === null ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { key: `free-${Date.now()}`, menuId: null, name, quantity: 1 }]
    })
    setFreeText('')
  }

  const getPickupTime = (): string | null => {
    if (pickupOption === 'now') return null
    if (pickupOption === '15')  return new Date(Date.now() + 15 * 60000).toISOString()
    if (pickupOption === '30')  return new Date(Date.now() + 30 * 60000).toISOString()
    const [h, m] = customTime.split(':').map(Number)
    const t = new Date(); t.setHours(h, m, 0, 0)
    return t.toISOString()
  }

  const handleSubmit = async () => {
    if (cart.length === 0) { setError('品目を追加してください'); return }
    setError('')
    setSubmitting(true)
    try {
      const { data: orderNumber, error: numErr } = await supabase
        .rpc('get_next_order_number', { p_store_id: storeId })
      if (numErr) throw numErr

      const { data: order, error: orderErr } = await supabase
        .from('takeout_orders')
        .insert({
          store_id:      storeId,
          order_number:  orderNumber as string,
          customer_name: customerName.trim() || null,
          status:        'pending',
          total_amount:  0,
          pickup_time:   getPickupTime(),
          order_source:  source,
          notes:         notes.trim() || null,
        })
        .select()
        .single()
      if (orderErr || !order) throw orderErr

      await supabase.from('takeout_order_items').insert(
        cart.map(i => ({
          order_id:   (order as { id: string }).id,
          name:       i.name,
          unit_price: 0,
          quantity:   i.quantity,
        }))
      )

      onCreated()
      onClose()
    } catch (e) {
      console.error(e)
      setError('エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center">
      <div className="bg-zinc-900 rounded-t-2xl md:rounded-2xl w-full md:max-w-md md:mx-4 max-h-[94vh] flex flex-col">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="font-bold text-lg">注文入力</h2>
          <button onClick={onClose} className="text-zinc-400 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

          {/* 注文経路 */}
          <div className="flex gap-2">
            {(['walkin', 'phone'] as Source[]).map(s => (
              <button key={s} onClick={() => setSource(s)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${source === s ? 'bg-white text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                {s === 'walkin' ? '🚶 店頭' : '📞 電話'}
              </button>
            ))}
          </div>

          {/* お客様名 */}
          <input
            type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
            placeholder="お客様名（任意）"
            className="w-full bg-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 outline-none"
          />

          {/* 受取時間 */}
          <div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['now', '15', '30', 'custom'] as PickupOption[]).map(opt => (
                <button key={opt} onClick={() => setPickupOption(opt)}
                  className={`py-2.5 rounded-lg text-xs font-medium ${pickupOption === opt ? 'bg-white text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                  {opt === 'now' ? '今すぐ' : opt === 'custom' ? '時間指定' : `${opt}分後`}
                </button>
              ))}
            </div>
            {pickupOption === 'custom' && (
              <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
                className="mt-2 w-full bg-zinc-800 rounded-lg px-4 py-3 text-white outline-none" />
            )}
          </div>

          {/* メニューチップ（登録済みメニューがある場合） */}
          {menus.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2 font-medium">メニューをタップして追加</p>
              <div className="grid grid-cols-2 gap-2">
                {menus.map(menu => {
                  const inCart = cart.find(i => i.menuId === menu.id)
                  return (
                    <button key={menu.id} onClick={() => tapMenu(menu)}
                      className={`relative py-3 px-3 rounded-lg text-sm font-medium text-left transition-colors active:scale-95 ${
                        inCart ? 'bg-white text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                      <span className="block truncate pr-5">{menu.name}</span>
                      {inCart && (
                        <span className="absolute top-1.5 right-1.5 bg-zinc-950/30 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {inCart.quantity}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* フリーテキスト追加 */}
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium">
              {menus.length > 0 ? 'その他（手入力）' : '品目を追加'}
            </p>
            <div className="flex gap-2">
              <input
                type="text" value={freeText} onChange={e => setFreeText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFreeText()}
                placeholder="品目名を入力"
                className="flex-1 bg-zinc-800 rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 text-sm outline-none"
              />
              <button onClick={addFreeText}
                className="shrink-0 bg-zinc-700 text-zinc-200 px-4 py-2.5 rounded-lg text-sm font-medium active:bg-zinc-600">
                追加
              </button>
            </div>
          </div>

          {/* カート（選択済み品目） */}
          {cart.length > 0 && (
            <div className="bg-zinc-800/50 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs text-zinc-500 font-medium">注文内容</p>
              {cart.map(item => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-zinc-200 truncate">{item.name}</span>
                  <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden shrink-0">
                    <button onClick={() => setQty(item.key, item.quantity - 1)}
                      className="px-3 py-1.5 text-zinc-400 active:bg-zinc-700">－</button>
                    <span className="px-2 text-white text-sm min-w-[2ch] text-center">{item.quantity}</span>
                    <button onClick={() => setQty(item.key, item.quantity + 1)}
                      className="px-3 py-1.5 text-zinc-400 active:bg-zinc-700">＋</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 備考 */}
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="備考・アレルギーなど"
            className="w-full bg-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 text-sm outline-none"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* フッター */}
        <div className="px-4 py-4 border-t border-zinc-800 shrink-0">
          <button onClick={handleSubmit} disabled={submitting || cart.length === 0}
            className="w-full py-4 rounded-xl font-bold text-lg bg-white text-zinc-950 disabled:opacity-40 active:scale-95 transition-transform">
            {submitting ? '送信中...' : `注文を確定する（${cart.length}品目）`}
          </button>
        </div>
      </div>
    </div>
  )
}
