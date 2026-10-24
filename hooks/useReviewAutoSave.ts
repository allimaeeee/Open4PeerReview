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
import type { CriterionScore, HighlightTag } from '@/types'
import type { PdfTextAnchor } from '@/lib/supabase/types'

export interface ScoreDraft {
  rubricItemId: string
  /** The review row (one exists per rubric) this item's rubric belongs to —
   *  resolved by the caller via the item→row lookup. Never the hook's own
   *  `reviewId`, which is only the console's anchor row and may belong to a
   *  different rubric than this item. */
  reviewId: string
  scores: CriterionScore[]
  comment: string
}

export interface AnnotationDraft {
  id?: string           // present on existing annotations
  reviewId: string
  rubricItemId: string | null   // null = Free Notes
  anchor: PdfTextAnchor | Json
  body: string
  tag: HighlightTag | null
}

export type { CriterionScore }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseReviewAutoSaveOptions {
  supabase: SupabaseClient<Database>
  reviewId: string
  /** When the console has per-rubric review rows, pass the active tab's review id here.
   *  General-comment saves go to this row; score/annotation saves always use reviewId. */
  notesReviewId?: string
  /** How long to wait after the last keystroke before auto-saving. Default 1500 ms. */
  debounceMs?: number
}

export function useReviewAutoSave({
  supabase,
  reviewId,
  notesReviewId,
  debounceMs = 1500,
}: UseReviewAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Pending score upserts keyed by rubric_item_id
  const pendingScores = useRef<Map<string, ScoreDraft>>(new Map())
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Tracks the last save per rubricItemId to avoid redundant requests
  const lastSaved = useRef<Map<string, string>>(new Map())
  // Notes debounce
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedNotes = useRef<string | null>(null)
  // Ref always holds the current target review id for notes saves.
  const notesReviewIdRef = useRef<string>(notesReviewId ?? reviewId)
  // Tracks any text that is waiting to be flushed (so we can save to the OLD row on tab switch).
  const pendingNotesText = useRef<string | null>(null)

  // When the active rubric tab changes, flush any pending notes to the OLD review row
  // before switching the ref to the new one.
  useEffect(() => {
    const newId = notesReviewId ?? reviewId
    const oldId = notesReviewIdRef.current
    if (oldId === newId) return

    if (
      pendingNotesText.current !== null &&
      lastSavedNotes.current !== pendingNotesText.current
    ) {
      if (notesTimer.current) {
        clearTimeout(notesTimer.current)
        notesTimer.current = null
      }
      const textToSave = pendingNotesText.current
      supabase
        .from('reviews')
        .update({ notes: textToSave })
        .eq('id', oldId)
        .then(({ error }) => { if (!error) lastSavedNotes.current = textToSave })
    }

    notesReviewIdRef.current = newId
    lastSavedNotes.current = null   // treat the new row as a fresh slate
    pendingNotesText.current = null // the old text was just flushed; clear so saveDraft/unmount don't re-write it to the new row
  }, [notesReviewId, reviewId, supabase])

  // ── Core upsert ────────────────────────────────────────────────────────────

  const upsertScore = useCallback(
    async (draft: ScoreDraft): Promise<void> => {
      // Skip if nothing has changed since last save
      const key = JSON.stringify(draft)
      if (lastSaved.current.get(draft.rubricItemId) === key) return

      setSaveStatus('saving')
      const { error } = await supabase
        .from('review_scores')
        .upsert(
          {
            // draft.reviewId is the row owning this item's rubric (resolved by
            // the caller) — never the hook's own `reviewId`, which is only the
            // console's anchor row and may belong to a different rubric.
            review_id: draft.reviewId,
            rubric_item_id: draft.rubricItemId,
            criterion_scores: draft.scores,
            score: draft.scores[0] ?? null,
            comment: draft.comment.trim() || null,
          },
          { onConflict: 'review_id,rubric_item_id' }
        )

      if (error) {
        console.error('[useReviewAutoSave] upsertScore error:', error.message, {
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
        setSaveStatus('error')
        return
      }

      lastSaved.current.set(draft.rubricItemId, key)
      setSaveStatus('saved')
    },
    [supabase]
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

  // ── Auto-save: debounced notes ────────────────────────────────────────────

  const onGeneralCommentChange = useCallback(
    (notes: string) => {
      pendingNotesText.current = notes
      if (notesTimer.current) clearTimeout(notesTimer.current)
      setSaveStatus('saving')
      notesTimer.current = setTimeout(async () => {
        if (lastSavedNotes.current === notes) { setSaveStatus('saved'); return }
        const { error } = await supabase
          .from('reviews')
          .update({ notes })
          .eq('id', notesReviewIdRef.current)
        if (error) { setSaveStatus('error'); return }
        lastSavedNotes.current = notes
        setSaveStatus('saved')
      }, debounceMs)
    },
    [supabase, debounceMs]
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
          console.error('[useReviewAutoSave] updateAnnotation error:', error.message, { code: error.code, details: error.details })
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
            review_id: annotation.reviewId,
            rubric_item_id: annotation.rubricItemId,
            anchor: annotation.anchor as Json,
            body: annotation.body,
            tag: annotation.tag,
          })
          .select('id')
          .single()

        if (error) {
          console.error('[useReviewAutoSave] insertAnnotation error:', error.message, { code: error.code, details: error.details })
          setSaveStatus('error')
          return null
        }
        setSaveStatus('saved')
        return data.id
      }
    },
    [supabase]
  )

  const updateAnnotation = useCallback(
    async (annotationId: string, changes: { body?: string; tag?: HighlightTag | null; rubricItemId?: string | null }): Promise<void> => {
      setSaveStatus('saving')
      const { error } = await supabase
        .from('annotations')
        .update({
          ...(changes.body !== undefined && { body: changes.body }),
          ...('tag' in changes && { tag: changes.tag }),
          ...('rubricItemId' in changes && { rubric_item_id: changes.rubricItemId ?? null }),
        })
        .eq('id', annotationId)
      if (error) {
        console.error('[useReviewAutoSave] updateAnnotation error:', error.message, { code: error.code, details: error.details })
        setSaveStatus('error')
        return
      }
      setSaveStatus('saved')
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
        console.error('[useReviewAutoSave] deleteAnnotation error:', error.message, { code: error.code, details: error.details })
        setSaveStatus('error')
        return
      }
      setSaveStatus('saved')
    },
    [supabase]
  )

  // ── Manual save-draft: flush all pending debounced saves ───────────────────

  const saveDraft = useCallback(async (): Promise<void> => {
    // Cancel all pending score timers
    debounceTimers.current.forEach((timer) => clearTimeout(timer))
    debounceTimers.current.clear()

    // Cancel pending notes timer and capture any unsaved text
    if (notesTimer.current) {
      clearTimeout(notesTimer.current)
      notesTimer.current = null
    }
    const pendingNotes =
      pendingNotesText.current !== null &&
      lastSavedNotes.current !== pendingNotesText.current
        ? pendingNotesText.current
        : null

    const pendingScoreList = Array.from(pendingScores.current.values())
    if (pendingScoreList.length === 0 && pendingNotes === null) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('saving')
    const writes: PromiseLike<unknown>[] = pendingScoreList.map(upsertScore)
    if (pendingNotes !== null) {
      writes.push(
        supabase
          .from('reviews')
          .update({ notes: pendingNotes })
          .eq('id', notesReviewIdRef.current)
          .then(({ error }) => { if (!error) lastSavedNotes.current = pendingNotes })
      )
    }
    await Promise.all(writes)
    pendingScores.current.clear()
  }, [upsertScore, supabase])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Cancel timers and flush any pending saves (fire-and-forget; handles
      // client-side navigation where the component unmounts without a saveDraft call)
      debounceTimers.current.forEach((timer) => clearTimeout(timer))
      debounceTimers.current.clear()
      if (notesTimer.current) clearTimeout(notesTimer.current)
      pendingScores.current.forEach(draft => { upsertScore(draft) })
      pendingScores.current.clear()
      if (
        pendingNotesText.current !== null &&
        lastSavedNotes.current !== pendingNotesText.current
      ) {
        const text = pendingNotesText.current
        supabase
          .from('reviews')
          .update({ notes: text })
          .eq('id', notesReviewIdRef.current)
          .then(({ error }) => { if (!error) lastSavedNotes.current = text })
      }
    }
  }, [upsertScore, supabase])

  // ── Warn before tab close / browser refresh when saves are pending ──────────

  useEffect(() => {
    if (saveStatus !== 'saving') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus])

  // ── Reset saved → idle after 3 s ──────────────────────────────────────────

  useEffect(() => {
    if (saveStatus !== 'saved') return
    const t = setTimeout(() => setSaveStatus('idle'), 3000)
    return () => clearTimeout(t)
  }, [saveStatus])

  // ── Score comments (immediate — no debounce) ──────────────────────────────

  const addScoreComment = useCallback(
    async (
      reviewId: string,
      rubricItemId: string,
      scoreLevel: CriterionScore,
      body: string,
    ): Promise<string | null> => {
      setSaveStatus('saving')
      const { data, error } = await supabase
        .from('score_comments')
        .insert({ review_id: reviewId, rubric_item_id: rubricItemId, score_level: scoreLevel, body })
        .select('id')
        .single()
      if (error) {
        console.error('[useReviewAutoSave] addScoreComment error:', error)
        setSaveStatus('error')
        return null
      }
      setSaveStatus('saved')
      return data.id
    },
    [supabase]
  )

  const deleteScoreComment = useCallback(
    async (commentId: string): Promise<void> => {
      setSaveStatus('saving')
      const { error } = await supabase
        .from('score_comments')
        .delete()
        .eq('id', commentId)
      if (error) {
        console.error('[useReviewAutoSave] deleteScoreComment error:', error)
        setSaveStatus('error')
        return
      }
      setSaveStatus('saved')
    },
    [supabase]
  )

  const updateScoreComment = useCallback(
    async (commentId: string, body: string): Promise<void> => {
      setSaveStatus('saving')
      const { error } = await supabase
        .from('score_comments')
        .update({ body })
        .eq('id', commentId)
      if (error) {
        console.error('[useReviewAutoSave] updateScoreComment error:', error)
        setSaveStatus('error')
        return
      }
      setSaveStatus('saved')
    },
    [supabase]
  )

  return {
    saveStatus,
    onScoreChange,
    onGeneralCommentChange,
    saveAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addScoreComment,
    updateScoreComment,
    deleteScoreComment,
    saveDraft,
  }
}
