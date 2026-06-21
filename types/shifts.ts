// ──────────────────────────────────────────────────────────────
// シフト管理の型定義
//   対応マイグレーション: supabase/migrations/20260621_shift_management.sql
//   staff は types/master.ts の Staff を再利用(join 用)。
// ──────────────────────────────────────────────────────────────
import type { Staff } from './master'

// ── シフト本体 ────────────────────────────────────────────────
export type ShiftStatus = 'draft' | 'published' | 'cancelled'

export interface Shift {
  id:              string
  store_id:        string          // 勤務地店舗
  staff_id:        string
  home_store_id:   string | null   // スタッフ所属店舗(ヘルプ判定)
  work_date:       string          // YYYY-MM-DD
  start_time:      string          // HH:MM(:SS)
  end_time:        string
  break_minutes:   number
  position:        string | null
  status:          ShiftStatus
  is_help:         boolean
  help_request_id: string | null
  hourly_wage:     number | null   // shift単位の上書き(無ければ staff.hourly_wage)
  note:            string | null
  created_at:      string
  updated_at:      string
  staff?:          Staff           // join
}

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  draft:     '下書き',
  published: '公開済み',
  cancelled: '取消',
}

// ── 希望シフト ────────────────────────────────────────────────
export type ShiftRequestKind   = 'work' | 'off' | 'any'
export type ShiftRequestStatus = 'submitted' | 'approved' | 'rejected'

export interface ShiftRequest {
  id:                string
  store_id:          string
  staff_id:          string
  work_date:         string
  kind:              ShiftRequestKind
  pref_start:        string | null
  pref_end:          string | null
  note:              string | null
  status:            ShiftRequestStatus
  resolved_shift_id: string | null
  created_at:        string
  updated_at:        string
  staff?:            Staff
}

export const SHIFT_REQUEST_KIND_LABELS: Record<ShiftRequestKind, string> = {
  work: '勤務可',
  off:  '休み希望',
  any:  'いつでも',
}
export const SHIFT_REQUEST_STATUS_LABELS: Record<ShiftRequestStatus, string> = {
  submitted: '未確認',
  approved:  '承認済み',
  rejected:  '却下',
}

// ── 店舗間ヘルプ募集 ──────────────────────────────────────────
export type HelpRequestStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled'

export interface ShiftHelpRequest {
  id:                  string
  group_id:            string
  requesting_store_id: string
  work_date:           string
  start_time:          string
  end_time:            string
  headcount:           number
  position:            string | null
  note:                string | null
  status:              HelpRequestStatus
  created_at:          string
  updated_at:          string
  // API join(任意)
  requesting_store_name?: string
  offers?:             ShiftHelpOffer[]
}

export const HELP_REQUEST_STATUS_LABELS: Record<HelpRequestStatus, string> = {
  open:             '募集中',
  partially_filled: '一部確定',
  filled:           '充足',
  cancelled:        '取消',
}

// ── ヘルプ応募/割当 ───────────────────────────────────────────
export type HelpOfferStatus = 'offered' | 'accepted' | 'declined' | 'assigned'

export interface ShiftHelpOffer {
  id:                string
  help_request_id:   string
  staff_id:          string
  offering_store_id: string
  status:            HelpOfferStatus
  shift_id:          string | null
  note:              string | null
  created_at:        string
  updated_at:        string
  staff?:            Staff
  offering_store_name?: string
}

export const HELP_OFFER_STATUS_LABELS: Record<HelpOfferStatus, string> = {
  offered:  '応募中',
  accepted: '受諾',
  declined: '辞退',
  assigned: '確定',
}

// ── アプリ内メッセージ ────────────────────────────────────────
export type MessageSender = 'manager' | 'staff'

export interface ShiftMessage {
  id:         string
  store_id:   string
  staff_id:   string | null   // NULL = 全体連絡
  sender:     MessageSender
  body:       string
  read_at:    string | null
  created_at: string
}

// ── 人件費予算 ────────────────────────────────────────────────
export interface ShiftBudget {
  id:            string
  store_id:      string
  year_month:    string        // 'YYYY-MM'
  budget_amount: number | null
  note:          string | null
  created_at:    string
  updated_at:    string
}

// ── 勤務パターン雛形 ──────────────────────────────────────────
export interface ShiftTemplate {
  id:            string
  store_id:      string
  label:         string
  start_time:    string
  end_time:      string
  break_minutes: number
  color:         string | null
  sort_order:    number
  active:        boolean
  created_at:    string
  updated_at:    string
}
