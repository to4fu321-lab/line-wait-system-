export type QueueStatus   = 'waiting' | 'calling' | 'completed' | 'cancelled'
export type QueueCategory = 'fitting' | 'pickup' | 'other'
export type Gender        = 'male' | 'female' | 'other'

export interface WaitThreshold {
  max_wait: number | null
  text: string
}

export interface Group {
  id: string
  name: string
  created_at: string
}

export interface Store {
  id: string
  group_id: string | null
  name: string
  pin: string
  is_open: boolean
  wait_thresholds: WaitThreshold[]
  notice_threshold: number
  allow_remote: boolean
  remote_threshold: number
  created_at: string
}

export interface Queue {
  id: string
  store_id: string
  ticket_number: number
  status: QueueStatus
  school_name: string
  customer_name: string
  child_name: string | null
  category: QueueCategory
  gender: Gender
  line_user_id: string | null
  details: Record<string, unknown> | null
  is_remote: boolean
  checked_in: boolean
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: Group
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      queues: {
        Row: Queue
        Insert: {
          id?: string; store_id: string; ticket_number: number; status?: QueueStatus
          school_name: string; customer_name: string; child_name?: string | null
          category: QueueCategory; gender: Gender; line_user_id?: string | null
          details?: Record<string, unknown> | null; created_at?: string
        }
        Update: {
          id?: string; store_id?: string; ticket_number?: number; status?: QueueStatus
          school_name?: string; customer_name?: string; child_name?: string | null
          category?: QueueCategory; gender?: Gender; line_user_id?: string | null
          details?: Record<string, unknown> | null; created_at?: string
        }
        Relationships: []
      }
      takeout_orders: {
        Row: {
          id: string; store_id: string; order_number: string; line_user_id: string | null
          customer_name: string | null; status: string; total_amount: number
          notes: string | null; pickup_time: string | null; order_source: string
          notified_preparing: boolean; notified_ready: boolean
          estimated_ready_at: string | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; store_id: string; order_number: string; line_user_id?: string | null
          customer_name?: string | null; status?: string; total_amount?: number
          notes?: string | null; pickup_time?: string | null; order_source?: string
          notified_preparing?: boolean; notified_ready?: boolean
          estimated_ready_at?: string | null; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; store_id?: string; order_number?: string; line_user_id?: string | null
          customer_name?: string | null; status?: string; total_amount?: number
          notes?: string | null; pickup_time?: string | null; order_source?: string
          notified_preparing?: boolean; notified_ready?: boolean
          estimated_ready_at?: string | null; updated_at?: string
        }
        Relationships: []
      }
      takeout_order_items: {
        Row: {
          id: string; order_id: string; menu_id: string | null; name: string
          unit_price: number; quantity: number; notes: string | null
          is_done: boolean; created_at: string
        }
        Insert: {
          id?: string; order_id: string; menu_id?: string | null; name: string
          unit_price?: number; quantity?: number; notes?: string | null
          is_done?: boolean; created_at?: string
        }
        Update: {
          id?: string; order_id?: string; menu_id?: string | null; name?: string
          unit_price?: number; quantity?: number; notes?: string | null
          is_done?: boolean
        }
        Relationships: []
      }
      stores: {
        Row: Store & { takeout_settings: Record<string, unknown>; business_type: string }
        Insert: {
          id?: string; group_id?: string | null; name: string; pin?: string
          is_open?: boolean; wait_thresholds?: WaitThreshold[]; notice_threshold?: number
          takeout_settings?: Record<string, unknown>; business_type?: string; created_at?: string
        }
        Update: {
          id?: string; group_id?: string | null; name?: string; pin?: string
          is_open?: boolean; wait_thresholds?: WaitThreshold[]; notice_threshold?: number
          takeout_settings?: Record<string, unknown>; business_type?: string; created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_next_ticket_number: {
        Args: { p_store_id: string }
        Returns: number
      }
      get_next_order_number: {
        Args: { p_store_id: string }
        Returns: string
      }
    }
    Enums: {
      queue_status: QueueStatus
      queue_category: QueueCategory
    }
    CompositeTypes: Record<string, never>
  }
}

export const CATEGORY_LABELS: Record<QueueCategory, string> = {
  fitting: '採寸',
  pickup:  '受取',
  other:   'その他',
}

export const CATEGORY_ICONS: Record<QueueCategory, string> = {
  fitting: '📏',
  pickup:  '📦',
  other:   '💬',
}

export const STATUS_LABELS: Record<QueueStatus, string> = {
  waiting:   '待ち',
  calling:   '呼出中',
  completed: '完了',
  cancelled: '不在',
}

export const GENDER_LABELS: Record<Gender, string> = {
  male:   '👦男性',
  female: '👧女性',
  other:  '',
}

export const GENDER_STYLES: Record<Gender, string> = {
  male:   'bg-blue-100 text-blue-700',
  female: 'bg-pink-100 text-pink-700',
  other:  '',
}

export const DEFAULT_THRESHOLDS: WaitThreshold[] = [
  { max_wait: 4,    text: 'まもなくお呼びします。お近くでお待ちください。' },
  { max_wait: 9,    text: '中程度の待ち時間が発生しています。館内でお待ちください。' },
  { max_wait: null, text: 'ただいま大変混み合っております。お時間を潰してお待ちいただけます。' },
]

export function getWaitMessage(waitingAhead: number, thresholds: WaitThreshold[]): string {
  const sorted = [...thresholds].sort((a, b) => {
    if (a.max_wait === null) return 1
    if (b.max_wait === null) return -1
    return a.max_wait - b.max_wait
  })
  for (const t of sorted) {
    if (t.max_wait === null || waitingAhead <= t.max_wait) return t.text
  }
  return ''
}
