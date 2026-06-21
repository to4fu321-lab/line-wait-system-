export type ReservationStatus =
  | 'confirmed'  // 予約確定
  | 'arrived'    // 来店済み
  | 'called'     // 呼出中
  | 'completed'  // 対応完了
  | 'cancelled'  // キャンセル
  | 'no_show'    // 無断欠席

export interface Reservation {
  id:            string
  store_id:      string
  customer_id:   string | null
  customer_name?: string | null   // 未登録客の氏名（CRM非汚染。customer_id があればそちら優先）
  child_id:      string | null
  reserved_at:   string
  purpose:       string | null
  service_type?: string | null
  line_user_id?: string | null
  status:        ReservationStatus
  queue_id:      string | null
  notes:         string | null
  created_at:    string
  updated_at:    string
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed:  '予約確定',
  arrived:    '来店済み',
  called:     '呼出中',
  completed:  '対応完了',
  cancelled:  'キャンセル',
  no_show:    '無断欠席',
}

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  confirmed:  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  arrived:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  called:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed:  'bg-zinc-700/60 text-zinc-400 border-zinc-600/50',
  cancelled:  'bg-red-500/20 text-red-400 border-red-500/30',
  no_show:    'bg-red-900/40 text-red-500 border-red-700/40',
}
