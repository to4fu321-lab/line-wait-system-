export type QueueStatus = 'waiting' | 'calling' | 'completed' | 'cancelled'
export type QueueCategory = 'fitting' | 'pickup' | 'other'

export interface Queue {
  id: string
  ticket_number: number
  status: QueueStatus
  school_name: string
  customer_name: string
  category: QueueCategory
  line_user_id: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      queues: {
        Row: Queue
        Insert: {
          id?: string
          ticket_number: number
          status?: QueueStatus
          school_name: string
          customer_name: string
          category: QueueCategory
          line_user_id?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Queue, 'id' | 'created_at'>>
      }
    }
    Functions: {
      get_next_ticket_number: {
        Args: Record<string, never>
        Returns: number
      }
    }
  }
}

export const CATEGORY_LABELS: Record<QueueCategory, string> = {
  fitting: '採寸',
  pickup: '受取',
  other: 'その他',
}

export const CATEGORY_ICONS: Record<QueueCategory, string> = {
  fitting: '📏',
  pickup: '📦',
  other: '💬',
}

export const STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: '待機中',
  calling: '呼出中',
  completed: '完了',
  cancelled: '不在',
}
