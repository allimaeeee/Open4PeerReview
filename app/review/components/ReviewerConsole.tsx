'use client'

// app/reviewer/_components/ReviewerConsole.tsx
// Split-pane: PDF viewer (left) + annotation panel (right).
// Owns score/comment/annotation state and wires up useReviewAutoSave.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useReviewAutoSave, type CriterionScore, type SaveStatus } from '../../../hooks/useReviewAutoSave'
import { useReviewTracking } from '../../../hooks/useReviewTracking'
import { useRouter } from 'next/navigation'
import type { HighlightTag } from '@/types'
import type { Json } from '@/types/database.types'
import { PDFViewer, type TextSelection, type AnnotationConfirmPayload } from './PDFViewer'
import HtmlViewerCanvas, { type HtmlTextSelection } from './HtmlViewerCanvas'
import { TorusAnnotationViewer } from './TorusAnnotationViewer'
import ReviewRightPanel from './ReviewRightPanel'
import { Modal, ModalContent } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useReviewSaveStatus } from '@/lib/review-save-context'
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
  proficientSelected: boolean
  niComments: ScoreCommentItem[]
  exceedsComments: ScoreCommentItem[]
  annotations: { id: string; anchor: Record<string, unknown>; body: string; tag: string | null; created_at?: string }[]
}

function computePrimaryScore(
  proficientSelected: boolean,
  niComments: ScoreCommentItem[],
  exceedsComments: ScoreCommentItem[],
): CriterionScore | null {
  if (proficientSelected) return 'exemplifies'
  if (niComments.length > 0) return 'does_not_meet'
  if (exceedsComments.length > 0) return 'exceeds'
  return null
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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [generalAnnotations, setGeneralAnnotations] = useState<
    { id: string; anchor: Record<string, unknown>; body: string; tag: string | null; created_at?: string }[]
  >(
    (review.annotations ?? []).filter((a) => a.rubric_item_id === null).reverse()
  )
  const [annotationIndexMap, setAnnotationIndexMap] = useState<Map<string, number>>(new Map())
  // General-comment live refresh: serverNotes seeds the field; bumping notesKey remounts it.
  const [serverNotes, setServerNotes] = useState<string | null>(review.notes)
  const [notesKey, setNotesKey] = useState(0)

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
          const niComments = itemScoreComments
            .filter((sc) => sc.score_level === 'does_not_meet')
            .map((sc) => ({ id: sc.id, body: sc.body }))
          const exceedsComments = itemScoreComments
            .filter((sc) => sc.score_level === 'exceeds')
            .map((sc) => ({ id: sc.id, body: sc.body }))
          const proficientSelected = (existingScore?.criterion_scores ?? []).includes('exemplifies')
          // Derive scores from both saved criterion_scores and comment presence.
          // score_comments are persisted immediately; criterion_scores go through a
          // 1500ms debounce and may not have been written if the user exited quickly.
          // Merging the two sources keeps badge state consistent across sessions.
          const derivedScores: CriterionScore[] = [...(existingScore?.criterion_scores ?? [])]
          if (exceedsComments.length > 0 && !derivedScores.includes('exceeds')) derivedScores.push('exceeds')
          if (niComments.length > 0 && !derivedScores.includes('does_not_meet')) derivedScores.push('does_not_meet')
          if (proficientSelected && !derivedScores.includes('exemplifies')) derivedScores.push('exemplifies')
          initialScores[item.id] = {
            rubricItemId: item.id,
            scores: derivedScores,
            comment: existingScore?.comment ?? '',
            proficientSelected,
            niComments,
            exceedsComments,
            annotations: [...existingAnnotations].reverse(),
          }
        })
        setScores(initialScores)
      })
  // rubrics is stable (set once from server props); review.review_scores seeds initial UI only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, rubrics])

  // ── Auto-save hook ─────────────────────────────────────────────────────────
  const {
    saveStatus, onScoreChange, onGeneralCommentChange, saveAnnotation, updateAnnotation, deleteAnnotation,
    addScoreComment, updateScoreComment, deleteScoreComment, saveDraft,
  } = useReviewAutoSave({ supabase, reviewId: review.id })

  // ── Broadcast save status to Navbar via context ────────────────────────────
  const { setSaveStatus: setNavSaveStatus, setLastSavedAt: setNavLastSavedAt } = useReviewSaveStatus()
  useEffect(() => { setNavSaveStatus(saveStatus) }, [saveStatus, setNavSaveStatus])
  useEffect(() => { setNavLastSavedAt(lastSavedAt ? new Date(lastSavedAt) : null) }, [lastSavedAt, setNavLastSavedAt])
  useEffect(() => () => { setNavSaveStatus('idle'); setNavLastSavedAt(null) }, [])

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

  // ── Live refresh on tab refocus ────────────────────────────────────────────
  // Re-pull score comments + ratings when the reviewer returns to this tab, so
  // per-criterion comments made in the browser extension (or another session)
  // appear without a manual reload. Guards prevent clobbering in-progress edits.
  const saveStatusRef = useRef(saveStatus)
  useEffect(() => { saveStatusRef.current = saveStatus }, [saveStatus])
  const refreshInFlight = useRef(false)

  const refreshCommentsFromServer = useCallback(async () => {
    if (isSubmitted || refreshInFlight.current) return
    if (saveStatusRef.current === 'saving') return
    const ae = window.document.activeElement as HTMLElement | null
    if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return

    refreshInFlight.current = true
    try {
      const [{ data: sc }, { data: rs }, { data: rev }] = await Promise.all([
        supabase
          .from('score_comments')
          .select('id, rubric_item_id, score_level, body')
          .eq('review_id', review.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('review_scores')
          .select('rubric_item_id, criterion_scores, score, comment')
          .eq('review_id', review.id),
        supabase
          .from('reviews')
          .select('notes')
          .eq('id', review.id)
          .single(),
      ])
      // Re-check guards — the reviewer may have started editing during the fetch.
      // (cast re-widens the ref: TS narrows it across the await above.)
      if ((saveStatusRef.current as SaveStatus) === 'saving') return
      const ae2 = window.document.activeElement as HTMLElement | null
      if (ae2 && (ae2.tagName === 'TEXTAREA' || ae2.tagName === 'INPUT')) return

      setScores((prev) => {
        const next: Record<string, LocalScore> = {}
        for (const itemId of Object.keys(prev)) {
          const existing = prev[itemId]
          const itemComments = (sc ?? []).filter((c) => c.rubric_item_id === itemId)
          const niComments = itemComments.filter((c) => c.score_level === 'does_not_meet').map((c) => ({ id: c.id, body: c.body }))
          const exceedsComments = itemComments.filter((c) => c.score_level === 'exceeds').map((c) => ({ id: c.id, body: c.body }))
          const rsRow = (rs ?? []).find((r) => r.rubric_item_id === itemId)
          const proficientSelected = (rsRow?.criterion_scores ?? []).includes('exemplifies')
          const derived: CriterionScore[] = [...((rsRow?.criterion_scores ?? []) as CriterionScore[])]
          if (exceedsComments.length > 0 && !derived.includes('exceeds')) derived.push('exceeds')
          if (niComments.length > 0 && !derived.includes('does_not_meet')) derived.push('does_not_meet')
          if (proficientSelected && !derived.includes('exemplifies')) derived.push('exemplifies')
          next[itemId] = {
            ...existing,
            scores: derived,
            comment: rsRow?.comment ?? existing.comment,
            proficientSelected,
            niComments,
            exceedsComments,
            // annotations are managed separately — preserve local state
          }
        }
        return next
      })

      // General comment: if the stored notes changed externally, remount the field
      // with the fresh value. Safe here — the guards above ensure it isn't focused
      // and no save is pending, so no in-progress text is lost.
      const freshNotes = rev?.notes ?? null
      setServerNotes((prevNotes) => {
        if (freshNotes !== prevNotes) setNotesKey((k) => k + 1)
        return freshNotes
      })
    } finally {
      refreshInFlight.current = false
    }
  }, [supabase, review.id, isSubmitted])

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => { debounce = null; refreshCommentsFromServer() }, 250)
    }
    const onVisibility = () => { if (window.document.visibilityState === 'visible') schedule() }
    window.addEventListener('focus', schedule)
    window.document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (debounce) clearTimeout(debounce)
      window.removeEventListener('focus', schedule)
      window.document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshCommentsFromServer])

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
      const { body, rubricItemId, tag } = payload

      const pdfSel = pendingSelection as TextSelection
      const anchor = 'type' in pendingSelection && pendingSelection.type === 'html'
        ? {
            type: 'html-char-offset' as const,
            pageIndex: pendingSelection.pageIndex,
            selector: [
              { type: 'TextPositionSelector' as const, start: pendingSelection.start, end: pendingSelection.end },
              { type: 'TextQuoteSelector' as const, exact: pendingSelection.text, prefix: pendingSelection.prefix, suffix: pendingSelection.suffix },
            ],
          }
        : {
            page: pdfSel.page,
            text: pdfSel.text,
            rects: pdfSel.rects,
            pageWidth: pdfSel.pageWidth,
            containerWidth: pdfSel.containerWidth,
            selector: [
              { type: 'TextQuoteSelector' as const, exact: pdfSel.text, prefix: pdfSel.prefix, suffix: pdfSel.suffix },
            ],
          }

      const validItemId = rubricItemId && scores[rubricItemId] ? rubricItemId : null

      if (!validItemId) {
        const newId = await saveAnnotation({ reviewId: review.id, rubricItemId: null, anchor, body, tag })
        if (!newId) return 'Failed to save evidence. Please try again.'
        track('annotation_create', { annotation_id: newId, rubric_item_id: null, tag, char_count: body.length })
        setGeneralAnnotations((prev) => [{ id: newId, anchor, body, tag }, ...prev])
        setPendingSelection(null)
        return null
      }

      const newId = await saveAnnotation({ reviewId: review.id, rubricItemId: validItemId, anchor, body, tag })
      if (!newId) return 'Failed to save evidence. Please try again.'
      track('annotation_create', { annotation_id: newId, rubric_item_id: validItemId, tag, char_count: body.length })
      setScores((prev) => ({
        ...prev,
        [validItemId]: {
          ...prev[validItemId],
          annotations: [{ id: newId, anchor, body, tag }, ...prev[validItemId].annotations],
        },
      }))
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
              { id: newId, anchor: {}, body, tag },
              ...prev[rubricItemId].annotations,
            ],
          },
        }))
      } else {
        setGeneralAnnotations(prev => [{ id: newId, anchor: {}, body, tag }, ...prev])
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
    async (annotationId: string, newRubricItemIds: string[], updates: { body: string; tag: HighlightTag | null }) => {
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
            body: updates.body,
            tag: updates.tag,
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
              { id: newId, anchor: target.anchor, body: updates.body, tag: updates.tag },
              ...next[rubricItemId].annotations,
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
          ...newGeneralEntries.map(({ newId }) => ({
            id: newId!,
            anchor: target.anchor,
            body: updates.body,
            tag: updates.tag,
          })),
          ...prev,
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
        const fromGeneral = generalAnnotations.find((a) => a.id === annotationId)
        if (fromGeneral) {
          // Move from generalAnnotations into a criterion
          setGeneralAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
          setScores((prev) => ({
            ...prev,
            [changes.rubricItemId!]: {
              ...prev[changes.rubricItemId!],
              annotations: [
                {
                  id: annotationId,
                  anchor: fromGeneral.anchor,
                  body: changes.body,
                  tag: changes.tag !== undefined ? changes.tag : fromGeneral.tag,
                },
                ...prev[changes.rubricItemId!].annotations,
              ],
            },
          }))
        } else {
          // Move from one criterion to another
          setScores((prev) => {
            const next = { ...prev }
            let movedAnn: { id: string; anchor: Record<string, unknown>; body: string; tag: string | null } | null = null
            for (const criterionId of Object.keys(next)) {
              if (criterionId === changes.rubricItemId) continue
              const idx = next[criterionId].annotations.findIndex((a) => a.id === annotationId)
              if (idx !== -1) {
                movedAnn = next[criterionId].annotations[idx]
                next[criterionId] = {
                  ...next[criterionId],
                  annotations: next[criterionId].annotations.filter((a) => a.id !== annotationId),
                }
                break
              }
            }
            if (movedAnn) {
              next[changes.rubricItemId!] = {
                ...next[changes.rubricItemId!],
                annotations: [
                  {
                    id: annotationId,
                    anchor: movedAnn.anchor,
                    body: changes.body,
                    tag: changes.tag !== undefined ? changes.tag : movedAnn.tag,
                  },
                  ...next[changes.rubricItemId!].annotations,
                ],
              }
            }
            return next
          })
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
    [updateAnnotation, scores, generalAnnotations, track]
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
      const { data: updated, error } = await supabase
        .from('reviews')
        .update({
          status: 'submitted',
          overall_comment: finalOverallComment,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', review.id)
        .select('id')
        .single()

      if (error || !updated) return error?.message ?? 'Submit failed — please try again'
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

  const handleConfirmSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)
    const error = await handleSubmit(overallComment)
    setIsSubmitting(false)
    if (error) {
      setSubmitError(error)
      return
    }
    setShowSubmitConfirm(false)
    router.push('/reviewer?tab=completed')
  }, [handleSubmit, overallComment, router])

  const firstRubricId = useMemo(() => {
    for (const item of rubricItems) {
      return item.rubric_id
    }
    return null
  }, [rubricItems])

  const [activeRubricId, setActiveRubricId] = useState<string | null>(firstRubricId)
  const [scrollToAnnotationId, setScrollToAnnotationId] = useState<string | null>(null)
  const [pulseAnnotationId, setPulseAnnotationId] = useState<string | null>(null)
  const [panelScrollAnnotationId, setPanelScrollAnnotationId] = useState<string | null>(null)
  const [focusAnnotationId, setFocusAnnotationId] = useState<string | null>(null)

  useEffect(() => {
    if (firstRubricId && activeRubricId === null) {
      setActiveRubricId(firstRubricId)
    }
  }, [firstRubricId])

  // Scroll the rubric panel to the target annotation card, expanding its criterion if needed
  useEffect(() => {
    if (!panelScrollAnnotationId) return
    const timer = setTimeout(() => {
      const el = window.document.getElementById(`annotation-card-${panelScrollAnnotationId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPanelScrollAnnotationId(null)
    }, 150)
    return () => clearTimeout(timer)
  }, [panelScrollAnnotationId])

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

  function handleViewFullComment(annotationId: string) {
    const ann = savedAnnotations.find(a => a.id === annotationId)
    if (!ann) return
    if (ann.rubricItemId) {
      const item = rubricItems.find(r => r.id === ann.rubricItemId)
      if (item && item.rubric_id !== activeRubricId) {
        setActiveRubricId(item.rubric_id)
      }
    }
    setPanelScrollAnnotationId(annotationId)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-surface overflow-hidden print:h-auto print:overflow-visible print:block">
      <ResizablePanelLayout
        defaultLeftPercent={50}
        leftPanel={
          <div className="h-full overflow-hidden print:hidden">
            {document.platform === 'OLI Torus' ? (
              <TorusAnnotationViewer
                supabase={supabase}
                reviewId={review.id}
                sourceUrl={document.source_url}
                courseAccessCode={document.course_access_code}
                savedAnnotations={savedAnnotations}
                rubricItems={activeViewerCriteria}
                onBack={() => { saveDraft().then(() => router.push('/reviewer?tab=my-reviews')) }}
                disabled={isSubmitted}
                scrollToAnnotationId={scrollToAnnotationId}
                onGoToAnnotation={() => setScrollToAnnotationId(null)}
                onAnnotationViewFull={handleViewFullComment}
                pulseAnnotationId={pulseAnnotationId}
                onPulseComplete={() => setPulseAnnotationId(null)}
                submissionTitle={document.title}
                onIndexMapReady={setAnnotationIndexMap}
                onCarouselNavigate={(annotationId) => {
                  handleViewFullComment(annotationId)
                }}
              />
            ) : document.file_type === 'html' && document.content_fingerprint ? (
              <HtmlViewerCanvas
                snapshotSrc={`/api/snapshot/${document.content_fingerprint}`}
                additionalPages={document.pages ?? undefined}
                onBack={() => { saveDraft().then(() => router.push('/reviewer?tab=my-reviews')) }}
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
                pulseAnnotationId={pulseAnnotationId}
                onPulseComplete={() => setPulseAnnotationId(null)}
                onAnnotationViewFull={handleViewFullComment}
                focusAnnotationId={focusAnnotationId}
              />
            ) : document.file_url ? (
              <PDFViewer
                fileUrl={document.file_url}
                onBack={() => { saveDraft().then(() => router.push('/reviewer?tab=my-reviews')) }}
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
                onAnnotationViewFull={handleViewFullComment}
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
              isReadOnly={isSubmitted}
              onSubmit={() => setShowSubmitConfirm(true)}
              onScoreToggle={handleScoreToggle}
              onAddComment={handleAddScoreComment}
              onEditComment={handleEditScoreComment}
              onDeleteComment={handleDeleteScoreComment}
              onEditFreeNote={handleEditFreeNote}
              onGoToAnnotation={(id) => { setScrollToAnnotationId(id); setPulseAnnotationId(id); setFocusAnnotationId(id) }}
              onEditAnnotation={handleAnnotationEditFromPDF}
              onDeleteAnnotation={handleAnnotationDeleteFromPDF}
              expandToAnnotationId={panelScrollAnnotationId}
              initialNotes={serverNotes}
              onGeneralCommentChange={onGeneralCommentChange}
              saveStatus={saveStatus}
              notesKey={notesKey}
              goToLabel={document.platform === 'OLI Torus' ? 'Go to screenshot' : undefined}
              annotationIndexMap={annotationIndexMap}
            />
          </div>
        }
      />

      <Modal open={showSubmitConfirm} onClose={() => { if (!isSubmitting) setShowSubmitConfirm(false) }}>
        <ModalContent className="max-w-sm h-auto">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="font-heading text-title-lg text-text-primary leading-snug">
                Submit Review
              </h2>
              <button
                type="button"
                onClick={() => { if (!isSubmitting) setShowSubmitConfirm(false) }}
                className="shrink-0 rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors duration-150"
                aria-label="Close"
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
            <p className="text-body-md text-text-secondary">
              Are you sure you want to submit? Once submitted, you will not be able to edit or add to this review.
            </p>
            {submitError && (
              <p className="text-body-sm text-error mt-3">{submitError}</p>
            )}
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                size="md"
                disabled={isSubmitting}
                onClick={() => setShowSubmitConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
              >
                {isSubmitting ? 'Submitting…' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  )
}
