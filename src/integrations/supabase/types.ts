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
      appointments: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          end_at: string
          id: string
          location: string | null
          notes: string | null
          reminder_minutes: number | null
          reminder_sent: boolean
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          end_at: string
          id?: string
          location?: string | null
          notes?: string | null
          reminder_minutes?: number | null
          reminder_sent?: boolean
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          end_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          reminder_minutes?: number | null
          reminder_sent?: boolean
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          id: string
          ip_address: string | null
          module: string
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          module: string
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          currency: string
          date_format: string
          default_language: string
          default_vat: number
          email: string | null
          ice: string | null
          id: string
          if_number: string | null
          logo_url: string | null
          patente: string | null
          phone: string | null
          primary_color: string
          rc: string | null
          singleton: boolean
          theme: string
          time_format: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string
          created_at?: string
          currency?: string
          date_format?: string
          default_language?: string
          default_vat?: number
          email?: string | null
          ice?: string | null
          id?: string
          if_number?: string | null
          logo_url?: string | null
          patente?: string | null
          phone?: string | null
          primary_color?: string
          rc?: string | null
          singleton?: boolean
          theme?: string
          time_format?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          currency?: string
          date_format?: string
          default_language?: string
          default_vat?: number
          email?: string | null
          ice?: string | null
          id?: string
          if_number?: string | null
          logo_url?: string | null
          patente?: string | null
          phone?: string | null
          primary_color?: string
          rc?: string | null
          singleton?: boolean
          theme?: string
          time_format?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_history: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          document_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          document_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          document_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          file_path: string
          file_size: number
          file_type: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          file_path: string
          file_size?: number
          file_type?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          file_path?: string
          file_size?: number
          file_type?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_rate: number
          id: string
          invoice_id: string
          line_tax: number
          line_total_ht: number
          line_total_ttc: number
          product_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          discount_rate?: number
          id?: string
          invoice_id: string
          line_tax?: number
          line_total_ht?: number
          line_total_ttc?: number
          product_id?: string | null
          quantity: number
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          discount_rate?: number
          id?: string
          invoice_id?: string
          line_tax?: number
          line_total_ht?: number
          line_total_ttc?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount_amount: number
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stock_applied: boolean
          source_sale_id: string | null
          subtotal_ht: number
          tax_amount: number
          total_ttc: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stock_applied?: boolean
          source_sale_id?: string | null
          subtotal_ht?: number
          tax_amount?: number
          total_ttc?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stock_applied?: boolean
          source_sale_id?: string | null
          subtotal_ht?: number
          tax_amount?: number
          total_ttc?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          description: string
          discount_rate: number
          id: string
          line_tax: number
          line_total_ht: number
          line_total_ttc: number
          order_id: string
          product_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          discount_rate?: number
          id?: string
          line_tax?: number
          line_total_ht?: number
          line_total_ttc?: number
          order_id: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          discount_rate?: number
          id?: string
          line_tax?: number
          line_total_ht?: number
          line_total_ttc?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          order_id: string
          paid_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          order_id: string
          paid_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          order_id?: string
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          due_date: string
          id: string
          notes: string | null
          order_date: string
          order_number: string
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          stock_applied: boolean
          subtotal_ht: number
          tax_amount: number
          total_ttc: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          stock_applied?: boolean
          subtotal_ht?: number
          tax_amount?: number
          total_ttc?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          stock_applied?: boolean
          subtotal_ht?: number
          tax_amount?: number
          total_ttc?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          label: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          label: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          label?: string
          module?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          images: string[]
          min_stock: number
          name: string
          purchase_price: number
          reference: string
          selling_price: number
          sku: string | null
          stock_quantity: number
          supplier_id: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          brand?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          images?: string[]
          min_stock?: number
          name: string
          purchase_price?: number
          reference: string
          selling_price?: number
          sku?: string | null
          stock_quantity?: number
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          brand?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          images?: string[]
          min_stock?: number
          name?: string
          purchase_price?: number
          reference?: string
          selling_price?: number
          sku?: string | null
          stock_quantity?: number
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      project_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          project_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string
          id: string
          kind: string
          project_id: string
          stage_key: Database["public"]["Enums"]["project_stage_key"] | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url: string
          id?: string
          kind?: string
          project_id: string
          stage_key?: Database["public"]["Enums"]["project_stage_key"] | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string
          id?: string
          kind?: string
          project_id?: string
          stage_key?: Database["public"]["Enums"]["project_stage_key"] | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          actual_date: string | null
          comment: string | null
          completed: boolean
          created_at: string
          id: string
          order_index: number
          planned_date: string | null
          project_id: string
          responsible_id: string | null
          stage_key: Database["public"]["Enums"]["project_stage_key"]
          updated_at: string
        }
        Insert: {
          actual_date?: string | null
          comment?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          order_index?: number
          planned_date?: string | null
          project_id: string
          responsible_id?: string | null
          stage_key: Database["public"]["Enums"]["project_stage_key"]
          updated_at?: string
        }
        Update: {
          actual_date?: string | null
          comment?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          order_index?: number
          planned_date?: string | null
          project_id?: string
          responsible_id?: string | null
          stage_key?: Database["public"]["Enums"]["project_stage_key"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          commercial_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          expected_end_date: string | null
          id: string
          install_address: string | null
          name: string
          notes: string | null
          progress: number
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          budget?: number | null
          commercial_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_end_date?: string | null
          id?: string
          install_address?: string | null
          name: string
          notes?: string | null
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          budget?: number | null
          commercial_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_end_date?: string | null
          id?: string
          install_address?: string | null
          name?: string
          notes?: string | null
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          total: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          total?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          total?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          received_date: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          stock_applied: boolean
          supplier_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          stock_applied?: boolean
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          stock_applied?: boolean
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string | null
          discount: number
          id: string
          product_id: string | null
          quantity: number
          quote_id: string
          tax_rate: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          quote_id: string
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          quote_id?: string
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          commercial_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          expiry_date: string | null
          id: string
          notes: string | null
          quote_date: string
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal_ht: number
          tax: number
          total_ttc: number
          updated_at: string
        }
        Insert: {
          commercial_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          expiry_date?: string | null
          id?: string
          notes?: string | null
          quote_date?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_ht?: number
          tax?: number
          total_ttc?: number
          updated_at?: string
        }
        Update: {
          commercial_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          expiry_date?: string | null
          id?: string
          notes?: string | null
          quote_date?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_ht?: number
          tax?: number
          total_ttc?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          is_system: boolean
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_system?: boolean
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_system?: boolean
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          description: string
          discount_rate: number
          id: string
          line_tax: number
          line_total_ht: number
          line_total_ttc: number
          product_id: string | null
          quantity: number
          sale_id: string
          tax_rate: number
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          discount_rate?: number
          id?: string
          line_tax?: number
          line_total_ht?: number
          line_total_ttc?: number
          product_id?: string | null
          quantity?: number
          sale_id: string
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          discount_rate?: number
          id?: string
          line_tax?: number
          line_total_ht?: number
          line_total_ttc?: number
          product_id?: string | null
          quantity?: number
          sale_id?: string
          tax_rate?: number
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          paid_amount: number
          payment_due_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          sale_date: string
          sale_number: string
          stock_applied: boolean
          subtotal_ht: number
          tax_amount: number
          total_ttc: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_amount?: number
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sale_date?: string
          sale_number?: string
          stock_applied?: boolean
          subtotal_ht?: number
          tax_amount?: number
          total_ttc?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          paid_amount?: number
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sale_date?: string
          sale_number?: string
          stock_applied?: boolean
          subtotal_ht?: number
          tax_amount?: number
          total_ttc?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          document_ref: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          stock_after: number | null
          stock_before: number | null
          type: Database["public"]["Enums"]["movement_type"]
          user_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          document_ref?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          stock_after?: number | null
          stock_before?: number | null
          type: Database["public"]["Enums"]["movement_type"]
          user_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          document_ref?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          stock_after?: number | null
          stock_before?: number | null
          type?: Database["public"]["Enums"]["movement_type"]
          user_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          symbol: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_key: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_key?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_key?: string | null
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          manager: string | null
          merchandise: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager?: string | null
          merchandise?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager?: string | null
          merchandise?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_sale: { Args: { _sale: Json; _items: Json }; Returns: string }
      create_order: { Args: { _order: Json; _items: Json }; Returns: string }
      create_invoice: { Args: { _invoice: Json; _items: Json }; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_purchase_order_number: { Args: never; Returns: string }
      generate_quote_number: { Args: never; Returns: string }
      generate_sale_number: { Args: never; Returns: string }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          action: string
          allowed: boolean
          module: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "employee"
        | "manager"
        | "commercial"
        | "warehouse"
        | "accountant"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      document_category:
        | "factures"
        | "devis"
        | "contrats"
        | "projets_cuisines"
        | "sav"
        | "photos"
        | "autres"
      invoice_status: "draft" | "pending" | "paid" | "cancelled"
      movement_type:
        | "in"
        | "out"
        | "sale"
        | "purchase"
        | "customer_return"
        | "supplier_return"
        | "inventory"
        | "transfer"
      order_status: "pending" | "validated" | "delivered" | "cancelled"
      payment_method: "cash" | "card" | "transfer" | "check" | "credit"
      payment_status: "unpaid" | "partial" | "paid"
      project_stage_key:
        | "design"
        | "client_validation"
        | "supplier_order"
        | "goods_reception"
        | "preparation"
        | "delivery"
        | "installation"
        | "quality_check"
        | "completed"
      project_status: "active" | "on_hold" | "completed" | "cancelled"
      purchase_order_status:
        | "draft"
        | "sent"
        | "confirmed"
        | "preparing"
        | "shipped"
        | "received"
        | "cancelled"
      quote_status: "draft" | "sent" | "accepted" | "refused" | "expired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "admin",
        "employee",
        "manager",
        "commercial",
        "warehouse",
        "accountant",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      document_category: [
        "factures",
        "devis",
        "contrats",
        "projets_cuisines",
        "sav",
        "photos",
        "autres",
      ],
      invoice_status: ["draft", "pending", "paid", "cancelled"],
      movement_type: [
        "in",
        "out",
        "sale",
        "purchase",
        "customer_return",
        "supplier_return",
        "inventory",
        "transfer",
      ],
      order_status: ["pending", "validated", "delivered", "cancelled"],
      payment_method: ["cash", "card", "transfer", "check", "credit"],
      payment_status: ["unpaid", "partial", "paid"],
      project_stage_key: [
        "design",
        "client_validation",
        "supplier_order",
        "goods_reception",
        "preparation",
        "delivery",
        "installation",
        "quality_check",
        "completed",
      ],
      project_status: ["active", "on_hold", "completed", "cancelled"],
      purchase_order_status: [
        "draft",
        "sent",
        "confirmed",
        "preparing",
        "shipped",
        "received",
        "cancelled",
      ],
      quote_status: ["draft", "sent", "accepted", "refused", "expired"],
    },
  },
} as const
