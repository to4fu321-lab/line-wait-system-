// ============================================================
// Kitchen Scheduler — コアロジック（純粋関数）
//
// すべての関数は副作用なし。Reactの外でも単体テスト可能。
// ============================================================

import type { TakeoutOrder, TakeoutSettings, Menu } from '@/types/takeout'
import type {
  KitchenStation,
  ScheduledTask,
  BatchInstruction,
  ScheduleResult,
  ScheduleChannel,
  VirtualBuffer,
  BufferConsumeResult,
} from '@/types/kitchen-scheduler'

// ── 定数 ────────────────────────────────────────────────────

const SLOT_MINUTES          = 5    // タイムスロット粒度（分）
const DEFAULT_COOK_MINUTES  = 10   // メニューに cook_minutes が未設定の場合のデフォルト
const BATCH_HORIZON_MINUTES = 30   // バッチ指示の生成対象となる直近の時間幅（分）
const MAX_SLOTS_TO_SEARCH   = 288  // スロット探索の上限（= 24時間 ÷ 5分）

// ── スロット時刻ユーティリティ ───────────────────────────────

/** Date → SLOT_MINUTES 単位のスロットキー（ISO文字列） */
function toSlotKey(date: Date): string {
  const ms = Math.floor(date.getTime() / (SLOT_MINUTES * 60_000)) * (SLOT_MINUTES * 60_000)
  return new Date(ms).toISOString()
}

/** 指定時刻以降の最初のスロット境界（切り上げ） */
function ceilToSlot(date: Date): Date {
  const ms = Math.ceil(date.getTime() / (SLOT_MINUTES * 60_000)) * (SLOT_MINUTES * 60_000)
  return new Date(ms)
}

/** 指定時刻以前の最後のスロット境界（切り捨て） */
function floorToSlot(date: Date): Date {
  const ms = Math.floor(date.getTime() / (SLOT_MINUTES * 60_000)) * (SLOT_MINUTES * 60_000)
  return new Date(ms)
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

// ── 型エイリアス（内部用） ───────────────────────────────────

/** stationId → slotKey → その時刻に調理中のアイテム数 */
type SlotMap = Map<string, Map<string, number>>

// ── 1. SLA ルーティング ────────────────────────────────────

/**
 * 注文チャネルを判定する。
 * pickup_time が設定されていれば「予約」、なければ「即時」。
 */
export function getChannel(order: TakeoutOrder): ScheduleChannel {
  return order.pickup_time ? 'reservation' : 'immediate'
}

/**
 * 注文の SLA 目標完成時刻を算出する。
 *
 * - 予約注文: pickup_time がターゲット（逆算スケジューリングの基準）
 * - 即時注文: 注文受付時刻 + target_minutes（デフォルト15分）
 */
export function computeTargetReadyAt(
  order:    TakeoutOrder,
  settings: TakeoutSettings
): Date {
  if (order.pickup_time) return new Date(order.pickup_time)
  const target = settings.target_minutes ?? 15
  return addMinutes(new Date(order.created_at), target)
}

/**
 * 注文リストを SLA 優先順（Earliest Deadline First）でソートする。
 * 同一締め切りの場合は受付時刻が早い方を優先。
 */
export function sortOrdersBySLA(
  orders:   TakeoutOrder[],
  settings: TakeoutSettings
): TakeoutOrder[] {
  return [...orders].sort((a, b) => {
    const deadlineDiff =
      computeTargetReadyAt(a, settings).getTime() -
      computeTargetReadyAt(b, settings).getTime()
    if (deadlineDiff !== 0) return deadlineDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

// ── 2. タイムスロット & キャパシティ管理 ────────────────────

/**
 * 指定ステーションが [slotStart, slotStart + cookMinutes) の間、
 * itemCount 分の追加を受け入れられるかチェックする。
 *
 * 各 SLOT_MINUTES の区間で「すでに調理中のアイテム数 + itemCount <= capacity」
 * を全区間で満たす場合のみ true。
 */
function hasCapacity(
  stationId: string,
  slotStart: Date,
  cookMinutes: number,
  itemCount: number,
  capacity: number,
  slotMap: SlotMap
): boolean {
  const stationSlots = slotMap.get(stationId)
  const slotEnd      = addMinutes(slotStart, cookMinutes)
  let   t            = new Date(slotStart)

  while (t < slotEnd) {
    const used = stationSlots?.get(toSlotKey(t)) ?? 0
    if (used + itemCount > capacity) return false
    t = addMinutes(t, SLOT_MINUTES)
  }
  return true
}

/**
 * スロットマップにアイテムを書き込む（調理中としてキャパシティを消費）。
 */
function occupySlots(
  stationId:   string,
  slotStart:   Date,
  cookMinutes: number,
  itemCount:   number,
  slotMap:     SlotMap
): void {
  if (!slotMap.has(stationId)) slotMap.set(stationId, new Map())
  const stationSlots = slotMap.get(stationId)!
  const slotEnd      = addMinutes(slotStart, cookMinutes)
  let   t            = new Date(slotStart)

  while (t < slotEnd) {
    const key = toSlotKey(t)
    stationSlots.set(key, (stationSlots.get(key) ?? 0) + itemCount)
    t = addMinutes(t, SLOT_MINUTES)
  }
}

/**
 * フォワードスケジューリング：notBefore 以降で最速のスロットを探す。
 * 即時注文・予約注文のフォールバック（過去の pickup_time）に使用。
 */
function scheduleForward(
  stations:    KitchenStation[],
  stationType: string,
  itemCount:   number,
  cookMinutes: number,
  notBefore:   Date,
  slotMap:     SlotMap
): { station: KitchenStation; slotStart: Date } | null {
  const compatible = stations.filter(s => s.station_type === stationType && s.is_active)
  if (compatible.length === 0) return null

  let slotStart = ceilToSlot(notBefore)

  for (let i = 0; i < MAX_SLOTS_TO_SEARCH; i++) {
    for (const station of compatible) {
      if (hasCapacity(station.id, slotStart, cookMinutes, itemCount, station.capacity, slotMap)) {
        return { station, slotStart }
      }
    }
    slotStart = addMinutes(slotStart, SLOT_MINUTES)
  }
  return null
}

/**
 * バックワードスケジューリング：mustEndBy までに完了できる最遅スロットを探す。
 * pickup_time が設定された予約注文に使用。
 * 現在時刻より前のスロットには戻れないため、その場合はフォワードにフォールバック。
 */
function scheduleBackward(
  stations:    KitchenStation[],
  stationType: string,
  itemCount:   number,
  cookMinutes: number,
  mustEndBy:   Date,
  slotMap:     SlotMap,
  now:         Date
): { station: KitchenStation; slotStart: Date } | null {
  const compatible = stations.filter(s => s.station_type === stationType && s.is_active)
  if (compatible.length === 0) return null

  // 「完了時刻 = mustEndBy」となる最遅の開始スロット
  let slotStart = floorToSlot(addMinutes(mustEndBy, -cookMinutes))
  const earliest = ceilToSlot(now)

  for (let i = 0; i < MAX_SLOTS_TO_SEARCH; i++) {
    if (slotStart < earliest) {
      // 現在より前には行けない → フォワードにフォールバック
      return scheduleForward(stations, stationType, itemCount, cookMinutes, now, slotMap)
    }
    for (const station of compatible) {
      if (hasCapacity(station.id, slotStart, cookMinutes, itemCount, station.capacity, slotMap)) {
        return { station, slotStart }
      }
    }
    slotStart = addMinutes(slotStart, -SLOT_MINUTES)
  }
  return null
}

// ── 4. 仮想バッファ（半調理在庫）引き当て ───────────────────

/**
 * バッファから指定メニューの在庫を引き当てる。
 *
 * ※ キーは menuName（品目名）。stationType ではなく品目単位で管理することで
 *    「唐揚げ5個・コロッケ3個」のように細粒度な在庫追跡を可能にしている。
 *
 * @param buffer   現在の仮想在庫マップ（不変）
 * @param menuName 引き当て対象のメニュー名
 * @param needed   引き当てたい個数
 * @returns fromBuffer（在庫から）+ fromFresh（新規調理）の内訳と更新後バッファ
 */
export function consumeBuffer(
  buffer:   VirtualBuffer,
  menuName: string,
  needed:   number
): BufferConsumeResult {
  const available   = buffer.get(menuName) ?? 0
  const fromBuffer  = Math.min(available, needed)
  const fromFresh   = needed - fromBuffer
  const updatedBuffer = new Map(buffer)

  if (fromBuffer > 0) {
    const remaining = available - fromBuffer
    remaining > 0
      ? updatedBuffer.set(menuName, remaining)
      : updatedBuffer.delete(menuName)
  }

  return { fromBuffer, fromFresh, updatedBuffer }
}

// ── 3. & 統合：buildSchedule ────────────────────────────────

/**
 * 全注文・全アイテムをスケジューリングしてタスクリストとバッチ指示を返す。
 *
 * アルゴリズム概要:
 *   1. EDF（最早締め切り優先）で注文をソート
 *   2. 各アイテムに対し仮想バッファを引き当て
 *   3. 有効調理時間（バッファ分は finish_minutes、新規分は cook_minutes の重み付き平均）を算出
 *   4. 予約 → バックワード / 即時 → フォワードでスロットを割り当て
 *   5. 直近ホライゾン内のタスクをメニュー名でグルーピングしバッチ指示を生成
 *
 * @param orders   スケジューリング対象の注文（pending / preparing のみ渡すこと）
 * @param menuMap  menu.name をキーにしたメニューマップ
 * @param stations kitchen_stations のリスト
 * @param buffer   現在の仮想バッファ（この関数は変更しない）
 * @param settings TakeoutSettings
 * @param now      現在時刻（テスト時に差し替え可能）
 */
export function buildSchedule(
  orders:   TakeoutOrder[],
  menuMap:  Map<string, Menu>,
  stations: KitchenStation[],
  buffer:   VirtualBuffer,
  settings: TakeoutSettings,
  now:      Date = new Date()
): ScheduleResult {
  const tasks:         ScheduledTask[]            = []
  const unschedulable: ScheduleResult['unschedulable'] = []
  const slotMap:       SlotMap                    = new Map()
  let   currentBuffer  = new Map(buffer)  // 引き当てが進むにつれ減っていくローカルコピー

  const sorted = sortOrdersBySLA(orders, settings)

  for (const order of sorted) {
    const channel     = getChannel(order)
    const targetReady = computeTargetReadyAt(order, settings)

    for (const item of order.items ?? []) {
      if (item.is_done) continue   // 完了済みはスケジューリング不要

      const menu        = menuMap.get(item.name)
      const stationType = menu?.station_type ?? 'other'
      const cookMins    = menu?.cook_minutes  ?? DEFAULT_COOK_MINUTES

      // 仕上げ時間: 明示値がなければ cook_minutes の 30% を使用
      const finishMins  = menu?.finish_minutes ?? Math.max(1, Math.round(cookMins * 0.3))

      // バッファ引き当て
      const { fromBuffer, fromFresh, updatedBuffer } = consumeBuffer(
        currentBuffer, item.name, item.quantity
      )
      currentBuffer = updatedBuffer

      // 有効調理時間（バッファ分は仕上げのみ、フレッシュ分は通常、の重み付き平均）
      const effectiveMins = item.quantity > 0
        ? Math.max(1, Math.round(
            (fromBuffer * finishMins + fromFresh * cookMins) / item.quantity
          ))
        : cookMins

      // スロット割り当て
      const result = channel === 'reservation'
        ? scheduleBackward(stations, stationType, item.quantity, effectiveMins, targetReady, slotMap, now)
        : scheduleForward(stations, stationType, item.quantity, effectiveMins, now, slotMap)

      if (!result) {
        unschedulable.push({
          orderId: order.id,
          itemId:  item.id,
          reason:  stations.some(s => s.station_type === stationType && s.is_active)
            ? `No available slot found within search window for station_type '${stationType}'`
            : `No active station for station_type '${stationType}'`,
        })
        continue
      }

      const { station, slotStart } = result
      occupySlots(station.id, slotStart, effectiveMins, item.quantity, slotMap)

      tasks.push({
        orderId:              order.id,
        itemId:               item.id,
        menuName:             item.name,
        stationType,
        quantity:             item.quantity,
        freshQty:             fromFresh,
        bufferQty:            fromBuffer,
        effectiveCookMinutes: effectiveMins,
        stationId:            station.id,
        stationName:          station.name,
        slotStart,
        slotEnd:              addMinutes(slotStart, effectiveMins),
        targetReadyAt:        targetReady,
        channel,
      })
    }
  }

  const batchInstructions = computeBatchInstructions(tasks, now, BATCH_HORIZON_MINUTES)
  return { tasks, batchInstructions, unschedulable }
}

// ── 3. 動的バッチ指示の生成 ─────────────────────────────────

/**
 * 直近 horizonMinutes 以内に開始予定のタスクをメニュー名でグルーピングし、
 * 「〇〇を合計△個作る」形式のバッチ指示配列を生成する。
 *
 * BatchView コンポーネントへ渡すデータ形式として使用。
 *
 * @param tasks          buildSchedule() で生成されたタスクリスト
 * @param now            現在時刻
 * @param horizonMinutes バッチ対象の時間幅（分）
 */
export function computeBatchInstructions(
  tasks:           ScheduledTask[],
  now:             Date,
  horizonMinutes:  number = BATCH_HORIZON_MINUTES
): BatchInstruction[] {
  const horizon  = addMinutes(now, horizonMinutes)
  const relevant = tasks.filter(t => t.slotStart >= now && t.slotStart <= horizon)

  const map = new Map<string, BatchInstruction>()

  for (const task of relevant) {
    const existing = map.get(task.menuName)
    if (existing) {
      existing.totalQty  += task.quantity
      existing.freshQty  += task.freshQty
      existing.bufferQty += task.bufferQty
      if (task.slotStart < existing.earliestStart) existing.earliestStart = task.slotStart
      if (task.slotStart > existing.latestStart)   existing.latestStart   = task.slotStart
      existing.tasks.push(task)
    } else {
      map.set(task.menuName, {
        menuName:      task.menuName,
        stationType:   task.stationType,
        totalQty:      task.quantity,
        freshQty:      task.freshQty,
        bufferQty:     task.bufferQty,
        earliestStart: task.slotStart,
        latestStart:   task.slotStart,
        tasks:         [task],
      })
    }
  }

  // 開始時刻の早い順に並べる（厨房への時系列指示順）
  return Array.from(map.values()).sort(
    (a, b) => a.earliestStart.getTime() - b.earliestStart.getTime()
  )
}

// ── ユーティリティ（外部公開） ──────────────────────────────

/**
 * Menu 配列を name → Menu のマップに変換するヘルパー。
 * useKitchenScheduler フックや SSR での事前計算に使用。
 */
export function buildMenuMap(menus: Menu[]): Map<string, Menu> {
  return new Map(menus.map(m => [m.name, m]))
}
