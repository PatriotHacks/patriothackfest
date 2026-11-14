export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          level: Database["public"]["Enums"]["admin_level"]
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          level: Database["public"]["Enums"]["admin_level"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          level?: Database["public"]["Enums"]["admin_level"]
        }
        Relationships: [
          {
            foreignKeyName: "admin_allowlist_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_archives: {
        Row: {
          answers: NonNullable<Json>
          application_id: string
          changed_by: string | null
          created_at: string
          event_id: string
          from_form_id: string | null
          from_role: Database["public"]["Enums"]["app_role"]
          id: string
          schema: NonNullable<Json>
          to_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          answers: NonNullable<Json>
          application_id: string
          changed_by?: string | null
          created_at?: string
          event_id: string
          from_form_id?: string | null
          from_role: Database["public"]["Enums"]["app_role"]
          id?: string
          schema: NonNullable<Json>
          to_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          answers?: NonNullable<Json>
          application_id?: string
          changed_by?: string | null
          created_at?: string
          event_id?: string
          from_form_id?: string | null
          from_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          schema?: NonNullable<Json>
          to_role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_archives_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_archives_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_archives_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_archives_from_form_id_fkey"
            columns: ["from_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_archives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_decisions: {
        Row: {
          application_id: string
          decided_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["decision"]
        }
        ComputedFields: never
        Insert: {
          application_id: string
          decided_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["decision"]
        }
        Update: {
          application_id?: string
          decided_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["decision"]
        }
        Relationships: [
          {
            foreignKeyName: "application_decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          answers: NonNullable<Json>
          created_at: string
          declined_at: string | null
          event_id: string
          form_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          withdrawn_at: string | null
          status_rank: number | null
          under_18: boolean | null
        }
        ComputedFields: "status_rank" | "under_18"
        Insert: {
          answers?: NonNullable<Json>
          created_at?: string
          declined_at?: string | null
          event_id: string
          form_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          answers?: NonNullable<Json>
          created_at?: string
          declined_at?: string | null
          event_id?: string
          form_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_form_id_event_id_role_fkey"
            columns: ["form_id", "event_id", "role"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id", "event_id", "role"]
          },
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_tracks: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          reviews_per_project: number
          sponsor: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          reviews_per_project?: number
          sponsor?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          reviews_per_project?: number
          sponsor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_tracks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_competition_settings"
            referencedColumns: ["event_id"]
          },
        ]
      }
      email_broadcasts: {
        Row: {
          audience: Database["public"]["Enums"]["broadcast_audience"]
          body: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          subject: string
        }
        ComputedFields: never
        Insert: {
          audience?: Database["public"]["Enums"]["broadcast_audience"]
          body: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          subject: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["broadcast_audience"]
          body?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          application_id: string
          attempts: number
          broadcast_id: string | null
          claimed_at: string | null
          created_at: string
          decision: Database["public"]["Enums"]["decision"] | null
          error: string | null
          form_id: string | null
          id: string
          kind: string
          last_error_at: string | null
          message_id: string | null
          previous_decision: Database["public"]["Enums"]["decision"] | null
          recipient: string | null
          sent_at: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          application_id: string
          attempts?: number
          broadcast_id?: string | null
          claimed_at?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["decision"] | null
          error?: string | null
          form_id?: string | null
          id?: string
          kind: string
          last_error_at?: string | null
          message_id?: string | null
          previous_decision?: Database["public"]["Enums"]["decision"] | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          application_id?: string
          attempts?: number
          broadcast_id?: string | null
          claimed_at?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["decision"] | null
          error?: string | null
          form_id?: string | null
          id?: string
          kind?: string
          last_error_at?: string | null
          message_id?: string | null
          previous_decision?: Database["public"]["Enums"]["decision"] | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "email_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          key: string
          subject: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          body: string
          key: string
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          key?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_competition_settings: {
        Row: {
          created_at: string
          enabled: boolean
          event_id: string
          general_reviews_per_project: number
          judging_close_at: string | null
          judging_started_at: string | null
          project_submissions_close_at: string | null
          project_submissions_open_at: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          enabled?: boolean
          event_id: string
          general_reviews_per_project?: number
          judging_close_at?: string | null
          judging_started_at?: string | null
          project_submissions_close_at?: string | null
          project_submissions_open_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_id?: string
          general_reviews_per_project?: number
          judging_close_at?: string | null
          judging_started_at?: string | null
          project_submissions_close_at?: string | null
          project_submissions_open_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_competition_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_judges: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          email: string
          event_id: string
          id: string
          kind: string
          updated_at: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          email: string
          event_id: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_judges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_competition_settings"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_judges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          name: string
          slug: string
          starts_at: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          slug: string
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          slug?: string
          starts_at?: string | null
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          archived_at: string | null
          condition: Json | null
          created_at: string
          editable_after_submit: boolean
          form_id: string
          help_text: string | null
          id: string
          label: string
          options: Json | null
          position: number
          required: boolean
          type: Database["public"]["Enums"]["field_type"]
          updated_at: string
          validation: Json | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          condition?: Json | null
          created_at?: string
          editable_after_submit?: boolean
          form_id: string
          help_text?: string | null
          id?: string
          label: string
          options?: Json | null
          position: number
          required?: boolean
          type: Database["public"]["Enums"]["field_type"]
          updated_at?: string
          validation?: Json | null
        }
        Update: {
          archived_at?: string | null
          condition?: Json | null
          created_at?: string
          editable_after_submit?: boolean
          form_id?: string
          help_text?: string | null
          id?: string
          label?: string
          options?: Json | null
          position?: number
          required?: boolean
          type?: Database["public"]["Enums"]["field_type"]
          updated_at?: string
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          content_updated_at: string
          created_at: string
          decisions_released_at: string | null
          description: string | null
          edits_lock_at: string | null
          event_id: string
          id: string
          published_at: string | null
          published_schema: Json | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["form_status"]
          submissions_close_at: string | null
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          content_updated_at?: string
          created_at?: string
          decisions_released_at?: string | null
          description?: string | null
          edits_lock_at?: string | null
          event_id: string
          id?: string
          published_at?: string | null
          published_schema?: Json | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["form_status"]
          submissions_close_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content_updated_at?: string
          created_at?: string
          decisions_released_at?: string | null
          description?: string | null
          edits_lock_at?: string | null
          event_id?: string
          id?: string
          published_at?: string | null
          published_schema?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["form_status"]
          submissions_close_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_track_scopes: {
        Row: {
          event_id: string
          judge_id: string
          track_id: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          judge_id: string
          track_id: string
        }
        Update: {
          event_id?: string
          judge_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_track_scopes_judge_id_event_id_fkey"
            columns: ["judge_id", "event_id"]
            isOneToOne: false
            referencedRelation: "event_judges"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "judge_track_scopes_track_id_event_id_fkey"
            columns: ["track_id", "event_id"]
            isOneToOne: false
            referencedRelation: "competition_tracks"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      judging_assignments: {
        Row: {
          cancelled: boolean
          created_at: string
          creativity_score: number | null
          event_id: string
          id: string
          impact_score: number | null
          judge_id: string
          notes: string
          presentation_score: number | null
          project_id: string
          submitted_at: string | null
          technical_score: number | null
          total_score: number | null
          track_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          cancelled?: boolean
          created_at?: string
          creativity_score?: number | null
          event_id: string
          id?: string
          impact_score?: number | null
          judge_id: string
          notes?: string
          presentation_score?: number | null
          project_id: string
          submitted_at?: string | null
          technical_score?: number | null
          total_score?: never
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled?: boolean
          created_at?: string
          creativity_score?: number | null
          event_id?: string
          id?: string
          impact_score?: number | null
          judge_id?: string
          notes?: string
          presentation_score?: number | null
          project_id?: string
          submitted_at?: string | null
          technical_score?: number | null
          total_score?: never
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "judging_assignments_judge_id_event_id_fkey"
            columns: ["judge_id", "event_id"]
            isOneToOne: false
            referencedRelation: "event_judges"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "judging_assignments_judge_id_track_id_event_id_fkey"
            columns: ["judge_id", "track_id", "event_id"]
            isOneToOne: false
            referencedRelation: "judge_track_scopes"
            referencedColumns: ["judge_id", "track_id", "event_id"]
          },
          {
            foreignKeyName: "judging_assignments_project_id_event_id_fkey"
            columns: ["project_id", "event_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "judging_assignments_project_id_track_id_event_id_fkey"
            columns: ["project_id", "track_id", "event_id"]
            isOneToOne: false
            referencedRelation: "project_tracks"
            referencedColumns: ["project_id", "track_id", "event_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          school: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          school?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          school?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_collaborators: {
        Row: {
          created_at: string
          event_id: string
          project_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_event_id_fkey"
            columns: ["project_id", "event_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "project_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tracks: {
        Row: {
          event_id: string
          project_id: string
          track_id: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          project_id: string
          track_id: string
        }
        Update: {
          event_id?: string
          project_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tracks_project_id_event_id_fkey"
            columns: ["project_id", "event_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "project_tracks_track_id_event_id_fkey"
            columns: ["track_id", "event_id"]
            isOneToOne: false
            referencedRelation: "competition_tracks"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          demo_url: string | null
          description: string
          event_id: string
          id: string
          name: string
          owner_user_id: string
          repository_url: string | null
          status: string
          submitted_at: string | null
          summary: string
          technologies: string
          updated_at: string
          video_url: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          demo_url?: string | null
          description?: string
          event_id: string
          id?: string
          name?: string
          owner_user_id: string
          repository_url?: string | null
          status?: string
          submitted_at?: string | null
          summary?: string
          technologies?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          demo_url?: string | null
          description?: string
          event_id?: string
          id?: string
          name?: string
          owner_user_id?: string
          repository_url?: string | null
          status?: string
          submitted_at?: string | null
          summary?: string
          technologies?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_competition_settings"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_broadcast_history: {
        Args: { p_event_id: string }
        Returns: {
          audience: Database["public"]["Enums"]["broadcast_audience"]
          body: string
          cancelled: number
          created_at: string
          failed: number
          id: string
          pending: number
          recipients: number
          role: Database["public"]["Enums"]["app_role"]
          sender_email: string
          sending: number
          sent: number
          subject: string
        }[]
      }
      admin_broadcast_recipient_count: {
        Args: {
          p_audience: Database["public"]["Enums"]["broadcast_audience"]
          p_event_id: string
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          daily_used: number
          recipients: number
        }[]
      }
      admin_change_application_role: {
        Args: {
          p_application_id: string
          p_new_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      admin_claim_broadcast_emails: {
        Args: { p_broadcast_id: string; p_limit: number }
        Returns: {
          email: string
          event_name: string
          full_name: string
          id: string
        }[]
      }
      admin_claim_emails: {
        Args: { p_form_id: string; p_limit: number }
        Returns: {
          decision: Database["public"]["Enums"]["decision"]
          email: string
          event_ends_at: string
          event_name: string
          event_starts_at: string
          full_name: string
          id: string
          previous_decision: Database["public"]["Enums"]["decision"]
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_create_broadcast: {
        Args: {
          p_audience: Database["public"]["Enums"]["broadcast_audience"]
          p_body: string
          p_event_id: string
          p_expected: number
          p_role?: Database["public"]["Enums"]["app_role"]
          p_subject: string
        }
        Returns: {
          broadcast_id: string
          queued: number
        }[]
      }
      admin_finish_email: {
        Args: {
          p_error?: string
          p_id: string
          p_message_id?: string
          p_ok: boolean
        }
        Returns: undefined
      }
      admin_publish_form: { Args: { p_form_id: string }; Returns: undefined }
      admin_release_counts: {
        Args: { p_form_id: string }
        Returns: {
          accepted: number
          declined: number
          emails_cancelled: number
          emails_failed: number
          emails_pending: number
          emails_sending: number
          emails_sent: number
          pending: number
          rejected: number
          submitted: number
          undecided: number
          waitlisted: number
        }[]
      }
      admin_release_decisions: { Args: { p_form_id: string }; Returns: Json }
      admin_reorder_form_fields: {
        Args: { p_field_ids: string[]; p_form_id: string }
        Returns: undefined
      }
      admin_retry_failed_broadcast: {
        Args: { p_broadcast_id: string }
        Returns: number
      }
      admin_retry_failed_emails: {
        Args: { p_form_id: string }
        Returns: number
      }
      admin_save_competition_settings: {
        Args: {
          p_close_at?: string
          p_enabled: boolean
          p_event_id: string
          p_general_reviews?: number
          p_judging_close_at?: string
          p_open_at?: string
        }
        Returns: undefined
      }
      admin_save_competition_track: {
        Args: {
          p_active: boolean
          p_description: string
          p_event_id: string
          p_name: string
          p_reviews: number
          p_sponsor: string
          p_track_id?: string
        }
        Returns: string
      }
      admin_start_judging: { Args: { p_event_id: string }; Returns: undefined }
      application_answer_errors: {
        Args: { p_answers: Json; p_application_id: string; p_schema: Json }
        Returns: Json
      }
      application_file_deletable: { Args: { p_name: string }; Returns: boolean }
      application_file_writable: { Args: { p_name: string }; Returns: boolean }
      broadcast_audience_includes: {
        Args: {
          p_audience: Database["public"]["Enums"]["broadcast_audience"]
          p_declined_at: string
          p_status: Database["public"]["Enums"]["application_status"]
        }
        Returns: boolean
      }
      current_admin_level: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["admin_level"]
      }
      decline_application_offer: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      event_has_ended: {
        Args: { p_ends_at: string; p_starts_at: string }
        Returns: boolean
      }
      form_answered_field_ids: {
        Args: { p_form_id: string }
        Returns: string[]
      }
      form_decisions_released: {
        Args: { p_application_id: string }
        Returns: boolean
      }
      form_field_visible: {
        Args: {
          p_answers: Json
          p_field_id: string
          p_schema: Json
          p_seen?: string[]
        }
        Returns: boolean
      }
      form_locked_field_ids: { Args: { p_schema: Json }; Returns: string[] }
      has_admin_level: {
        Args: { min_level: Database["public"]["Enums"]["admin_level"] }
        Returns: boolean
      }
      js_trim: { Args: { p_value: string }; Returns: string }
      lock_participant_project: {
        Args: { p_project_id: string; p_roster_only?: boolean }
        Returns: {
          created_at: string
          demo_url: string | null
          description: string
          event_id: string
          id: string
          name: string
          owner_user_id: string
          repository_url: string | null
          status: string
          submitted_at: string | null
          summary: string
          technologies: string
          updated_at: string
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      locked_answer_errors: {
        Args: { p_after: Json; p_before: Json; p_schema: Json }
        Returns: Json
      }
      participant_add_project_collaborator: {
        Args: { p_email: string; p_project_id: string }
        Returns: undefined
      }
      participant_create_project: {
        Args: { p_event_id: string }
        Returns: string
      }
      participant_project_detail: {
        Args: { p_event_id: string; p_project_id: string }
        Returns: Json
      }
      participant_project_events: {
        Args: Record<PropertyKey, never>
        Returns: {
          eligible: boolean
          enabled: boolean
          event_id: string
          judging_started_at: string
          name: string
          project_submissions_close_at: string
          project_submissions_open_at: string
          slug: string
        }[]
      }
      participant_projects: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string
          demo_url: string | null
          description: string
          event_id: string
          id: string
          name: string
          owner_user_id: string
          repository_url: string | null
          status: string
          submitted_at: string | null
          summary: string
          technologies: string
          updated_at: string
          video_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      participant_remove_project_collaborator: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: undefined
      }
      participant_save_project: {
        Args: {
          p_content: Json
          p_expected_updated_at?: string
          p_project_id: string
          p_submit?: boolean
          p_track_ids?: string[]
        }
        Returns: string
      }
      participant_withdraw_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      project_content_errors: {
        Args: { p_complete: boolean; p_content: Json }
        Returns: Json
      }
      project_http_url_valid: { Args: { p_url: string }; Returns: boolean }
      project_is_accessible: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      project_user_is_eligible: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      prune_application_answers: {
        Args: { p_answers: Json; p_schema: Json }
        Returns: Json
      }
      queue_decision_email: {
        Args: {
          p_application_id: string
          p_decision: Database["public"]["Enums"]["decision"]
          p_form_id: string
        }
        Returns: undefined
      }
      save_application_answers: {
        Args: { p_answers: Json; p_application_id: string }
        Returns: string
      }
      start_application: { Args: { p_form_id: string }; Returns: string }
      status_rank: {
        Args: {
          p_application: Omit<
            Database["public"]["Tables"]["applications"]["Row"],
            Database["public"]["Tables"]["applications"]["ComputedFields"]
          >
        }
        Returns: number
      }
      submit_application: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      under_18: {
        Args: {
          p_application: Omit<
            Database["public"]["Tables"]["applications"]["Row"],
            Database["public"]["Tables"]["applications"]["ComputedFields"]
          >
        }
        Returns: boolean
      }
      update_basic_info: {
        Args: {
          p_date_of_birth?: string
          p_full_name: string
          p_keep_phone?: boolean
          p_phone?: string
          p_school?: string
        }
        Returns: undefined
      }
      validated_application_answers: {
        Args: { p_answers: Json; p_application_id: string; p_schema: Json }
        Returns: Json
      }
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_level: "owner" | "organizer" | "reviewer"
      app_role: "participant" | "volunteer" | "judge"
      application_status: "draft" | "submitted" | "withdrawn"
      broadcast_audience: "draft" | "submitted" | "all"
      decision: "pending" | "accepted" | "waitlisted" | "rejected"
      field_type:
        | "short_text"
        | "long_text"
        | "email"
        | "url"
        | "number"
        | "date"
        | "single_choice"
        | "multiple_choice"
        | "checkbox"
        | "file"
        | "section"
      form_status: "draft" | "published"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
      admin_level: ["owner", "organizer", "reviewer"],
      app_role: ["participant", "volunteer", "judge"],
      application_status: ["draft", "submitted", "withdrawn"],
      broadcast_audience: ["draft", "submitted", "all"],
      decision: ["pending", "accepted", "waitlisted", "rejected"],
      field_type: [
        "short_text",
        "long_text",
        "email",
        "url",
        "number",
        "date",
        "single_choice",
        "multiple_choice",
        "checkbox",
        "file",
        "section",
      ],
      form_status: ["draft", "published"],
    },
  },
} as const
