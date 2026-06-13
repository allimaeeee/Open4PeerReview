'use client'

import { useMemo, useState } from 'react'
import { TabBar } from '@/components/ui/TabBar'
import { CriterionCard } from './CriterionCard'
import { FreeNotesSection } from './FreeNotesSection'
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
}: ReviewRightPanelProps) {
  const rubrics = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; title: string }[] = []
    for (const item of rubricItems) {
      if (!seen.has(item.rubric_id)) {
        seen.add(item.rubric_id)
        result.push({ id: item.rubric_id, title: item.rubric_title ?? item.rubric_id })
      }
    }
    return result
  }, [rubricItems])

  const activeRubricItems = useMemo(
    () => rubricItems.filter(item => item.rubric_id === activeRubricId),
    [rubricItems, activeRubricId]
  )

  const criteriaOptions: CriterionOption[] = useMemo(
    () => activeRubricItems.map((item, i) => ({ id: item.id, label: `C${i + 1} ${item.label}` })),
    [activeRubricItems]
  )

  const [isAddingNote, setIsAddingNote] = useState(false)

  function handleEditNote(noteId: string, changes: { body: string; tag: HighlightTag | null }) {
    onEditFreeNote(noteId, { body: changes.body, tag: changes.tag, rubricItemId: null })
  }

  function handleMoveNote(noteId: string, rubricItemId: string) {
    const note = generalAnnotations.find(n => n.id === noteId)
    if (!note) return
    onEditFreeNote(noteId, { body: note.body, tag: note.tag as HighlightTag | null, rubricItemId })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed header: rubric tabs */}
      <div className="flex-shrink-0">
        <TabBar
          tabs={rubrics.map(r => ({ id: r.id, label: r.title }))}
          activeId={activeRubricId ?? ''}
          onChange={onActiveRubricChange}
          rightSlot={
            <button
              type="button"
              onClick={() => setIsAddingNote(v => !v)}
              className={[
                'flex items-center gap-1.5 text-label-sm font-label font-semibold whitespace-nowrap px-3 py-1.5 rounded-md transition-colors',
                isAddingNote
                  ? 'bg-surface-container text-text-secondary'
                  : 'bg-primary text-on-primary hover:bg-primary-hover',
              ].join(' ')}
            >
              {isAddingNote ? 'Free note' : '+ Free note'}
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                {isAddingNote
                  ? <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  : <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                }
              </svg>
            </button>
          }
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <FreeNotesSection
          notes={generalAnnotations}
          criteria={criteriaOptions}
          isAdding={isAddingNote}
          onAddingChange={setIsAddingNote}
          onAddNote={onAddNote}
          onEditNote={handleEditNote}
          onMoveNote={handleMoveNote}
          onDeleteNote={onDeleteNote}
        />

        <div className="flex flex-col gap-2 p-4">
          {activeRubricItems.map((item, index) => {
            const score = scores[item.id]
            if (!score) return null
            return (
              <CriterionCard
                key={item.id}
                rubricItem={item}
                score={score}
                onScoreToggle={onScoreToggle}
                onAddComment={onAddComment}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onGoToAnnotation={onGoToAnnotation}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ReviewRightPanel
