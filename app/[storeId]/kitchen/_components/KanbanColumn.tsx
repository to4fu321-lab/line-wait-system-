'use client'

import type { TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import OrderCard from './OrderCard'

interface Props {
  title:        string
  headerClass:  string
  orders:       TakeoutOrder[]
  settings:     TakeoutSettings
  isActiveTab:  boolean
  emptyMessage: string
  onAdvance:    (order: TakeoutOrder) => Promise<void>
  onCancel:     (order: TakeoutOrder) => Promise<void>
  onItemDone:   (orderId: string, itemId: string, done: boolean) => Promise<void>
}

export default function KanbanColumn({
  title, headerClass, orders, settings, isActiveTab,
  emptyMessage, onAdvance, onCancel, onItemDone,
}: Props) {
  return (
    <div className={`
      flex-col overflow-hidden border-r border-zinc-800 last:border-r-0
      md:flex md:flex-1
      ${isActiveTab ? 'flex flex-1' : 'hidden'}
    `}>
      {/* カラムヘッダー */}
      <div className={`px-4 py-3 border-b border-zinc-800 shrink-0 ${headerClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {orders.length > 0 && (
            <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
              {orders.length}
            </span>
          )}
        </div>
      </div>

      {/* カード一覧 */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {orders.length > 0 ? (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              settings={settings}
              onAdvance={() => onAdvance(order)}
              onCancel={() => onCancel(order)}
              onItemDone={(itemId, done) => onItemDone(order.id, itemId, done)}
            />
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm py-16">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  )
}
