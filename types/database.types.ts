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
      annotations: {
        Row: {
          anchor: Json
          body: string
          created_at: string
          id: string
          review_id: string
          rubric_item_id: string | null
          tag: string | null
          updated_at: string
        }
        Insert: {
          anchor: Json
          body: string
          created_at?: string
          id?: string
          review_id: string
          rubric_item_id?: string | null
          tag?: string | null
          updated_at?: string
        }
        Update: {
          anchor?: Json
          body?: string
          created_at?: string
          id?: string
          review_id?: string
          rubric_item_id?: string | null
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_rubric_item_id_fkey"
            columns: ["rubric_item_id"]
            isOneToOne: false
            referencedRelation: "rubric_items"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acceptances: {
        Row: {
          created_at: string
          document_id: string
          id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acceptances_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          decline_note: string | null
          declined_at: string | null
          document_id: string
          id: string
          reviewer_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          decline_note?: string | null
          declined_at?: string | null
          document_id: string
          id?: string
          reviewer_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          decline_note?: string | null
          declined_at?: string | null
          document_id?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_assignments_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_rubrics: {
        Row: {
          assigned_at: string
          document_id: string
          rubric_id: string
        }
        Insert: {
          assigned_at?: string
          document_id: string
          rubric_id: string
        }
        Update: {
          assigned_at?: string
          document_id?: string
          rubric_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_rubrics_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_rubrics_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          author_id: string
          authors: string
          content_fingerprint: string | null
          coordinator_released_at: string | null
          coordinator_upload: boolean
          created_at: string
          creative_commons_license: Database["public"]["Enums"]["creative_commons_license"]
          file_type: Database["public"]["Enums"]["file_type"] | null
          file_url: string | null
          id: string
          is_draft: boolean
          pages: Json | null
          platform: string | null
          source_url: string | null
          storage_path: string | null
          subject_matter: string
          submission_scope: string[]
          third_party_content_disclosure: string | null
          title: string
        }
        Insert: {
          author_id: string
          authors?: string
          content_fingerprint?: string | null
          coordinator_released_at?: string | null
          coordinator_upload?: boolean
          created_at?: string
          creative_commons_license?: Database["public"]["Enums"]["creative_commons_license"]
          file_type?: Database["public"]["Enums"]["file_type"] | null
          file_url?: string | null
          id?: string
          is_draft?: boolean
          pages?: Json | null
          platform?: string | null
          source_url?: string | null
          storage_path?: string | null
          subject_matter?: string
          submission_scope?: string[]
          third_party_content_disclosure?: string | null
          title: string
        }
        Update: {
          author_id?: string
          authors?: string
          content_fingerprint?: string | null
          coordinator_released_at?: string | null
          coordinator_upload?: boolean
          created_at?: string
          creative_commons_license?: Database["public"]["Enums"]["creative_commons_license"]
          file_type?: Database["public"]["Enums"]["file_type"] | null
          file_url?: string | null
          id?: string
          is_draft?: boolean
          pages?: Json | null
          platform?: string | null
          source_url?: string | null
          storage_path?: string | null
          subject_matter?: string
          submission_scope?: string[]
          third_party_content_disclosure?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      review_events: {
        Row: {
          data: Json | null
          event_type: string
          id: string
          occurred_at: string
          review_id: string
          reviewer_id: string
          session_id: string
        }
        Insert: {
          data?: Json | null
          event_type: string
          id?: string
          occurred_at?: string
          review_id: string
          reviewer_id: string
          session_id: string
        }
        Update: {
          data?: Json | null
          event_type?: string
          id?: string
          occurred_at?: string
          review_id?: string
          reviewer_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_scores: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          review_id: string
          rubric_item_id: string
          score: Database["public"]["Enums"]["criterion_score"] | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          review_id: string
          rubric_item_id: string
          score?: Database["public"]["Enums"]["criterion_score"] | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          review_id?: string
          rubric_item_id?: string
          score?: Database["public"]["Enums"]["criterion_score"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_rubric_item_id_fkey"
            columns: ["rubric_item_id"]
            isOneToOne: false
            referencedRelation: "rubric_items"
            referencedColumns: ["id"]
          },
        ]
      }
      review_declines: {
        Row: {
          created_at: string
          document_id: string
          id: string
          note: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          note: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          note?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_declines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_declines_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          document_id: string
          id: string
          last_saved_at: string | null
          notes: string | null
          overall_comment: string | null
          reviewer_id: string
          rubric_id: string
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          last_saved_at?: string | null
          notes?: string | null
          overall_comment?: string | null
          reviewer_id: string
          rubric_id: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          last_saved_at?: string | null
          notes?: string | null
          overall_comment?: string | null
          reviewer_id?: string
          rubric_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          rubric_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          rubric_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          rubric_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_items_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_preset: boolean
          operational_definition: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_preset?: boolean
          operational_definition?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_preset?: boolean
          operational_definition?: string | null
          title?: string
        }
        Relationships: []
      }
      score_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          review_id: string
          rubric_item_id: string
          score_level: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          review_id: string
          rubric_item_id: string
          score_level: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          review_id?: string
          rubric_item_id?: string
          score_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_comments_rubric_item_id_fkey"
            columns: ["rubric_item_id"]
            isOneToOne: false
            referencedRelation: "rubric_items"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          expertise_tags: string[] | null
          id: string
          institution: string | null
          onboarding_completed: boolean
          primary_discipline: string | null
          profession: string | null
          reviewer_type: string | null
          role: Database["public"]["Enums"]["user_role"]
          roles: string[]
          rubric_specializations: string[] | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          expertise_tags?: string[] | null
          id: string
          institution?: string | null
          onboarding_completed?: boolean
          primary_discipline?: string | null
          profession?: string | null
          reviewer_type?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          roles?: string[]
          rubric_specializations?: string[] | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          expertise_tags?: string[] | null
          id?: string
          institution?: string | null
          onboarding_completed?: boolean
          primary_discipline?: string | null
          profession?: string | null
          reviewer_type?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          roles?: string[]
          rubric_specializations?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      anchor_type: "text-range" | "dom-range" | "bbox" | "timestamp"
      creative_commons_license:
        | "cc_by"
        | "cc_by_sa"
        | "cc_by_nd"
        | "cc_by_nc"
        | "cc_by_nc_sa"
        | "cc_by_nc_nd"
      criterion_score: "does_not_meet" | "exemplifies" | "exceeds"
      expert_domain:
        | "agriculture"
        | "arts_and_humanities"
        | "biology"
        | "business"
        | "chemistry"
        | "computer_science"
        | "economics"
        | "education"
        | "engineering"
        | "environmental_science"
        | "health_and_medicine"
        | "history"
        | "law"
        | "mathematics"
        | "physics"
        | "social_sciences"
        | "other"
      file_type: "pdf" | "html" | "image" | "audio"
      review_status: "unassigned" | "assigned" | "in_progress" | "submitted"
      user_role: "author" | "reviewer" | "admin"
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
      anchor_type: ["text-range", "dom-range", "bbox", "timestamp"],
      creative_commons_license: [
        "cc_by",
        "cc_by_sa",
        "cc_by_nd",
        "cc_by_nc",
        "cc_by_nc_sa",
        "cc_by_nc_nd",
      ],
      criterion_score: ["does_not_meet", "exemplifies", "exceeds"],
      expert_domain: [
        "agriculture",
        "arts_and_humanities",
        "biology",
        "business",
        "chemistry",
        "computer_science",
        "economics",
        "education",
        "engineering",
        "environmental_science",
        "health_and_medicine",
        "history",
        "law",
        "mathematics",
        "physics",
        "social_sciences",
        "other",
      ],
      file_type: ["pdf", "html", "image", "audio"],
      review_status: ["unassigned", "assigned", "in_progress", "submitted"],
      user_role: ["author", "reviewer", "admin"],
    },
  },
} as const
