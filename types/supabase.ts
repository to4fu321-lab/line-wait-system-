export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      children: {
        Row: {
          admission_year: number | null
          created_at: string
          customer_id: string
          gender: string | null
          grade: string | null
          id: string
          kana: string | null
          name: string
          school_id: string | null
          school_name: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          admission_year?: number | null
          created_at?: string
          customer_id: string
          gender?: string | null
          grade?: string | null
          id?: string
          kana?: string | null
          name: string
          school_id?: string | null
          school_name?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          admission_year?: number | null
          created_at?: string
          customer_id?: string
          gender?: string | null
          grade?: string | null
          id?: string
          kana?: string | null
          name?: string
          school_id?: string | null
          school_name?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_children_school"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount: string
          id: string
          issued_to: string
          label: string
          store_id: string
          updated_at: string
          updated_by: string
          used: boolean
          used_at: string | null
          valid_until: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          discount?: string
          id?: string
          issued_to?: string
          label?: string
          store_id: string
          updated_at?: string
          updated_by?: string
          used?: boolean
          used_at?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount?: string
          id?: string
          issued_to?: string
          label?: string
          store_id?: string
          updated_at?: string
          updated_by?: string
          used?: boolean
          used_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          category: string | null
          created_at: string
          deleted_at: string | null
          gender: string | null
          id: string
          kana: string | null
          line_user_id: string | null
          name: string
          notes: string | null
          parent_kana: string | null
          parent_name: string | null
          school_id: string | null
          school_name: string | null
          staff_notes: string | null
          store_id: string
          tel: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          gender?: string | null
          id?: string
          kana?: string | null
          line_user_id?: string | null
          name: string
          notes?: string | null
          parent_kana?: string | null
          parent_name?: string | null
          school_id?: string | null
          school_name?: string | null
          staff_notes?: string | null
          store_id: string
          tel?: string | null
          updated_at?: string
          updated_by?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          gender?: string | null
          id?: string
          kana?: string | null
          line_user_id?: string | null
          name?: string
          notes?: string | null
          parent_kana?: string | null
          parent_name?: string | null
          school_id?: string | null
          school_name?: string | null
          staff_notes?: string | null
          store_id?: string
          tel?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_schemas: {
        Row: {
          created_at: string
          description: string | null
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          master_kind: string | null
          role: string | null
          scope: string
          sort_order: number
          store_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_required?: boolean
          master_kind?: string | null
          role?: string | null
          scope?: string
          sort_order?: number
          store_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          master_kind?: string | null
          role?: string | null
          scope?: string
          sort_order?: number
          store_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_schemas_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_schemas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "extraction_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          sort_order: number
          store_id: string
          target: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          sort_order?: number
          store_id: string
          target?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          sort_order?: number
          store_id?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          ai_category: string | null
          ai_implementable: boolean | null
          ai_recommendation: string | null
          approved_at: string | null
          approved_by: string | null
          body: string
          created_at: string
          id: string
          image_urls: string[] | null
          issue_number: number | null
          issue_url: string | null
          kind: string
          page_url: string | null
          priority: string | null
          related_feedback_id: string | null
          status: string
          store_id: string | null
          store_name: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_implementable?: boolean | null
          ai_recommendation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          issue_number?: number | null
          issue_url?: string | null
          kind?: string
          page_url?: string | null
          priority?: string | null
          related_feedback_id?: string | null
          status?: string
          store_id?: string | null
          store_name?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_implementable?: boolean | null
          ai_recommendation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          issue_number?: number | null
          issue_url?: string | null
          kind?: string
          page_url?: string | null
          priority?: string | null
          related_feedback_id?: string | null
          status?: string
          store_id?: string | null
          store_name?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_related_feedback_id_fkey"
            columns: ["related_feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_notices: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          feedback_id: string | null
          id: string
          message: string
          store_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          feedback_id?: string | null
          id?: string
          message: string
          store_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          feedback_id?: string | null
          id?: string
          message?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_notices_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          pin: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          pin?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          pin?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          content: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          due_date: string | null
          handled_by: string | null
          id: string
          is_urgent: boolean
          received_by: string | null
          request_no: number | null
          responded_at: string | null
          response_method: string | null
          response_notes: string | null
          status: string
          store_id: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          handled_by?: string | null
          id?: string
          is_urgent?: boolean
          received_by?: string | null
          request_no?: number | null
          responded_at?: string | null
          response_method?: string | null
          response_notes?: string | null
          status?: string
          store_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          handled_by?: string | null
          id?: string
          is_urgent?: boolean
          received_by?: string | null
          request_no?: number | null
          responded_at?: string | null
          response_method?: string | null
          response_notes?: string | null
          status?: string
          store_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kantan_tasks: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          label: string
          ref_id: string
          seq: number
          status: string
          store_id: string
          task_date: string
          task_type: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          label: string
          ref_id: string
          seq: number
          status?: string
          store_id: string
          task_date?: string
          task_type: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          label?: string
          ref_id?: string
          seq?: number
          status?: string
          store_id?: string
          task_date?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kantan_tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_stations: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          station_type: string
          store_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          station_type: string
          store_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          station_type?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_stations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          leave_type: string
          note: string | null
          reason: string | null
          reviewed_by: string | null
          staff_id: string
          start_date: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          leave_type?: string
          note?: string | null
          reason?: string | null
          reviewed_by?: string | null
          staff_id: string
          start_date: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          note?: string | null
          reason?: string | null
          reviewed_by?: string | null
          staff_id?: string
          start_date?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          chest_cm: number | null
          child_id: string
          confirmed_sizes: Json
          created_at: string
          height_cm: number | null
          id: string
          inseam_cm: number | null
          measured_date: string
          order_id: string | null
          staff_memo: string | null
          status: string
          store_id: string
          updated_at: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          chest_cm?: number | null
          child_id: string
          confirmed_sizes?: Json
          created_at?: string
          height_cm?: number | null
          id?: string
          inseam_cm?: number | null
          measured_date?: string
          order_id?: string | null
          staff_memo?: string | null
          status?: string
          store_id: string
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          chest_cm?: number | null
          child_id?: string
          confirmed_sizes?: Json
          created_at?: string
          height_cm?: number | null
          id?: string
          inseam_cm?: number | null
          measured_date?: string
          order_id?: string | null
          staff_memo?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "uniform_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          category_id: string | null
          cook_minutes: number | null
          created_at: string
          description: string | null
          finish_minutes: number | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          sort_order: number
          station_type: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          finish_minutes?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price?: number
          sort_order?: number
          station_type?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          finish_minutes?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          sort_order?: number
          station_type?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          store_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          store_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          store_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string
          filter_desc: string | null
          id: string
          recipient_count: number
          sent_at: string
          store_id: string
          total_amount: number
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          filter_desc?: string | null
          id?: string
          recipient_count?: number
          sent_at?: string
          store_id: string
          total_amount?: number
          type?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          filter_desc?: string | null
          id?: string
          recipient_count?: number
          sent_at?: string
          store_id?: string
          total_amount?: number
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_jobs: {
        Row: {
          created_at: string
          error_msg: string | null
          id: string
          input_meta: Json | null
          job_type: string
          progress: Json | null
          result: Json | null
          status: string
          store_id: string
          tokens_used: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_msg?: string | null
          id?: string
          input_meta?: Json | null
          job_type: string
          progress?: Json | null
          result?: Json | null
          status?: string
          store_id: string
          tokens_used?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_msg?: string | null
          id?: string
          input_meta?: Json | null
          job_type?: string
          progress?: Json | null
          result?: Json | null
          status?: string
          store_id?: string
          tokens_used?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          method: string | null
          order_id: string
          sale_id: string | null
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind?: string
          method?: string | null
          order_id: string
          sale_id?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          method?: string | null
          order_id?: string
          sale_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "uniform_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      price_bands: {
        Row: {
          active: boolean
          cost: number | null
          created_at: string
          from_item_id: string | null
          id: string
          is_eo: boolean
          label: string | null
          price_tax_in: number
          price_tax_out: number | null
          product_id: string
          school_id: string
          sort_order: number
          store_id: string
          to_item_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost?: number | null
          created_at?: string
          from_item_id?: string | null
          id?: string
          is_eo?: boolean
          label?: string | null
          price_tax_in: number
          price_tax_out?: number | null
          product_id: string
          school_id: string
          sort_order?: number
          store_id: string
          to_item_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number | null
          created_at?: string
          from_item_id?: string | null
          id?: string
          is_eo?: boolean
          label?: string | null
          price_tax_in?: number
          price_tax_out?: number | null
          product_id?: string
          school_id?: string
          sort_order?: number
          store_id?: string
          to_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_bands_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "size_set_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_bands_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_bands_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "school_products"
            referencedColumns: ["product_master_id"]
          },
          {
            foreignKeyName: "price_bands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_bands_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "size_set_items"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          active: boolean
          cost: number | null
          created_at: string
          id: string
          is_eo: boolean
          price_tax_in: number
          price_tax_out: number | null
          product_id: string
          school_id: string
          size_label: string | null
          size_set_item_id: string | null
          sort_order: number
          store_id: string
          updated_at: string
          valid_from: string | null
        }
        Insert: {
          active?: boolean
          cost?: number | null
          created_at?: string
          id?: string
          is_eo?: boolean
          price_tax_in: number
          price_tax_out?: number | null
          product_id: string
          school_id: string
          size_label?: string | null
          size_set_item_id?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
          valid_from?: string | null
        }
        Update: {
          active?: boolean
          cost?: number | null
          created_at?: string
          id?: string
          is_eo?: boolean
          price_tax_in?: number
          price_tax_out?: number | null
          product_id?: string
          school_id?: string
          size_label?: string | null
          size_set_item_id?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
          valid_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "school_products"
            referencedColumns: ["product_master_id"]
          },
          {
            foreignKeyName: "prices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_size_set_item_id_fkey"
            columns: ["size_set_item_id"]
            isOneToOne: false
            referencedRelation: "size_set_items"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_options: {
        Row: {
          applies_to_category: string[]
          choices: string[]
          created_at: string
          default_price: number | null
          id: string
          input_type: string
          is_active: boolean
          name: string
          notes: string | null
          required: boolean
          sort_order: number
          store_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          applies_to_category?: string[]
          choices?: string[]
          created_at?: string
          default_price?: number | null
          id?: string
          input_type?: string
          is_active?: boolean
          name: string
          notes?: string | null
          required?: boolean
          sort_order?: number
          store_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          applies_to_category?: string[]
          choices?: string[]
          created_at?: string
          default_price?: number | null
          id?: string
          input_type?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          required?: boolean
          sort_order?: number
          store_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          base_price_tax_in: number | null
          base_price_tax_out: number | null
          body_types: string[]
          category: string | null
          color_code: string | null
          created_at: string
          gender: string | null
          group_name: string | null
          id: string
          maker: string | null
          maker_code: string | null
          name: string
          notes: string | null
          school_id: string | null
          size_set_id: string | null
          sort_order: number
          stock: number | null
          store_id: string
          supplier_id: string | null
          updated_at: string
          washable: string | null
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          base_price_tax_in?: number | null
          base_price_tax_out?: number | null
          body_types?: string[]
          category?: string | null
          color_code?: string | null
          created_at?: string
          gender?: string | null
          group_name?: string | null
          id?: string
          maker?: string | null
          maker_code?: string | null
          name: string
          notes?: string | null
          school_id?: string | null
          size_set_id?: string | null
          sort_order?: number
          stock?: number | null
          store_id: string
          supplier_id?: string | null
          updated_at?: string
          washable?: string | null
        }
        Update: {
          active?: boolean
          barcode?: string | null
          base_price_tax_in?: number | null
          base_price_tax_out?: number | null
          body_types?: string[]
          category?: string | null
          color_code?: string | null
          created_at?: string
          gender?: string | null
          group_name?: string | null
          id?: string
          maker?: string | null
          maker_code?: string | null
          name?: string
          notes?: string | null
          school_id?: string | null
          size_set_id?: string | null
          sort_order?: number
          stock?: number | null
          store_id?: string
          supplier_id?: string | null
          updated_at?: string
          washable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_size_set_id_fkey"
            columns: ["size_set_id"]
            isOneToOne: false
            referencedRelation: "size_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          arrived_date: string | null
          child_id: string | null
          created_at: string
          customer_id: string
          delivered_by: string | null
          delivered_date: string | null
          id: string
          item_name: string
          maker: string | null
          notes: string | null
          notified: boolean
          ordered_date: string
          payment_status: string | null
          price: number | null
          request_no: number | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          arrived_date?: string | null
          child_id?: string | null
          created_at?: string
          customer_id: string
          delivered_by?: string | null
          delivered_date?: string | null
          id?: string
          item_name: string
          maker?: string | null
          notes?: string | null
          notified?: boolean
          ordered_date?: string
          payment_status?: string | null
          price?: number | null
          request_no?: number | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          arrived_date?: string | null
          child_id?: string | null
          created_at?: string
          customer_id?: string
          delivered_by?: string | null
          delivered_date?: string | null
          id?: string
          item_name?: string
          maker?: string | null
          notes?: string | null
          notified?: boolean
          ordered_date?: string
          payment_status?: string | null
          price?: number | null
          request_no?: number | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          kind: string | null
          p256dh: string
          staff_id: string | null
          store_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          kind?: string | null
          p256dh: string
          staff_id?: string | null
          store_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          kind?: string | null
          p256dh?: string
          staff_id?: string | null
          store_id?: string
        }
        Relationships: []
      }
      queues: {
        Row: {
          category: Database["public"]["Enums"]["queue_category"]
          checked_in: boolean
          child_id: string | null
          child_name: string | null
          created_at: string
          customer_id: string | null
          customer_kana: string | null
          customer_name: string
          details: Json | null
          gender: string
          id: string
          is_remote: boolean
          line_user_id: string | null
          school_name: string | null
          status: Database["public"]["Enums"]["queue_status"]
          store_id: string
          ticket_number: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["queue_category"]
          checked_in?: boolean
          child_id?: string | null
          child_name?: string | null
          created_at?: string
          customer_id?: string | null
          customer_kana?: string | null
          customer_name: string
          details?: Json | null
          gender?: string
          id?: string
          is_remote?: boolean
          line_user_id?: string | null
          school_name?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          store_id: string
          ticket_number: number
        }
        Update: {
          category?: Database["public"]["Enums"]["queue_category"]
          checked_in?: boolean
          child_id?: string | null
          child_name?: string | null
          created_at?: string
          customer_id?: string | null
          customer_kana?: string | null
          customer_name?: string
          details?: Json | null
          gender?: string
          id?: string
          is_remote?: boolean
          line_user_id?: string | null
          school_name?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          store_id?: string
          ticket_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "queues_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      register_cash_movements: {
        Row: {
          amount: number
          created_at: string
          direction: string
          id: string
          memo: string | null
          reason: string | null
          session_id: string
          staff_id: string | null
          staff_name: string | null
          store_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          direction: string
          id?: string
          memo?: string | null
          reason?: string | null
          session_id: string
          staff_id?: string | null
          staff_name?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          id?: string
          memo?: string | null
          reason?: string | null
          session_id?: string
          staff_id?: string | null
          staff_name?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "register_cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "register_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      register_sessions: {
        Row: {
          cash_actual: number | null
          cash_theoretical: number | null
          cash_variance: number | null
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          closing_denominations: Json | null
          closing_report: Json | null
          created_at: string
          id: string
          note: string | null
          opened_at: string
          opened_by: string | null
          opened_by_name: string | null
          opening_denominations: Json
          opening_float: number
          session_number: string | null
          status: string
          store_id: string
          total_sales: number | null
          total_variance: number | null
          updated_at: string
        }
        Insert: {
          cash_actual?: number | null
          cash_theoretical?: number | null
          cash_variance?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_denominations?: Json | null
          closing_report?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          opening_denominations?: Json
          opening_float?: number
          session_number?: string | null
          status?: string
          store_id: string
          total_sales?: number | null
          total_variance?: number | null
          updated_at?: string
        }
        Update: {
          cash_actual?: number | null
          cash_theoretical?: number | null
          cash_variance?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_denominations?: Json | null
          closing_report?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          opening_denominations?: Json
          opening_float?: number
          session_number?: string | null
          status?: string
          store_id?: string
          total_sales?: number | null
          total_variance?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      repair_garment_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_garment_types_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_histories: {
        Row: {
          base_price: number | null
          calculated_price: number | null
          child_id: string | null
          completed_date: string | null
          content: string
          created_at: string
          customer_id: string
          delivered_by: string | null
          delivered_date: string | null
          desired_completion_date: string | null
          embroidery_color: string | null
          embroidery_pos: string | null
          embroidery_text: string | null
          expected_return_date: string | null
          final_price: number | null
          garment_name: string | null
          garment_type_id: string | null
          group_notify_mode: string
          hem_length_mm: number | null
          id: string
          input_details: Json
          inputs: Json
          inspected_at: string | null
          internal_memo: string | null
          is_rework: boolean | null
          item_code: string | null
          item_id: string | null
          item_name: string
          manual_reason: string | null
          notes: string | null
          notified: boolean
          payment_status: string
          physical_item_id: string | null
          prepaid: boolean
          price: number | null
          pricing_mode: string
          quick_receipt: boolean
          quote_status: string
          received_by: string | null
          received_date: string
          repair_group_id: string | null
          repair_type: string | null
          request_no: number | null
          request_type: string | null
          rework_reason: string | null
          selected_options: Json
          sent_to_vendor_at: string | null
          sleeve_adjust_mm: number | null
          slip_number: string | null
          status: string
          store_id: string
          strung_by: string | null
          updated_at: string
          vendor_id: string | null
          vendor_name: string | null
          waist_adjust_mm: number | null
          work_started: boolean
        }
        Insert: {
          base_price?: number | null
          calculated_price?: number | null
          child_id?: string | null
          completed_date?: string | null
          content?: string
          created_at?: string
          customer_id: string
          delivered_by?: string | null
          delivered_date?: string | null
          desired_completion_date?: string | null
          embroidery_color?: string | null
          embroidery_pos?: string | null
          embroidery_text?: string | null
          expected_return_date?: string | null
          final_price?: number | null
          garment_name?: string | null
          garment_type_id?: string | null
          group_notify_mode?: string
          hem_length_mm?: number | null
          id?: string
          input_details?: Json
          inputs?: Json
          inspected_at?: string | null
          internal_memo?: string | null
          is_rework?: boolean | null
          item_code?: string | null
          item_id?: string | null
          item_name: string
          manual_reason?: string | null
          notes?: string | null
          notified?: boolean
          payment_status?: string
          physical_item_id?: string | null
          prepaid?: boolean
          price?: number | null
          pricing_mode?: string
          quick_receipt?: boolean
          quote_status?: string
          received_by?: string | null
          received_date?: string
          repair_group_id?: string | null
          repair_type?: string | null
          request_no?: number | null
          request_type?: string | null
          rework_reason?: string | null
          selected_options?: Json
          sent_to_vendor_at?: string | null
          sleeve_adjust_mm?: number | null
          slip_number?: string | null
          status?: string
          store_id: string
          strung_by?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
          waist_adjust_mm?: number | null
          work_started?: boolean
        }
        Update: {
          base_price?: number | null
          calculated_price?: number | null
          child_id?: string | null
          completed_date?: string | null
          content?: string
          created_at?: string
          customer_id?: string
          delivered_by?: string | null
          delivered_date?: string | null
          desired_completion_date?: string | null
          embroidery_color?: string | null
          embroidery_pos?: string | null
          embroidery_text?: string | null
          expected_return_date?: string | null
          final_price?: number | null
          garment_name?: string | null
          garment_type_id?: string | null
          group_notify_mode?: string
          hem_length_mm?: number | null
          id?: string
          input_details?: Json
          inputs?: Json
          inspected_at?: string | null
          internal_memo?: string | null
          is_rework?: boolean | null
          item_code?: string | null
          item_id?: string | null
          item_name?: string
          manual_reason?: string | null
          notes?: string | null
          notified?: boolean
          payment_status?: string
          physical_item_id?: string | null
          prepaid?: boolean
          price?: number | null
          pricing_mode?: string
          quick_receipt?: boolean
          quote_status?: string
          received_by?: string | null
          received_date?: string
          repair_group_id?: string | null
          repair_type?: string | null
          request_no?: number | null
          request_type?: string | null
          rework_reason?: string | null
          selected_options?: Json
          sent_to_vendor_at?: string | null
          sleeve_adjust_mm?: number | null
          slip_number?: string | null
          status?: string
          store_id?: string
          strung_by?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
          waist_adjust_mm?: number | null
          work_started?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "repair_histories_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_histories_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_histories_garment_type_id_fkey"
            columns: ["garment_type_id"]
            isOneToOne: false
            referencedRelation: "repair_garment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_histories_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "repair_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_histories_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_histories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_histories_strung_by_fkey"
            columns: ["strung_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_histories_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "repair_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_items: {
        Row: {
          active: boolean
          base_price: number
          code: string
          created_at: string
          fields: Json
          garment_type_id: string
          icon: string | null
          id: string
          lead_time_days: number | null
          manual: Json | null
          measurements: Json
          name: string
          price_unit: string
          requires_quote: boolean
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          code: string
          created_at?: string
          fields?: Json
          garment_type_id: string
          icon?: string | null
          id?: string
          lead_time_days?: number | null
          manual?: Json | null
          measurements?: Json
          name: string
          price_unit?: string
          requires_quote?: boolean
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          code?: string
          created_at?: string
          fields?: Json
          garment_type_id?: string
          icon?: string | null
          id?: string
          lead_time_days?: number | null
          manual?: Json | null
          measurements?: Json
          name?: string
          price_unit?: string
          requires_quote?: boolean
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_items_garment_type_id_fkey"
            columns: ["garment_type_id"]
            isOneToOne: false
            referencedRelation: "repair_garment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_options: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_selected: boolean
          fields: Json
          group_label: string | null
          group_select: string
          id: string
          item_id: string
          manual: Json | null
          name: string
          price_delta: number
          price_unit: string
          requires_quote: boolean
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_selected?: boolean
          fields?: Json
          group_label?: string | null
          group_select?: string
          id?: string
          item_id: string
          manual?: Json | null
          name: string
          price_delta?: number
          price_unit?: string
          requires_quote?: boolean
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_selected?: boolean
          fields?: Json
          group_label?: string | null
          group_select?: string
          id?: string
          item_id?: string
          manual?: Json | null
          name?: string
          price_delta?: number
          price_unit?: string
          requires_quote?: boolean
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "repair_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_options_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_photos: {
        Row: {
          created_at: string
          id: string
          note: string | null
          path: string
          phase: string
          repair_id: string
          store_id: string
          taken_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          path: string
          phase?: string
          repair_id: string
          store_id: string
          taken_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          path?: string
          phase?: string
          repair_id?: string
          store_id?: string
          taken_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_photos_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repair_histories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_photos_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_vendors: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          kana: string | null
          name: string
          note: string | null
          sort_order: number | null
          store_id: string
          tel: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          kana?: string | null
          name: string
          note?: string | null
          sort_order?: number | null
          store_id: string
          tel?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          kana?: string | null
          name?: string
          note?: string | null
          sort_order?: number | null
          store_id?: string
          tel?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reservation_date_overrides: {
        Row: {
          created_at: string
          date: string
          id: string
          max_slots: number
          store_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          max_slots?: number
          store_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          max_slots?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_date_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_settings: {
        Row: {
          duration_min: number
          end_time: string
          id: string
          is_active: boolean | null
          label: string
          service_type: string
          slots_fri: number | null
          slots_mon: number | null
          slots_sat: number | null
          slots_sun: number | null
          slots_thu: number | null
          slots_tue: number | null
          slots_wed: number | null
          start_time: string
          store_id: string
        }
        Insert: {
          duration_min?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          label: string
          service_type: string
          slots_fri?: number | null
          slots_mon?: number | null
          slots_sat?: number | null
          slots_sun?: number | null
          slots_thu?: number | null
          slots_tue?: number | null
          slots_wed?: number | null
          start_time?: string
          store_id: string
        }
        Update: {
          duration_min?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          label?: string
          service_type?: string
          slots_fri?: number | null
          slots_mon?: number | null
          slots_sat?: number | null
          slots_sun?: number | null
          slots_thu?: number | null
          slots_tue?: number | null
          slots_wed?: number | null
          start_time?: string
          store_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          child_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          line_user_id: string | null
          notes: string | null
          purpose: string | null
          queue_id: string | null
          reserved_at: string
          service_type: string | null
          status: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          line_user_id?: string | null
          notes?: string | null
          purpose?: string | null
          queue_id?: string | null
          reserved_at: string
          service_type?: string | null
          status?: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          line_user_id?: string | null
          notes?: string | null
          purpose?: string | null
          queue_id?: string | null
          reserved_at?: string
          service_type?: string | null
          status?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          name: string
          qty: number
          sale_id: string
          source_id: string | null
          source_type: string
          store_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          name: string
          qty?: number
          sale_id: string
          source_id?: string | null
          source_type?: string
          store_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          name?: string
          qty?: number
          sale_id?: string
          source_id?: string | null
          source_type?: string
          store_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_received: number | null
          change: number | null
          child_id: string | null
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          note: string | null
          payment_method: string
          receipt_name: string | null
          receipt_note: string | null
          register_session_id: string | null
          sale_number: string | null
          staff_id: string | null
          status: string
          store_id: string
          subtotal: number
          tax: number
          tax_inclusive: boolean
          tax_rate: number
          total: number
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          cash_received?: number | null
          change?: number | null
          child_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          note?: string | null
          payment_method?: string
          receipt_name?: string | null
          receipt_note?: string | null
          register_session_id?: string | null
          sale_number?: string | null
          staff_id?: string | null
          status?: string
          store_id: string
          subtotal?: number
          tax?: number
          tax_inclusive?: boolean
          tax_rate?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          cash_received?: number | null
          change?: number | null
          child_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          note?: string | null
          payment_method?: string
          receipt_name?: string | null
          receipt_note?: string | null
          register_session_id?: string | null
          sale_number?: string | null
          staff_id?: string | null
          status?: string
          store_id?: string
          subtotal?: number
          tax?: number
          tax_inclusive?: boolean
          tax_rate?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: []
      }
      scan_inbox: {
        Row: {
          confidence: string | null
          created_at: string
          extracted: Json
          id: string
          image_data: string | null
          promoted_id: string | null
          promoted_table: string | null
          slip_type: string
          status: string
          store_id: string
          updated_at: string
          warnings: Json
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          extracted?: Json
          id?: string
          image_data?: string | null
          promoted_id?: string | null
          promoted_table?: string | null
          slip_type: string
          status?: string
          store_id: string
          updated_at?: string
          warnings?: Json
        }
        Update: {
          confidence?: string | null
          created_at?: string
          extracted?: Json
          id?: string
          image_data?: string | null
          promoted_id?: string | null
          promoted_table?: string | null
          slip_type?: string
          status?: string
          store_id?: string
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scan_inbox_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      school_grades: {
        Row: {
          color_hex: string
          color_name: string
          created_at: string
          grade_name: string
          id: string
          school_id: string
          sort_order: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          color_hex?: string
          color_name?: string
          created_at?: string
          grade_name: string
          id?: string
          school_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string
        }
        Update: {
          color_hex?: string
          color_name?: string
          created_at?: string
          grade_name?: string
          id?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_parent_tips: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          item_name: string
          line_uid: string
          school_id: string
          store_id: string
          tip_text: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          item_name?: string
          line_uid?: string
          school_id: string
          store_id: string
          tip_text: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          item_name?: string
          line_uid?: string
          school_id?: string
          store_id?: string
          tip_text?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_parent_tips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_parent_tips_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      school_requirements: {
        Row: {
          avg_qty: number | null
          created_at: string
          grade_color_note: string
          id: string
          item_notes: string
          product_id: string
          required: boolean
          school_id: string
          sort_order: number
          store_id: string
          updated_at: string
          uses_grade_color: boolean
        }
        Insert: {
          avg_qty?: number | null
          created_at?: string
          grade_color_note?: string
          id?: string
          item_notes?: string
          product_id: string
          required?: boolean
          school_id: string
          sort_order?: number
          store_id: string
          updated_at?: string
          uses_grade_color?: boolean
        }
        Update: {
          avg_qty?: number | null
          created_at?: string
          grade_color_note?: string
          id?: string
          item_notes?: string
          product_id?: string
          required?: boolean
          school_id?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
          uses_grade_color?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "school_requirements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_requirements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "school_products"
            referencedColumns: ["product_master_id"]
          },
          {
            foreignKeyName: "school_requirements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          extra_info: string | null
          id: string
          kana: string
          measurement_end: string | null
          measurement_start: string | null
          name: string
          notes: string
          order_deadline: string | null
          pickup_deadline: string | null
          schedule_notes: string | null
          short_name: string | null
          sort_order: number
          special_notes: string | null
          store_id: string
          tel: string | null
          updated_at: string
          updated_by: string
          wearing_regulations: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          extra_info?: string | null
          id?: string
          kana?: string
          measurement_end?: string | null
          measurement_start?: string | null
          name: string
          notes?: string
          order_deadline?: string | null
          pickup_deadline?: string | null
          schedule_notes?: string | null
          short_name?: string | null
          sort_order?: number
          special_notes?: string | null
          store_id: string
          tel?: string | null
          updated_at?: string
          updated_by?: string
          wearing_regulations?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          extra_info?: string | null
          id?: string
          kana?: string
          measurement_end?: string | null
          measurement_start?: string | null
          name?: string
          notes?: string
          order_deadline?: string | null
          pickup_deadline?: string | null
          schedule_notes?: string | null
          short_name?: string | null
          sort_order?: number
          special_notes?: string | null
          store_id?: string
          tel?: string | null
          updated_at?: string
          updated_by?: string
          wearing_regulations?: string | null
        }
        Relationships: []
      }
      shift_budgets: {
        Row: {
          budget_amount: number | null
          created_at: string | null
          id: string
          note: string | null
          store_id: string
          updated_at: string | null
          year_month: string
        }
        Insert: {
          budget_amount?: number | null
          created_at?: string | null
          id?: string
          note?: string | null
          store_id: string
          updated_at?: string | null
          year_month: string
        }
        Update: {
          budget_amount?: number | null
          created_at?: string | null
          id?: string
          note?: string | null
          store_id?: string
          updated_at?: string | null
          year_month?: string
        }
        Relationships: []
      }
      shift_help_offers: {
        Row: {
          created_at: string | null
          help_request_id: string
          id: string
          note: string | null
          offering_store_id: string
          shift_id: string | null
          staff_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          help_request_id: string
          id?: string
          note?: string | null
          offering_store_id: string
          shift_id?: string | null
          staff_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          help_request_id?: string
          id?: string
          note?: string | null
          offering_store_id?: string
          shift_id?: string | null
          staff_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_help_offers_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "shift_help_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_help_offers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_help_requests: {
        Row: {
          created_at: string | null
          end_time: string
          group_id: string
          headcount: number | null
          id: string
          note: string | null
          position: string | null
          requesting_store_id: string
          start_time: string
          status: string | null
          updated_at: string | null
          work_date: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          group_id: string
          headcount?: number | null
          id?: string
          note?: string | null
          position?: string | null
          requesting_store_id: string
          start_time: string
          status?: string | null
          updated_at?: string | null
          work_date: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          group_id?: string
          headcount?: number | null
          id?: string
          note?: string | null
          position?: string | null
          requesting_store_id?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
          work_date?: string
        }
        Relationships: []
      }
      shift_messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          read_at: string | null
          sender: string
          staff_id: string | null
          store_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender: string
          staff_id?: string | null
          store_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender?: string
          staff_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_messages_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_requests: {
        Row: {
          created_at: string | null
          id: string
          kind: string
          note: string | null
          pref_end: string | null
          pref_start: string | null
          resolved_shift_id: string | null
          staff_id: string
          status: string | null
          store_id: string
          updated_at: string | null
          work_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kind?: string
          note?: string | null
          pref_end?: string | null
          pref_start?: string | null
          resolved_shift_id?: string | null
          staff_id: string
          status?: string | null
          store_id: string
          updated_at?: string | null
          work_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kind?: string
          note?: string | null
          pref_end?: string | null
          pref_start?: string | null
          resolved_shift_id?: string | null
          staff_id?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swaps: {
        Row: {
          created_at: string | null
          from_shift_id: string
          from_staff_id: string
          id: string
          note: string | null
          status: string | null
          store_id: string
          to_staff_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          from_shift_id: string
          from_staff_id: string
          id?: string
          note?: string | null
          status?: string | null
          store_id: string
          to_staff_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          from_shift_id?: string
          from_staff_id?: string
          id?: string
          note?: string | null
          status?: string | null
          store_id?: string
          to_staff_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swaps_from_shift_id_fkey"
            columns: ["from_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_from_staff_id_fkey"
            columns: ["from_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_to_staff_id_fkey"
            columns: ["to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          active: boolean | null
          break_minutes: number | null
          color: string | null
          created_at: string | null
          end_time: string
          id: string
          label: string
          sort_order: number | null
          start_time: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          break_minutes?: number | null
          color?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          label: string
          sort_order?: number | null
          start_time: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          break_minutes?: number | null
          color?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          label?: string
          sort_order?: number | null
          start_time?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          break_minutes: number | null
          created_at: string | null
          end_time: string
          help_request_id: string | null
          home_store_id: string | null
          hourly_wage: number | null
          id: string
          is_help: boolean | null
          note: string | null
          position: string | null
          staff_id: string
          start_time: string
          status: string | null
          store_id: string
          updated_at: string | null
          work_date: string
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string | null
          end_time: string
          help_request_id?: string | null
          home_store_id?: string | null
          hourly_wage?: number | null
          id?: string
          is_help?: boolean | null
          note?: string | null
          position?: string | null
          staff_id: string
          start_time: string
          status?: string | null
          store_id: string
          updated_at?: string | null
          work_date: string
        }
        Update: {
          break_minutes?: number | null
          created_at?: string | null
          end_time?: string
          help_request_id?: string | null
          home_store_id?: string | null
          hourly_wage?: number | null
          id?: string
          is_help?: boolean | null
          note?: string | null
          position?: string | null
          staff_id?: string
          start_time?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      size_presets: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      size_set_items: {
        Row: {
          id: string
          label: string
          size_set_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          size_set_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          size_set_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "size_set_items_size_set_id_fkey"
            columns: ["size_set_id"]
            isOneToOne: false
            referencedRelation: "size_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      size_sets: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          sort_order: number
          store_id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          sort_order?: number
          store_id: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          store_id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      slip_records: {
        Row: {
          created_at: string
          customer_id: string | null
          header: Json
          id: string
          items: Json
          received_date: string
          status: string
          store_id: string
          template_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          header?: Json
          id?: string
          items?: Json
          received_date?: string
          status?: string
          store_id: string
          template_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          header?: Json
          id?: string
          items?: Json
          received_date?: string
          status?: string
          store_id?: string
          template_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slip_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slip_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slip_records_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "extraction_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          availability: Json | null
          color: string | null
          commute_min: number | null
          created_at: string
          employment_type: string | null
          hourly_wage: number | null
          id: string
          kana: string | null
          max_daily_hours: number | null
          max_weekly_hours: number | null
          name: string
          pin: string | null
          role: string | null
          skill_level: number | null
          skills: Json | null
          sort_order: number
          store_id: string
          tel: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          availability?: Json | null
          color?: string | null
          commute_min?: number | null
          created_at?: string
          employment_type?: string | null
          hourly_wage?: number | null
          id?: string
          kana?: string | null
          max_daily_hours?: number | null
          max_weekly_hours?: number | null
          name: string
          pin?: string | null
          role?: string | null
          skill_level?: number | null
          skills?: Json | null
          sort_order?: number
          store_id: string
          tel?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          availability?: Json | null
          color?: string | null
          commute_min?: number | null
          created_at?: string
          employment_type?: string | null
          hourly_wage?: number | null
          id?: string
          kana?: string | null
          max_daily_hours?: number | null
          max_weekly_hours?: number | null
          name?: string
          pin?: string | null
          role?: string | null
          skill_level?: number | null
          skills?: Json | null
          sort_order?: number
          store_id?: string
          tel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_line_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          line_user_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_line_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_requirements: {
        Row: {
          created_at: string | null
          id: string
          required: number
          reservations: number | null
          source: string | null
          store_id: string
          time_block: string
          updated_at: string | null
          work_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          required?: number
          reservations?: number | null
          source?: string | null
          store_id: string
          time_block: string
          updated_at?: string | null
          work_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          required?: number
          reservations?: number | null
          source?: string | null
          store_id?: string
          time_block?: string
          updated_at?: string | null
          work_date?: string
        }
        Relationships: []
      }
      staffing_settings: {
        Row: {
          conversion_rate: number | null
          created_at: string | null
          fitting_minutes: number | null
          id: string
          max_staff: number | null
          min_staff: number | null
          per_person_rooms: number | null
          store_id: string
          time_block_min: number | null
          updated_at: string | null
          visit_factor: number | null
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string | null
          fitting_minutes?: number | null
          id?: string
          max_staff?: number | null
          min_staff?: number | null
          per_person_rooms?: number | null
          store_id: string
          time_block_min?: number | null
          updated_at?: string | null
          visit_factor?: number | null
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string | null
          fitting_minutes?: number | null
          id?: string
          max_staff?: number | null
          min_staff?: number | null
          per_person_rooms?: number | null
          store_id?: string
          time_block_min?: number | null
          updated_at?: string | null
          visit_factor?: number | null
        }
        Relationships: []
      }
      store_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          plan: string | null
          status: string
          store_id: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          plan?: string | null
          status?: string
          store_id: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          plan?: string | null
          status?: string
          store_id?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active_fittings: number
          alert_days_purchase: number | null
          alert_days_repair: number | null
          allow_remote: boolean
          business_hours: Json | null
          business_type: string
          created_at: string
          features: Json | null
          group_id: string | null
          id: string
          invoice_number: string | null
          is_open: boolean
          is_test_mode: boolean | null
          line_official_id: string | null
          name: string
          notice_text: string | null
          notice_threshold: number
          notification_plan: string | null
          order_schedule: Json | null
          owner_pin_hash: string | null
          pin: string
          pop_settings: Json | null
          push_settings: Json | null
          queue_pop_settings: Json | null
          repair_notes: string | null
          repair_settings: Json | null
          school_names: string[] | null
          setup: Json
          staff_link_code: string | null
          staff_session_access_token: string | null
          staff_session_expires_at: string | null
          staff_session_refresh_token: string | null
          store_type: string
          takeout_settings: Json
          tax_inclusive: boolean
          tax_rate: number
          timecard_settings: Json | null
          ui_settings: Json | null
          wait_thresholds: Json
          welcome_message: string | null
          school_change_key: string | null
        }
        Insert: {
          active_fittings?: number
          alert_days_purchase?: number | null
          alert_days_repair?: number | null
          allow_remote?: boolean
          business_hours?: Json | null
          business_type?: string
          created_at?: string
          features?: Json | null
          group_id?: string | null
          id?: string
          invoice_number?: string | null
          is_open?: boolean
          is_test_mode?: boolean | null
          line_official_id?: string | null
          name: string
          notice_text?: string | null
          notice_threshold?: number
          notification_plan?: string | null
          order_schedule?: Json | null
          owner_pin_hash?: string | null
          pin?: string
          pop_settings?: Json | null
          push_settings?: Json | null
          queue_pop_settings?: Json | null
          repair_notes?: string | null
          repair_settings?: Json | null
          school_names?: string[] | null
          setup?: Json
          staff_link_code?: string | null
          staff_session_access_token?: string | null
          staff_session_expires_at?: string | null
          staff_session_refresh_token?: string | null
          store_type?: string
          takeout_settings?: Json
          tax_inclusive?: boolean
          tax_rate?: number
          timecard_settings?: Json | null
          ui_settings?: Json | null
          wait_thresholds?: Json
          welcome_message?: string | null
          school_change_key?: string | null
        }
        Update: {
          active_fittings?: number
          alert_days_purchase?: number | null
          alert_days_repair?: number | null
          allow_remote?: boolean
          business_hours?: Json | null
          business_type?: string
          created_at?: string
          features?: Json | null
          group_id?: string | null
          id?: string
          invoice_number?: string | null
          is_open?: boolean
          is_test_mode?: boolean | null
          line_official_id?: string | null
          name?: string
          notice_text?: string | null
          notice_threshold?: number
          notification_plan?: string | null
          order_schedule?: Json | null
          owner_pin_hash?: string | null
          pin?: string
          pop_settings?: Json | null
          push_settings?: Json | null
          queue_pop_settings?: Json | null
          repair_notes?: string | null
          repair_settings?: Json | null
          school_names?: string[] | null
          setup?: Json
          staff_link_code?: string | null
          staff_session_access_token?: string | null
          staff_session_expires_at?: string | null
          staff_session_refresh_token?: string | null
          store_type?: string
          takeout_settings?: Json
          tax_inclusive?: boolean
          tax_rate?: number
          timecard_settings?: Json | null
          ui_settings?: Json | null
          wait_thresholds?: Json
          welcome_message?: string | null
          school_change_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          kana: string | null
          lead_time_days: number | null
          min_lot: number | null
          name: string
          notes: string | null
          order_method: string | null
          order_url: string | null
          sort_order: number | null
          store_id: string
          tel: string | null
          updated_at: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          kana?: string | null
          lead_time_days?: number | null
          min_lot?: number | null
          name: string
          notes?: string | null
          order_method?: string | null
          order_url?: string | null
          sort_order?: number | null
          store_id: string
          tel?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          kana?: string | null
          lead_time_days?: number | null
          min_lot?: number | null
          name?: string
          notes?: string | null
          order_method?: string | null
          order_url?: string | null
          sort_order?: number | null
          store_id?: string
          tel?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      takeout_order_items: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          menu_id: string | null
          name: string
          notes: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          menu_id?: string | null
          name: string
          notes?: string | null
          order_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          menu_id?: string | null
          name?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "takeout_order_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeout_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "takeout_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      takeout_orders: {
        Row: {
          created_at: string
          customer_name: string | null
          estimated_ready_at: string | null
          id: string
          line_user_id: string | null
          notes: string | null
          notified_preparing: boolean
          notified_ready: boolean
          order_number: string
          order_source: string
          pickup_time: string | null
          status: string
          store_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          estimated_ready_at?: string | null
          id?: string
          line_user_id?: string | null
          notes?: string | null
          notified_preparing?: boolean
          notified_ready?: boolean
          order_number: string
          order_source?: string
          pickup_time?: string | null
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          estimated_ready_at?: string | null
          id?: string
          line_user_id?: string | null
          notes?: string | null
          notified_preparing?: boolean
          notified_ready?: boolean
          order_number?: string
          order_source?: string
          pickup_time?: string | null
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeout_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      time_records: {
        Row: {
          break_minutes: number | null
          clock_in_at: string | null
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_out_at: string | null
          created_at: string | null
          id: string
          note: string | null
          shift_id: string | null
          staff_id: string
          status: string | null
          store_id: string
          updated_at: string | null
          work_date: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in_at?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out_at?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          shift_id?: string | null
          staff_id: string
          status?: string | null
          store_id: string
          updated_at?: string | null
          work_date: string
        }
        Update: {
          break_minutes?: number | null
          clock_in_at?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out_at?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          shift_id?: string | null
          staff_id?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      uniform_order_items: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          notes: string | null
          order_id: string | null
          quantity: number | null
          school_product_id: string | null
          size_label: string | null
          status: string | null
          store_id: string
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          notes?: string | null
          order_id?: string | null
          quantity?: number | null
          school_product_id?: string | null
          size_label?: string | null
          status?: string | null
          store_id: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          order_id?: string | null
          quantity?: number | null
          school_product_id?: string | null
          size_label?: string | null
          status?: string | null
          store_id?: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uniform_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "uniform_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      uniform_orders: {
        Row: {
          child_id: string | null
          created_at: string | null
          customer_id: string | null
          expected_delivery_date: string | null
          id: string
          maker: string | null
          notes: string | null
          order_number: string | null
          payment_status: string | null
          priority: string
          slip_number: string | null
          status: string | null
          store_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          maker?: string | null
          notes?: string | null
          order_number?: string | null
          payment_status?: string | null
          priority?: string
          slip_number?: string | null
          status?: string | null
          store_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          maker?: string | null
          notes?: string | null
          order_number?: string | null
          payment_status?: string | null
          priority?: string
          slip_number?: string | null
          status?: string | null
          store_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uniform_orders_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniform_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count: number
          metric: string
          period: string
          store_id: string
          updated_at: string
        }
        Insert: {
          count?: number
          metric: string
          period: string
          store_id: string
          updated_at?: string
        }
        Update: {
          count?: number
          metric?: string
          period?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      school_items: {
        Row: {
          avg_qty: number | null
          cost_price: number | null
          created_at: string | null
          eo_price_tax_in: number | null
          eo_price_tax_out: number | null
          grade_color_note: string | null
          growth_adjust: boolean | null
          id: string | null
          item_notes: string | null
          name: string | null
          price_tax_in: number | null
          price_tax_out: number | null
          product_code: string | null
          required: boolean | null
          school_id: string | null
          size_spec: string | null
          sort_order: number | null
          updated_at: string | null
          updated_by: string | null
          uses_grade_color: boolean | null
          washable: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_requirements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_product_variants: {
        Row: {
          active: boolean | null
          cost: number | null
          created_at: string | null
          id: string | null
          price: number | null
          product_id: string | null
          size_label: string | null
          sort_order: number | null
          stock: number | null
          store_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      school_products: {
        Row: {
          active: boolean | null
          avg_qty: number | null
          barcode: string | null
          category: string | null
          color_code: string | null
          created_at: string | null
          eo_price_tax_in: number | null
          eo_price_tax_out: number | null
          gender: string | null
          grade_color_note: string | null
          id: string | null
          item_name: string | null
          maker: string | null
          maker_code: string | null
          notes: string | null
          product_master_id: string | null
          required: boolean | null
          requirement_id: string | null
          school_id: string | null
          sort_order: number | null
          store_id: string | null
          updated_at: string | null
          uses_grade_color: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "school_requirements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_product_stock: {
        Args: { p_delta: number; p_product_id: string }
        Returns: undefined
      }
      get_next_order_number: { Args: { p_store_id: string }; Returns: string }
      get_next_ticket_number: { Args: { p_store_id: string }; Returns: number }
      hash_pin: { Args: { p_pin: string }; Returns: string }
      increment_usage_counter: {
        Args: { p_metric: string; p_period: string; p_store_id: string }
        Returns: number
      }
      is_staff: { Args: never; Returns: boolean }
      is_staff_of:
        | {
            Args: { sid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.is_staff_of(sid => text), public.is_staff_of(sid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { sid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.is_staff_of(sid => text), public.is_staff_of(sid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      jwt_store_id: { Args: never; Returns: string }
      seed_default_grades: {
        Args: { p_grade_count?: number; p_school_id: string }
        Returns: undefined
      }
      verify_store_pin: {
        Args: { p_pin: string; p_store_id: string }
        Returns: string
      }
    }
    Enums: {
      queue_category: "fitting" | "pickup" | "other"
      queue_status: "waiting" | "calling" | "completed" | "cancelled"
      visit_category: "fitting" | "pickup" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      queue_category: ["fitting", "pickup", "other"],
      queue_status: ["waiting", "calling", "completed", "cancelled"],
      visit_category: ["fitting", "pickup", "other"],
    },
  },
} as const
