'use client'

import { useState } from 'react'
import type { TakeoutOrder } from '@/types/takeout'
import type { BatchInstruction, TimeBucket, StationType } from '@/types/kitchen-scheduler'
import { TIME_BUCKET_LABEL } from '@/types/kitchen-scheduler'

// ── ステーション表示設定 ─────────────────────────────────────
const STATION_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  grill: { icon: '🔥', label: '焼き台',      color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-700/40' },
  fryer: { icon: '🍳', label: 'フライヤー',   color: 'text-yellow-400', bg: 'bg-yellow-950/40 border-yellow-700/40' },
  drink: { icon: '🥤', label: 'ドリンク',     color: 'text-sky-400',    bg: 'bg-sky-950/40    border-sky-700/40'    },
  other: { icon: '📦', label: 'その他',       color: 'text-zinc-400',   bg: 'bg-zinc-900      border-zinc-700'      },
}
function stationCfg(type: string) {
  return STATION_CONFIG[type] ?? { icon: '⚙️', label: type, color: 'text-zinc-400', bg: 'bg-zinc-900 border-zinc-700' }
}

// ── 時間バケット設定 ────────────────────────────────────────
const BUCKET_CONFIG: Record<TimeBucket, { color: string; bg: string; badge: string }> = {
  now:   { color: 'text-orange-300', bg: 'bg-orange-950/30 border-orange-700/30', badge: 'bg-orange-500 text-white' },
  soon:  { color: 'text-amber-300',  bg: 'bg-amber-950/20  border-amber-700/20',  badge: 'bg-amber-500  text-zinc-950' },
  later: { color: 'text-zinc-400',   bg: 'bg-zinc-900/60   border-zinc-700/30',   badge: 'bg-zinc-700   text-zinc-200' },
}

// ── フォールバック集計（スケジューラーなし時）────────────────
interface LegacyItem { name: string; totalQty: number; breakdown: { orderNumber: string; qty: number }[] }

function aggregateLegacy(orders: TakeoutOrder[]): LegacyItem[] {
  const map = new Map<string, LegacyItem>()
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const ex = map.get(item.name)
      if (ex) {
        ex.totalQty += item.quantity
        ex.breakdown.push({ orderNumber: order.order_number, qty: item.quantity })
      } else {
        map.set(item.name, { name: item.name, totalQty: item.quantity, breakdown: [{ orderNumber: order.order_number, qty: item.quantity }] })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty)
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  orders:       TakeoutOrder[]
  instructions?: BatchInstruction[]
  onClose:      () => void
}

// ── メインコンポーネント ─────────────────────────────────────
export default function BatchView({ orders, instructions, onClose }: Props) {
  const hasSchedule = !!instructions && instructions.length > 0

  // ステーションタブ（動的生成）
  const stationTypes: StationType[] = hasSchedule
    ? ['all' as StationType, ...Array.from(new Set(instructions!.map(i => i.stationType)))]
    : []
  const [activeStation, setActiveStation] = useState<StationType>('all')

  const filtered = hasSchedule
    ? (activeStation === 'all' ? instructions! : instructions!.filter(i => i.stationType === activeStation))
    : []

  // timeBucket × 指示リスト
  const buckets: TimeBucket[] = ['now', 'soon', 'later']
  const byBucket = (b: TimeBucket) => filtered.filter(i => i.timeBucket === b)

  // フォールバック
  const legacy = hasSchedule ? [] : aggregateLegacy(orders)

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">

      {/* ── ヘッダー ── */}
      <div className="shrink-0 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="font-bold text-lg">バッチ調理ビュー</h2>
            <p className="text-xs text-zinc-500">
              {hasSchedule
                ? `スケジューラー算出 · 直近30分 · ${filtered.length}バッチ`
                : `受付中・調理中 ${orders.length}件を集計`}
            </p>
          </div>
          <button onClick={onClose}
            className="bg-zinc-800 text-zinc-300 rounded-full w-9 h-9 flex items-center justify-center text-xl active:scale-95">
            ×
          </button>
        </div>

        {/* ── ステーションタブ ── */}
        {hasSchedule && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
            {stationTypes.map(type => {
              const cfg    = type === 'all' ? null : stationCfg(type)
              const isActive = activeStation === type
              const count  = type === 'all'
                ? instructions!.length
                : instructions!.filter(i => i.stationType === type).length
              return (
                <button key={type} onClick={() => setActiveStation(type)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${
                    isActive
                      ? 'bg-white text-zinc-950 border-white'
                      : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60 active:scale-95'
                  }`}>
                  {type === 'all' ? '🍽' : cfg!.icon}
                  <span>{type === 'all' ? 'すべて' : cfg!.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-700 text-zinc-400'
                  }`}>{count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── コンテンツ ── */}
      <div className="flex-1 overflow-y-auto">
        {hasSchedule ? (
          <div className="max-w-lg mx-auto p-4 flex flex-col gap-6">

            {buckets.map(bucket => {
              const items = byBucket(bucket)
              if (items.length === 0) return null
              const bcfg = BUCKET_CONFIG[bucket]

              return (
                <div key={bucket}>
                  {/* セクションヘッダー */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${bcfg.badge}`}>
                      {TIME_BUCKET_LABEL[bucket]}
                    </span>
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-xs text-zinc-600">{items.length}品目</span>
                  </div>

                  {/* バッチカード */}
                  <div className="flex flex-col gap-2.5">
                    {items.map((inst, idx) => {
                      const scfg = stationCfg(inst.stationType)
                      return (
                        <div key={idx} className={`rounded-xl p-4 flex flex-col gap-2.5 border ${bcfg.bg}`}>

                          {/* 品目名 + 個数 */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-xl text-white leading-tight truncate">
                                {inst.menuName}
                              </div>
                              <div className={`text-xs font-bold mt-0.5 ${scfg.color}`}>
                                {scfg.icon} {scfg.label}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-4xl font-black tabular-nums text-white leading-none">
                                ×{inst.totalQty}
                              </div>
                            </div>
                          </div>

                          {/* フレッシュ / バッファ内訳 */}
                          {inst.bufferQty > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              <span className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full font-bold">
                                🍳 新規 {inst.freshQty}個
                              </span>
                              <span className="text-xs bg-emerald-900/60 text-emerald-300 px-2.5 py-1 rounded-full font-bold">
                                ✓ 作り置き仕上げ {inst.bufferQty}個
                              </span>
                            </div>
                          )}

                          {/* 注文内訳 */}
                          <div className="flex flex-wrap gap-1.5">
                            {inst.tasks.map((t, i) => (
                              <span key={i} className="bg-zinc-800/80 text-zinc-400 text-xs px-2.5 py-1 rounded-full">
                                {t.orderNumber} × {t.quantity}
                                {t.bufferQty > 0 && (
                                  <span className="text-emerald-500 ml-1">仕上げ</span>
                                )}
                              </span>
                            ))}
                          </div>

                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
                このステーションの調理指示はありません
              </div>
            )}
          </div>

        ) : (
          /* フォールバック */
          <div className="flex flex-col gap-3 max-w-lg mx-auto p-4">
            {legacy.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
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
