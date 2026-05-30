'use client'

// ============================================================
// useKitchenScheduler — Reactフック
//
// kitchen_stations をロードし、仮想バッファ状態を管理し、
// buildSchedule() を orders/menus/stations/buffer の変化に応じて
// 自動再計算して ScheduleResult を返す。
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TakeoutOrder, TakeoutSettings, Menu } from '@/types/takeout'
import type { KitchenStation, ScheduleResult, VirtualBuffer } from '@/types/kitchen-scheduler'
import { buildSchedule, buildMenuMap, consumeBuffer } from '@/lib/kitchen-scheduler'

// ──────────────────────────────────────────────
// フック本体
// ──────────────────────────────────────────────

/**
 * @param storeId  店舗 ID
 * @param orders   スケジューリング対象の注文（pending / preparing）
 * @param menus    メニューマスター（cook_minutes / station_type / finish_minutes 含む）
 * @param settings TakeoutSettings
 */
export function useKitchenScheduler(
  storeId:  string,
  orders:   TakeoutOrder[],
  menus:    Menu[],
  settings: TakeoutSettings
) {
  const [stations,        setStations]        = useState<KitchenStation[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)

  // ── 仮想バッファ（半調理在庫）
  // key: menu.name（品目名）, value: 現在の在庫数
  // ※ 仕様上 stationType をキーとする案もあったが、同じステーションを使う複数品目を
  //   区別するために menuName をキーとして実装。
  const [virtualBuffer, setVirtualBuffer] = useState<VirtualBuffer>(new Map())

  // ── kitchen_stations のロード
  useEffect(() => {
    setStationsLoading(true)
    supabase
      .from('kitchen_stations')
      .select('*')
      .eq('store_id', storeId)
      .then(({ data, error }) => {
        if (!error && data) setStations(data as KitchenStation[])
        setStationsLoading(false)
      })
  }, [storeId])

  // ── Realtime: kitchen_stations の変化をリッスン
  useEffect(() => {
    const channel = supabase
      .channel(`kitchen-stations-${storeId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'kitchen_stations',
        filter: `store_id=eq.${storeId}`,
      }, () => {
        supabase
          .from('kitchen_stations')
          .select('*')
          .eq('store_id', storeId)
          .then(({ data }) => { if (data) setStations(data as KitchenStation[]) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [storeId])

  // ── メニューマップ（name → Menu）のメモ化
  const menuMap = useMemo(() => buildMenuMap(menus), [menus])

  // ── スケジュール計算（orders / stations / buffer / settings のいずれかが変化したら再計算）
  const schedule = useMemo((): ScheduleResult => {
    if (stationsLoading) {
      return { tasks: [], batchInstructions: [], unschedulable: [] }
    }
    return buildSchedule(orders, menuMap, stations, virtualBuffer, settings)
  }, [orders, menuMap, stations, virtualBuffer, settings, stationsLoading])

  // ── estimated_ready_at の書き戻し（3秒デバウンス）
  const writebackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (schedule.tasks.length === 0) return

    // orderId ごとに最大の slotEnd を計算
    const readyAtMap = new Map<string, Date>()
    for (const task of schedule.tasks) {
      const current = readyAtMap.get(task.orderId)
      if (!current || task.slotEnd > current) {
        readyAtMap.set(task.orderId, task.slotEnd)
      }
    }

    if (writebackTimerRef.current) clearTimeout(writebackTimerRef.current)
    writebackTimerRef.current = setTimeout(async () => {
      const entries = Array.from(readyAtMap.entries())
      for (const [orderId, readyAt] of entries) {
        await supabase
          .from('takeout_orders')
          .update({ estimated_ready_at: readyAt.toISOString() } as never)
          .eq('id', orderId)
      }
    }, 3000)

    return () => {
      if (writebackTimerRef.current) clearTimeout(writebackTimerRef.current)
    }
  }, [schedule])

  // ──────────────────────────────────────────
  // 仮想バッファ操作関数
  // ──────────────────────────────────────────

  /**
   * 半調理済み在庫を追加する。
   * 仕込み完了時にスタッフが手動で呼び出す（UI は今後実装）。
   *
   * @param menuName メニュー名（menu.name）
   * @param amount   追加する個数
   */
  const addVirtualBuffer = useCallback((menuName: string, amount: number) => {
    if (amount <= 0) return
    setVirtualBuffer(prev => {
      const next = new Map(prev)
      next.set(menuName, (next.get(menuName) ?? 0) + amount)
      return next
    })
  }, [])

  /**
   * 半調理済み在庫を手動で消費する（内部関数 / 調整用）。
   * buildSchedule() 内部では consumeBuffer() が自動で呼ばれるため、
   * 通常この関数を外部から呼ぶ必要はない。
   * スタッフが誤入力を修正する場合などに使用。
   *
   * @param menuName メニュー名（menu.name）
   * @param amount   消費する個数
   */
  const consumeVirtualBuffer = useCallback((menuName: string, amount: number) => {
    if (amount <= 0) return
    setVirtualBuffer(prev => {
      const { updatedBuffer } = consumeBuffer(prev, menuName, amount)
      return updatedBuffer
    })
  }, [])

  /**
   * 特定メニューの仮想バッファ残量を取得するヘルパー。
   */
  const getBufferCount = useCallback(
    (menuName: string): number => virtualBuffer.get(menuName) ?? 0,
    [virtualBuffer]
  )

  return {
    /** タスクリスト・バッチ指示・スケジューリング不可アイテムを含む結果 */
    schedule,
    /** 直近ホライゾン内のバッチ調理指示（BatchView へ渡す） */
    batchInstructions: schedule.batchInstructions,
    /** アクティブな kitchen_stations リスト */
    stations,
    /** 仮想バッファ（menuName → 在庫数）の現在状態 */
    virtualBuffer,
    /** 在庫を追加する: addVirtualBuffer(menuName, amount) */
    addVirtualBuffer,
    /** 在庫を手動消費する: consumeVirtualBuffer(menuName, amount) */
    consumeVirtualBuffer,
    /** 在庫残量を取得: getBufferCount(menuName) */
    getBufferCount,
    /** kitchen_stations のロード中かどうか */
    isLoading: stationsLoading,
  }
}
