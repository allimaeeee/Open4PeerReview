'use client'

// app/reviewer/_components/ReviewerConsole.tsx
// Split-pane: PDF viewer (left) + annotation panel (right).
// Owns score/comment/annotation state and wires up useReviewAutoSave.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useReviewAutoSave, type CriterionScore } from '../../../hooks/useReviewAutoSave'
import { useReviewTracking } from '../../../hooks/useReviewTracking'
import { useRouter } from 'next/navigation'
import type { HighlightTag } from '@/types'
import type { Json } from '@/types/database.types'
import { PDFViewer, type TextSelection, type AnnotationConfirmPayload } from './PDFViewer'
import HtmlViewerCanvas, { type HtmlTextSelection } from './HtmlViewerCanvas'
import { ReviewConsoleHeader } from './ReviewConsoleHeader'
import ReviewRightPanel from './ReviewRightPanel'
import ResizablePanelLayout from '@/components/layout/ResizablePanelLayout'
import type { OERDocument, Review, Rubric, RubricItem, ScoreComment } from './ReviewerApp'

type AnyTextSelection = TextSelection | HtmlTextSelection

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
  scores: CriterionScore[]
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
  const [pendingSelection, setPendingSelection] = useState<AnyTextSelection | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(review.last_saved_at)
  const [overallComment, setOverallComment] = useState(review.overall_comment ?? '')
  const [generalAnnotations, setGeneralAnnotations] = useState<
    { id: string; anchor: Record<string, unknown>; body: string; tag: string | null }[]
  >(
    (review.annotations ?? []).filter((a) => a.rubric_item_id === null)
  )

  const isSubmitted = review.status === 'submitted'
  const router = useRouter()

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
            scores: existingScore?.score ? [existingScore.score] : [],
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
    addScoreComment, updateScoreComment, deleteScoreComment, saveDraft,
  } = useReviewAutoSave({ supabase, reviewId: review.id })

  // Stable ref so annotation callbacks can look up rubric_item_id without stale closures
  const scoresRef = useRef(scores)
  const generalAnnotationsRef = useRef(generalAnnotations)
  useEffect(() => { scoresRef.current = scores }, [scores])
  useEffect(() => { generalAnnotationsRef.current = generalAnnotations }, [generalAnnotations])

  // ── Interaction tracking ───────────────────────────────────────────────────
  const { track, flush } = useReviewTracking({ supabase, reviewId: review.id, reviewerId: userId })
  const criterionFocusTime = useRef<{ id: string; at: number } | null>(null)

  // After any save, stamp the current time — last_saved_at on the DB is only
  // updated by a trigger on review_score upserts, so fetching from DB would
  // return a stale value for annotation saves.
  const refreshLastSaved = useCallback(() => {
    setLastSavedAt(new Date().toISOString())
  }, [])

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
    (rubricItemId: string, changes: { scores?: CriterionScore[]; comment?: string }) => {
      setScores((prev) => {
        const updated = { ...prev[rubricItemId], ...changes }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(onScoreChange as any)({ rubricItemId, scores: updated.scores, comment: updated.comment })
        if ('scores' in changes) {
          track('score_set', {
            rubric_item_id: rubricItemId,
            scores: changes.scores,
          })
        }
        return { ...prev, [rubricItemId]: updated }
      })
    },
    [onScoreChange, track]
  )

  // ── Annotation from text selection (PDF or HTML) ─────────────────────────
  const handleTextSelected = useCallback((selection: AnyTextSelection) => {
    if (isSubmitted || rubricItems.length === 0) return
    if ('page' in selection) {
      track('pdf_text_select', { page: selection.page, text_length: selection.text.length, text_preview: selection.text.slice(0, 80) })
    } else {
      track('html_text_select', { text_length: selection.text.length, text_preview: selection.text.slice(0, 80) })
    }
    setPendingSelection(selection)
  }, [isSubmitted, rubricItems.length, track])

  const handlePendingSelectionClear = useCallback(() => {
    if (pendingSelection) {
      track('annotation_abandoned', {
        ...('page' in pendingSelection ? { page: pendingSelection.page } : {}),
        text_length: pendingSelection.text.length,
      })
    }
    setPendingSelection(null)
  }, [pendingSelection, track])

  const handleAnnotationConfirm = useCallback(
    async (payload: AnnotationConfirmPayload) => {
      if (!pendingSelection) return
      const { body, rubricItemIds, tag } = payload

      const pdfSel = pendingSelection as TextSelection
      const anchor = 'type' in pendingSelection && pendingSelection.type === 'html'
        ? { type: 'html-char-offset' as const, start: pendingSelection.start, end: pendingSelection.end, text: pendingSelection.text }
        : { page: pdfSel.page, text: pdfSel.text, rects: pdfSel.rects, pageWidth: pdfSel.pageWidth, containerWidth: pdfSel.containerWidth }

      const validItemIds = rubricItemIds.filter((id) => scores[id])

      if (validItemIds.length === 0) {
        const newId = await saveAnnotation({ reviewId: review.id, rubricItemId: null, anchor, body, tag })
        if (!newId) return 'Failed to save evidence. Please try again.'
        track('annotation_create', { annotation_id: newId, rubric_item_id: null, tag, char_count: body.length })
        setGeneralAnnotations((prev) => [...prev, { id: newId, anchor, body, tag }])
        setPendingSelection(null)
        return null
      }

      const results = await Promise.all(
        validItemIds.map((id) => saveAnnotation({ reviewId: review.id, rubricItemId: id, anchor, body, tag }))
      )
      if (results.some((id) => !id)) return 'Failed to save evidence. Please try again.'

      results.forEach((newId, i) => {
        if (newId) track('annotation_create', { annotation_id: newId, rubric_item_id: validItemIds[i], tag, char_count: body.length })
      })

      setScores((prev) => {
        let next = { ...prev }
        validItemIds.forEach((id, i) => {
          const newId = results[i]
          if (!newId || !next[id]) return
          next = { ...next, [id]: { ...next[id], annotations: [...next[id].annotations, { id: newId, anchor, body, tag }] } }
        })
        return next
      })
      setPendingSelection(null)
      return null
    },
    [pendingSelection, scores, review.id, saveAnnotation, setGeneralAnnotations, track]
  )

  const handleAddGeneralNote = useCallback(
    async (body: string, tag: HighlightTag | null, rubricItemId: string | null): Promise<string | null> => {
      const newId = await saveAnnotation({ reviewId: review.id, rubricItemId, anchor: {}, body, tag })
      if (!newId) return 'Failed to save note. Please try again.'
      track('note_add', { annotation_id: newId, char_count: body.length, rubric_item_id: rubricItemId })
      if (rubricItemId && scoresRef.current[rubricItemId]) {
        setScores(prev => ({
          ...prev,
          [rubricItemId]: {
            ...prev[rubricItemId],
            annotations: [
              ...prev[rubricItemId].annotations,
              { id: newId, anchor: {}, body, tag },
            ],
          },
        }))
      } else {
        setGeneralAnnotations(prev => [...prev, { id: newId, anchor: {}, body, tag }])
      }
      return null
    },
    [review.id, saveAnnotation, track]
  )

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
      let rubricItemId: string | null = null
      for (const [id, s] of Object.entries(scoresRef.current)) {
        if (s.annotations.some((a) => a.id === annotationId)) { rubricItemId = id; break }
      }
      track('annotation_delete', { annotation_id: annotationId, rubric_item_id: rubricItemId })
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
      let rubricItemId: string | null = null
      for (const [id, s] of Object.entries(scoresRef.current)) {
        if (s.annotations.some((a) => a.id === annotationId)) { rubricItemId = id; break }
      }
      track('annotation_edit', { annotation_id: annotationId, rubric_item_id: rubricItemId })
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

  const handleAnnotationRelink = useCallback(
    async (annotationId: string, newRubricItemIds: string[]) => {
      const allAnns = [
        ...Object.entries(scoresRef.current).flatMap(([rubricItemId, s]) =>
          s.annotations.map(ann => ({ ...ann, rubricItemId }))
        ),
        ...generalAnnotationsRef.current.map(ann => ({ ...ann, rubricItemId: null as null })),
      ]
      const target = allAnns.find(a => a.id === annotationId)
      if (!target) return

      const anchorStr = JSON.stringify(target.anchor)
      const siblings = allAnns.filter(a => JSON.stringify(a.anchor) === anchorStr)

      track('annotation_relink', {
        annotation_id: annotationId,
        old_rubric_item_ids: siblings.map(s => s.rubricItemId),
        new_rubric_item_ids: newRubricItemIds,
      })

      await Promise.all(siblings.map(s => deleteAnnotation(s.id)))

      const insertIds: (string | null)[] = newRubricItemIds.length > 0 ? newRubricItemIds : [null]
      const results = await Promise.all(
        insertIds.map(id =>
          saveAnnotation({
            reviewId: review.id,
            rubricItemId: id,
            anchor: target.anchor as Json,
            body: target.body,
            tag: target.tag as HighlightTag | null,
          })
        )
      )

      setScores(prev => {
        const next = { ...prev }
        for (const sib of siblings) {
          if (sib.rubricItemId && next[sib.rubricItemId]) {
            next[sib.rubricItemId] = {
              ...next[sib.rubricItemId],
              annotations: next[sib.rubricItemId].annotations.filter(a => a.id !== sib.id),
            }
          }
        }
        insertIds.forEach((rubricItemId, i) => {
          const newId = results[i]
          if (!newId || !rubricItemId || !next[rubricItemId]) return
          next[rubricItemId] = {
            ...next[rubricItemId],
            annotations: [
              ...next[rubricItemId].annotations,
              { id: newId, anchor: target.anchor, body: target.body, tag: target.tag },
            ],
          }
        })
        return next
      })

      const oldGeneralIds = siblings.filter(s => !s.rubricItemId).map(s => s.id)
      if (oldGeneralIds.length > 0) {
        setGeneralAnnotations(prev => prev.filter(a => !oldGeneralIds.includes(a.id)))
      }
      const newGeneralEntries = insertIds
        .map((rubricItemId, i) => ({ rubricItemId, newId: results[i] }))
        .filter(({ rubricItemId, newId }) => !rubricItemId && newId)
      if (newGeneralEntries.length > 0) {
        setGeneralAnnotations(prev => [
          ...prev,
          ...newGeneralEntries.map(({ newId }) => ({
            id: newId!,
            anchor: target.anchor,
            body: target.body,
            tag: target.tag,
          })),
        ])
      }
    },
    [deleteAnnotation, saveAnnotation, track, review.id]
  )

  const handleEditFreeNote = useCallback(
    async (annotationId: string, changes: { body: string; rubricItemId: string | null; tag?: HighlightTag | null }) => {
      if (changes.rubricItemId) {
        track('note_categorize', { annotation_id: annotationId, to_rubric_item_id: changes.rubricItemId, char_count: changes.body.length })
      } else {
        track('note_edit', { annotation_id: annotationId, char_count: changes.body.length })
      }
      await updateAnnotation(annotationId, {
        body: changes.body,
        rubricItemId: changes.rubricItemId,
        ...(changes.tag !== undefined && { tag: changes.tag }),
      })
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
          prev.map((a) =>
            a.id === annotationId
              ? { ...a, body: changes.body, ...(changes.tag !== undefined && { tag: changes.tag }) }
              : a
          )
        )
      }
    },
    [updateAnnotation, scores, generalAnnotations]
  )

  // ── Criterion comment blur ────────────────────────────────────────────────
  const handleCommentBlur = useCallback(
    (rubricItemId: string, comment: string) => {
      track('comment_change', { rubric_item_id: rubricItemId, char_count: comment.length })
    },
    [track]
  )

  // ── Score comment edit ────────────────────────────────────────────────────
  const handleEditScoreComment = useCallback(
    async (rubricItemId: string, commentId: string, scoreLevel: 'does_not_meet' | 'exceeds', body: string) => {
      track('score_comment_edit', { rubric_item_id: rubricItemId, comment_id: commentId, score_level: scoreLevel, char_count: body.length })
      await updateScoreComment(commentId, body)
      setScores((prev) => {
        const existing = prev[rubricItemId]
        if (!existing) return prev
        const key = scoreLevel === 'does_not_meet' ? 'niComments' : 'exceedsComments'
        return {
          ...prev,
          [rubricItemId]: {
            ...existing,
            [key]: existing[key].map((c) => (c.id === commentId ? { ...c, body } : c)),
          },
        }
      })
    },
    [updateScoreComment, track]
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
        const updatedScores = existing.scores.includes(scoreLevel)
          ? existing.scores
          : [...existing.scores, scoreLevel]
        const updated: LocalScore = {
          ...existing,
          scores: updatedScores,
          ...(scoreLevel === 'does_not_meet'
            ? { niComments: [...existing.niComments, { id: item.id, body: item.body }] }
            : { exceedsComments: [...existing.exceedsComments, { id: item.id, body: item.body }] }
          ),
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(onScoreChange as any)({ rubricItemId, scores: updatedScores, comment: existing.comment })
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
        const key = scoreLevel === 'does_not_meet' ? 'niComments' : 'exceedsComments'
        const updatedComments = existing[key].filter((c) => c.id !== commentId)
        const updatedScores = updatedComments.length === 0
          ? existing.scores.filter((s) => s !== scoreLevel)
          : existing.scores
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(onScoreChange as any)({ rubricItemId, scores: updatedScores, comment: existing.comment })
        return {
          ...prev,
          [rubricItemId]: {
            ...existing,
            [key]: updatedComments,
            scores: updatedScores,
          },
        }
      })
    },
    [deleteScoreComment, onScoreChange, track]
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
        scored_criteria: Object.values(scores).filter((s) => s.scores.length > 0).length,
        total_criteria: rubricItems.length,
        overall_comment_length: finalOverallComment.length,
      })
      await flush()
      onReviewUpdate({ ...review, status: 'submitted', overall_comment: finalOverallComment })
      return null
    },
    [saveDraft, supabase, review, onReviewUpdate, track, flush, scores, rubricItems.length]
  )

  const firstRubricId = useMemo(() => {
    for (const item of rubricItems) {
      return item.rubric_id
    }
    return null
  }, [rubricItems])

  const [activeRubricId, setActiveRubricId] = useState<string | null>(firstRubricId)
  const [scrollToAnnotationId, setScrollToAnnotationId] = useState<string | null>(null)

  useEffect(() => {
    if (firstRubricId && activeRubricId === null) {
      setActiveRubricId(firstRubricId)
    }
  }, [firstRubricId])

  const activeViewerCriteria = useMemo(
    () => activeRubricId
      ? rubricItems.filter(item => item.rubric_id === activeRubricId).map(({ id, label }) => ({ id, label }))
      : rubricItems.map(({ id, label }) => ({ id, label })),
    [rubricItems, activeRubricId]
  )

  const handleScoreToggle = useCallback(
    (rubricItemId: string, level: CriterionScore) => {
      const current = scoresRef.current[rubricItemId]
      if (!current) return
      const newScores = current.scores.includes(level)
        ? current.scores.filter(s => s !== level)
        : [...current.scores, level]
      handleScoreChange(rubricItemId, { scores: newScores })
    },
    [handleScoreChange]
  )

  const scoredCount = Object.values(scores).filter((s) => s.scores.length > 0).length
  const totalCount = rubricItems.length

  // Flatten all saved annotations for PDF highlight overlays
  const savedAnnotations = useMemo(() => [
    ...Object.entries(scores).flatMap(([rubricItemId, s]) =>
      s.annotations.map((ann) => ({ ...ann, rubricItemId }))
    ),
    ...generalAnnotations.map((ann) => ({ ...ann, rubricItemId: null })),
  ], [scores, generalAnnotations])

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden print:h-auto print:overflow-visible print:block">
      <ReviewConsoleHeader
        scoredCount={scoredCount}
        totalCount={totalCount}
        lastSavedAt={lastSavedAt ? new Date(lastSavedAt) : null}
        onBack={() => router.push('/reviewer')}
        onSubmit={async () => { await handleSubmit('') }}
        isSubmitted={isSubmitted}
      />

      <ResizablePanelLayout
        defaultLeftPercent={60}
        leftPanel={
          <div className="h-full overflow-hidden print:hidden">
            {document.file_type === 'html' && document.content_fingerprint ? (
              <HtmlViewerCanvas
                snapshotSrc={`/api/snapshot/${document.content_fingerprint}`}
                rubricItems={activeViewerCriteria}
                activeItemId={activeItemId}
                pendingSelection={pendingSelection && 'type' in pendingSelection ? pendingSelection as HtmlTextSelection : null}
                savedAnnotations={savedAnnotations}
                onTextSelected={handleTextSelected as (sel: HtmlTextSelection) => void}
                onAnnotationConfirm={handleAnnotationConfirm}
                onPendingSelectionClear={handlePendingSelectionClear}
                onAnnotationEdit={handleAnnotationEditFromPDF}
                onAnnotationDelete={handleAnnotationDeleteFromPDF}
                onAnnotationRelink={handleAnnotationRelink}
                onTrackEvent={track}
                disabled={isSubmitted}
                scrollToAnnotationId={scrollToAnnotationId}
                onGoToAnnotation={() => setScrollToAnnotationId(null)}
              />
            ) : document.file_url ? (
              <PDFViewer
                fileUrl={document.file_url}
                rubricItems={activeViewerCriteria}
                activeItemId={activeItemId}
                pendingSelection={pendingSelection && 'page' in pendingSelection ? pendingSelection : null}
                savedAnnotations={savedAnnotations}
                onTextSelected={handleTextSelected as (sel: TextSelection) => void}
                onAnnotationConfirm={handleAnnotationConfirm}
                onPendingSelectionClear={handlePendingSelectionClear}
                onAnnotationEdit={handleAnnotationEditFromPDF}
                onAnnotationDelete={handleAnnotationDeleteFromPDF}
                onAnnotationRelink={handleAnnotationRelink}
                onTrackEvent={track}
                disabled={isSubmitted}
                scrollToAnnotationId={scrollToAnnotationId}
                onGoToAnnotation={() => setScrollToAnnotationId(null)}
              />
            ) : null}
          </div>
        }
        rightPanel={
          <div className="h-full overflow-hidden print:w-full print:overflow-visible">
            <ReviewRightPanel
              rubricItems={rubricItems}
              scores={scores}
              generalAnnotations={generalAnnotations}
              activeRubricId={activeRubricId}
              onActiveRubricChange={setActiveRubricId}
              isSubmitted={isSubmitted}
              onScoreToggle={handleScoreToggle}
              onAddComment={handleAddScoreComment}
              onEditComment={handleEditScoreComment}
              onDeleteComment={handleDeleteScoreComment}
              onAddNote={handleAddGeneralNote}
              onEditFreeNote={handleEditFreeNote}
              onDeleteNote={handleDeleteGeneralAnnotation}
              onGoToAnnotation={(id) => setScrollToAnnotationId(id)}
            />
          </div>
        }
      />
    </div>
  )
}
