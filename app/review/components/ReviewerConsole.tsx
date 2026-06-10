'use client'

// app/reviewer/_components/ReviewerConsole.tsx
// Split-pane: PDF viewer (left) + annotation panel (right).
// Owns score/comment/annotation state and wires up useReviewAutoSave.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useReviewAutoSave, type CriterionScore } from '../../../hooks/useReviewAutoSave'
import { useReviewTracking } from '../../../hooks/useReviewTracking'
import type { HighlightTag } from '@/types'
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator'
import { PDFViewer, type TextSelection, type AnnotationConfirmPayload } from './PDFViewer'
import { AnnotationPanel } from './AnnotationPanel'
import { SubmitButton } from './SubmitButton'
import type { OERDocument, Review, Rubric, RubricItem, ScoreComment } from './ReviewerApp'

interface ReviewerConsoleProps {
  supabase: SupabaseClient
  userId: string
  document: OERDocument
  review: Review
  rubrics: Rubric[]
  onReviewUpdate: (r: Review) => void
}

export interface ScoreCommentItem {
  id: string
  body: string
}

export interface LocalScore {
  rubricItemId: string
  score: CriterionScore | null
  comment: string
  niComments: ScoreCommentItem[]
  exceedsComments: ScoreCommentItem[]
  annotations: { id: string; anchor: Record<string, unknown>; body: string; tag: string | null }[]
}

export function ReviewerConsole({
  supabase,
  userId,
  document,
  review,
  rubrics,
  onReviewUpdate,
}: ReviewerConsoleProps) {
  const [rubricItems, setRubricItems] = useState<RubricItem[]>([])
  const [scores, setScores] = useState<Record<string, LocalScore>>({})
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [pendingSelection, setPendingSelection] = useState<TextSelection | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(review.last_saved_at)
  const [overallComment, setOverallComment] = useState(review.overall_comment ?? '')
  const [generalAnnotations, setGeneralAnnotations] = useState<
    { id: string; anchor: Record<string, unknown>; body: string; tag: string | null }[]
  >(
    (review.annotations ?? []).filter((a) => a.rubric_item_id === null)
  )

  const isSubmitted = review.status === 'submitted'

  // ── Load rubric items ──────────────────────────────────────────────────────
  useEffect(() => {
    const rubricIds = rubrics.map((r) => r.id)
    if (rubricIds.length === 0) return

    const rubricTitleById = Object.fromEntries(rubrics.map((r) => [r.id, r.title]))

    supabase
      .from('rubric_items')
      .select('id, label, description, sort_order, rubric_id')
      .in('rubric_id', rubricIds)
      .order('rubric_id')
      .order('sort_order')
      .then(({ data }) => {
        if (!data) return
        const items: RubricItem[] = data.map((item) => ({
          ...item,
          rubric_title: rubricTitleById[item.rubric_id],
        }))
        setRubricItems(items)
        setActiveItemId(items[0]?.id ?? null)

        // Hydrate local scores from existing review_scores, annotations, and score_comments
        const initialScores: Record<string, LocalScore> = {}
        items.forEach((item) => {
          const existingScore = review.review_scores.find((rs) => rs.rubric_item_id === item.id)
          const existingAnnotations = (review.annotations ?? []).filter(
            (a) => a.rubric_item_id === item.id
          )
          const itemScoreComments = (review.score_comments ?? []).filter(
            (sc) => sc.rubric_item_id === item.id
          )
          initialScores[item.id] = {
            rubricItemId: item.id,
            score: existingScore?.score ?? null,
            comment: existingScore?.comment ?? '',
            niComments: itemScoreComments
              .filter((sc) => sc.score_level === 'does_not_meet')
              .map((sc) => ({ id: sc.id, body: sc.body })),
            exceedsComments: itemScoreComments
              .filter((sc) => sc.score_level === 'exceeds')
              .map((sc) => ({ id: sc.id, body: sc.body })),
            annotations: existingAnnotations,
          }
        })
        setScores(initialScores)
      })
  // rubrics is stable (set once from server props); review.review_scores seeds initial UI only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, rubrics])

  // ── Auto-save hook ─────────────────────────────────────────────────────────
  const {
    saveStatus, onScoreChange, saveAnnotation, updateAnnotation, deleteAnnotation,
    addScoreComment, deleteScoreComment, saveDraft,
  } = useReviewAutoSave({ supabase, reviewId: review.id })

  // ── Interaction tracking ───────────────────────────────────────────────────
  const { track, flush } = useReviewTracking({ supabase, reviewId: review.id, reviewerId: userId })
  const criterionFocusTime = useRef<{ id: string; at: number } | null>(null)

  // After any save, refresh last_saved_at from DB
  const refreshLastSaved = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('last_saved_at')
      .eq('id', review.id)
      .single()
    if (data?.last_saved_at) setLastSavedAt(data.last_saved_at)
  }, [supabase, review.id])

  useEffect(() => {
    if (saveStatus === 'saved') refreshLastSaved()
  }, [saveStatus, refreshLastSaved])

  // ── Criterion focus / blur ─────────────────────────────────────────────────
  const handleActiveItemChange = useCallback((id: string) => {
    const now = performance.now()
    if (criterionFocusTime.current) {
      track('criterion_blur', {
        rubric_item_id: criterionFocusTime.current.id,
        dwell_ms: Math.round(now - criterionFocusTime.current.at),
      })
    }
    criterionFocusTime.current = { id, at: now }
    track('criterion_focus', { rubric_item_id: id })
    setActiveItemId(id)
  }, [track])

  // ── Score / comment change ─────────────────────────────────────────────────
  const handleScoreChange = useCallback(
    (rubricItemId: string, changes: { score?: CriterionScore | null; comment?: string }) => {
      setScores((prev) => {
        const prevScore = prev[rubricItemId]?.score ?? null
        const updated = { ...prev[rubricItemId], ...changes }
        onScoreChange({ rubricItemId, score: updated.score, comment: updated.comment })
        if ('score' in changes && changes.score !== prevScore) {
          track('score_set', {
            rubric_item_id: rubricItemId,
            score: changes.score ?? null,
            prev_score: prevScore,
          })
        }
        return { ...prev, [rubricItemId]: updated }
      })
    },
    [onScoreChange, track]
  )

  // ── Annotation from PDF text selection ────────────────────────────────────
  const handleTextSelected = useCallback((selection: TextSelection) => {
    if (isSubmitted || rubricItems.length === 0) return
    track('pdf_text_select', {
      page: selection.page,
      text_length: selection.text.length,
      text_preview: selection.text.slice(0, 80),
    })
    setPendingSelection(selection)
  }, [isSubmitted, rubricItems.length, track])

  const handlePendingSelectionClear = useCallback(() => {
    if (pendingSelection) {
      track('annotation_abandoned', {
        page: pendingSelection.page,
        text_length: pendingSelection.text.length,
      })
    }
    setPendingSelection(null)
  }, [pendingSelection, track])

  const handleAnnotationConfirm = useCallback(
    async (payload: AnnotationConfirmPayload) => {
      if (!pendingSelection) return
      const { body, rubricItemId, tag } = payload

      const anchor = {
        page: pendingSelection.page,
        text: pendingSelection.text,
        rects: pendingSelection.rects,
      }

      if (!rubricItemId || !scores[rubricItemId]) {
        const newId = await saveAnnotation({ reviewId: review.id, rubricItemId: null, anchor, body, tag })
        if (!newId) return 'Failed to save evidence. Please try again.'
        track('annotation_create', { annotation_id: newId, rubric_item_id: null, tag, char_count: body.length })
        setGeneralAnnotations((prev) => [...prev, { id: newId, anchor, body, tag }])
        setPendingSelection(null)
        return null
      }

      const newId = await saveAnnotation({ reviewId: review.id, rubricItemId, anchor, body, tag })
      if (!newId) return 'Failed to save evidence. Please try again.'
      track('annotation_create', { annotation_id: newId, rubric_item_id: rubricItemId, tag, char_count: body.length })

      setScores((prev) => ({
        ...prev,
        [rubricItemId]: {
          ...prev[rubricItemId],
          annotations: [...prev[rubricItemId].annotations, { id: newId, anchor, body, tag }],
        },
      }))
      setPendingSelection(null)
      return null
    },
    [pendingSelection, scores, review.id, saveAnnotation, setGeneralAnnotations]
  )

  const handleAddGeneralNote = useCallback(async (body: string): Promise<string | null> => {
    const newId = await saveAnnotation({ reviewId: review.id, rubricItemId: null, anchor: {}, body, tag: null })
    if (!newId) return 'Failed to save note. Please try again.'
    track('note_add', { annotation_id: newId, char_count: body.length })
    setGeneralAnnotations((prev) => [...prev, { id: newId, anchor: {}, body, tag: null }])
    return null
  }, [review.id, saveAnnotation, track])

  const handleDeleteGeneralAnnotation = useCallback(async (annotationId: string) => {
    track('note_delete', { annotation_id: annotationId })
    await deleteAnnotation(annotationId)
    setGeneralAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
  }, [deleteAnnotation, track])

  const handleAnnotationDelete = useCallback(
    async (rubricItemId: string, annotationId: string) => {
      track('annotation_delete', { annotation_id: annotationId, rubric_item_id: rubricItemId })
      await deleteAnnotation(annotationId)
      setScores((prev) => ({
        ...prev,
        [rubricItemId]: {
          ...prev[rubricItemId],
          annotations: prev[rubricItemId].annotations.filter((a) => a.id !== annotationId),
        },
      }))
    },
    [deleteAnnotation, track]
  )

  // Called from PDF highlight click — deletes without knowing rubric item
  const handleAnnotationDeleteFromPDF = useCallback(
    async (annotationId: string) => {
      track('annotation_delete', { annotation_id: annotationId })
      await deleteAnnotation(annotationId)
      setScores((prev) => {
        const next = { ...prev }
        for (const rubricItemId of Object.keys(next)) {
          if (next[rubricItemId].annotations.some((a) => a.id === annotationId)) {
            next[rubricItemId] = {
              ...next[rubricItemId],
              annotations: next[rubricItemId].annotations.filter((a) => a.id !== annotationId),
            }
            break
          }
        }
        return next
      })
      setGeneralAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
    },
    [deleteAnnotation, track]
  )

  // Called from PDF highlight click — edits body/tag without knowing rubric item
  const handleAnnotationEditFromPDF = useCallback(
    async (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => {
      track('annotation_edit', { annotation_id: annotationId })
      await updateAnnotation(annotationId, changes)
      setScores((prev) => {
        const next = { ...prev }
        for (const rubricItemId of Object.keys(next)) {
          const idx = next[rubricItemId].annotations.findIndex((a) => a.id === annotationId)
          if (idx !== -1) {
            const updated = [...next[rubricItemId].annotations]
            updated[idx] = { ...updated[idx], ...changes }
            next[rubricItemId] = { ...next[rubricItemId], annotations: updated }
            break
          }
        }
        return next
      })
      setGeneralAnnotations((prev) =>
        prev.map((a) => (a.id === annotationId ? { ...a, ...changes } : a))
      )
    },
    [updateAnnotation, track]
  )

  const handleEditFreeNote = useCallback(
    async (annotationId: string, changes: { body: string; rubricItemId: string | null }) => {
      await updateAnnotation(annotationId, { body: changes.body, rubricItemId: changes.rubricItemId })
      if (changes.rubricItemId && scores[changes.rubricItemId]) {
        // Move from free notes into a criterion
        const note = generalAnnotations.find((a) => a.id === annotationId)
        if (note) {
          setGeneralAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
          setScores((prev) => ({
            ...prev,
            [changes.rubricItemId!]: {
              ...prev[changes.rubricItemId!],
              annotations: [
                ...prev[changes.rubricItemId!].annotations,
                { id: annotationId, anchor: note.anchor, body: changes.body, tag: note.tag },
              ],
            },
          }))
        }
      } else {
        setGeneralAnnotations((prev) =>
          prev.map((a) => (a.id === annotationId ? { ...a, body: changes.body } : a))
        )
      }
    },
    [updateAnnotation, scores, generalAnnotations]
  )

  // ── Score comments ────────────────────────────────────────────────────────
  const handleAddScoreComment = useCallback(
    async (rubricItemId: string, scoreLevel: 'does_not_meet' | 'exceeds', body: string) => {
      const id = await addScoreComment(review.id, rubricItemId, scoreLevel, body)
      if (!id) return
      track('score_comment_add', { rubric_item_id: rubricItemId, score_level: scoreLevel, char_count: body.length })
      setScores((prev) => {
        const existing = prev[rubricItemId]
        const item: ScoreComment = { id, rubric_item_id: rubricItemId, score_level: scoreLevel, body }
        const updated: LocalScore = {
          ...existing,
          score: scoreLevel,
          ...(scoreLevel === 'does_not_meet'
            ? { niComments: [...existing.niComments, { id: item.id, body: item.body }] }
            : { exceedsComments: [...existing.exceedsComments, { id: item.id, body: item.body }] }
          ),
        }
        onScoreChange({ rubricItemId, score: scoreLevel, comment: existing.comment })
        return { ...prev, [rubricItemId]: updated }
      })
    },
    [review.id, addScoreComment, onScoreChange, track]
  )

  const handleDeleteScoreComment = useCallback(
    async (rubricItemId: string, commentId: string, scoreLevel: 'does_not_meet' | 'exceeds') => {
      track('score_comment_delete', { rubric_item_id: rubricItemId, comment_id: commentId, score_level: scoreLevel })
      await deleteScoreComment(commentId)
      setScores((prev) => {
        const existing = prev[rubricItemId]
        return {
          ...prev,
          [rubricItemId]: {
            ...existing,
            ...(scoreLevel === 'does_not_meet'
              ? { niComments: existing.niComments.filter((c) => c.id !== commentId) }
              : { exceedsComments: existing.exceedsComments.filter((c) => c.id !== commentId) }
            ),
          },
        }
      })
    },
    [deleteScoreComment, track]
  )

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (finalOverallComment: string): Promise<string | null> => {
      await saveDraft()
      const { error } = await supabase
        .from('reviews')
        .update({ status: 'submitted', overall_comment: finalOverallComment })
        .eq('id', review.id)

      if (error) return error.message
      track('submit', {
        scored_criteria: Object.values(scores).filter((s) => s.score !== null).length,
        total_criteria: rubricItems.length,
        overall_comment_length: finalOverallComment.length,
      })
      await flush()
      onReviewUpdate({ ...review, status: 'submitted', overall_comment: finalOverallComment })
      return null
    },
    [saveDraft, supabase, review, onReviewUpdate, track, flush, scores, rubricItems.length]
  )

  const scoredCount = Object.values(scores).filter((s) => s.score !== null).length
  const totalCount = rubricItems.length

  // Flatten all saved annotations for PDF highlight overlays
  const savedAnnotations = useMemo(() => [
    ...Object.entries(scores).flatMap(([rubricItemId, s]) =>
      s.annotations.map((ann) => ({ ...ann, rubricItemId }))
    ),
    ...generalAnnotations.map((ann) => ({ ...ann, rubricItemId: null })),
  ], [scores, generalAnnotations])

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold tracking-widest text-[#1e3a5f] uppercase hidden sm:block">
            Open 4 Peer Review
          </span>
          <span className="text-slate-200 hidden sm:block">|</span>
          <h1 className="text-sm font-semibold text-slate-800 truncate">{document.title}</h1>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
            {review.rubric.title}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress pill */}
          <span className={[
            'text-xs font-medium px-2.5 py-1 rounded-full',
            scoredCount === totalCount && totalCount > 0
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-600',
          ].join(' ')}>
            {scoredCount}/{totalCount} rated
          </span>

          <SaveStatusIndicator
            status={saveStatus}
            lastSavedAt={lastSavedAt}
            onSaveDraft={saveDraft}
            disabled={isSubmitted}
          />

          <SubmitButton
            isSubmitted={isSubmitted}
            scoredCount={scoredCount}
            totalCount={totalCount}
            overallComment={overallComment}
            onOverallCommentChange={setOverallComment}
            onSubmit={handleSubmit}
          />
        </div>
      </header>

      {/* ── Split pane ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Content viewer — left 60% */}
        <div className="w-[60%] border-r border-slate-200 overflow-hidden">
          {document.file_type === 'html' && document.content_fingerprint ? (
            <iframe
              src={`/api/snapshot/${document.content_fingerprint}`}
              className="w-full h-full border-0"
              title={document.title}
              sandbox="allow-same-origin allow-popups"
            />
          ) : (
            <PDFViewer
              fileUrl={document.file_url}
              rubricItems={rubricItems.map(({ id, label }) => ({ id, label }))}
              activeItemId={activeItemId}
              pendingSelection={pendingSelection}
              savedAnnotations={savedAnnotations}
              onTextSelected={handleTextSelected}
              onAnnotationConfirm={handleAnnotationConfirm}
              onPendingSelectionClear={handlePendingSelectionClear}
              onAnnotationEdit={handleAnnotationEditFromPDF}
              onAnnotationDelete={handleAnnotationDeleteFromPDF}
              onTrackEvent={track}
              disabled={isSubmitted}
            />
          )}
        </div>

        {/* Annotation panel — right 40% */}
        <div className="w-[40%] overflow-hidden">
          <AnnotationPanel
            rubricItems={rubricItems}
            scores={scores}
            activeItemId={activeItemId}
            isSubmitted={isSubmitted}
            generalAnnotations={generalAnnotations}
            onActiveItemChange={setActiveItemId}
            onScoreChange={handleScoreChange}
            onAnnotationDelete={handleAnnotationDelete}
            onAnnotationEdit={handleAnnotationEditFromPDF}
            onEditFreeNote={handleEditFreeNote}
            onAddGeneralNote={handleAddGeneralNote}
            onDeleteGeneralAnnotation={handleDeleteGeneralAnnotation}
            onAddScoreComment={handleAddScoreComment}
            onDeleteScoreComment={handleDeleteScoreComment}
          />
        </div>
      </div>
    </div>
  )
}
