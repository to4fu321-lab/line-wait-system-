// ──────────────────────────────────────────────
// ステータス定義
// ──────────────────────────────────────────────
export type TakeoutOrderStatus =
  | 'pending'    // 受付
  | 'preparing'  // 調理中
  | 'ready'      // 完成
  | 'completed'  // お渡し済み
  | 'cancelled'  // キャンセル

export const DEFAULT_STATUS_LABELS: Record<TakeoutOrderStatus, string> = {
  pending:   '受付',
  preparing: '調理中',
  ready:     '完成',
  completed: 'お渡し済み',
  cancelled: 'キャンセル',
}

// 各ステータスでのアクションボタンラベル（skip_preparingを考慮して関数で解決）
export function getActionLabel(
  status: TakeoutOrderStatus,
  settings: TakeoutSettings
): string {
  const customLabels = settings.status_labels ?? {}
  if (status === 'pending') {
    return settings.skip_preparing
      ? `${customLabels.ready ?? '完成'}にする`
      : '調理開始'
  }
  if (status === 'preparing') return `${customLabels.ready ?? '完成'}にする`
  if (status === 'ready')     return 'お渡し完了'
  return ''
}

// 次ステータスを返す（skip_preparingを考慮）
export function getNextStatus(
  status: TakeoutOrderStatus,
  settings: TakeoutSettings
): TakeoutOrderStatus | null {
  if (status === 'pending')   return settings.skip_preparing ? 'ready' : 'preparing'
  if (status === 'preparing') return 'ready'
  if (status === 'ready')     return 'completed'
  return null
}

// LINE通知を送るステータスか
export function shouldNotify(
  status: TakeoutOrderStatus,
  settings: TakeoutSettings
): boolean {
  if (status === 'preparing') return settings.notify_on_preparing ?? true
  if (status === 'ready')     return settings.notify_on_ready ?? true
  return false
}

// ──────────────────────────────────────────────
// 緊急度（キッチン画面の色制御）
// ──────────────────────────────────────────────
export type UrgencyLevel = 'normal' | 'warning' | 'urgent'

export function getUrgencyLevel(
  createdAt: string,
  status: TakeoutOrderStatus,
  targetMinutes: number = 15
): UrgencyLevel {
  if (status === 'pending') return 'normal'
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000 / 60
  if (elapsed >= targetMinutes)        return 'urgent'
  if (elapsed >= targetMinutes * 0.65) return 'warning'
  return 'normal'
}

// ──────────────────────────────────────────────
// テイクアウト設定（store単位でカスタマイズ）
// ──────────────────────────────────────────────
export interface TakeoutSettings {
  skip_preparing?:        boolean
  status_labels?:         Partial<Record<TakeoutOrderStatus, string>>
  target_minutes?:        number
  combo_timeout_seconds?: number
  notify_on_preparing?:   boolean
  notify_on_ready?:       boolean
}

// ──────────────────────────────────────────────
// メニュー
// ──────────────────────────────────────────────
export interface MenuCategory {
  id:         string
  store_id:   string
  name:       string
  sort_order: number
  is_active:  boolean
  created_at: string
}

export interface Menu {
  id:           string
  store_id:     string
  category_id:  string | null
  name:         string
  description:  string | null
  price:        number
  image_url:    string | null
  is_available: boolean
  sort_order:   number
  created_at:   string
  updated_at:   string
  category?:    MenuCategory
}

// ──────────────────────────────────────────────
// 注文
// ──────────────────────────────────────────────
export interface TakeoutOrderItem {
  id:         string
  order_id:   string
  menu_id:    string | null
  name:       string
  unit_price: number
  quantity:   number
  notes:      string | null
  created_at: string
}

export interface TakeoutOrder {
  id:                 string
  store_id:           string
  order_number:       string
  line_user_id:       string | null
  customer_name:      string | null
  status:             TakeoutOrderStatus
  total_amount:       number
  notes:              string | null
  notified_preparing: boolean
  notified_ready:     boolean
  estimated_ready_at: string | null
  created_at:         string
  updated_at:         string
  items?:             TakeoutOrderItem[]
}
