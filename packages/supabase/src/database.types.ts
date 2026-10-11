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
        }
        ComputedFields: never
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
      email_log: {
        Row: {
          application_id: string
          attempts: number
          claimed_at: string | null
          created_at: string
          decision: Database["public"]["Enums"]["decision"]
          error: string | null
          form_id: string
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
          claimed_at?: string | null
          created_at?: string
          decision: Database["public"]["Enums"]["decision"]
          error?: string | null
          form_id: string
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
          claimed_at?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["decision"]
          error?: string | null
          form_id?: string
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
            foreignKeyName: "email_log_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_change_application_role: {
        Args: {
          p_application_id: string
          p_new_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      admin_claim_emails: {
        Args: { p_form_id: string; p_limit: number }
        Returns: {
          decision: Database["public"]["Enums"]["decision"]
          email: string
          event_name: string
          full_name: string
          id: string
          previous_decision: Database["public"]["Enums"]["decision"]
          role: Database["public"]["Enums"]["app_role"]
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
      admin_release_decisions: { Args: { p_form_id: string }; Returns: Json }
      admin_reorder_form_fields: {
        Args: { p_field_ids: string[]; p_form_id: string }
        Returns: undefined
      }
      admin_retry_failed_emails: {
        Args: { p_form_id: string }
        Returns: number
      }
      application_answer_errors: {
        Args: { p_answers: Json; p_application_id: string; p_schema: Json }
        Returns: Json
      }
      application_file_deletable: { Args: { p_name: string }; Returns: boolean }
      application_file_writable: { Args: { p_name: string }; Returns: boolean }
      current_admin_level: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["admin_level"]
      }
      decline_application_offer: {
        Args: { p_application_id: string }
        Returns: undefined
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
      has_admin_level: {
        Args: { min_level: Database["public"]["Enums"]["admin_level"] }
        Returns: boolean
      }
      js_trim: { Args: { p_value: string }; Returns: string }
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
      submit_application: {
        Args: { p_application_id: string }
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
      ],
      form_status: ["draft", "published"],
    },
  },
} as const
