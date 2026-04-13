// lib/supabase/types.ts
// Hand-written types matching 001_schema.sql
// Replace with auto-generated types once schema stabilizes:
//   npx supabase gen types typescript --project-id <your-project-id> > lib/supabase/types.ts

export type UserRole = 'author' | 'reviewer' | 'admin'
export type FileType = 'pdf' | 'html' | 'image' | 'audio'
export type AnchorType = 'text-range' | 'dom-range' | 'bbox' | 'timestamp'

// ── Anchor shapes ─────────────────────────────────────────────

export interface TextRangeAnchor {
  type: 'text-range'
  page: number
  start: number
  end: number
}

export interface DomRangeAnchor {
  type: 'dom-range'
  xpath: string
  startOffset: number
  endOffset: number
}

export interface BboxAnchor {
  type: 'bbox'
  x: number
  y: number
  width: number
  height: number
}

export interface TimestampAnchor {
  type: 'timestamp'
  startSec: number
  endSec: number
}

export type Anchor = TextRangeAnchor | DomRangeAnchor | BboxAnchor | TimestampAnchor

// ── Table row types ───────────────────────────────────────────

export interface User {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
}

export interface Rubric {
  id: string
  title: string
  description: string | null
  created_at: string
}

export interface RubricItem {
  id: string
  rubric_id: string
  label: string
  description: string | null
  sort_order: number
  created_at: string
}

export interface Document {
  id: string
  author_id: string
  title: string
  file_url: string
  storage_path: string
  file_type: FileType
  created_at: string
}

export interface DocumentRubric {
  document_id: string
  rubric_id: string
  assigned_at: string
}

export interface Comment {
  id: string
  document_id: string
  rubric_item_id: string
  author_id: string
  body: string
  anchor: Anchor
  created_at: string
}

// ── Joined / enriched types (for UI) ─────────────────────────

export interface CommentWithAuthor extends Comment {
  users: Pick<User, 'display_name' | 'email'>
}

export interface RubricWithItems extends Rubric {
  rubric_items: RubricItem[]
}

export interface DocumentWithRubrics extends Document {
  rubrics: Rubric[]
}

// ── Supabase Database type map ────────────────────────────────
// Used to type createBrowserClient / createServerClient

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'created_at'>
        Update: Partial<Omit<User, 'id' | 'created_at'>>
      }
      rubrics: {
        Row: Rubric
        Insert: Omit<Rubric, 'id' | 'created_at'>
        Update: Partial<Omit<Rubric, 'id' | 'created_at'>>
      }
      rubric_items: {
        Row: RubricItem
        Insert: Omit<RubricItem, 'id' | 'created_at'>
        Update: Partial<Omit<RubricItem, 'id' | 'created_at'>>
      }
      documents: {
        Row: Document
        Insert: Omit<Document, 'id' | 'created_at'>
        Update: Partial<Omit<Document, 'id' | 'created_at'>>
      }
      document_rubrics: {
        Row: DocumentRubric
        Insert: Omit<DocumentRubric, 'assigned_at'>
        Update: never
      }
      comments: {
        Row: Comment
        Insert: Omit<Comment, 'id' | 'created_at'>
        Update: Partial<Pick<Comment, 'body'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      file_type: FileType
      anchor_type: AnchorType
    }
  }
}
