/**
 * useReviewAutoSave
 *
 * Handles both auto-save (debounced on change) and manual save-draft
 * for review_scores and annotations.
 *
 * Auto-save triggers:
 *   - Score or comment change → debounced 1.5 s then upsert review_score
 *   - Annotation add/edit/delete → immediate (discrete user action)
 *
 * Manual save-draft:
 *   - Flushes any pending debounced save immediately
 *   - Returns a promise so the UI can show a spinner
 *
 * last_saved_at is updated automatically by the DB trigger
 * (trg_touch_review_last_saved) on every review_score upsert.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import type { CriterionScore } from '@/types'
import type { PdfTextAnchor } from '@/lib/supabase/types'

export interface ScoreDraft {
  rubricItemId: string
  score: CriterionScore | null
  comment: string
}

export interface AnnotationDraft {
  id?: string           // present on existing annotations
  reviewScoreId: string
  anchor: PdfTextAnchor | Json
  body: string
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseReviewAutoSaveOptions {
  supabase: SupabaseClient<Database>
  reviewId: string
  /** How long to wait after the last keystroke before auto-saving. Default 1500 ms. */
  debounceMs?: number
}

export function useReviewAutoSave({
  supabase,
  reviewId,
  debounceMs = 1500,
}: UseReviewAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Pending score upserts keyed by rubric_item_id
  const pendingScores = useRef<Map<string, ScoreDraft>>(new Map())
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Tracks the last save per rubricItemId to avoid redundant requests
  const lastSaved = useRef<Map<string, string>>(new Map())

  // ── Core upsert ────────────────────────────────────────────────────────────

  const upsertScore = useCallback(
    async (draft: ScoreDraft): Promise<void> => {
      // Skip if nothing has changed since last save
      const key = JSON.stringify(draft)
      if (lastSaved.current.get(draft.rubricItemId) === key) return
      if (!draft.score) return // score is required — don't save an empty state

      setSaveStatus('saving')
      const { error } = await supabase
        .from('review_scores')
        .upsert(
          {
            review_id: reviewId,
            rubric_item_id: draft.rubricItemId,
            score: draft.score,
            comment: draft.comment,
          },
          { onConflict: 'review_id,rubric_item_id' }
        )

      if (error) {
        console.error('[useReviewAutoSave] upsertScore error:', error)
        setSaveStatus('error')
        return
      }

      lastSaved.current.set(draft.rubricItemId, key)
      setSaveStatus('saved')
    },
    [supabase, reviewId]
  )

  // ── Auto-save: debounced score/comment change ───────────────────────────────

  const onScoreChange = useCallback(
    (draft: ScoreDraft) => {
      pendingScores.current.set(draft.rubricItemId, draft)
      setSaveStatus('saving') // optimistic indicator while debouncing

      // Clear existing timer for this criterion
      const existing = debounceTimers.current.get(draft.rubricItemId)
      if (existing) clearTimeout(existing)

      const timer = setTimeout(() => {
        const current = pendingScores.current.get(draft.rubricItemId)
        if (current) upsertScore(current)
        debounceTimers.current.delete(draft.rubricItemId)
      }, debounceMs)

      debounceTimers.current.set(draft.rubricItemId, timer)
    },
    [upsertScore, debounceMs]
  )

  // ── Auto-save: immediate annotation operations ─────────────────────────────

  const saveAnnotation = useCallback(
    async (annotation: AnnotationDraft): Promise<string | null> => {
      setSaveStatus('saving')

      if (annotation.id) {
        // Update existing
        const { error } = await supabase
          .from('annotations')
          .update({ anchor: annotation.anchor as Json, body: annotation.body })
          .eq('id', annotation.id)

        if (error) {
          console.error('[useReviewAutoSave] updateAnnotation error:', error)
          setSaveStatus('error')
          return null
        }
        setSaveStatus('saved')
        return annotation.id
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('annotations')
          .insert({
            review_score_id: annotation.reviewScoreId,
            anchor: annotation.anchor as Json,
            body: annotation.body,
          })
          .select('id')
          .single()

        if (error) {
          console.error('[useReviewAutoSave] insertAnnotation error:', error)
          setSaveStatus('error')
          return null
        }
        setSaveStatus('saved')
        return data.id
      }
    },
    [supabase]
  )

  const deleteAnnotation = useCallback(
    async (annotationId: string): Promise<void> => {
      setSaveStatus('saving')
      const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('id', annotationId)

      if (error) {
        console.error('[useReviewAutoSave] deleteAnnotation error:', error)
        setSaveStatus('error')
        return
      }
      setSaveStatus('saved')
    },
    [supabase]
  )

  // ── Manual save-draft: flush all pending debounced saves ───────────────────

  const saveDraft = useCallback(async (): Promise<void> => {
    // Cancel all pending timers
    debounceTimers.current.forEach((timer) => clearTimeout(timer))
    debounceTimers.current.clear()

    const pending = Array.from(pendingScores.current.values())
    if (pending.length === 0) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('saving')
    await Promise.all(pending.map(upsertScore))
    pendingScores.current.clear()
  }, [upsertScore])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  // ── Reset saved → idle after 3 s ──────────────────────────────────────────

  useEffect(() => {
    if (saveStatus !== 'saved') return
    const t = setTimeout(() => setSaveStatus('idle'), 3000)
    return () => clearTimeout(t)
  }, [saveStatus])

  return {
    saveStatus,
    onScoreChange,
    saveAnnotation,
    deleteAnnotation,
    saveDraft,
  }
}
