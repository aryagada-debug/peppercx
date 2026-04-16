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
      clients: {
        Row: {
          account_status: string
          billing_address: string
          competitor_involved: string
          contract_signed_date: string | null
          created_at: string
          daily_poc_linkedin: string
          daily_poc_name: string
          daily_poc_phone: string
          geography: string
          gst_number: string
          hom_poc_linkedin: string
          hom_poc_name: string
          hom_poc_phone: string
          id: string
          industry: string
          lead_source: string
          name: string
          nda_signed: boolean
          notes: string
          pc_code: string
          sales_poc: string
          signing_entity: string
          updated_at: string
          website: string
        }
        Insert: {
          account_status?: string
          billing_address?: string
          competitor_involved?: string
          contract_signed_date?: string | null
          created_at?: string
          daily_poc_linkedin?: string
          daily_poc_name?: string
          daily_poc_phone?: string
          geography?: string
          gst_number?: string
          hom_poc_linkedin?: string
          hom_poc_name?: string
          hom_poc_phone?: string
          id?: string
          industry?: string
          lead_source?: string
          name: string
          nda_signed?: boolean
          notes?: string
          pc_code?: string
          sales_poc?: string
          signing_entity?: string
          updated_at?: string
          website?: string
        }
        Update: {
          account_status?: string
          billing_address?: string
          competitor_involved?: string
          contract_signed_date?: string | null
          created_at?: string
          daily_poc_linkedin?: string
          daily_poc_name?: string
          daily_poc_phone?: string
          geography?: string
          gst_number?: string
          hom_poc_linkedin?: string
          hom_poc_name?: string
          hom_poc_phone?: string
          id?: string
          industry?: string
          lead_source?: string
          name?: string
          nda_signed?: boolean
          notes?: string
          pc_code?: string
          sales_poc?: string
          signing_entity?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      cx_space_members: {
        Row: {
          created_at: string
          id: string
          member_name: string
          role: string
          space_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_name: string
          role?: string
          space_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_name?: string
          role?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cx_space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "cx_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cx_spaces: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cx_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          sort_order: number
          space_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          space_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cx_statuses_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "cx_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cx_tasks: {
        Row: {
          assignee: string
          created_at: string
          description: string
          end_date: string | null
          id: string
          priority: string
          sort_order: number
          space_id: string
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          priority?: string
          sort_order?: number
          space_id: string
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Update: {
          assignee?: string
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          priority?: string
          sort_order?: number
          space_id?: string
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cx_tasks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "cx_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_financials: {
        Row: {
          actual_gm_pct: number
          consumption: number
          contracted: number
          created_at: string
          deal_id: string
          id: string
          invoice_date: string | null
          invoiced: number
          month: string
          outstanding: number
          outstanding_date: string | null
          planned_gm_pct: number
          received: number
          received_date: string | null
          updated_at: string
        }
        Insert: {
          actual_gm_pct?: number
          consumption?: number
          contracted?: number
          created_at?: string
          deal_id: string
          id?: string
          invoice_date?: string | null
          invoiced?: number
          month: string
          outstanding?: number
          outstanding_date?: string | null
          planned_gm_pct?: number
          received?: number
          received_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_gm_pct?: number
          consumption?: number
          contracted?: number
          created_at?: string
          deal_id?: string
          id?: string
          invoice_date?: string | null
          invoiced?: number
          month?: string
          outstanding?: number
          outstanding_date?: string | null
          planned_gm_pct?: number
          received?: number
          received_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deal_onboarding_steps: {
        Row: {
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          deal_id: string
          due_date: string | null
          id: string
          owner: string
          sort_order: number
          step_name: string
          updated_at: string
        }
        Insert: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deal_id: string
          due_date?: string | null
          id?: string
          owner?: string
          sort_order?: number
          step_name?: string
          updated_at?: string
        }
        Update: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deal_id?: string
          due_date?: string | null
          id?: string
          owner?: string
          sort_order?: number
          step_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_revenue_monthly: {
        Row: {
          actuals: number
          contraction: number
          created_at: string
          deal_id: string
          delivered: number
          id: string
          invoiced: number
          month: string
          mrr: number
          updated_at: string
        }
        Insert: {
          actuals?: number
          contraction?: number
          created_at?: string
          deal_id: string
          delivered?: number
          id?: string
          invoiced?: number
          month: string
          mrr?: number
          updated_at?: string
        }
        Update: {
          actuals?: number
          contraction?: number
          created_at?: string
          deal_id?: string
          delivered?: number
          id?: string
          invoiced?: number
          month?: string
          mrr?: number
          updated_at?: string
        }
        Relationships: []
      }
      deal_rgy_weekly: {
        Row: {
          account_health: string
          action_plan: string | null
          capability_creative: string
          capability_seo: string
          consumption: string
          content: string
          copy: string
          created_at: string
          customer: string
          deal_id: string
          delivery: string
          design: string
          discussed_action_plan: string | null
          finance_billing: string
          id: string
          internal: string
          invoicing: string
          issue_date: string | null
          issue_details: string | null
          issue_status: string | null
          margins: string
          notes: string | null
          plan_of_action: string
          receivables: string
          resolution_due_date: string | null
          seo: string
          supply: string
          video: string
          week_start: string
        }
        Insert: {
          account_health?: string
          action_plan?: string | null
          capability_creative?: string
          capability_seo?: string
          consumption?: string
          content?: string
          copy?: string
          created_at?: string
          customer?: string
          deal_id: string
          delivery?: string
          design?: string
          discussed_action_plan?: string | null
          finance_billing?: string
          id?: string
          internal?: string
          invoicing?: string
          issue_date?: string | null
          issue_details?: string | null
          issue_status?: string | null
          margins?: string
          notes?: string | null
          plan_of_action?: string
          receivables?: string
          resolution_due_date?: string | null
          seo?: string
          supply?: string
          video?: string
          week_start: string
        }
        Update: {
          account_health?: string
          action_plan?: string | null
          capability_creative?: string
          capability_seo?: string
          consumption?: string
          content?: string
          copy?: string
          created_at?: string
          customer?: string
          deal_id?: string
          delivery?: string
          design?: string
          discussed_action_plan?: string | null
          finance_billing?: string
          id?: string
          internal?: string
          invoicing?: string
          issue_date?: string | null
          issue_details?: string | null
          issue_status?: string | null
          margins?: string
          notes?: string | null
          plan_of_action?: string
          receivables?: string
          resolution_due_date?: string | null
          seo?: string
          supply?: string
          video?: string
          week_start?: string
        }
        Relationships: []
      }
      deal_sow_items: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          line_item_value: number | null
          revenue_share: number
          scope: string
          team_capability: string
          teams: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          line_item_value?: number | null
          revenue_share?: number
          scope?: string
          team_capability?: string
          teams?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          line_item_value?: number | null
          revenue_share?: number
          scope?: string
          team_capability?: string
          teams?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      deal_targets_monthly: {
        Row: {
          contraction_target: number
          created_at: string
          deal_id: string
          delivery_target: number
          id: string
          invoicing_target: number
          month: string
          updated_at: string
        }
        Insert: {
          contraction_target?: number
          created_at?: string
          deal_id: string
          delivery_target?: number
          id?: string
          invoicing_target?: number
          month: string
          updated_at?: string
        }
        Update: {
          contraction_target?: number
          created_at?: string
          deal_id?: string
          delivery_target?: number
          id?: string
          invoicing_target?: number
          month?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          assignee: string
          auto_regen: boolean
          created_at: string
          deal_id: string
          description: string
          end_date: string | null
          estimated_hours: number
          id: string
          logged_hours: number
          phase: string
          sort_order: number
          stage: string
          start_date: string | null
          subtasks: Json
          tags: string[] | null
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assignee?: string
          auto_regen?: boolean
          created_at?: string
          deal_id: string
          description?: string
          end_date?: string | null
          estimated_hours?: number
          id?: string
          logged_hours?: number
          phase?: string
          sort_order?: number
          stage?: string
          start_date?: string | null
          subtasks?: Json
          tags?: string[] | null
          title?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assignee?: string
          auto_regen?: boolean
          created_at?: string
          deal_id?: string
          description?: string
          end_date?: string | null
          estimated_hours?: number
          id?: string
          logged_hours?: number
          phase?: string
          sort_order?: number
          stage?: string
          start_date?: string | null
          subtasks?: Json
          tags?: string[] | null
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: []
      }
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
          mbr_ppt_link: string | null
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
          mbr_ppt_link?: string | null
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
          mbr_ppt_link?: string | null
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
      staffing_bw_rules: {
        Row: {
          capability: string
          created_at: string
          id: string
          mrr_max: number
          mrr_min: number
          mrr_tier_label: string
          recommended_pct: number
          region: string
          role_key: string
          updated_at: string
        }
        Insert: {
          capability?: string
          created_at?: string
          id?: string
          mrr_max?: number
          mrr_min?: number
          mrr_tier_label?: string
          recommended_pct?: number
          region?: string
          role_key?: string
          updated_at?: string
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          mrr_max?: number
          mrr_min?: number
          mrr_tier_label?: string
          recommended_pct?: number
          region?: string
          role_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      staffing_deals: {
        Row: {
          account: string
          baseline_metrics: string
          bopm: string
          business_unit: string
          capability_line: string
          client_id: string | null
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
          end_date: string | null
          id: string
          mrr: number | null
          net_deal_value: number | null
          non_retainer_deal_value: number | null
          payment_terms: string
          pc_code: string
          pepper_business_unit: string
          pod: string
          principal_bopm: string
          projected_outcomes: Json | null
          rag: string
          retainer_deal_value: number | null
          senior_bopm: string
          seo_staffing: boolean
          service_line_tagging: string
          staffing_status: string
          start_date: string | null
          success_metrics: Json | null
          total_deal_value: number | null
          updated_at: string
          validation: string
          vsd: string
        }
        Insert: {
          account?: string
          baseline_metrics?: string
          bopm?: string
          business_unit?: string
          capability_line?: string
          client_id?: string | null
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
          end_date?: string | null
          id: string
          mrr?: number | null
          net_deal_value?: number | null
          non_retainer_deal_value?: number | null
          payment_terms?: string
          pc_code?: string
          pepper_business_unit?: string
          pod?: string
          principal_bopm?: string
          projected_outcomes?: Json | null
          rag?: string
          retainer_deal_value?: number | null
          senior_bopm?: string
          seo_staffing?: boolean
          service_line_tagging?: string
          staffing_status?: string
          start_date?: string | null
          success_metrics?: Json | null
          total_deal_value?: number | null
          updated_at?: string
          validation?: string
          vsd?: string
        }
        Update: {
          account?: string
          baseline_metrics?: string
          bopm?: string
          business_unit?: string
          capability_line?: string
          client_id?: string | null
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
          end_date?: string | null
          id?: string
          mrr?: number | null
          net_deal_value?: number | null
          non_retainer_deal_value?: number | null
          payment_terms?: string
          pc_code?: string
          pepper_business_unit?: string
          pod?: string
          principal_bopm?: string
          projected_outcomes?: Json | null
          rag?: string
          retainer_deal_value?: number | null
          senior_bopm?: string
          seo_staffing?: boolean
          service_line_tagging?: string
          staffing_status?: string
          start_date?: string | null
          success_metrics?: Json | null
          total_deal_value?: number | null
          updated_at?: string
          validation?: string
          vsd?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          hourly_rate: number
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
          hourly_rate?: number
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
          hourly_rate?: number
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
      task_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          phases: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          phases?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phases?: Json
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
