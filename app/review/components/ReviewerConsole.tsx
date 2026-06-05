'use client'

// app/reviewer/_components/ReviewerConsole.tsx
// Split-pane: PDF viewer (left) + annotation panel (right).
// Owns score/comment/annotation state and wires up useReviewAutoSave.

import { useState, useCallback, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useReviewAutoSave, type CriterionScore } from '../../../hooks/useReviewAutoSave'
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator'
import { PDFViewer, type TextSelection, type AnnotationConfirmPayload } from './PDFViewer'
import { AnnotationPanel } from './AnnotationPanel'
import { SubmitButton } from './SubmitButton'
import type { OERDocument, Review, Rubric, RubricItem } from './ReviewerApp'

interface ReviewerConsoleProps {
  supabase: SupabaseClient
  userId: string
  document: OERDocument
  review: Review
  rubrics: Rubric[]
  onReviewUpdate: (r: Review) => void
}

export interface LocalScore {
  rubricItemId: string
  score: CriterionScore | null
  comment: string
  annotations: { id: string; anchor: Record<string, unknown>; body: string; tag: string }[]
  reviewScoreId: string | null  // null until first save
}

export function ReviewerConsole({
  supabase,
  userId: _userId,
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

        // Hydrate local scores from existing review_scores
        const initialScores: Record<string, LocalScore> = {}
        items.forEach((item) => {
          const existing = review.review_scores.find(
            (rs) => rs.rubric_item_id === item.id
          )
          initialScores[item.id] = {
            rubricItemId: item.id,
            score: existing?.score ?? null,
            comment: existing?.comment ?? '',
            annotations: existing?.annotations ?? [],
            reviewScoreId: existing?.id ?? null,
          }
        })
        setScores(initialScores)
      })
  // rubrics is stable (set once from server props); review.review_scores seeds initial UI only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, rubrics])

  // ── Auto-save hook ─────────────────────────────────────────────────────────
  const { saveStatus, onScoreChange, saveAnnotation, deleteAnnotation, saveDraft } =
    useReviewAutoSave({ supabase, reviewId: review.id })

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

  // ── Score / comment change ─────────────────────────────────────────────────
  const handleScoreChange = useCallback(
    (rubricItemId: string, field: 'score' | 'comment', value: string) => {
      setScores((prev) => {
        const updated = { ...prev[rubricItemId], [field]: value }
        onScoreChange({
          rubricItemId,
          score: updated.score,
          comment: updated.comment,
        })
        return { ...prev, [rubricItemId]: updated }
      })
    },
    [onScoreChange]
  )

  // ── Annotation from PDF text selection ────────────────────────────────────
  const handleTextSelected = useCallback((selection: TextSelection) => {
    if (isSubmitted || rubricItems.length === 0) return
    setPendingSelection(selection)
  }, [isSubmitted, rubricItems.length])

  const handleAnnotationConfirm = useCallback(
    async (payload: AnnotationConfirmPayload) => {
      if (!pendingSelection) return
      const { body, rubricItemId, tag } = payload

      const currentScore = scores[rubricItemId]
      if (!currentScore) return

      // Ensure a review_score row exists before inserting annotation
      let reviewScoreId = currentScore.reviewScoreId
      if (!reviewScoreId) {
        if (!currentScore.score) {
          // Surface error via return value — caller shows it in the tooltip
          return 'Please select a rating for this criterion before adding evidence.'
        }
        const { data: rs } = await supabase
          .from('review_scores')
          .upsert({
            review_id: review.id,
            rubric_item_id: rubricItemId,
            score: currentScore.score,
            comment: currentScore.comment || ' ',
          }, { onConflict: 'review_id,rubric_item_id' })
          .select('id')
          .single()

        if (!rs) return 'Failed to save rating. Please try again.'
        reviewScoreId = rs.id
        setScores((prev) => ({
          ...prev,
          [rubricItemId]: { ...prev[rubricItemId], reviewScoreId: rs.id },
        }))
      }

      const anchor = {
        page: pendingSelection.page,
        text: pendingSelection.text,
        rects: pendingSelection.rects,
      }

      const newId = await saveAnnotation({ reviewScoreId: reviewScoreId!, anchor, body, tag })
      if (!newId) return 'Failed to save evidence. Please try again.'

      setScores((prev) => ({
        ...prev,
        [rubricItemId]: {
          ...prev[rubricItemId],
          annotations: [
            ...prev[rubricItemId].annotations,
            { id: newId, anchor, body, tag },
          ],
        },
      }))
      setPendingSelection(null)
      return null
    },
    [pendingSelection, scores, review.id, supabase, saveAnnotation]
  )

  const handleAnnotationDelete = useCallback(
    async (rubricItemId: string, annotationId: string) => {
      await deleteAnnotation(annotationId)
      setScores((prev) => ({
        ...prev,
        [rubricItemId]: {
          ...prev[rubricItemId],
          annotations: prev[rubricItemId].annotations.filter((a) => a.id !== annotationId),
        },
      }))
    },
    [deleteAnnotation]
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
      onReviewUpdate({ ...review, status: 'submitted', overall_comment: finalOverallComment })
      return null
    },
    [saveDraft, supabase, review, onReviewUpdate]
  )

  const scoredCount = Object.values(scores).filter((s) => s.score !== null).length
  const totalCount = rubricItems.length

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
        {/* PDF viewer — left 60% */}
        <div className="w-[60%] border-r border-slate-200 overflow-hidden">
          <PDFViewer
            fileUrl={document.file_url}
            rubricItems={rubricItems.map(({ id, label }) => ({ id, label }))}
            activeItemId={activeItemId}
            pendingSelection={pendingSelection}
            onTextSelected={handleTextSelected}
            onAnnotationConfirm={handleAnnotationConfirm}
            onPendingSelectionClear={() => setPendingSelection(null)}
            disabled={isSubmitted}
          />
        </div>

        {/* Annotation panel — right 40% */}
        <div className="w-[40%] overflow-hidden">
          <AnnotationPanel
            rubricItems={rubricItems}
            scores={scores}
            activeItemId={activeItemId}
            isSubmitted={isSubmitted}
            onActiveItemChange={setActiveItemId}
            onScoreChange={handleScoreChange}
            onAnnotationDelete={handleAnnotationDelete}
          />
        </div>
      </div>
    </div>
  )
}
