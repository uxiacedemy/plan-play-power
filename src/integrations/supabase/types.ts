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
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_credits: {
        Row: {
          actor_id: string | null
          amount: number
          created_at: string
          customer_id: string
          entry_type: string
          id: string
          note: string | null
          payment_method: string | null
          sale_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          created_at?: string
          customer_id: string
          entry_type: string
          id?: string
          note?: string | null
          payment_method?: string | null
          sale_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          created_at?: string
          customer_id?: string
          entry_type?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          sale_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          loyalty_points: number
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          note: string | null
          recorded_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          meta: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          expiry_date: string | null
          id: string
          image_url: string | null
          name: string
          quantity: number
          reorder_level: number
          selling_price: number
          supplier_id: string | null
          tax_rate: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          name: string
          quantity?: number
          reorder_level?: number
          selling_price?: number
          supplier_id?: string | null
          tax_rate?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          name?: string
          quantity?: number
          reorder_level?: number
          selling_price?: number
          supplier_id?: string | null
          tax_rate?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
        ]
      }
      profiles: {
        Row: {
          address: string | null
          business_reg_no: string | null
          created_at: string
          currency: string
          id: string
          language: string
          low_stock_threshold: number
          opening_float: number
          phone: string | null
          receipt_footer: string | null
          receipt_header: string | null
          shop_name: string
          tax_rate: number
          updated_at: string
          vat_enabled: boolean
        }
        Insert: {
          address?: string | null
          business_reg_no?: string | null
          created_at?: string
          currency?: string
          id: string
          language?: string
          low_stock_threshold?: number
          opening_float?: number
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          shop_name?: string
          tax_rate?: number
          updated_at?: string
          vat_enabled?: boolean
        }
        Update: {
          address?: string | null
          business_reg_no?: string | null
          created_at?: string
          currency?: string
          id?: string
          language?: string
          low_stock_threshold?: number
          opening_float?: number
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          shop_name?: string
          tax_rate?: number
          updated_at?: string
          vat_enabled?: boolean
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          discount: number
          id: string
          line_total: number
          name_snapshot: string
          product_id: string | null
          quantity: number
          sale_id: string
          unit_price: number
          user_id: string
        }
        Insert: {
          discount?: number
          id?: string
          line_total: number
          name_snapshot: string
          product_id?: string | null
          quantity: number
          sale_id: string
          unit_price: number
          user_id: string
        }
        Update: {
          discount?: number
          id?: string
          line_total?: number
          name_snapshot?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
          user_id?: string
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
        ]
      }
      sales: {
        Row: {
          cashier_id: string | null
          created_at: string
          customer_id: string | null
          device_id: string | null
          discount: number
          id: string
          notes: string | null
          payment_method: string
          receipt_no: number | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_from: string | null
          status: string
          subtotal: number
          tax_total: number
          total: number
          user_id: string
          void_reason: string | null
          voided: boolean
          voided_at: string | null
        }
        Insert: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_no?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_from?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total: number
          user_id: string
          void_reason?: string | null
          voided?: boolean
          voided_at?: string | null
        }
        Update: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_no?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_from?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          user_id?: string
          void_reason?: string | null
          voided?: boolean
          voided_at?: string | null
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
            foreignKeyName: "sales_refunded_from_fkey"
            columns: ["refunded_from"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_counters: {
        Row: {
          last_receipt_no: number
          user_id: string
        }
        Insert: {
          last_receipt_no?: number
          user_id: string
        }
        Update: {
          last_receipt_no?: number
          user_id?: string
        }
        Relationships: []
      }
      shop_members: {
        Row: {
          created_at: string
          id: string
          member_id: string
          owner_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          owner_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          owner_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          delta: number
          device_id: string | null
          id: string
          note: string | null
          product_id: string
          reason: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          device_id?: string | null
          id?: string
          note?: string | null
          product_id: string
          reason: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          device_id?: string | null
          id?: string
          note?: string | null
          product_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          _delta: number
          _note?: string
          _product_id: string
          _reason: string
        }
        Returns: undefined
      }
      can_manage_inventory: { Args: never; Returns: boolean }
      checkout_sale:
        | { Args: { _items: Json; _payment_method: string }; Returns: string }
        | {
            Args: {
              _customer_id?: string
              _discount?: number
              _items: Json
              _notes?: string
              _payment_method: string
              _tax_total?: number
            }
            Returns: string
          }
        | {
            Args: {
              _customer_id?: string
              _device_id?: string
              _discount?: number
              _items: Json
              _notes?: string
              _payment_method: string
              _tax_total?: number
            }
            Returns: string
          }
      create_notification: {
        Args: {
          _body?: string
          _meta?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      current_shop_owner: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_or_owner: { Args: never; Returns: boolean }
      next_receipt_no: { Args: { _owner: string }; Returns: number }
      record_customer_payment: {
        Args: {
          _amount: number
          _customer_id: string
          _note?: string
          _payment_method: string
        }
        Returns: string
      }
      refund_sale: {
        Args: { _reason: string; _sale_id: string }
        Returns: string
      }
      void_sale: {
        Args: { _reason: string; _sale_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "cashier"
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
      app_role: ["owner", "manager", "cashier"],
    },
  },
} as const
