'use client'

import { useMemo } from 'react'
import { TabBar } from '@/components/ui/TabBar'
import { CriterionCard } from './CriterionCard'
import { FreeNotesSection } from './FreeNotesSection'
import { UnlinkedAnnotationsCard } from '@/components/patterns/UnlinkedAnnotationsCard'
import type { RubricItem } from './ReviewerApp'
import type { LocalScore, ScoreCommentItem } from './ReviewerConsole'
import type { CriterionScore, SaveStatus } from '../../../hooks/useReviewAutoSave'
import type { HighlightTag } from '@/types'
import type { FreeNote, CriterionOption } from './FreeNotesSection'
import { SubmitReviewButton } from './SubmitReviewButton'

interface ReviewRightPanelProps {
  rubricItems: RubricItem[]
  scores: Record<string, LocalScore>
  generalAnnotations: FreeNote[]
  activeRubricId: string | null
  onActiveRubricChange: (id: string) => void
  isReadOnly: boolean
  submittedRubricIds: Set<string>
  onSubmit: (rubricId: string) => Promise<void>
  onScoreToggle: (rubricItemId: string, level: CriterionScore) => void
  onAddComment: (rubricItemId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onEditComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onDeleteComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet') => void
  onEditFreeNote: (noteId: string, changes: { body: string; rubricItemId: string | null; tag?: HighlightTag | null }) => void
  onGoToAnnotation: (annotationId: string) => void
  onEditAnnotation: (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onDeleteAnnotation: (annotationId: string) => void
  expandToAnnotationId?: string | null
  initialNotes: string | null
  onNotesChange: (val: string) => void
  saveStatus: SaveStatus
}

export function ReviewRightPanel({
  rubricItems,
  scores,
  generalAnnotations,
  activeRubricId,
  onActiveRubricChange,
  isReadOnly,
  submittedRubricIds,
  onSubmit,
  onScoreToggle,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onEditFreeNote,
  onGoToAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  expandToAnnotationId,
  initialNotes,
  onNotesChange,
  saveStatus,
}: ReviewRightPanelProps) {
  const rubrics = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; title: string; rated: number; total: number }[] = []
    for (const item of rubricItems) {
      if (!seen.has(item.rubric_id)) {
        seen.add(item.rubric_id)
        const items = rubricItems.filter(i => i.rubric_id === item.rubric_id)
        const rated = items.filter(i => (scores[i.id]?.scores?.length ?? 0) > 0).length
        result.push({ id: item.rubric_id, title: item.rubric_title ?? item.rubric_id, rated, total: items.length })
      }
    }
    return result
  }, [rubricItems, scores])

  const activeRubric = rubrics.find(r => r.id === activeRubricId)
  const activeRubricFullyRated =
    (activeRubric?.rated ?? 0) > 0 &&
    activeRubric?.rated === activeRubric?.total
  const activeRubricIsSubmitted =
    activeRubricId ? submittedRubricIds.has(activeRubricId) : false
  const activeRubricIsReadOnly = isReadOnly || activeRubricIsSubmitted

  const activeRubricItems = useMemo(
    () => rubricItems.filter(item => item.rubric_id === activeRubricId),
    [rubricItems, activeRubricId]
  )

  const criteriaOptions: CriterionOption[] = useMemo(
    () => activeRubricItems.map(item => ({ id: item.id, label: item.label })),
    [activeRubricItems]
  )

  // Unlinked highlights: annotations with a non-empty anchor that haven't been linked to a criterion.
  // Free notes (anchor={}) are now stored in reviews.notes, not rendered here.
  const unlinkedHighlights = useMemo(
    () => generalAnnotations.filter(a => Object.keys(a.anchor).length > 0),
    [generalAnnotations]
  )

  function handleLinkHighlight(annotationId: string, criterionId: string) {
    const ann = generalAnnotations.find(a => a.id === annotationId)
    if (!ann) return
    onEditFreeNote(annotationId, { body: ann.body, tag: ann.tag as HighlightTag | null, rubricItemId: criterionId })
  }

  function handleMoveAnnotation(annotationId: string, newRubricItemId: string, body?: string, tag?: HighlightTag | null) {
    for (const score of Object.values(scores)) {
      const ann = (score.annotations as { id: string; body: string; tag: string | null }[]).find(a => a.id === annotationId)
      if (ann) {
        onEditFreeNote(annotationId, {
          body: body ?? ann.body,
          tag: tag !== undefined ? tag : ann.tag as HighlightTag | null,
          rubricItemId: newRubricItemId,
        })
        return
      }
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface">
      {/* Fixed header: rubric tabs */}
      <div className="flex-shrink-0">
        <TabBar
          tabs={rubrics.map(r => ({
            id: r.id,
            label: r.title,
            badge: submittedRubricIds.has(r.id) ? (
              <span className="flex items-center gap-1 text-label-sm font-semibold text-success">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 8.5L6.5 12L13 4" />
                </svg>
              </span>
            ) : (
              <span className={[
                'inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label font-semibold',
                r.rated === r.total
                  ? 'bg-success-container text-success border border-success'
                  : 'bg-amber-100 text-amber-800 border border-amber-800',
              ].join(' ')}>
                {r.rated}/{r.total}
              </span>
            ),
          }))}
          activeId={activeRubricId ?? ''}
          onChange={onActiveRubricChange}
          tabClassName="py-[16px]"
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <FreeNotesSection
          initialNotes={initialNotes}
          onNotesChange={onNotesChange}
          saveStatus={saveStatus}
          isReadOnly={activeRubricIsReadOnly}
        />

        <UnlinkedAnnotationsCard
          annotations={unlinkedHighlights}
          criterionOptions={criteriaOptions}
          onLink={handleLinkHighlight}
          onGoToAnnotation={onGoToAnnotation}
          onEdit={onEditAnnotation}
          onDelete={onDeleteAnnotation}
          isReadOnly={activeRubricIsReadOnly}
        />

        <div className="flex flex-col gap-2 p-4">
          {activeRubricItems.map((item, index) => {
            const score = scores[item.id]
            if (!score) return null
            return (
              <CriterionCard
                key={item.id}
                criterionIndex={index + 1}
                rubricItem={item}
                score={score}
                onScoreToggle={onScoreToggle}
                onAddComment={onAddComment}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onGoToAnnotation={onGoToAnnotation}
                onEditAnnotation={onEditAnnotation}
                onDeleteAnnotation={onDeleteAnnotation}
                onMoveAnnotation={handleMoveAnnotation}
                allCriteria={criteriaOptions}
                expandToAnnotationId={expandToAnnotationId}
                isReadOnly={activeRubricIsReadOnly}
              />
            )
          })}
        </div>

        {/* Submit footer — sticky inside scroll container so it's always visible */}
        {activeRubricIsReadOnly ? (
          <div className="sticky bottom-0 bg-surface px-4 py-3 flex justify-center">
            <div className="flex items-center gap-2 text-label-sm font-label font-semibold uppercase tracking-wide text-success">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              {activeRubric?.title ?? 'Rubric'} Review Submitted
            </div>
          </div>
        ) : activeRubricFullyRated ? (
          <div className="sticky bottom-0 px-4 py-3 flex justify-center">
            <SubmitReviewButton
              activeRubricRated={activeRubric?.rated ?? 0}
              activeRubricTotal={activeRubric?.total ?? 0}
              rubricName={activeRubric?.title ?? ''}
              isReadOnly={isReadOnly}
              onSubmit={() => onSubmit(activeRubricId ?? '')}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ReviewRightPanel
