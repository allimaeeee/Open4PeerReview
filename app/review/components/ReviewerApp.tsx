'use client'

// app/reviewer/_components/ReviewerApp.tsx
// Client root — manages the picker → console transition and all shared state.

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import { RubricPicker } from './RubricPicker'
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
}

export interface AnnotationRecord {
  id: string
  anchor: Record<string, unknown>
  body: string
}

export interface ReviewScore {
  id: string
  rubric_item_id: string
  score: 'does_not_meet' | 'exemplifies' | 'exceeds' | null
  comment: string
  annotations: AnnotationRecord[]
}

export interface Review {
  id: string
  status: 'in_progress' | 'submitted'
  overall_comment: string | null
  last_saved_at: string | null
  rubric_id: string
  rubric: Rubric
  review_scores: ReviewScore[]
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

  const supabase = createBrowserSupabase()

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

  const handleRubricSelected = async (rubric: Rubric) => {
    // Create the review record
    const { data: newReview, error } = await supabase
      .from('reviews')
      .insert({
        document_id: document.id,
        rubric_id: rubric.id,
        reviewer_id: userId,
      })
      .select(`
        id, status, overall_comment, last_saved_at, rubric_id,
        rubric:rubrics ( id, title, description ),
        review_scores (
          id, rubric_item_id, score, comment,
          annotations ( id, anchor, body )
        )
      `)
      .single()

    if (error) {
      console.error('Failed to create review:', error)
      return
    }

    setReview(newReview as Review)
  }

  if (!review) {
    return (
      <RubricPicker
        document={document}
        rubrics={rubrics}
        onSelect={handleRubricSelected}
      />
    )
  }

  return (
    <ReviewerConsole
      supabase={supabase}
      userId={userId}
      document={document}
      review={review}
      onReviewUpdate={setReview}
    />
  )
}
