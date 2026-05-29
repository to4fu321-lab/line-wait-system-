'use client'

import type { TakeoutOrder } from '@/types/takeout'

interface BatchItem {
  name:      string
  totalQty:  number
  breakdown: { orderNumber: string; qty: number }[]
}

function aggregate(orders: TakeoutOrder[]): BatchItem[] {
  const map = new Map<string, BatchItem>()
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const existing = map.get(item.name)
      if (existing) {
        existing.totalQty += item.quantity
        existing.breakdown.push({ orderNumber: order.order_number, qty: item.quantity })
      } else {
        map.set(item.name, {
          name:      item.name,
          totalQty:  item.quantity,
          breakdown: [{ orderNumber: order.order_number, qty: item.quantity }],
        })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty)
}

interface Props {
  orders:  TakeoutOrder[]
  onClose: () => void
}

export default function BatchView({ orders, onClose }: Props) {
  const items = aggregate(orders)

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0 bg-zinc-900">
        <div>
          <h2 className="font-bold text-lg">バッチ調理ビュー</h2>
          <p className="text-xs text-zinc-500">受付中・調理中 {orders.length} 件を集計</p>
        </div>
        <button
          onClick={onClose}
          className="bg-zinc-800 text-zinc-300 rounded-full w-9 h-9 flex items-center justify-center text-xl active:scale-95"
        >×</button>
      </div>

      {/* 集計リスト */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600">
            集計対象の注文がありません
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-lg mx-auto">
            {items.map(item => (
              <div key={item.name} className="bg-zinc-900 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold text-xl flex-1">{item.name}</span>
                  <span className="text-4xl font-black shrink-0">×{item.totalQty}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.breakdown.map((b, i) => (
                    <span key={i} className="bg-zinc-800 text-zinc-400 text-xs px-2.5 py-1 rounded-full">
                      {b.orderNumber} × {b.qty}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
