'use client'

// ============================================================================
//  お仕事タブのバッジ件数
//
//  BottomNav と SideNav が同じ集計を別々に書いていて、しかもお仕事ページの
//  ダッシュボードのタイルとも定義がずれていた。実害が出たのが次のケース:
//
//    ・repairs_focus プランは「発注」「入荷待ち」タブが OFF
//    ・なのにバッジは purchase_orders を無条件に数えていた
//    → 画面のどのタイルも 0 なのにバッジだけ 1。ユーザーには消しようがない
//
//  そこで集計をここに1本化し、「その店の画面に出ていて、押せば片付く件数」
//  だけを数える。タイルの定義（app/[storeId]/admin/repairs/page.tsx）と
//  1対1で対応させること。
//
//    お直し   repair_histories status=received              常時
//    追加購入 uniform_orders   status<>delivered            常時
//    発注     purchase_orders  status in (received,ordered) repairs_tab_purchase
//    入荷待ち purchase_orders  status in (on_order,stocked) repairs_tab_arrival
//    お渡し   repair_histories status=completed
//             + purchase_orders status=arrived              repairs_tab_delivery
//    問合せ   inquiries        status=pending               tab_inquiries
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FeatureKey } from '@/lib/features'

type HasFeature = (k: FeatureKey) => boolean

const REFRESH_MS = 60000

// 件数が変わる操作をしたら notifyWorkChanged() を呼ぶ。
// 60秒待たずにバッジへ反映される（完了にしたのにバッジが残る、を防ぐ）
const listeners = new Set<() => void>()
export function notifyWorkChanged() { listeners.forEach(fn => fn()) }

const countOf = (table: string, storeId: string) =>
  (supabase as any).from(table).select('*', { count: 'exact', head: true }).eq('store_id', storeId)

export async function fetchWorkBadgeCount(storeId: string, hasFeature: HasFeature): Promise<number> {
  const zero = Promise.resolve({ count: 0 })
  const [repairs, uniforms, toOrder, toArrive, doneRepairs, arrived, inquiries] = await Promise.all([
    countOf('repair_histories', storeId).eq('status', 'received'),
    countOf('uniform_orders', storeId).not('status', 'in', '("delivered")'),
    hasFeature('repairs_tab_purchase')
      ? countOf('purchase_orders', storeId).in('status', ['received', 'ordered']) : zero,
    hasFeature('repairs_tab_arrival')
      ? countOf('purchase_orders', storeId).in('status', ['on_order', 'stocked']) : zero,
    hasFeature('repairs_tab_delivery')
      ? countOf('repair_histories', storeId).eq('status', 'completed') : zero,
    hasFeature('repairs_tab_delivery')
      ? countOf('purchase_orders', storeId).eq('status', 'arrived') : zero,
    hasFeature('tab_inquiries')
      ? countOf('inquiries', storeId).eq('status', 'pending') : zero,
  ])
  return [repairs, uniforms, toOrder, toArrive, doneRepairs, arrived, inquiries]
    .reduce((sum, r) => sum + (r.count ?? 0), 0)
}

/**
 * お仕事タブのバッジ。定期更新に加えて
 *   ・notifyWorkChanged() を呼ばれたとき
 *   ・タブに戻ってきたとき（別端末や他ページでの操作を拾う）
 * にも取り直す。
 * featLoaded が false の間は数えない（機能ON/OFFが未確定のまま数えると、
 * OFF のタブの件数を一瞬バッジに出してしまう）
 */
export function useWorkBadge(storeId: string, hasFeature: HasFeature, featLoaded: boolean): number {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!storeId || !featLoaded) return
    try { setCount(await fetchWorkBadgeCount(storeId, hasFeature)) }
    catch { /* 次の定期更新で回復する */ }
  }, [storeId, featLoaded, hasFeature])

  useEffect(() => {
    if (!storeId || !featLoaded) return
    refresh()
    const t = setInterval(refresh, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    listeners.add(refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      listeners.delete(refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [storeId, featLoaded, refresh])

  return count
}
