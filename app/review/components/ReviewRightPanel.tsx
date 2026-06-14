'use client'

import { useMemo } from 'react'
import { TabBar } from '@/components/ui/TabBar'
import { CriterionCard } from './CriterionCard'
import { FreeNotesSection } from './FreeNotesSection'
import { UnlinkedHighlightsSection } from './UnlinkedHighlightsSection'
import type { RubricItem } from './ReviewerApp'
import type { LocalScore, ScoreCommentItem } from './ReviewerConsole'
import type { CriterionScore } from '../../../hooks/useReviewAutoSave'
import type { HighlightTag } from '@/types'
import type { FreeNote, CriterionOption } from './FreeNotesSection'

interface ReviewRightPanelProps {
  rubricItems: RubricItem[]
  scores: Record<string, LocalScore>
  generalAnnotations: FreeNote[]
  activeRubricId: string | null
  onActiveRubricChange: (id: string) => void
  isSubmitted: boolean
  onScoreToggle: (rubricItemId: string, level: CriterionScore) => void
  onAddComment: (rubricItemId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onEditComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onDeleteComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet') => void
  onAddNote: (body: string, tag: HighlightTag | null, rubricItemId: string | null) => Promise<string | null>
  onEditFreeNote: (noteId: string, changes: { body: string; rubricItemId: string | null; tag?: HighlightTag | null }) => void
  onDeleteNote: (noteId: string) => void
  onGoToAnnotation: (annotationId: string) => void
  onEditAnnotation: (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onDeleteAnnotation: (annotationId: string) => void
  expandToAnnotationId?: string | null
}

export function ReviewRightPanel({
  rubricItems,
  scores,
  generalAnnotations,
  activeRubricId,
  onActiveRubricChange,
  isSubmitted,
  onScoreToggle,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAddNote,
  onEditFreeNote,
  onDeleteNote,
  onGoToAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  expandToAnnotationId,
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

  const activeRubricItems = useMemo(
    () => rubricItems.filter(item => item.rubric_id === activeRubricId),
    [rubricItems, activeRubricId]
  )

  const criteriaOptions: CriterionOption[] = useMemo(
    () => activeRubricItems.map(item => ({ id: item.id, label: item.label })),
    [activeRubricItems]
  )

  // Split generalAnnotations: actual highlights have a non-empty anchor object;
  // plain free notes are saved with anchor={} (empty).
  const freeNotes = useMemo(
    () => generalAnnotations.filter(a => Object.keys(a.anchor).length === 0),
    [generalAnnotations]
  )
  const unlinkedHighlights = useMemo(
    () => generalAnnotations.filter(a => Object.keys(a.anchor).length > 0),
    [generalAnnotations]
  )

  function handleEditNote(noteId: string, changes: { body: string; tag: HighlightTag | null }) {
    onEditFreeNote(noteId, { body: changes.body, tag: changes.tag, rubricItemId: null })
  }

  function handleMoveNote(noteId: string, rubricItemId: string) {
    const note = generalAnnotations.find(n => n.id === noteId)
    if (!note) return
    onEditFreeNote(noteId, { body: note.body, tag: note.tag as HighlightTag | null, rubricItemId })
  }

  function handleLinkHighlight(annotationId: string, criterionId: string) {
    const ann = generalAnnotations.find(a => a.id === annotationId)
    if (!ann) return
    onEditFreeNote(annotationId, { body: ann.body, tag: ann.tag as HighlightTag | null, rubricItemId: criterionId })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface">
      {/* Fixed header: rubric tabs */}
      <div className="flex-shrink-0">
        <TabBar
          tabs={rubrics.map(r => ({
            id: r.id,
            label: r.title,
            badge: (
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
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <FreeNotesSection
          notes={freeNotes}
          criteria={criteriaOptions}
          onAddNote={onAddNote}
          onEditNote={handleEditNote}
          onMoveNote={handleMoveNote}
          onDeleteNote={onDeleteNote}
        />

        <UnlinkedHighlightsSection
          annotations={unlinkedHighlights}
          criteria={criteriaOptions}
          onGoTo={onGoToAnnotation}
          onEdit={onEditAnnotation}
          onDelete={onDeleteAnnotation}
          onLink={handleLinkHighlight}
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
                expandToAnnotationId={expandToAnnotationId}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ReviewRightPanel
