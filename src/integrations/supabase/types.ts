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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      mbr_entries: {
        Row: {
          action_items: Json | null
          ai_summary: string | null
          anirudh_added: boolean | null
          anirudh_joining: boolean | null
          created_at: string
          deal_id: string
          fathom_link: string | null
          id: string
          input_recorded_at: string | null
          mode: string | null
          notes: string | null
          scheduled_date: string | null
          sentiment: string | null
          status: string
          transcript: string | null
          updated_at: string
          updated_by: string
          week_start: string
        }
        Insert: {
          action_items?: Json | null
          ai_summary?: string | null
          anirudh_added?: boolean | null
          anirudh_joining?: boolean | null
          created_at?: string
          deal_id: string
          fathom_link?: string | null
          id?: string
          input_recorded_at?: string | null
          mode?: string | null
          notes?: string | null
          scheduled_date?: string | null
          sentiment?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          updated_by?: string
          week_start: string
        }
        Update: {
          action_items?: Json | null
          ai_summary?: string | null
          anirudh_added?: boolean | null
          anirudh_joining?: boolean | null
          created_at?: string
          deal_id?: string
          fathom_link?: string | null
          id?: string
          input_recorded_at?: string | null
          mode?: string | null
          notes?: string | null
          scheduled_date?: string | null
          sentiment?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          updated_by?: string
          week_start?: string
        }
        Relationships: []
      }
      staffing_assignments: {
        Row: {
          allocation_pct: number
          created_at: string
          deal_id: string
          id: string
          person_id: string
          role_key: string
          updated_at: string
        }
        Insert: {
          allocation_pct?: number
          created_at?: string
          deal_id: string
          id: string
          person_id: string
          role_key: string
          updated_at?: string
        }
        Update: {
          allocation_pct?: number
          created_at?: string
          deal_id?: string
          id?: string
          person_id?: string
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_assignments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "staffing_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "staffing_people"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_deals: {
        Row: {
          account: string
          bopm: string
          business_unit: string
          capability_line: string
          created_at: string
          creative_staffing: boolean
          customer_status: string
          customer_type: string
          deal_id: string
          deal_name: string
          deal_status: string
          deal_status_cx: string
          deal_type: string
          deal_value_lost: number | null
          duration: string | null
          id: string
          mrr: number | null
          net_deal_value: number | null
          non_retainer_deal_value: number | null
          pc_code: string
          principal_bopm: string
          retainer_deal_value: number | null
          senior_bopm: string
          seo_staffing: boolean
          service_line_tagging: string
          staffing_status: string
          total_deal_value: number | null
          updated_at: string
          validation: string
          vsd: string
        }
        Insert: {
          account?: string
          bopm?: string
          business_unit?: string
          capability_line?: string
          created_at?: string
          creative_staffing?: boolean
          customer_status?: string
          customer_type?: string
          deal_id?: string
          deal_name?: string
          deal_status?: string
          deal_status_cx?: string
          deal_type?: string
          deal_value_lost?: number | null
          duration?: string | null
          id: string
          mrr?: number | null
          net_deal_value?: number | null
          non_retainer_deal_value?: number | null
          pc_code?: string
          principal_bopm?: string
          retainer_deal_value?: number | null
          senior_bopm?: string
          seo_staffing?: boolean
          service_line_tagging?: string
          staffing_status?: string
          total_deal_value?: number | null
          updated_at?: string
          validation?: string
          vsd?: string
        }
        Update: {
          account?: string
          bopm?: string
          business_unit?: string
          capability_line?: string
          created_at?: string
          creative_staffing?: boolean
          customer_status?: string
          customer_type?: string
          deal_id?: string
          deal_name?: string
          deal_status?: string
          deal_status_cx?: string
          deal_type?: string
          deal_value_lost?: number | null
          duration?: string | null
          id?: string
          mrr?: number | null
          net_deal_value?: number | null
          non_retainer_deal_value?: number | null
          pc_code?: string
          principal_bopm?: string
          retainer_deal_value?: number | null
          senior_bopm?: string
          seo_staffing?: boolean
          service_line_tagging?: string
          staffing_status?: string
          total_deal_value?: number | null
          updated_at?: string
          validation?: string
          vsd?: string
        }
        Relationships: []
      }
      staffing_hiring_needs: {
        Row: {
          created_at: string
          id: string
          pod: string
          priority: string
          rationale: string
          role: string
          role_category: string
          status: string
          target_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          pod?: string
          priority?: string
          rationale?: string
          role: string
          role_category: string
          status?: string
          target_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pod?: string
          priority?: string
          rationale?: string
          role?: string
          role_category?: string
          status?: string
          target_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      staffing_people: {
        Row: {
          band: string | null
          created_at: string
          department: string | null
          designation: string | null
          id: string
          leaving: boolean
          name: string
          pod: string
          region: string
          reporting_manager: string | null
          role_category: string
          role_title: string
          tbh: boolean
          updated_at: string
        }
        Insert: {
          band?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          id: string
          leaving?: boolean
          name: string
          pod?: string
          region?: string
          reporting_manager?: string | null
          role_category: string
          role_title?: string
          tbh?: boolean
          updated_at?: string
        }
        Update: {
          band?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          id?: string
          leaving?: boolean
          name?: string
          pod?: string
          region?: string
          reporting_manager?: string | null
          role_category?: string
          role_title?: string
          tbh?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      staffing_revenue_targets: {
        Row: {
          created_at: string
          department: string
          designation: string
          id: string
          target_deal_value_per_person: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: string
          designation: string
          id?: string
          target_deal_value_per_person?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          designation?: string
          id?: string
          target_deal_value_per_person?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
