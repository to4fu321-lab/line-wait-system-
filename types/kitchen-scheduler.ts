// ============================================================
// Kitchen Scheduler — 型定義
// ============================================================

/** タイムスロットの粒度（分）。変更する場合は lib/kitchen-scheduler.ts の SLOT_MINUTES も合わせること */
export const SLOT_MINUTES = 5

/** 調理機材タイプの識別子（menus.station_type / kitchen_stations.station_type と対応） */
export type StationType = 'grill' | 'fryer' | 'drink' | 'other' | (string & {})

// ──────────────────────────────────────────────
// DB エンティティ
// ──────────────────────────────────────────────

export interface KitchenStation {
  id:           string
  store_id:     string
  name:         string
  station_type: StationType
  capacity:     number       // 同時調理可能数
  is_active:    boolean
  created_at:   string
}

// ──────────────────────────────────────────────
// スケジューリング
// ──────────────────────────────────────────────

/**
 * 注文チャネル。
 * - immediate  : 即時テイクアウト／店内（pickup_time なし）
 * - reservation: 事前予約（pickup_time あり → バックワードスケジューリング）
 */
export type ScheduleChannel = 'immediate' | 'reservation'

/**
 * 各アイテムのスロット割り当て結果。
 * スケジューラーが 1 order_item ごとに生成する。
 */
export interface ScheduledTask {
  orderId:              string
  orderNumber:          string
  itemId:               string
  menuName:             string
  stationType:          StationType
  quantity:             number
  freshQty:             number        // 通常調理する個数
  bufferQty:            number        // バッファ（作り置き）から引き当てた個数
  effectiveCookMinutes: number        // 実際に使用する調理時間（バッファ混在時は重み付き平均）
  stationId:            string
  stationName:          string
  slotStart:            Date
  slotEnd:              Date
  targetReadyAt:        Date          // SLA 目標完成時刻
  channel:              ScheduleChannel
}

/**
 * バッチ調理指示。
 * 直近ホライゾン内で同じメニューに割り当てられたタスクをまとめた「厨房への指示単位」。
 * BatchView で表示するデータ形式。
 */
export interface BatchInstruction {
  menuName:      string
  stationType:   StationType
  totalQty:      number
  freshQty:      number         // 今から調理が必要な個数
  bufferQty:     number         // 作り置きから仕上げるだけでよい個数
  earliestStart: Date           // 最も早い slotStart（「この時刻までに取り掛かれ」の基準）
  latestStart:   Date
  tasks:         ScheduledTask[]
}

/**
 * buildSchedule() の戻り値。
 */
export interface ScheduleResult {
  tasks:             ScheduledTask[]
  batchInstructions: BatchInstruction[]
  /** アクティブなステーションが存在しないなどの理由でスロット割り当てできなかったアイテム */
  unschedulable:     { orderId: string; itemId: string; reason: string }[]
}

// ──────────────────────────────────────────────
// バッファ（仮想在庫）
// ──────────────────────────────────────────────

/**
 * 仮想バッファの状態型。
 * key   = menu.name（メニュー名。同じ名前＝同じ品目として管理）
 * value = 現在の半調理済み在庫数
 */
export type VirtualBuffer = Map<string, number>

/** consumeBuffer() の戻り値 */
export interface BufferConsumeResult {
  fromBuffer:    number
  fromFresh:     number
  updatedBuffer: VirtualBuffer
}
