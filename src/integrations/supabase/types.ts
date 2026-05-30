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
      approval_comments: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author_id: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          batch_title: string
          created_at: string
          deal_id: string
          decided_at: string | null
          id: string
          is_batch: boolean
          parent_id: string | null
          payload: Json
          previous: Json
          request_type: string
          requested_by: string
          requested_by_name: string
          requester_note: string
          reviewer_id: string | null
          reviewer_name: string
          reviewer_note: string
          status: string
          target_id: string
          target_kind: string
          updated_at: string
        }
        Insert: {
          batch_title?: string
          created_at?: string
          deal_id?: string
          decided_at?: string | null
          id?: string
          is_batch?: boolean
          parent_id?: string | null
          payload?: Json
          previous?: Json
          request_type: string
          requested_by: string
          requested_by_name?: string
          requester_note?: string
          reviewer_id?: string | null
          reviewer_name?: string
          reviewer_note?: string
          status?: string
          target_id?: string
          target_kind?: string
          updated_at?: string
        }
        Update: {
          batch_title?: string
          created_at?: string
          deal_id?: string
          decided_at?: string | null
          id?: string
          is_batch?: boolean
          parent_id?: string | null
          payload?: Json
          previous?: Json
          request_type?: string
          requested_by?: string
          requested_by_name?: string
          requester_note?: string
          reviewer_id?: string | null
          reviewer_name?: string
          reviewer_note?: string
          status?: string
          target_id?: string
          target_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_groups: {
        Row: {
          created_at: string
          id: string
          lead_person_id: string | null
          name: string
          role_categories: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_person_id?: string | null
          name: string
          role_categories?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_person_id?: string | null
          name?: string
          role_categories?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      capability_memberships: {
        Row: {
          capability_id: string
          created_at: string
          id: string
          is_lead: boolean
          person_id: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          id?: string
          is_lead?: boolean
          person_id: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          id?: string
          is_lead?: boolean
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_memberships_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capability_groups"
            referencedColumns: ["id"]
          },
        ]
      }
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
          assignees: string[]
          auto_regen: boolean
          created_at: string
          created_by: string | null
          created_by_name: string
          description: string
          end_date: string | null
          estimated_hours: number
          id: string
          logged_hours: number
          priority: string
          sort_order: number
          space_id: string
          start_date: string | null
          status: string
          subtasks: Json
          tags: string[] | null
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assignee?: string
          assignees?: string[]
          auto_regen?: boolean
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          description?: string
          end_date?: string | null
          estimated_hours?: number
          id?: string
          logged_hours?: number
          priority?: string
          sort_order?: number
          space_id: string
          start_date?: string | null
          status?: string
          subtasks?: Json
          tags?: string[] | null
          title?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assignee?: string
          assignees?: string[]
          auto_regen?: boolean
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          description?: string
          end_date?: string | null
          estimated_hours?: number
          id?: string
          logged_hours?: number
          priority?: string
          sort_order?: number
          space_id?: string
          start_date?: string | null
          status?: string
          subtasks?: Json
          tags?: string[] | null
          title?: string
          updated_at?: string
          urgency?: string
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
      deal_applicability: {
        Row: {
          created_at: string
          deal_id: string
          department_id: string
          id: string
          is_applicable: boolean
          role_type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          department_id: string
          id?: string
          is_applicable?: boolean
          role_type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          department_id?: string
          id?: string
          is_applicable?: boolean
          role_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_applicability_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "staffing_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_applicability_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "staffing_role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_financial_targets: {
        Row: {
          contraction_actual: number
          contraction_target: number
          created_at: string
          deal_id: string
          delivery_actual: number
          delivery_target: number
          id: string
          invoicing_actual: number
          invoicing_target: number
          month: string
          receivables_actual: number
          receivables_target: number
          updated_at: string
        }
        Insert: {
          contraction_actual?: number
          contraction_target?: number
          created_at?: string
          deal_id: string
          delivery_actual?: number
          delivery_target?: number
          id?: string
          invoicing_actual?: number
          invoicing_target?: number
          month: string
          receivables_actual?: number
          receivables_target?: number
          updated_at?: string
        }
        Update: {
          contraction_actual?: number
          contraction_target?: number
          created_at?: string
          deal_id?: string
          delivery_actual?: number
          delivery_target?: number
          id?: string
          invoicing_actual?: number
          invoicing_target?: number
          month?: string
          receivables_actual?: number
          receivables_target?: number
          updated_at?: string
        }
        Relationships: []
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
      deal_rgy_notes: {
        Row: {
          created_at: string
          deal_id: string
          dimension: string
          from_value: string
          id: string
          note: string
          to_value: string
          updated_by: string
          updated_by_name: string
          week_start: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          dimension: string
          from_value?: string
          id?: string
          note?: string
          to_value?: string
          updated_by: string
          updated_by_name?: string
          week_start?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          dimension?: string
          from_value?: string
          id?: string
          note?: string
          to_value?: string
          updated_by?: string
          updated_by_name?: string
          week_start?: string | null
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
          updated_at: string
          updated_by: string | null
          updated_by_name: string
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
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
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
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
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
      deal_stakeholders: {
        Row: {
          client_name: string
          created_at: string
          deal_id: string
          decision_power: number
          email: string
          function: string
          id: string
          linkedin_url: string
          name: string
          notes: string
          phone: string
          role: string
          seniority: string
          sort_order: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          client_name?: string
          created_at?: string
          deal_id: string
          decision_power?: number
          email?: string
          function?: string
          id?: string
          linkedin_url?: string
          name?: string
          notes?: string
          phone?: string
          role?: string
          seniority?: string
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          deal_id?: string
          decision_power?: number
          email?: string
          function?: string
          id?: string
          linkedin_url?: string
          name?: string
          notes?: string
          phone?: string
          role?: string
          seniority?: string
          sort_order?: number
          tags?: string[]
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
          assignees: string[]
          auto_regen: boolean
          created_at: string
          created_by: string | null
          created_by_name: string
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
          assignees?: string[]
          auto_regen?: boolean
          created_at?: string
          created_by?: string | null
          created_by_name?: string
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
          assignees?: string[]
          auto_regen?: boolean
          created_at?: string
          created_by?: string | null
          created_by_name?: string
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
      google_calendar_connections: {
        Row: {
          access_token: string
          connected_at: string
          expires_at: string
          google_email: string | null
          refresh_token: string | null
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          expires_at: string
          google_email?: string | null
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          expires_at?: string
          google_email?: string | null
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mbr_calendar_links: {
        Row: {
          created_at: string
          google_calendar_id: string
          google_event_id: string
          html_link: string | null
          id: string
          last_synced_at: string
          mbr_entry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_calendar_id?: string
          google_event_id: string
          html_link?: string | null
          id?: string
          last_synced_at?: string
          mbr_entry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_calendar_id?: string
          google_event_id?: string
          html_link?: string | null
          id?: string
          last_synced_at?: string
          mbr_entry_id?: string
          user_id?: string
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
      mbr_reminder_log: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          mbr_entry_id: string
          reminder_type: string
          sent_date: string
        }
        Insert: {
          channel_id?: string
          created_at?: string
          id?: string
          mbr_entry_id: string
          reminder_type: string
          sent_date: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          mbr_entry_id?: string
          reminder_type?: string
          sent_date?: string
        }
        Relationships: []
      }
      personal_todos: {
        Row: {
          assigned_by_name: string
          assigned_by_user_id: string | null
          assignee_name: string
          assignee_staffing_person_id: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          notes: string
          priority: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_by_name?: string
          assigned_by_user_id?: string | null
          assignee_name?: string
          assignee_staffing_person_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          notes?: string
          priority?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_by_name?: string
          assigned_by_user_id?: string | null
          assignee_name?: string
          assignee_staffing_person_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          notes?: string
          priority?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: string
          display_name: string | null
          id: string
          staffing_person_id: string | null
          updated_at: string
          user_id: string
          weekly_summary_opt_in: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id?: string
          staffing_person_id?: string | null
          updated_at?: string
          user_id: string
          weekly_summary_opt_in?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id?: string
          staffing_person_id?: string | null
          updated_at?: string
          user_id?: string
          weekly_summary_opt_in?: boolean
        }
        Relationships: []
      }
      route_access_summaries: {
        Row: {
          created_at: string
          edit_summary: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          route_key: string
          updated_at: string
          view_summary: string
        }
        Insert: {
          created_at?: string
          edit_summary?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          route_key: string
          updated_at?: string
          view_summary?: string
        }
        Update: {
          created_at?: string
          edit_summary?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          route_key?: string
          updated_at?: string
          view_summary?: string
        }
        Relationships: []
      }
      route_visibility: {
        Row: {
          access_mode: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          route_key: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          access_mode?: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          route_key: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          access_mode?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          route_key?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      slack_dm_threads: {
        Row: {
          app_user_id: string
          created_at: string
          id: string
          im_channel_id: string
          last_message_at: string | null
          slack_user_email: string
          slack_user_id: string
          slack_user_name: string
          updated_at: string
        }
        Insert: {
          app_user_id: string
          created_at?: string
          id?: string
          im_channel_id: string
          last_message_at?: string | null
          slack_user_email?: string
          slack_user_id: string
          slack_user_name?: string
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          created_at?: string
          id?: string
          im_channel_id?: string
          last_message_at?: string | null
          slack_user_email?: string
          slack_user_id?: string
          slack_user_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      slack_inactivity_nudges: {
        Row: {
          channel_id: string
          deal_id: string
          id: string
          message_count: number
          sent_at: string
          week_start: string
        }
        Insert: {
          channel_id: string
          deal_id: string
          id?: string
          message_count?: number
          sent_at?: string
          week_start: string
        }
        Update: {
          channel_id?: string
          deal_id?: string
          id?: string
          message_count?: number
          sent_at?: string
          week_start?: string
        }
        Relationships: []
      }
      slack_messages: {
        Row: {
          channel_id: string
          created_at: string
          deal_id: string | null
          dm_thread_id: string | null
          id: string
          raw: Json
          sent_by_app_user: string | null
          sent_by_display_name: string
          slack_ts: string
          source: string
          text: string
          thread_ts: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          deal_id?: string | null
          dm_thread_id?: string | null
          id?: string
          raw?: Json
          sent_by_app_user?: string | null
          sent_by_display_name?: string
          slack_ts: string
          source?: string
          text?: string
          thread_ts?: string | null
          user_id?: string
          user_name?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          deal_id?: string | null
          dm_thread_id?: string | null
          id?: string
          raw?: Json
          sent_by_app_user?: string | null
          sent_by_display_name?: string
          slack_ts?: string
          source?: string
          text?: string
          thread_ts?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      smart_nudges: {
        Row: {
          confidence: number
          dismissed: boolean
          expires_at: string | null
          generated_at: string
          id: string
          primary_action_href: string
          primary_action_label: string
          primary_action_payload: Json
          snoozed_until: string | null
          target_entity_id: string
          target_entity_name: string
          target_entity_type: string
          text: string
          type: string
          user_id: string
        }
        Insert: {
          confidence?: number
          dismissed?: boolean
          expires_at?: string | null
          generated_at?: string
          id?: string
          primary_action_href?: string
          primary_action_label?: string
          primary_action_payload?: Json
          snoozed_until?: string | null
          target_entity_id?: string
          target_entity_name?: string
          target_entity_type?: string
          text?: string
          type: string
          user_id: string
        }
        Update: {
          confidence?: number
          dismissed?: boolean
          expires_at?: string | null
          generated_at?: string
          id?: string
          primary_action_href?: string
          primary_action_label?: string
          primary_action_payload?: Json
          snoozed_until?: string | null
          target_entity_id?: string
          target_entity_name?: string
          target_entity_type?: string
          text?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      staffing_assignments: {
        Row: {
          allocation_pct: number
          created_at: string
          deal_id: string
          end_date: string | null
          id: string
          person_id: string
          role_key: string
          role_type_id: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          allocation_pct?: number
          created_at?: string
          deal_id: string
          end_date?: string | null
          id: string
          person_id: string
          role_key: string
          role_type_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          allocation_pct?: number
          created_at?: string
          deal_id?: string
          end_date?: string | null
          id?: string
          person_id?: string
          role_key?: string
          role_type_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_assignments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_unified"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "staffing_assignments_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "staffing_role_types"
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
          role_type_id: string | null
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
          role_type_id?: string | null
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
          role_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_bw_rules_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "staffing_role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_deals: {
        Row: {
          account: string
          baseline_metrics: string
          bopm: string
          business_unit: string
          capability_line: string
          client_id: string | null
          consumption_value: number
          contract_file_path: string | null
          created_at: string
          creative_staffing: boolean
          customer_status: string
          customer_type: string
          deal_id: string
          deal_name: string
          deal_status: string
          deal_status_cx: string
          deal_target_status: string
          deal_type: string
          deal_value_lost: number | null
          duration: string | null
          end_date: string | null
          geo: string
          id: string
          input_currency: string
          invoiced_deal_value: number
          mis_vs_consumption: number
          month_closed_won: string
          mrr: number | null
          net_deal_value: number | null
          new_deal_id_formulated: string
          new_deal_id_temp: string
          non_retainer_deal_value: number | null
          payment_terms: string
          pc_code: string
          pepper_bu_l2: string
          pepper_business_unit: string
          pod: string
          principal_bopm: string
          projected_outcomes: Json | null
          rag: string
          retainer_deal_value: number | null
          revenue_type: string
          sales_leader: string
          sales_rep: string
          senior_bopm: string
          seo_staffing: boolean
          service_line_tagging: string
          slack_channel_id: string
          sow_file_path: string | null
          staffing_locked_at: string | null
          staffing_locked_by: string | null
          staffing_locked_by_name: string
          staffing_status: string
          start_date: string | null
          strategy_bandwidth_required: string
          success_metrics: Json | null
          tcv_usd: number
          total_deal_value: number | null
          total_mis_recognition: number
          total_pending_recognition: number
          undelivered_funnel: number
          updated_at: string
          validation: string
          validation_central_cx: string
          vsd: string
        }
        Insert: {
          account?: string
          baseline_metrics?: string
          bopm?: string
          business_unit?: string
          capability_line?: string
          client_id?: string | null
          consumption_value?: number
          contract_file_path?: string | null
          created_at?: string
          creative_staffing?: boolean
          customer_status?: string
          customer_type?: string
          deal_id?: string
          deal_name?: string
          deal_status?: string
          deal_status_cx?: string
          deal_target_status?: string
          deal_type?: string
          deal_value_lost?: number | null
          duration?: string | null
          end_date?: string | null
          geo?: string
          id: string
          input_currency?: string
          invoiced_deal_value?: number
          mis_vs_consumption?: number
          month_closed_won?: string
          mrr?: number | null
          net_deal_value?: number | null
          new_deal_id_formulated?: string
          new_deal_id_temp?: string
          non_retainer_deal_value?: number | null
          payment_terms?: string
          pc_code?: string
          pepper_bu_l2?: string
          pepper_business_unit?: string
          pod?: string
          principal_bopm?: string
          projected_outcomes?: Json | null
          rag?: string
          retainer_deal_value?: number | null
          revenue_type?: string
          sales_leader?: string
          sales_rep?: string
          senior_bopm?: string
          seo_staffing?: boolean
          service_line_tagging?: string
          slack_channel_id?: string
          sow_file_path?: string | null
          staffing_locked_at?: string | null
          staffing_locked_by?: string | null
          staffing_locked_by_name?: string
          staffing_status?: string
          start_date?: string | null
          strategy_bandwidth_required?: string
          success_metrics?: Json | null
          tcv_usd?: number
          total_deal_value?: number | null
          total_mis_recognition?: number
          total_pending_recognition?: number
          undelivered_funnel?: number
          updated_at?: string
          validation?: string
          validation_central_cx?: string
          vsd?: string
        }
        Update: {
          account?: string
          baseline_metrics?: string
          bopm?: string
          business_unit?: string
          capability_line?: string
          client_id?: string | null
          consumption_value?: number
          contract_file_path?: string | null
          created_at?: string
          creative_staffing?: boolean
          customer_status?: string
          customer_type?: string
          deal_id?: string
          deal_name?: string
          deal_status?: string
          deal_status_cx?: string
          deal_target_status?: string
          deal_type?: string
          deal_value_lost?: number | null
          duration?: string | null
          end_date?: string | null
          geo?: string
          id?: string
          input_currency?: string
          invoiced_deal_value?: number
          mis_vs_consumption?: number
          month_closed_won?: string
          mrr?: number | null
          net_deal_value?: number | null
          new_deal_id_formulated?: string
          new_deal_id_temp?: string
          non_retainer_deal_value?: number | null
          payment_terms?: string
          pc_code?: string
          pepper_bu_l2?: string
          pepper_business_unit?: string
          pod?: string
          principal_bopm?: string
          projected_outcomes?: Json | null
          rag?: string
          retainer_deal_value?: number | null
          revenue_type?: string
          sales_leader?: string
          sales_rep?: string
          senior_bopm?: string
          seo_staffing?: boolean
          service_line_tagging?: string
          slack_channel_id?: string
          sow_file_path?: string | null
          staffing_locked_at?: string | null
          staffing_locked_by?: string | null
          staffing_locked_by_name?: string
          staffing_status?: string
          start_date?: string | null
          strategy_bandwidth_required?: string
          success_metrics?: Json | null
          tcv_usd?: number
          total_deal_value?: number | null
          total_mis_recognition?: number
          total_pending_recognition?: number
          undelivered_funnel?: number
          updated_at?: string
          validation?: string
          validation_central_cx?: string
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
      staffing_departments: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
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
          department_id: string | null
          designation: string | null
          email: string
          hourly_rate: number
          id: string
          leaving: boolean
          name: string
          pod: string
          region: string
          reporting_manager: string | null
          revenue_target_currency: string
          revenue_target_per_person: number
          role_category: string
          role_title: string
          role_type_id: string | null
          slack_user_id: string
          sub_team: string
          tbh: boolean
          updated_at: string
        }
        Insert: {
          band?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string
          hourly_rate?: number
          id: string
          leaving?: boolean
          name: string
          pod?: string
          region?: string
          reporting_manager?: string | null
          revenue_target_currency?: string
          revenue_target_per_person?: number
          role_category: string
          role_title?: string
          role_type_id?: string | null
          slack_user_id?: string
          sub_team?: string
          tbh?: boolean
          updated_at?: string
        }
        Update: {
          band?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string
          hourly_rate?: number
          id?: string
          leaving?: boolean
          name?: string
          pod?: string
          region?: string
          reporting_manager?: string | null
          revenue_target_currency?: string
          revenue_target_per_person?: number
          role_category?: string
          role_title?: string
          role_type_id?: string | null
          slack_user_id?: string
          sub_team?: string
          tbh?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_people_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "staffing_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_people_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "staffing_role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_reminder_log: {
        Row: {
          assignment_id: string
          deal_id: string
          id: string
          person_id: string
          reminder_type: string
          sent_at: string
          sent_date: string
        }
        Insert: {
          assignment_id?: string
          deal_id?: string
          id?: string
          person_id: string
          reminder_type: string
          sent_at?: string
          sent_date?: string
        }
        Update: {
          assignment_id?: string
          deal_id?: string
          id?: string
          person_id?: string
          reminder_type?: string
          sent_at?: string
          sent_date?: string
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
      staffing_review_requests: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          note: string
          requested_by: string
          requested_by_name: string
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_name: string | null
          status: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          note?: string
          requested_by: string
          requested_by_name?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          note?: string
          requested_by?: string
          requested_by_name?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          status?: string
        }
        Relationships: []
      }
      staffing_role_types: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_role_types_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "staffing_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_weekly_allocations: {
        Row: {
          actual_hours: number
          allocation_pct: number
          created_at: string
          deal_id: string
          id: string
          person_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          actual_hours?: number
          allocation_pct?: number
          created_at?: string
          deal_id: string
          id?: string
          person_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          actual_hours?: number
          allocation_pct?: number
          created_at?: string
          deal_id?: string
          id?: string
          person_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          clients_created: number
          created_at: string
          deals_upserted: number
          error_log: Json
          financials_upserted: number
          finished_at: string | null
          id: string
          rows_skipped: number
          source: string
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          clients_created?: number
          created_at?: string
          deals_upserted?: number
          error_log?: Json
          financials_upserted?: number
          finished_at?: string | null
          id?: string
          rows_skipped?: number
          source?: string
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          clients_created?: number
          created_at?: string
          deals_upserted?: number
          error_log?: Json
          financials_upserted?: number
          finished_at?: string | null
          id?: string
          rows_skipped?: number
          source?: string
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          phases: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phases?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phases?: Json
          updated_at?: string
        }
        Relationships: []
      }
      trash_items: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          deleted_by_name: string
          entity_id: string
          entity_label: string
          entity_type: string
          expires_at: string
          id: string
          restored_at: string | null
          snapshot: Json
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string
          entity_id: string
          entity_label?: string
          entity_type: string
          expires_at?: string
          id?: string
          restored_at?: string | null
          snapshot?: Json
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string
          entity_id?: string
          entity_label?: string
          entity_type?: string
          expires_at?: string
          id?: string
          restored_at?: string | null
          snapshot?: Json
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          actor_avatar_url: string
          actor_name: string
          body: string
          created_at: string
          cta_href: string
          cta_label: string
          id: string
          notification_category: string
          read: boolean
          source_entity_id: string
          source_entity_name: string
          source_entity_type: string
          type: string
          user_id: string
        }
        Insert: {
          actor_avatar_url?: string
          actor_name?: string
          body?: string
          created_at?: string
          cta_href?: string
          cta_label?: string
          id?: string
          notification_category?: string
          read?: boolean
          source_entity_id?: string
          source_entity_name?: string
          source_entity_type?: string
          type: string
          user_id: string
        }
        Update: {
          actor_avatar_url?: string
          actor_name?: string
          body?: string
          created_at?: string
          cta_href?: string
          cta_label?: string
          id?: string
          notification_category?: string
          read?: boolean
          source_entity_id?: string
          source_entity_name?: string
          source_entity_type?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_nudge_settings: {
        Row: {
          enabled: boolean
          id: string
          nudge_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          nudge_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          id?: string
          nudge_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pins: {
        Row: {
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          pinned_at: string
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_name?: string
          entity_type: string
          id?: string
          pinned_at?: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          pinned_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quotas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          period_type: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          period_type: string
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_recent_views: {
        Row: {
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          entity_id: string
          entity_name?: string
          entity_type: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          user_id?: string
          viewed_at?: string
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
      user_route_overrides: {
        Row: {
          access_mode: string
          created_at: string
          route_key: string
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          access_mode: string
          created_at?: string
          route_key: string
          updated_at?: string
          user_id: string
          visible: boolean
        }
        Update: {
          access_mode?: string
          created_at?: string
          route_key?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      vsd_financial_targets: {
        Row: {
          contraction_actual: number
          contraction_target: number
          created_at: string
          delivery_actual: number
          delivery_target: number
          id: string
          invoicing_actual: number
          invoicing_target: number
          month: string
          receivables_actual: number
          receivables_target: number
          updated_at: string
          vsd: string
        }
        Insert: {
          contraction_actual?: number
          contraction_target?: number
          created_at?: string
          delivery_actual?: number
          delivery_target?: number
          id?: string
          invoicing_actual?: number
          invoicing_target?: number
          month: string
          receivables_actual?: number
          receivables_target?: number
          updated_at?: string
          vsd: string
        }
        Update: {
          contraction_actual?: number
          contraction_target?: number
          created_at?: string
          delivery_actual?: number
          delivery_target?: number
          id?: string
          invoicing_actual?: number
          invoicing_target?: number
          month?: string
          receivables_actual?: number
          receivables_target?: number
          updated_at?: string
          vsd?: string
        }
        Relationships: []
      }
    }
    Views: {
      deals_unified: {
        Row: {
          account: string | null
          assigned_headcount: number | null
          baseline_metrics: string | null
          bopm: string | null
          business_unit: string | null
          capability_line: string | null
          client_account_status: string | null
          client_geography: string | null
          client_id: string | null
          client_industry: string | null
          client_name: string | null
          client_pc_code: string | null
          client_sales_poc: string | null
          client_signing_entity: string | null
          client_website: string | null
          consumption_value: number | null
          created_at: string | null
          creative_staffing: boolean | null
          customer_status: string | null
          customer_type: string | null
          deal_id: string | null
          deal_name: string | null
          deal_status: string | null
          deal_status_cx: string | null
          deal_target_status: string | null
          deal_type: string | null
          deal_value_lost: number | null
          duration: string | null
          end_date: string | null
          id: string | null
          invoiced_deal_value: number | null
          latest_consumption: number | null
          latest_financial_month: string | null
          latest_invoiced: number | null
          latest_outstanding: number | null
          latest_received: number | null
          mis_vs_consumption: number | null
          month_closed_won: string | null
          mrr: number | null
          net_deal_value: number | null
          new_deal_id_formulated: string | null
          new_deal_id_temp: string | null
          non_retainer_deal_value: number | null
          payment_terms: string | null
          pc_code: string | null
          pepper_bu_l2: string | null
          pepper_business_unit: string | null
          pod: string | null
          principal_bopm: string | null
          projected_outcomes: Json | null
          rag: string | null
          retainer_deal_value: number | null
          senior_bopm: string | null
          seo_staffing: boolean | null
          service_line_tagging: string | null
          slack_channel_id: string | null
          staffing_status: string | null
          start_date: string | null
          strategy_bandwidth_required: string | null
          success_metrics: Json | null
          tcv_usd: number | null
          total_allocation_pct: number | null
          total_deal_value: number | null
          total_mis_recognition: number | null
          total_pending_recognition: number | null
          undelivered_funnel: number | null
          updated_at: string | null
          validation: string | null
          validation_central_cx: string | null
          vsd: string | null
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
    }
    Functions: {
      _is_active_staffing_status: {
        Args: { _status: string }
        Returns: boolean
      }
      _recompute_deal_bopm_field: {
        Args: { _deal_id: string; _role_key: string }
        Returns: undefined
      }
      get_home_personal_todos: {
        Args: never
        Returns: {
          assigned_by_name: string
          assigned_by_user_id: string | null
          assignee_name: string
          assignee_staffing_person_id: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          notes: string
          priority: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "personal_todos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_staffing_role_key: {
        Args: { _role_key: string }
        Returns: string
      }
      resolve_assignee_user_id: {
        Args: { _staffing_person_id: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      toggle_staffing_lock: {
        Args: { _deal_id: string; _lock: boolean }
        Returns: {
          account: string
          baseline_metrics: string
          bopm: string
          business_unit: string
          capability_line: string
          client_id: string | null
          consumption_value: number
          contract_file_path: string | null
          created_at: string
          creative_staffing: boolean
          customer_status: string
          customer_type: string
          deal_id: string
          deal_name: string
          deal_status: string
          deal_status_cx: string
          deal_target_status: string
          deal_type: string
          deal_value_lost: number | null
          duration: string | null
          end_date: string | null
          geo: string
          id: string
          input_currency: string
          invoiced_deal_value: number
          mis_vs_consumption: number
          month_closed_won: string
          mrr: number | null
          net_deal_value: number | null
          new_deal_id_formulated: string
          new_deal_id_temp: string
          non_retainer_deal_value: number | null
          payment_terms: string
          pc_code: string
          pepper_bu_l2: string
          pepper_business_unit: string
          pod: string
          principal_bopm: string
          projected_outcomes: Json | null
          rag: string
          retainer_deal_value: number | null
          revenue_type: string
          sales_leader: string
          sales_rep: string
          senior_bopm: string
          seo_staffing: boolean
          service_line_tagging: string
          slack_channel_id: string
          sow_file_path: string | null
          staffing_locked_at: string | null
          staffing_locked_by: string | null
          staffing_locked_by_name: string
          staffing_status: string
          start_date: string | null
          strategy_bandwidth_required: string
          success_metrics: Json | null
          tcv_usd: number
          total_deal_value: number | null
          total_mis_recognition: number
          total_pending_recognition: number
          undelivered_funnel: number
          updated_at: string
          validation: string
          validation_central_cx: string
          vsd: string
        }
        SetofOptions: {
          from: "*"
          to: "staffing_deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "member"
        | "user"
        | "view_only"
        | "capability_lead"
        | "capability_member"
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
        "member",
        "user",
        "view_only",
        "capability_lead",
        "capability_member",
      ],
    },
  },
} as const
