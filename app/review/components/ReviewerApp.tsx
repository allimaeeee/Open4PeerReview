'use client'

// app/reviewer/_components/ReviewerApp.tsx
// Client root — auto-creates a review on mount and transitions to the console.

import { useState, useEffect } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import { ReviewerConsole } from './ReviewerConsole'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OERPage {
  url: string
  fingerprint: string | null  // null = saved before snapshotting; lazy-snapshotted on first view
  storagePath?: string
}

export interface OERDocument {
  id: string
  title: string
  file_url: string | null
  storage_path: string | null
  file_type: string | null
  platform: string | null
  source_url: string | null
  course_access_code: string | null
  content_fingerprint: string | null
  pages: OERPage[] | null
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
  tag: string | null
  created_at: string
}

export interface ReviewScore {
  id: string
  rubric_item_id: string
  score: 'does_not_meet' | 'exemplifies' | 'exceeds' | null
  criterion_scores: ('does_not_meet' | 'exemplifies' | 'exceeds')[]
  comment: string | null
}

export interface ScoreComment {
  id: string
  rubric_item_id: string
  score_level: 'does_not_meet' | 'exceeds'
  body: string
}

export interface Review {
  id: string
  status: 'unassigned' | 'assigned' | 'in_progress' | 'submitted'
  overall_comment: string | null
  notes: string | null
  last_saved_at: string | null
  rubric_id: string
  rubric: Rubric
  review_scores: ReviewScore[]
  annotations: AnnotationRecord[]
  score_comments: ScoreComment[]
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

  const reviewSelect = `
    id, status, overall_comment, notes, last_saved_at, rubric_id,
    rubric:rubrics ( id, title, description, operational_definition ),
    review_scores ( id, rubric_item_id, score, criterion_scores, comment ),
    annotations ( id, rubric_item_id, anchor, body, tag, created_at ),
    score_comments ( id, rubric_item_id, score_level, body )
  `

  // On first visit: if a pre-assigned review exists, transition it to in_progress.
  // Otherwise auto-create a new in_progress review.
  useEffect(() => {
    if (creating || !document) return

    if (review) {
      // Pre-assigned review was loaded server-side — transition assigned → in_progress
      if (review.status === 'assigned') {
        supabase
          .from('reviews')
          .update({ status: 'in_progress' })
          .eq('id', review.id)
          .select(reviewSelect)
          .single()
          .then(({ data, error }) => {
            if (!error && data) setReview(data as Review)
          })
      }
      return
    }

    if (rubrics.length === 0) return
    setCreating(true)

    supabase
      .from('reviews')
      .insert({
        document_id: document.id,
        rubric_id: rubrics[0].id,
        reviewer_id: userId,
        status: 'in_progress',
      })
      .select(reviewSelect)
      .single()
      .then(async ({ data: newReview, error }) => {
        if (error) {
          if (error.code === '23505') {
            // A review already exists (Strict Mode double-fire or concurrent navigation)
            const { data: existing } = await supabase
              .from('reviews')
              .select(reviewSelect)
              .eq('document_id', document.id)
              .eq('reviewer_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            if (existing) setReview(existing as Review)
          } else {
            console.error('Failed to create review:', error)
          }
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
