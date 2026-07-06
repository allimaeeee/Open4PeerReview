'use client'

import { useMemo } from 'react'
import { TabBar } from '@/components/ui/TabBar'
import { Button } from '@/components/ui/Button'
import { CriterionCard } from './CriterionCard'
import { FreeNotesSection } from './FreeNotesSection'
import { UnlinkedAnnotationsCard } from '@/components/patterns/UnlinkedAnnotationsCard'
import type { RubricItem } from './ReviewerApp'
import type { LocalScore, ScoreCommentItem } from './ReviewerConsole'
import type { CriterionScore, SaveStatus } from '../../../hooks/useReviewAutoSave'
import type { HighlightTag } from '@/types'
import type { FreeNote, CriterionOption } from './FreeNotesSection'

interface ReviewRightPanelProps {
  rubricItems: RubricItem[]
  scores: Record<string, LocalScore>
  generalAnnotations: FreeNote[]
  activeRubricId: string | null
  onActiveRubricChange: (id: string) => void
  isReadOnly: boolean
  onSubmit: () => void
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
  onGeneralCommentChange: (val: string) => void
  saveStatus: SaveStatus
  goToLabel?: string
  annotationIndexMap?: Map<string, number>
}

export function ReviewRightPanel({
  rubricItems,
  scores,
  generalAnnotations,
  activeRubricId,
  onActiveRubricChange,
  isReadOnly,
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
  onGeneralCommentChange,
  saveStatus,
  goToLabel,
  annotationIndexMap,
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

  const activeRubricIsReadOnly = isReadOnly

  const allRubricsFullyRated = rubrics.length > 0 && rubrics.every(r => r.rated === r.total && r.total > 0)

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
      {/* Fixed header: rubric tabs + global submit button */}
      <div className="flex-shrink-0 flex items-stretch">
        <div className="flex-1 min-w-0">
          <TabBar
            tabs={rubrics.map(r => ({
              id: r.id,
              label: r.title,
              badge: (
                <span className={[
                  'inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label font-semibold',
                  r.rated === r.total && r.total > 0
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
        <div className="shrink-0 flex items-center px-3 bg-surface-card border-l border-b border-border">
          <Button
            variant="primary"
            disabled={!allRubricsFullyRated || isReadOnly}
            title={!allRubricsFullyRated ? 'Rate all criteria to submit.' : undefined}
            onClick={onSubmit}
          >
            Submit Review
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <FreeNotesSection
          initialNotes={initialNotes}
          onNotesChange={onGeneralCommentChange}
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
          goToLabel={goToLabel}
          annotationIndexMap={annotationIndexMap}
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
                goToLabel={goToLabel}
                annotationIndexMap={annotationIndexMap}
              />
            )
          })}
        </div>

      </div>
    </div>
  )
}

export default ReviewRightPanel
