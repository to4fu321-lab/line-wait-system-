export type QueueStatus   = 'waiting' | 'calling' | 'completed' | 'cancelled'
export type QueueCategory = 'fitting' | 'pickup' | 'other'
export type Gender        = 'male' | 'female' | 'other'

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
      stores: {
        Row: Store
        Insert: { id?: string; group_id?: string | null; name: string; pin?: string; is_open?: boolean; created_at?: string }
        Update: { id?: string; group_id?: string | null; name?: string; pin?: string; is_open?: boolean; created_at?: string }
        Relationships: []
      }
      queues: {
        Row: Queue
        Insert: {
          id?: string
          store_id: string
          ticket_number: number
          status?: QueueStatus
          school_name: string
          customer_name: string
          child_name?: string | null
          category: QueueCategory
          gender: Gender
          line_user_id?: string | null
          details?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          ticket_number?: number
          status?: QueueStatus
          school_name?: string
          customer_name?: string
          child_name?: string | null
          category?: QueueCategory
          gender?: Gender
          line_user_id?: string | null
          details?: Record<string, unknown> | null
          created_at?: string
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
