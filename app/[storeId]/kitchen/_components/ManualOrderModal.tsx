'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  storeId:   string
  onClose:   () => void
  onCreated: () => void
}

interface Item {
  key:      string
  name:     string
  quantity: number
}

type PickupOption = 'now' | '15' | '30' | 'custom'
type Source       = 'walkin' | 'phone'

export default function ManualOrderModal({ storeId, onClose, onCreated }: Props) {
  const [customerName,  setCustomerName]  = useState('')
  const [source,        setSource]        = useState<Source>('walkin')
  const [pickupOption,  setPickupOption]  = useState<PickupOption>('now')
  const [customTime,    setCustomTime]    = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  })
  const [items,         setItems]         = useState<Item[]>([{ key: '1', name: '', quantity: 1 }])
  const [notes,         setNotes]         = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')

  const addItem    = () => setItems(p => [...p, { key: Date.now().toString(), name: '', quantity: 1 }])
  const removeItem = (key: string) => setItems(p => p.filter(i => i.key !== key))
  const updateItem = (key: string, field: keyof Item, value: string | number) =>
    setItems(p => p.map(i => i.key === key ? { ...i, [field]: value } : i))

  const getPickupTime = (): string | null => {
    if (pickupOption === 'now') return null
    if (pickupOption === '15')  return new Date(Date.now() + 15 * 60000).toISOString()
    if (pickupOption === '30')  return new Date(Date.now() + 30 * 60000).toISOString()
    const [h, m] = customTime.split(':').map(Number)
    const t = new Date()
    t.setHours(h, m, 0, 0)
    return t.toISOString()
  }

  const handleSubmit = async () => {
    const validItems = items.filter(i => i.name.trim())
    if (validItems.length === 0) { setError('品目を1つ以上入力してください'); return }
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

      const { error: itemErr } = await supabase
        .from('takeout_order_items')
        .insert(validItems.map(i => ({
          order_id:   order.id,
          name:       i.name.trim(),
          unit_price: 0,
          quantity:   i.quantity,
        })))
      if (itemErr) throw itemErr

      onCreated()
      onClose()
    } catch (e) {
      console.error(e)
      setError('エラーが発生しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center">
      <div className="bg-zinc-900 rounded-t-2xl md:rounded-2xl w-full md:max-w-md md:mx-4 max-h-[92vh] flex flex-col">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="font-bold text-lg">注文入力</h2>
          <button onClick={onClose} className="text-zinc-500 w-8 h-8 flex items-center justify-center text-2xl rounded-full hover:bg-zinc-800">×</button>
        </div>

        {/* スクロールエリア */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* 注文経路 */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block font-medium">注文経路</label>
            <div className="flex gap-2">
              {(['walkin', 'phone'] as Source[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    source === s ? 'bg-white text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {s === 'walkin' ? '🚶 店頭' : '📞 電話'}
                </button>
              ))}
            </div>
          </div>

          {/* お客様名 */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block font-medium">お客様名（任意）</label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="例：田中様"
              className="w-full bg-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          {/* 受取時間 */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block font-medium">受取時間</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['now', '15', '30', 'custom'] as PickupOption[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setPickupOption(opt)}
                  className={`py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    pickupOption === opt ? 'bg-white text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {opt === 'now' ? '今すぐ' : opt === 'custom' ? '時間指定' : `${opt}分後`}
                </button>
              ))}
            </div>
            {pickupOption === 'custom' && (
              <input
                type="time"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                className="mt-2 w-full bg-zinc-800 rounded-lg px-4 py-3 text-white outline-none focus:ring-1 focus:ring-zinc-600"
              />
            )}
          </div>

          {/* 注文内容 */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block font-medium">注文内容</label>
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => (
                <div key={item.key} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateItem(item.key, 'name', e.target.value)}
                    placeholder={`品目 ${idx + 1}`}
                    className="flex-1 bg-zinc-800 rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                  <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden shrink-0">
                    <button
                      onClick={() => updateItem(item.key, 'quantity', Math.max(1, item.quantity - 1))}
                      className="px-3 py-2.5 text-zinc-400 active:bg-zinc-700 text-lg leading-none"
                    >－</button>
                    <span className="px-2 text-white min-w-[2ch] text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateItem(item.key, 'quantity', item.quantity + 1)}
                      className="px-3 py-2.5 text-zinc-400 active:bg-zinc-700 text-lg leading-none"
                    >＋</button>
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.key)} className="text-zinc-600 text-xl px-1 shrink-0">×</button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-2 w-full py-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-sm transition-colors active:bg-zinc-800"
            >
              ＋ 品目を追加
            </button>
          </div>

          {/* 備考 */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block font-medium">備考・アレルギー</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="例：アレルギー：えび"
              className="w-full bg-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={submitting || items.every(i => !i.name.trim())}
            className="w-full py-4 rounded-xl font-bold text-lg bg-white text-zinc-950 disabled:opacity-40 active:scale-95 transition-transform"
          >
            {submitting ? '送信中...' : '注文を確定する'}
          </button>
        </div>
      </div>
    </div>
  )
}
