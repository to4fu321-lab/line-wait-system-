'use client'

import type { TakeoutOrder } from '@/types/takeout'
import type { BatchInstruction } from '@/types/kitchen-scheduler'

// ── フォールバック：スケジューラーなし時の単純集計 ────────────
interface LegacyItem {
  name:      string
  totalQty:  number
  breakdown: { orderNumber: string; qty: number }[]
}

function aggregateLegacy(orders: TakeoutOrder[]): LegacyItem[] {
  const map = new Map<string, LegacyItem>()
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const ex = map.get(item.name)
      if (ex) {
        ex.totalQty += item.quantity
        ex.breakdown.push({ orderNumber: order.order_number, qty: item.quantity })
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

// ── 時刻表示ヘルパー ────────────────────────────────────────
function formatStartTime(date: Date): string {
  const diffMin = Math.round((date.getTime() - Date.now()) / 60_000)
  if (diffMin <= 2)  return '今すぐ'
  if (diffMin <= 60) return `${diffMin}分後`
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

const STATION_LABEL: Record<string, string> = {
  grill: '🔥 焼き台',
  fryer: '🍳 フライヤー',
  drink: '🥤 ドリンク',
  other: '📦 その他',
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  orders:       TakeoutOrder[]
  instructions?: BatchInstruction[]   // スケジューラーから渡される場合
  onClose:      () => void
}

export default function BatchView({ orders, instructions, onClose }: Props) {
  const hasSchedule = instructions && instructions.length > 0
  const legacy      = hasSchedule ? [] : aggregateLegacy(orders)

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0 bg-zinc-900">
        <div>
          <h2 className="font-bold text-lg">バッチ調理ビュー</h2>
          <p className="text-xs text-zinc-500">
            {hasSchedule
              ? `スケジューラー算出 · 直近30分 ${instructions!.length}品目`
              : `受付中・調理中 ${orders.length}件を集計`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="bg-zinc-800 text-zinc-300 rounded-full w-9 h-9 flex items-center justify-center text-xl active:scale-95"
        >×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ── スケジューラーあり ── */}
        {hasSchedule ? (
          <div className="flex flex-col gap-3 max-w-lg mx-auto">
            {instructions!.map(inst => {
              const startLabel = formatStartTime(inst.earliestStart)
              const isNow      = startLabel === '今すぐ'

              return (
                <div key={inst.menuName} className={`rounded-xl p-4 flex flex-col gap-2 border ${
                  isNow ? 'bg-orange-950/40 border-orange-700/50' : 'bg-zinc-900 border-zinc-800'
                }`}>
                  {/* 1行目：品目名 + 合計個数 */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xl text-white truncate">{inst.menuName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-500">
                          {STATION_LABEL[inst.stationType] ?? inst.stationType}
                        </span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                          isNow
                            ? 'bg-orange-500 text-white'
                            : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {startLabel}
                        </span>
                      </div>
                    </div>
                    <span className="text-4xl font-black shrink-0 tabular-nums">
                      ×{inst.totalQty}
                    </span>
                  </div>

                  {/* 2行目：フレッシュ / バッファ内訳 */}
                  {inst.bufferQty > 0 && (
                    <div className="flex gap-2 text-xs">
                      <span className="bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full">
                        🍳 新規 {inst.freshQty}個
                      </span>
                      <span className="bg-emerald-900/60 text-emerald-300 px-2.5 py-1 rounded-full">
                        ✓ 作り置き {inst.bufferQty}個
                      </span>
                    </div>
                  )}

                  {/* 3行目：注文内訳 */}
                  <div className="flex flex-wrap gap-1.5">
                    {inst.tasks.map((t, i) => (
                      <span key={i} className="bg-zinc-800 text-zinc-400 text-xs px-2.5 py-1 rounded-full">
                        {t.orderNumber} × {t.quantity}
                        {t.bufferQty > 0 && <span className="text-emerald-500 ml-1">(仕上げ)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── スケジューラーなし（フォールバック） ── */
          <div className="flex flex-col gap-3 max-w-lg mx-auto">
            {legacy.length === 0 ? (
              <div className="flex items-center justify-center h-full text-zinc-600 py-20">
                集計対象の注文がありません
              </div>
            ) : legacy.map(item => (
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
