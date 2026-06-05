'use client'

// app/reviewer/_components/ReviewerApp.tsx
// Client root — auto-creates a review on mount and transitions to the console.

import { useState, useEffect } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import { ReviewerConsole } from './ReviewerConsole'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OERDocument {
  id: string
  title: string
  file_url: string
  storage_path: string
}

export interface Rubric {
  id: string
  title: string
  description: string | null
  operational_definition: string | null
  criteria_count?: number
}

export interface RubricItem {
  id: string
  label: string
  description: string | null
  sort_order: number
  rubric_id: string
  rubric_title?: string
}

export interface AnnotationRecord {
  id: string
  rubric_item_id: string | null
  anchor: Record<string, unknown>
  body: string
  tag: string
}

export interface ReviewScore {
  id: string
  rubric_item_id: string
  score: 'does_not_meet' | 'exemplifies' | 'exceeds' | null
  comment: string
}

export interface Review {
  id: string
  status: 'in_progress' | 'submitted'
  overall_comment: string | null
  notes: string | null
  last_saved_at: string | null
  rubric_id: string
  rubric: Rubric
  review_scores: ReviewScore[]
  annotations: AnnotationRecord[]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ReviewerAppProps {
  userId: string
  document: OERDocument | null
  rubrics: Rubric[]
  existingReview: Review | null
}

export function ReviewerApp({ userId, document, rubrics, existingReview }: ReviewerAppProps) {
  const [review, setReview] = useState<Review | null>(existingReview)
  const [creating, setCreating] = useState(false)

  const supabase = createBrowserSupabase()

  // Auto-create a review on first visit (no picker step)
  useEffect(() => {
    if (review || creating || rubrics.length === 0 || !document) return
    setCreating(true)
    supabase
      .from('reviews')
      .insert({
        document_id: document.id,
        rubric_id: rubrics[0].id,
        reviewer_id: userId,
      })
      .select(`
        id, status, overall_comment, notes, last_saved_at, rubric_id,
        rubric:rubrics ( id, title, description, operational_definition ),
        review_scores ( id, rubric_item_id, score, comment ),
        annotations ( id, rubric_item_id, anchor, body, tag )
      `)
      .single()
      .then(({ data: newReview, error }) => {
        if (error) {
          console.error('Failed to create review:', error)
        } else {
          setReview(newReview as Review)
        }
        setCreating(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!document) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-slate-700">No OER document available</p>
          <p className="text-sm text-slate-400">Please contact an administrator to upload a document.</p>
        </div>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#1e3a5f] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ReviewerConsole
      supabase={supabase}
      userId={userId}
      document={document}
      review={review}
      rubrics={rubrics}
      onReviewUpdate={setReview}
    />
  )
}
