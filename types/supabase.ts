// ============================================================
// Supabase Database 型定義（本番スキーマから自動生成）
// 再生成: npm run gen:types （または本番DBの information_schema から生成）
// 手動編集しないこと。スキーマ変更時は必ず再生成する。
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      children: {
        Row: {
          id: string
          customer_id: string
          store_id: string
          name: string
          kana: string | null
          school_name: string | null
          grade: string | null
          created_at: string
          updated_at: string
          school_id: string | null
          gender: string | null
          admission_year: number | null
        }
        Insert: {
          id?: string
          customer_id: string
          store_id: string
          name: string
          kana?: string | null
          school_name?: string | null
          grade?: string | null
          created_at?: string
          updated_at?: string
          school_id?: string | null
          gender?: string | null
          admission_year?: number | null
        }
        Update: {
          id?: string
          customer_id?: string
          store_id?: string
          name?: string
          kana?: string | null
          school_name?: string | null
          grade?: string | null
          created_at?: string
          updated_at?: string
          school_id?: string | null
          gender?: string | null
          admission_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "children_customer_id_fkey",
            columns: [
              "customer_id"
            ],
            isOneToOne: false,
            referencedRelation: "customers",
            referencedColumns: [
              "id"
            ]
          }
        ]
      }
      coupons: {
        Row: {
          id: string
          store_id: string
          code: string
          label: string
          discount: string
          valid_until: string | null
          issued_to: string
          used: boolean
          used_at: string | null
          updated_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          code?: string
          label?: string
          discount?: string
          valid_until?: string | null
          issued_to?: string
          used?: boolean
          used_at?: string | null
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          code?: string
          label?: string
          discount?: string
          valid_until?: string | null
          issued_to?: string
          used?: boolean
          used_at?: string | null
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_tags: {
        Row: {
          id: string
          store_id: string
          name: string
          color: string | null
          description: string | null
          sort_order: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          color?: string | null
          description?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          color?: string | null
          description?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          store_id: string
          name: string
          kana: string | null
          tel: string | null
          line_user_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
          parent_name: string | null
          school_name: string | null
          gender: string | null
          category: string | null
          parent_kana: string | null
          deleted_at: string | null
          staff_notes: string | null
          school_id: string | null
          updated_by: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          kana?: string | null
          tel?: string | null
          line_user_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          parent_name?: string | null
          school_name?: string | null
          gender?: string | null
          category?: string | null
          parent_kana?: string | null
          deleted_at?: string | null
          staff_notes?: string | null
          school_id?: string | null
          updated_by?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          kana?: string | null
          tel?: string | null
          line_user_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          parent_name?: string | null
          school_name?: string | null
          gender?: string | null
          category?: string | null
          parent_kana?: string | null
          deleted_at?: string | null
          staff_notes?: string | null
          school_id?: string | null
          updated_by?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          id: string
          store_id: string | null
          store_name: string | null
          kind: string
          body: string
          page_url: string | null
          user_agent: string | null
          status: string
          created_at: string
          updated_at: string
          issue_number: number | null
          issue_url: string | null
          priority: string | null
          ai_category: string | null
          ai_recommendation: string | null
          ai_implementable: boolean | null
          approved_at: string | null
          approved_by: string | null
          image_urls: string[] | null
        }
        Insert: {
          id?: string
          store_id?: string | null
          store_name?: string | null
          kind?: string
          body: string
          page_url?: string | null
          user_agent?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          issue_number?: number | null
          issue_url?: string | null
          priority?: string | null
          ai_category?: string | null
          ai_recommendation?: string | null
          ai_implementable?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          image_urls?: string[] | null
        }
        Update: {
          id?: string
          store_id?: string | null
          store_name?: string | null
          kind?: string
          body?: string
          page_url?: string | null
          user_agent?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          issue_number?: number | null
          issue_url?: string | null
          priority?: string | null
          ai_category?: string | null
          ai_recommendation?: string | null
          ai_implementable?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          image_urls?: string[] | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          id: string
          name: string
          created_at: string
          code: string | null
          pin: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          code?: string | null
          pin?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          code?: string | null
          pin?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          id: string
          store_id: string
          customer_id: string | null
          customer_name: string | null
          content: string
          type: string
          is_urgent: boolean
          due_date: string | null
          status: string
          response_method: string | null
          response_notes: string | null
          responded_at: string | null
          created_at: string
          updated_at: string
          received_by: string | null
          handled_by: string | null
          request_no: number | null
        }
        Insert: {
          id?: string
          store_id: string
          customer_id?: string | null
          customer_name?: string | null
          content: string
          type?: string
          is_urgent?: boolean
          due_date?: string | null
          status?: string
          response_method?: string | null
          response_notes?: string | null
          responded_at?: string | null
          created_at?: string
          updated_at?: string
          received_by?: string | null
          handled_by?: string | null
          request_no?: number | null
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string | null
          customer_name?: string | null
          content?: string
          type?: string
          is_urgent?: boolean
          due_date?: string | null
          status?: string
          response_method?: string | null
          response_notes?: string | null
          responded_at?: string | null
          created_at?: string
          updated_at?: string
          received_by?: string | null
          handled_by?: string | null
          request_no?: number | null
        }
        Relationships: []
      }
      kantan_tasks: {
        Row: {
          id: string
          store_id: string
          task_date: string
          seq: number
          task_type: string
          ref_id: string
          label: string
          status: string
          done_by: string | null
          done_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          task_date?: string
          seq: number
          task_type: string
          ref_id: string
          label: string
          status?: string
          done_by?: string | null
          done_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          task_date?: string
          seq?: number
          task_type?: string
          ref_id?: string
          label?: string
          status?: string
          done_by?: string | null
          done_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      kitchen_stations: {
        Row: {
          id: string
          store_id: string
          name: string
          station_type: string
          capacity: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          station_type: string
          capacity?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          station_type?: string
          capacity?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          id: string
          store_id: string
          staff_id: string
          leave_type: string
          start_date: string
          end_date: string
          reason: string | null
          status: string | null
          reviewed_by: string | null
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          staff_id: string
          leave_type?: string
          start_date: string
          end_date: string
          reason?: string | null
          status?: string | null
          reviewed_by?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          staff_id?: string
          leave_type?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          status?: string | null
          reviewed_by?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      measurements: {
        Row: {
          id: string
          store_id: string
          child_id: string
          measured_date: string
          height_cm: number | null
          weight_kg: number | null
          chest_cm: number | null
          waist_cm: number | null
          inseam_cm: number | null
          confirmed_sizes: Json
          staff_memo: string | null
          status: string
          order_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          child_id: string
          measured_date?: string
          height_cm?: number | null
          weight_kg?: number | null
          chest_cm?: number | null
          waist_cm?: number | null
          inseam_cm?: number | null
          confirmed_sizes?: Json
          staff_memo?: string | null
          status?: string
          order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          child_id?: string
          measured_date?: string
          height_cm?: number | null
          weight_kg?: number | null
          chest_cm?: number | null
          waist_cm?: number | null
          inseam_cm?: number | null
          confirmed_sizes?: Json
          staff_memo?: string | null
          status?: string
          order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          id: string
          store_id: string
          name: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      menus: {
        Row: {
          id: string
          store_id: string
          category_id: string | null
          name: string
          description: string | null
          price: number
          image_url: string | null
          is_available: boolean
          sort_order: number
          created_at: string
          updated_at: string
          cook_minutes: number | null
          station_type: string | null
          finish_minutes: number | null
        }
        Insert: {
          id?: string
          store_id: string
          category_id?: string | null
          name: string
          description?: string | null
          price?: number
          image_url?: string | null
          is_available?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          cook_minutes?: number | null
          station_type?: string | null
          finish_minutes?: number | null
        }
        Update: {
          id?: string
          store_id?: string
          category_id?: string | null
          name?: string
          description?: string | null
          price?: number
          image_url?: string | null
          is_available?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          cook_minutes?: number | null
          station_type?: string | null
          finish_minutes?: number | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          id: string
          store_id: string
          category: string | null
          title: string
          body: string
          sort_order: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          category?: string | null
          title: string
          body: string
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          category?: string | null
          title?: string
          body?: string
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          id: string
          store_id: string
          type: string
          sent_at: string
          recipient_count: number
          unit_price: number
          total_amount: number
          filter_desc: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          type?: string
          sent_at?: string
          recipient_count?: number
          unit_price?: number
          total_amount?: number
          filter_desc?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          type?: string
          sent_at?: string
          recipient_count?: number
          unit_price?: number
          total_amount?: number
          filter_desc?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ocr_jobs: {
        Row: {
          id: string
          store_id: string
          job_type: string
          status: string
          input_meta: Json | null
          result: Json | null
          tokens_used: number | null
          error_msg: string | null
          created_at: string
          updated_at: string
          progress: Json | null
        }
        Insert: {
          id?: string
          store_id: string
          job_type: string
          status?: string
          input_meta?: Json | null
          result?: Json | null
          tokens_used?: number | null
          error_msg?: string | null
          created_at?: string
          updated_at?: string
          progress?: Json | null
        }
        Update: {
          id?: string
          store_id?: string
          job_type?: string
          status?: string
          input_meta?: Json | null
          result?: Json | null
          tokens_used?: number | null
          error_msg?: string | null
          created_at?: string
          updated_at?: string
          progress?: Json | null
        }
        Relationships: []
      }
      price_bands: {
        Row: {
          id: string
          store_id: string
          school_id: string
          product_id: string
          from_item_id: string | null
          to_item_id: string | null
          price_tax_in: number
          price_tax_out: number | null
          cost: number | null
          is_eo: boolean
          label: string | null
          sort_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          school_id: string
          product_id: string
          from_item_id?: string | null
          to_item_id?: string | null
          price_tax_in: number
          price_tax_out?: number | null
          cost?: number | null
          is_eo?: boolean
          label?: string | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          school_id?: string
          product_id?: string
          from_item_id?: string | null
          to_item_id?: string | null
          price_tax_in?: number
          price_tax_out?: number | null
          cost?: number | null
          is_eo?: boolean
          label?: string | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      prices: {
        Row: {
          id: string
          store_id: string
          school_id: string
          product_id: string
          size_set_item_id: string | null
          size_label: string | null
          price_tax_in: number
          price_tax_out: number | null
          cost: number | null
          is_eo: boolean
          valid_from: string | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          school_id: string
          product_id: string
          size_set_item_id?: string | null
          size_label?: string | null
          price_tax_in: number
          price_tax_out?: number | null
          cost?: number | null
          is_eo?: boolean
          valid_from?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          school_id?: string
          product_id?: string
          size_set_item_id?: string | null
          size_label?: string | null
          price_tax_in?: number
          price_tax_out?: number | null
          cost?: number | null
          is_eo?: boolean
          valid_from?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      processing_options: {
        Row: {
          id: string
          store_id: string
          name: string
          input_type: string
          unit: string | null
          default_price: number | null
          required: boolean
          applies_to_category: string[]
          choices: string[]
          notes: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          input_type?: string
          unit?: string | null
          default_price?: number | null
          required?: boolean
          applies_to_category?: string[]
          choices?: string[]
          notes?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          input_type?: string
          unit?: string | null
          default_price?: number | null
          required?: boolean
          applies_to_category?: string[]
          choices?: string[]
          notes?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          store_id: string
          school_id: string | null
          name: string
          category: string | null
          gender: string | null
          supplier_id: string | null
          maker: string | null
          maker_code: string | null
          color_code: string | null
          barcode: string | null
          stock: number | null
          washable: string | null
          size_set_id: string | null
          base_price_tax_in: number | null
          base_price_tax_out: number | null
          notes: string | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
          body_types: string[]
        }
        Insert: {
          id?: string
          store_id: string
          school_id?: string | null
          name: string
          category?: string | null
          gender?: string | null
          supplier_id?: string | null
          maker?: string | null
          maker_code?: string | null
          color_code?: string | null
          barcode?: string | null
          stock?: number | null
          washable?: string | null
          size_set_id?: string | null
          base_price_tax_in?: number | null
          base_price_tax_out?: number | null
          notes?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          body_types?: string[]
        }
        Update: {
          id?: string
          store_id?: string
          school_id?: string | null
          name?: string
          category?: string | null
          gender?: string | null
          supplier_id?: string | null
          maker?: string | null
          maker_code?: string | null
          color_code?: string | null
          barcode?: string | null
          stock?: number | null
          washable?: string | null
          size_set_id?: string | null
          base_price_tax_in?: number | null
          base_price_tax_out?: number | null
          notes?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          body_types?: string[]
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          id: string
          store_id: string
          customer_id: string
          item_name: string
          notes: string | null
          status: string
          price: number | null
          ordered_date: string
          arrived_date: string | null
          delivered_date: string | null
          notified: boolean
          created_at: string
          updated_at: string
          child_id: string | null
          maker: string | null
          payment_status: string | null
          delivered_by: string | null
          request_no: number | null
        }
        Insert: {
          id?: string
          store_id: string
          customer_id: string
          item_name: string
          notes?: string | null
          status?: string
          price?: number | null
          ordered_date?: string
          arrived_date?: string | null
          delivered_date?: string | null
          notified?: boolean
          created_at?: string
          updated_at?: string
          child_id?: string | null
          maker?: string | null
          payment_status?: string | null
          delivered_by?: string | null
          request_no?: number | null
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string
          item_name?: string
          notes?: string | null
          status?: string
          price?: number | null
          ordered_date?: string
          arrived_date?: string | null
          delivered_date?: string | null
          notified?: boolean
          created_at?: string
          updated_at?: string
          child_id?: string | null
          maker?: string | null
          payment_status?: string | null
          delivered_by?: string | null
          request_no?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          store_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string | null
          staff_id: string | null
          kind: string | null
        }
        Insert: {
          id?: string
          store_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string | null
          staff_id?: string | null
          kind?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string | null
          staff_id?: string | null
          kind?: string | null
        }
        Relationships: []
      }
      queues: {
        Row: {
          id: string
          store_id: string
          ticket_number: number
          status: string
          school_name: string | null
          customer_name: string
          child_name: string | null
          category: string
          gender: string
          line_user_id: string | null
          details: Json | null
          is_remote: boolean
          checked_in: boolean
          created_at: string
          customer_kana: string | null
          child_id: string | null
          customer_id: string | null
        }
        Insert: {
          id?: string
          store_id: string
          ticket_number: number
          status?: string
          school_name?: string | null
          customer_name: string
          child_name?: string | null
          category?: string
          gender?: string
          line_user_id?: string | null
          details?: Json | null
          is_remote?: boolean
          checked_in?: boolean
          created_at?: string
          customer_kana?: string | null
          child_id?: string | null
          customer_id?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          ticket_number?: number
          status?: string
          school_name?: string | null
          customer_name?: string
          child_name?: string | null
          category?: string
          gender?: string
          line_user_id?: string | null
          details?: Json | null
          is_remote?: boolean
          checked_in?: boolean
          created_at?: string
          customer_kana?: string | null
          child_id?: string | null
          customer_id?: string | null
        }
        Relationships: []
      }
      register_cash_movements: {
        Row: {
          id: string
          store_id: string
          session_id: string
          direction: string
          amount: number
          reason: string | null
          memo: string | null
          staff_id: string | null
          staff_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          session_id: string
          direction: string
          amount?: number
          reason?: string | null
          memo?: string | null
          staff_id?: string | null
          staff_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          session_id?: string
          direction?: string
          amount?: number
          reason?: string | null
          memo?: string | null
          staff_id?: string | null
          staff_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      register_sessions: {
        Row: {
          id: string
          store_id: string
          session_number: string | null
          status: string
          opened_at: string
          opened_by: string | null
          opened_by_name: string | null
          opening_float: number
          opening_denominations: Json
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          closing_denominations: Json | null
          closing_report: Json | null
          cash_theoretical: number | null
          cash_actual: number | null
          cash_variance: number | null
          total_sales: number | null
          total_variance: number | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          session_number?: string | null
          status?: string
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          opening_float?: number
          opening_denominations?: Json
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_denominations?: Json | null
          closing_report?: Json | null
          cash_theoretical?: number | null
          cash_actual?: number | null
          cash_variance?: number | null
          total_sales?: number | null
          total_variance?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          session_number?: string | null
          status?: string
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          opening_float?: number
          opening_denominations?: Json
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_denominations?: Json | null
          closing_report?: Json | null
          cash_theoretical?: number | null
          cash_actual?: number | null
          cash_variance?: number | null
          total_sales?: number | null
          total_variance?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      repair_garment_types: {
        Row: {
          id: string
          store_id: string
          code: string
          name: string
          icon: string | null
          sort_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          code: string
          name: string
          icon?: string | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          code?: string
          name?: string
          icon?: string | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      repair_histories: {
        Row: {
          id: string
          store_id: string
          customer_id: string
          child_id: string | null
          slip_number: string | null
          item_name: string
          content: string
          status: string
          received_date: string
          completed_date: string | null
          delivered_date: string | null
          price: number | null
          notes: string | null
          notified: boolean
          request_type: string | null
          prepaid: boolean
          desired_completion_date: string | null
          work_started: boolean
          request_no: number | null
          repair_type: string | null
          hem_length_mm: number | null
          sleeve_adjust_mm: number | null
          waist_adjust_mm: number | null
          embroidery_text: string | null
          embroidery_color: string | null
          embroidery_pos: string | null
          vendor_name: string | null
          sent_to_vendor_at: string | null
          expected_return_date: string | null
          is_rework: boolean | null
          rework_reason: string | null
          internal_memo: string | null
          garment_type_id: string | null
          item_id: string | null
          item_code: string | null
          garment_name: string | null
          base_price: number | null
          calculated_price: number | null
          final_price: number | null
          pricing_mode: string
          quote_status: string
          manual_reason: string | null
          selected_options: Json
          inputs: Json
          created_at: string
          updated_at: string
          vendor_id: string | null
          payment_status: string
          delivered_by: string | null
          inspected_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          customer_id: string
          child_id?: string | null
          slip_number?: string | null
          item_name: string
          content?: string
          status?: string
          received_date?: string
          completed_date?: string | null
          delivered_date?: string | null
          price?: number | null
          notes?: string | null
          notified?: boolean
          request_type?: string | null
          prepaid?: boolean
          desired_completion_date?: string | null
          work_started?: boolean
          request_no?: number | null
          repair_type?: string | null
          hem_length_mm?: number | null
          sleeve_adjust_mm?: number | null
          waist_adjust_mm?: number | null
          embroidery_text?: string | null
          embroidery_color?: string | null
          embroidery_pos?: string | null
          vendor_name?: string | null
          sent_to_vendor_at?: string | null
          expected_return_date?: string | null
          is_rework?: boolean | null
          rework_reason?: string | null
          internal_memo?: string | null
          garment_type_id?: string | null
          item_id?: string | null
          item_code?: string | null
          garment_name?: string | null
          base_price?: number | null
          calculated_price?: number | null
          final_price?: number | null
          pricing_mode?: string
          quote_status?: string
          manual_reason?: string | null
          selected_options?: Json
          inputs?: Json
          created_at?: string
          updated_at?: string
          vendor_id?: string | null
          payment_status?: string
          delivered_by?: string | null
          inspected_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string
          child_id?: string | null
          slip_number?: string | null
          item_name?: string
          content?: string
          status?: string
          received_date?: string
          completed_date?: string | null
          delivered_date?: string | null
          price?: number | null
          notes?: string | null
          notified?: boolean
          request_type?: string | null
          prepaid?: boolean
          desired_completion_date?: string | null
          work_started?: boolean
          request_no?: number | null
          repair_type?: string | null
          hem_length_mm?: number | null
          sleeve_adjust_mm?: number | null
          waist_adjust_mm?: number | null
          embroidery_text?: string | null
          embroidery_color?: string | null
          embroidery_pos?: string | null
          vendor_name?: string | null
          sent_to_vendor_at?: string | null
          expected_return_date?: string | null
          is_rework?: boolean | null
          rework_reason?: string | null
          internal_memo?: string | null
          garment_type_id?: string | null
          item_id?: string | null
          item_code?: string | null
          garment_name?: string | null
          base_price?: number | null
          calculated_price?: number | null
          final_price?: number | null
          pricing_mode?: string
          quote_status?: string
          manual_reason?: string | null
          selected_options?: Json
          inputs?: Json
          created_at?: string
          updated_at?: string
          vendor_id?: string | null
          payment_status?: string
          delivered_by?: string | null
          inspected_at?: string | null
        }
        Relationships: []
      }
      repair_items: {
        Row: {
          id: string
          store_id: string
          garment_type_id: string
          code: string
          name: string
          icon: string | null
          base_price: number
          price_unit: string
          measurements: Json
          manual: Json | null
          lead_time_days: number | null
          requires_quote: boolean
          sort_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          garment_type_id: string
          code: string
          name: string
          icon?: string | null
          base_price?: number
          price_unit?: string
          measurements?: Json
          manual?: Json | null
          lead_time_days?: number | null
          requires_quote?: boolean
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          garment_type_id?: string
          code?: string
          name?: string
          icon?: string | null
          base_price?: number
          price_unit?: string
          measurements?: Json
          manual?: Json | null
          lead_time_days?: number | null
          requires_quote?: boolean
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      repair_options: {
        Row: {
          id: string
          store_id: string
          item_id: string
          group_label: string | null
          group_select: string
          code: string
          name: string
          price_delta: number
          price_unit: string
          default_selected: boolean
          requires_quote: boolean
          manual: Json | null
          sort_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          item_id: string
          group_label?: string | null
          group_select?: string
          code: string
          name: string
          price_delta?: number
          price_unit?: string
          default_selected?: boolean
          requires_quote?: boolean
          manual?: Json | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          item_id?: string
          group_label?: string | null
          group_select?: string
          code?: string
          name?: string
          price_delta?: number
          price_unit?: string
          default_selected?: boolean
          requires_quote?: boolean
          manual?: Json | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      repair_photos: {
        Row: {
          id: string
          store_id: string
          repair_id: string
          phase: string
          path: string
          url: string | null
          note: string | null
          taken_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          repair_id: string
          phase?: string
          path: string
          url?: string | null
          note?: string | null
          taken_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          repair_id?: string
          phase?: string
          path?: string
          url?: string | null
          note?: string | null
          taken_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      repair_vendors: {
        Row: {
          id: string
          store_id: string
          name: string
          kana: string | null
          tel: string | null
          note: string | null
          sort_order: number | null
          active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          kana?: string | null
          tel?: string | null
          note?: string | null
          sort_order?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          kana?: string | null
          tel?: string | null
          note?: string | null
          sort_order?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reservation_date_overrides: {
        Row: {
          id: string
          store_id: string
          date: string
          max_slots: number
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          date: string
          max_slots?: number
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          date?: string
          max_slots?: number
          created_at?: string
        }
        Relationships: []
      }
      reservation_settings: {
        Row: {
          id: string
          store_id: string
          service_type: string
          label: string
          duration_min: number
          start_time: string
          end_time: string
          slots_sun: number | null
          slots_mon: number | null
          slots_tue: number | null
          slots_wed: number | null
          slots_thu: number | null
          slots_fri: number | null
          slots_sat: number | null
          is_active: boolean | null
        }
        Insert: {
          id?: string
          store_id: string
          service_type: string
          label: string
          duration_min?: number
          start_time?: string
          end_time?: string
          slots_sun?: number | null
          slots_mon?: number | null
          slots_tue?: number | null
          slots_wed?: number | null
          slots_thu?: number | null
          slots_fri?: number | null
          slots_sat?: number | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          store_id?: string
          service_type?: string
          label?: string
          duration_min?: number
          start_time?: string
          end_time?: string
          slots_sun?: number | null
          slots_mon?: number | null
          slots_tue?: number | null
          slots_wed?: number | null
          slots_thu?: number | null
          slots_fri?: number | null
          slots_sat?: number | null
          is_active?: boolean | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          id: string
          store_id: string
          customer_id: string | null
          child_id: string | null
          reserved_at: string
          purpose: string | null
          status: string
          queue_id: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
          service_type: string | null
          line_user_id: string | null
          customer_name: string | null
        }
        Insert: {
          id?: string
          store_id: string
          customer_id?: string | null
          child_id?: string | null
          reserved_at: string
          purpose?: string | null
          status?: string
          queue_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          service_type?: string | null
          line_user_id?: string | null
          customer_name?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string | null
          child_id?: string | null
          reserved_at?: string
          purpose?: string | null
          status?: string
          queue_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          service_type?: string | null
          line_user_id?: string | null
          customer_name?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          store_id: string
          source_type: string
          source_id: string | null
          name: string
          unit_price: number
          qty: number
          line_total: number
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          store_id: string
          source_type?: string
          source_id?: string | null
          name: string
          unit_price?: number
          qty?: number
          line_total?: number
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          store_id?: string
          source_type?: string
          source_id?: string | null
          name?: string
          unit_price?: number
          qty?: number
          line_total?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey",
            columns: [
              "sale_id"
            ],
            isOneToOne: false,
            referencedRelation: "sales",
            referencedColumns: [
              "id"
            ]
          }
        ]
      }
      order_payments: {
        Row: {
          id: string
          store_id: string
          order_id: string
          sale_id: string | null
          amount: number
          method: string | null
          kind: string
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          order_id: string
          sale_id?: string | null
          amount: number
          method?: string | null
          kind?: string
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          order_id?: string
          sale_id?: string | null
          amount?: number
          method?: string | null
          kind?: string
          created_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          id: string
          store_id: string
          sale_number: string | null
          staff_id: string | null
          customer_id: string | null
          child_id: string | null
          subtotal: number
          tax: number
          total: number
          tax_rate: number
          tax_inclusive: boolean
          payment_method: string
          cash_received: number | null
          change: number | null
          status: string
          note: string | null
          discount: number
          receipt_name: string | null
          receipt_note: string | null
          voided_at: string | null
          void_reason: string | null
          created_at: string
          register_session_id: string | null
        }
        Insert: {
          id?: string
          store_id: string
          sale_number?: string | null
          staff_id?: string | null
          customer_id?: string | null
          child_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          tax_rate?: number
          tax_inclusive?: boolean
          payment_method?: string
          cash_received?: number | null
          change?: number | null
          status?: string
          note?: string | null
          discount?: number
          receipt_name?: string | null
          receipt_note?: string | null
          voided_at?: string | null
          void_reason?: string | null
          created_at?: string
          register_session_id?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          sale_number?: string | null
          staff_id?: string | null
          customer_id?: string | null
          child_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          tax_rate?: number
          tax_inclusive?: boolean
          payment_method?: string
          cash_received?: number | null
          change?: number | null
          status?: string
          note?: string | null
          discount?: number
          receipt_name?: string | null
          receipt_note?: string | null
          voided_at?: string | null
          void_reason?: string | null
          created_at?: string
          register_session_id?: string | null
        }
        Relationships: []
      }
      scan_inbox: {
        Row: {
          id: string
          store_id: string
          slip_type: string
          extracted: Json
          confidence: string | null
          warnings: Json
          image_data: string | null
          status: string
          promoted_table: string | null
          promoted_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          slip_type: string
          extracted?: Json
          confidence?: string | null
          warnings?: Json
          image_data?: string | null
          status?: string
          promoted_table?: string | null
          promoted_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          slip_type?: string
          extracted?: Json
          confidence?: string | null
          warnings?: Json
          image_data?: string | null
          status?: string
          promoted_table?: string | null
          promoted_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_grades: {
        Row: {
          id: string
          school_id: string
          grade_name: string
          color_name: string
          color_hex: string
          sort_order: number
          updated_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id: string
          grade_name: string
          color_name?: string
          color_hex?: string
          sort_order?: number
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          grade_name?: string
          color_name?: string
          color_hex?: string
          sort_order?: number
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_grades_school_id_fkey",
            columns: [
              "school_id"
            ],
            isOneToOne: false,
            referencedRelation: "schools",
            referencedColumns: [
              "id"
            ]
          }
        ]
      }
      school_parent_tips: {
        Row: {
          id: string
          school_id: string
          store_id: string
          item_name: string
          tip_text: string
          line_uid: string
          approved: boolean
          updated_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id: string
          store_id: string
          item_name?: string
          tip_text: string
          line_uid?: string
          approved?: boolean
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          store_id?: string
          item_name?: string
          tip_text?: string
          line_uid?: string
          approved?: boolean
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_parent_tips_school_id_fkey",
            columns: [
              "school_id"
            ],
            isOneToOne: false,
            referencedRelation: "schools",
            referencedColumns: [
              "id"
            ]
          }
        ]
      }
      school_requirements: {
        Row: {
          id: string
          store_id: string
          school_id: string
          product_id: string
          required: boolean
          avg_qty: number | null
          uses_grade_color: boolean
          grade_color_note: string
          item_notes: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          school_id: string
          product_id: string
          required?: boolean
          avg_qty?: number | null
          uses_grade_color?: boolean
          grade_color_note?: string
          item_notes?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          school_id?: string
          product_id?: string
          required?: boolean
          avg_qty?: number | null
          uses_grade_color?: boolean
          grade_color_note?: string
          item_notes?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          id: string
          store_id: string
          name: string
          short_name: string | null
          sort_order: number
          active: boolean
          created_at: string
          updated_at: string
          wearing_regulations: string | null
          special_notes: string | null
          schedule_notes: string | null
          extra_info: string | null
          address: string | null
          tel: string | null
          kana: string
          notes: string
          updated_by: string
          order_deadline: string | null
          pickup_deadline: string | null
          measurement_start: string | null
          measurement_end: string | null
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          short_name?: string | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
          wearing_regulations?: string | null
          special_notes?: string | null
          schedule_notes?: string | null
          extra_info?: string | null
          address?: string | null
          tel?: string | null
          kana?: string
          notes?: string
          updated_by?: string
          order_deadline?: string | null
          pickup_deadline?: string | null
          measurement_start?: string | null
          measurement_end?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          short_name?: string | null
          sort_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
          wearing_regulations?: string | null
          special_notes?: string | null
          schedule_notes?: string | null
          extra_info?: string | null
          address?: string | null
          tel?: string | null
          kana?: string
          notes?: string
          updated_by?: string
          order_deadline?: string | null
          pickup_deadline?: string | null
          measurement_start?: string | null
          measurement_end?: string | null
        }
        Relationships: []
      }
      shift_budgets: {
        Row: {
          id: string
          store_id: string
          year_month: string
          budget_amount: number | null
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          year_month: string
          budget_amount?: number | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          year_month?: string
          budget_amount?: number | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_help_offers: {
        Row: {
          id: string
          help_request_id: string
          staff_id: string
          offering_store_id: string
          status: string | null
          shift_id: string | null
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          help_request_id: string
          staff_id: string
          offering_store_id: string
          status?: string | null
          shift_id?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          help_request_id?: string
          staff_id?: string
          offering_store_id?: string
          status?: string | null
          shift_id?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_help_requests: {
        Row: {
          id: string
          group_id: string
          requesting_store_id: string
          work_date: string
          start_time: string
          end_time: string
          headcount: number | null
          position: string | null
          note: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          requesting_store_id: string
          work_date: string
          start_time: string
          end_time: string
          headcount?: number | null
          position?: string | null
          note?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          requesting_store_id?: string
          work_date?: string
          start_time?: string
          end_time?: string
          headcount?: number | null
          position?: string | null
          note?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_messages: {
        Row: {
          id: string
          store_id: string
          staff_id: string | null
          sender: string
          body: string
          read_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          staff_id?: string | null
          sender: string
          body: string
          read_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          staff_id?: string | null
          sender?: string
          body?: string
          read_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      shift_requests: {
        Row: {
          id: string
          store_id: string
          staff_id: string
          work_date: string
          kind: string
          pref_start: string | null
          pref_end: string | null
          note: string | null
          status: string | null
          resolved_shift_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          staff_id: string
          work_date: string
          kind?: string
          pref_start?: string | null
          pref_end?: string | null
          note?: string | null
          status?: string | null
          resolved_shift_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          staff_id?: string
          work_date?: string
          kind?: string
          pref_start?: string | null
          pref_end?: string | null
          note?: string | null
          status?: string | null
          resolved_shift_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_swaps: {
        Row: {
          id: string
          store_id: string
          from_shift_id: string
          from_staff_id: string
          to_staff_id: string
          status: string | null
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          from_shift_id: string
          from_staff_id: string
          to_staff_id: string
          status?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          from_shift_id?: string
          from_staff_id?: string
          to_staff_id?: string
          status?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shift_templates: {
        Row: {
          id: string
          store_id: string
          label: string
          start_time: string
          end_time: string
          break_minutes: number | null
          color: string | null
          sort_order: number | null
          active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          label: string
          start_time: string
          end_time: string
          break_minutes?: number | null
          color?: string | null
          sort_order?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          label?: string
          start_time?: string
          end_time?: string
          break_minutes?: number | null
          color?: string | null
          sort_order?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          id: string
          store_id: string
          staff_id: string
          home_store_id: string | null
          work_date: string
          start_time: string
          end_time: string
          break_minutes: number | null
          position: string | null
          status: string | null
          is_help: boolean | null
          help_request_id: string | null
          hourly_wage: number | null
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          staff_id: string
          home_store_id?: string | null
          work_date: string
          start_time: string
          end_time: string
          break_minutes?: number | null
          position?: string | null
          status?: string | null
          is_help?: boolean | null
          help_request_id?: string | null
          hourly_wage?: number | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          staff_id?: string
          home_store_id?: string | null
          work_date?: string
          start_time?: string
          end_time?: string
          break_minutes?: number | null
          position?: string | null
          status?: string | null
          is_help?: boolean | null
          help_request_id?: string | null
          hourly_wage?: number | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      size_presets: {
        Row: {
          id: string
          store_id: string
          category: string | null
          label: string
          sort_order: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          category?: string | null
          label: string
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          category?: string | null
          label?: string
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      size_set_items: {
        Row: {
          id: string
          size_set_id: string
          label: string
          sort_order: number
        }
        Insert: {
          id?: string
          size_set_id: string
          label: string
          sort_order?: number
        }
        Update: {
          id?: string
          size_set_id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "size_set_items_size_set_id_fkey",
            columns: [
              "size_set_id"
            ],
            isOneToOne: false,
            referencedRelation: "size_sets",
            referencedColumns: [
              "id"
            ]
          }
        ]
      }
      size_sets: {
        Row: {
          id: string
          store_id: string
          supplier_id: string | null
          name: string
          category: string | null
          notes: string | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          supplier_id?: string | null
          name: string
          category?: string | null
          notes?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          supplier_id?: string | null
          name?: string
          category?: string | null
          notes?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          id: string
          store_id: string
          name: string
          kana: string | null
          role: string | null
          color: string | null
          pin: string | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
          hourly_wage: number | null
          tel: string | null
          employment_type: string | null
          skill_level: number | null
          skills: Json | null
          max_weekly_hours: number | null
          max_daily_hours: number | null
          commute_min: number | null
          availability: Json | null
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          kana?: string | null
          role?: string | null
          color?: string | null
          pin?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          hourly_wage?: number | null
          tel?: string | null
          employment_type?: string | null
          skill_level?: number | null
          skills?: Json | null
          max_weekly_hours?: number | null
          max_daily_hours?: number | null
          commute_min?: number | null
          availability?: Json | null
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          kana?: string | null
          role?: string | null
          color?: string | null
          pin?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          hourly_wage?: number | null
          tel?: string | null
          employment_type?: string | null
          skill_level?: number | null
          skills?: Json | null
          max_weekly_hours?: number | null
          max_daily_hours?: number | null
          commute_min?: number | null
          availability?: Json | null
        }
        Relationships: []
      }
      staff_line_accounts: {
        Row: {
          id: string
          store_id: string
          line_user_id: string
          display_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          line_user_id: string
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          line_user_id?: string
          display_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      staffing_requirements: {
        Row: {
          id: string
          store_id: string
          work_date: string
          time_block: string
          required: number
          reservations: number | null
          source: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          work_date: string
          time_block: string
          required?: number
          reservations?: number | null
          source?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          work_date?: string
          time_block?: string
          required?: number
          reservations?: number | null
          source?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      staffing_settings: {
        Row: {
          id: string
          store_id: string
          time_block_min: number | null
          min_staff: number | null
          max_staff: number | null
          fitting_minutes: number | null
          per_person_rooms: number | null
          conversion_rate: number | null
          visit_factor: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          time_block_min?: number | null
          min_staff?: number | null
          max_staff?: number | null
          fitting_minutes?: number | null
          per_person_rooms?: number | null
          conversion_rate?: number | null
          visit_factor?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          time_block_min?: number | null
          min_staff?: number | null
          max_staff?: number | null
          fitting_minutes?: number | null
          per_person_rooms?: number | null
          conversion_rate?: number | null
          visit_factor?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          id: string
          group_id: string | null
          name: string
          pin: string
          is_open: boolean
          wait_thresholds: Json
          notice_threshold: number
          allow_remote: boolean
          created_at: string
          business_type: string
          takeout_settings: Json
          business_hours: Json | null
          features: Json | null
          store_type: string
          school_names: string[] | null
          line_official_id: string | null
          order_schedule: Json | null
          notification_plan: string | null
          push_settings: Json | null
          alert_days_repair: number | null
          alert_days_purchase: number | null
          repair_notes: string | null
          welcome_message: string | null
          notice_text: string | null
          is_test_mode: boolean | null
          active_fittings: number
          staff_link_code: string | null
          timecard_settings: Json | null
          tax_rate: number
          invoice_number: string | null
          tax_inclusive: boolean
          owner_pin_hash: string | null
          staff_session_access_token: string | null
          staff_session_refresh_token: string | null
          staff_session_expires_at: string | null
          pop_settings: Json | null
          queue_pop_settings: Json | null
          ui_settings: Json | null
        }
        Insert: {
          id?: string
          group_id?: string | null
          name: string
          pin?: string
          is_open?: boolean
          wait_thresholds?: Json
          notice_threshold?: number
          allow_remote?: boolean
          created_at?: string
          business_type?: string
          takeout_settings?: Json
          business_hours?: Json | null
          features?: Json | null
          store_type?: string
          school_names?: string[] | null
          line_official_id?: string | null
          order_schedule?: Json | null
          notification_plan?: string | null
          push_settings?: Json | null
          alert_days_repair?: number | null
          alert_days_purchase?: number | null
          repair_notes?: string | null
          welcome_message?: string | null
          notice_text?: string | null
          is_test_mode?: boolean | null
          active_fittings?: number
          staff_link_code?: string | null
          timecard_settings?: Json | null
          tax_rate?: number
          invoice_number?: string | null
          tax_inclusive?: boolean
          owner_pin_hash?: string | null
          staff_session_access_token?: string | null
          staff_session_refresh_token?: string | null
          staff_session_expires_at?: string | null
          pop_settings?: Json | null
          queue_pop_settings?: Json | null
          ui_settings?: Json | null
        }
        Update: {
          id?: string
          group_id?: string | null
          name?: string
          pin?: string
          is_open?: boolean
          wait_thresholds?: Json
          notice_threshold?: number
          allow_remote?: boolean
          created_at?: string
          business_type?: string
          takeout_settings?: Json
          business_hours?: Json | null
          features?: Json | null
          store_type?: string
          school_names?: string[] | null
          line_official_id?: string | null
          order_schedule?: Json | null
          notification_plan?: string | null
          push_settings?: Json | null
          alert_days_repair?: number | null
          alert_days_purchase?: number | null
          repair_notes?: string | null
          welcome_message?: string | null
          notice_text?: string | null
          is_test_mode?: boolean | null
          active_fittings?: number
          staff_link_code?: string | null
          timecard_settings?: Json | null
          tax_rate?: number
          invoice_number?: string | null
          tax_inclusive?: boolean
          owner_pin_hash?: string | null
          staff_session_access_token?: string | null
          staff_session_refresh_token?: string | null
          staff_session_expires_at?: string | null
          pop_settings?: Json | null
          queue_pop_settings?: Json | null
          ui_settings?: Json | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          store_id: string
          name: string
          kana: string | null
          tel: string | null
          email: string | null
          contact_person: string | null
          lead_time_days: number | null
          order_method: string | null
          order_url: string | null
          min_lot: number | null
          notes: string | null
          sort_order: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          kana?: string | null
          tel?: string | null
          email?: string | null
          contact_person?: string | null
          lead_time_days?: number | null
          order_method?: string | null
          order_url?: string | null
          min_lot?: number | null
          notes?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          kana?: string | null
          tel?: string | null
          email?: string | null
          contact_person?: string | null
          lead_time_days?: number | null
          order_method?: string | null
          order_url?: string | null
          min_lot?: number | null
          notes?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      takeout_order_items: {
        Row: {
          id: string
          order_id: string
          menu_id: string | null
          name: string
          unit_price: number
          quantity: number
          notes: string | null
          created_at: string
          is_done: boolean
        }
        Insert: {
          id?: string
          order_id: string
          menu_id?: string | null
          name: string
          unit_price?: number
          quantity?: number
          notes?: string | null
          created_at?: string
          is_done?: boolean
        }
        Update: {
          id?: string
          order_id?: string
          menu_id?: string | null
          name?: string
          unit_price?: number
          quantity?: number
          notes?: string | null
          created_at?: string
          is_done?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "takeout_order_items_order_id_fkey",
            columns: [
              "order_id"
            ],
            isOneToOne: false,
            referencedRelation: "takeout_orders",
            referencedColumns: [
              "id"
            ]
          }
        ]
      }
      takeout_orders: {
        Row: {
          id: string
          store_id: string
          order_number: string
          line_user_id: string | null
          customer_name: string | null
          status: string
          total_amount: number
          notes: string | null
          notified_preparing: boolean
          notified_ready: boolean
          estimated_ready_at: string | null
          created_at: string
          updated_at: string
          pickup_time: string | null
          order_source: string
        }
        Insert: {
          id?: string
          store_id: string
          order_number: string
          line_user_id?: string | null
          customer_name?: string | null
          status?: string
          total_amount?: number
          notes?: string | null
          notified_preparing?: boolean
          notified_ready?: boolean
          estimated_ready_at?: string | null
          created_at?: string
          updated_at?: string
          pickup_time?: string | null
          order_source?: string
        }
        Update: {
          id?: string
          store_id?: string
          order_number?: string
          line_user_id?: string | null
          customer_name?: string | null
          status?: string
          total_amount?: number
          notes?: string | null
          notified_preparing?: boolean
          notified_ready?: boolean
          estimated_ready_at?: string | null
          created_at?: string
          updated_at?: string
          pickup_time?: string | null
          order_source?: string
        }
        Relationships: []
      }
      time_records: {
        Row: {
          id: string
          store_id: string
          staff_id: string
          shift_id: string | null
          work_date: string
          clock_in_at: string | null
          clock_out_at: string | null
          break_minutes: number | null
          clock_in_lat: number | null
          clock_in_lng: number | null
          status: string | null
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          store_id: string
          staff_id: string
          shift_id?: string | null
          work_date: string
          clock_in_at?: string | null
          clock_out_at?: string | null
          break_minutes?: number | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          status?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          staff_id?: string
          shift_id?: string | null
          work_date?: string
          clock_in_at?: string | null
          clock_out_at?: string | null
          break_minutes?: number | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          status?: string | null
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      uniform_order_items: {
        Row: {
          id: string
          order_id: string | null
          store_id: string
          school_product_id: string | null
          item_name: string
          size_label: string | null
          quantity: number | null
          unit_price: number | null
          status: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          store_id: string
          school_product_id?: string | null
          item_name: string
          size_label?: string | null
          quantity?: number | null
          unit_price?: number | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string | null
          store_id?: string
          school_product_id?: string | null
          item_name?: string
          size_label?: string | null
          quantity?: number | null
          unit_price?: number | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uniform_order_items_order_id_fkey",
            columns: [
              "order_id"
            ],
            isOneToOne: false,
            referencedRelation: "uniform_orders",
            referencedColumns: [
              "id"
            ]
          }
        ]
      }
      uniform_orders: {
        Row: {
          id: string
          store_id: string
          customer_id: string | null
          child_id: string | null
          order_number: string | null
          status: string | null
          payment_status: string | null
          total_amount: number | null
          notes: string | null
          expected_delivery_date: string | null
          slip_number: string | null
          created_at: string | null
          updated_at: string | null
          maker: string | null
          priority: string
        }
        Insert: {
          id?: string
          store_id: string
          customer_id?: string | null
          child_id?: string | null
          order_number?: string | null
          status?: string | null
          payment_status?: string | null
          total_amount?: number | null
          notes?: string | null
          expected_delivery_date?: string | null
          slip_number?: string | null
          created_at?: string | null
          updated_at?: string | null
          maker?: string | null
          priority?: string
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string | null
          child_id?: string | null
          order_number?: string | null
          status?: string | null
          payment_status?: string | null
          total_amount?: number | null
          notes?: string | null
          expected_delivery_date?: string | null
          slip_number?: string | null
          created_at?: string | null
          updated_at?: string | null
          maker?: string | null
          priority?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
