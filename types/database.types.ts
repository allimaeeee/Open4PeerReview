// types/database.types.ts
// Regenerate with: npx supabase gen types typescript --project-id nkcyjfuzmmkuavhmqyvu > types/database.types.ts

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
          created_at: string
          creative_commons_license: Database["public"]["Enums"]["creative_commons_license"]
          file_type: Database["public"]["Enums"]["file_type"]
          file_url: string
          id: string
          source_url: string | null
          storage_path: string
          subject_matter: string
          third_party_content_disclosure: string | null
          title: string
        }
        Insert: {
          author_id: string
          authors?: string
          content_fingerprint?: string | null
          created_at?: string
          creative_commons_license: Database["public"]["Enums"]["creative_commons_license"]
          file_type: Database["public"]["Enums"]["file_type"]
          file_url: string
          id?: string
          source_url?: string | null
          storage_path: string
          subject_matter?: string
          third_party_content_disclosure?: string | null
          title: string
        }
        Update: {
          author_id?: string
          authors?: string
          content_fingerprint?: string | null
          created_at?: string
          creative_commons_license?: Database["public"]["Enums"]["creative_commons_license"]
          file_type?: Database["public"]["Enums"]["file_type"]
          file_url?: string
          id?: string
          source_url?: string | null
          storage_path?: string
          subject_matter?: string
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
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      review_events: {
        Row: {
          id: string
          review_id: string
          reviewer_id: string
          session_id: string
          event_type: string
          data: Json | null
          occurred_at: string
        }
        Insert: {
          id?: string
          review_id: string
          reviewer_id: string
          session_id: string
          event_type: string
          data?: Json | null
          occurred_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          reviewer_id?: string
          session_id?: string
          event_type?: string
          data?: Json | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          score?: Database["public"]["Enums"]["criterion_score"]
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
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          expertise_tags: string[]
          id: string
          institution: string | null
          onboarding_completed: boolean
          primary_discipline: string | null
          profession: string | null
          reviewer_type: string | null
          role: Database["public"]["Enums"]["user_role"]
          roles: string[]
          rubric_specializations: string[]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          expertise_tags?: string[]
          id: string
          institution?: string | null
          onboarding_completed?: boolean
          primary_discipline?: string | null
          profession?: string | null
          reviewer_type?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          roles?: string[]
          rubric_specializations?: string[]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          expertise_tags?: string[]
          id?: string
          institution?: string | null
          onboarding_completed?: boolean
          primary_discipline?: string | null
          profession?: string | null
          reviewer_type?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          roles?: string[]
          rubric_specializations?: string[]
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
      creative_commons_license: "cc_by" | "cc_by_sa" | "cc_by_nd" | "cc_by_nc" | "cc_by_nc_sa" | "cc_by_nc_nd"
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
      review_status: "in_progress" | "submitted"
      user_role: "author" | "reviewer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

// ─── Enum constants (use instead of raw strings) ──────────────────────────────

export const Constants = {
  Enums: {
    creative_commons_license: ["cc_by", "cc_by_sa", "cc_by_nd", "cc_by_nc", "cc_by_nc_sa", "cc_by_nc_nd"] as const,
    criterion_score:  ["does_not_meet", "exemplifies", "exceeds"] as const,
    expert_domain:    ["agriculture", "arts_and_humanities", "biology", "business",
                       "chemistry", "computer_science", "economics", "education",
                       "engineering", "environmental_science", "health_and_medicine",
                       "history", "law", "mathematics", "physics", "social_sciences",
                       "other"] as const,
    file_type:        ["pdf", "html", "image", "audio"] as const,
    review_status:    ["in_progress", "submitted"] as const,
    user_role:        ["author", "reviewer", "admin"] as const,
  },
} as const
