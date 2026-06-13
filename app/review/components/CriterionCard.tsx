'use client'

import { useState } from 'react'
import type { CriterionScore } from '@/types'
import type { LocalScore } from './ReviewerConsole'
import type { RubricItem } from './ReviewerApp'
import { RatingBox } from './RatingBox'
import { AnnotationListCard } from './AnnotationListCard'

interface AnnotationSummary {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface CriterionCardProps {
  rubricItem: RubricItem
  score: LocalScore
  index: number
  onScoreToggle: (rubricItemId: string, level: CriterionScore) => void
  onAddComment: (rubricItemId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onEditComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onDeleteComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet') => void
  onGoToAnnotation: (annotationId: string) => void
}

const SCORE_LABELS: Record<CriterionScore, string> = {
  exceeds:      'Exc',
  exemplifies:  'Expl',
  does_not_meet: 'DNM',
}

const SCORE_PILL_CLASSES: Record<CriterionScore, string> = {
  exceeds:      'bg-rating-exceeds-bg text-rating-exceeds-text border-rating-exceeds-border',
  exemplifies:  'bg-rating-exemplifies-bg text-rating-exemplifies-text border-transparent',
  does_not_meet: 'bg-rating-dnm-bg text-rating-dnm-text border-rating-dnm-border',
}

export function CriterionCard({
  rubricItem,
  score,
  index,
  onScoreToggle,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onGoToAnnotation,
}: CriterionCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-surface-card transition-colors">
      {/* Collapsed header — always visible */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 flex items-center gap-2">
          <span className="text-body-sm font-semibold text-text-primary">
            C{index} {rubricItem.label}
          </span>
          {score.annotations.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-container text-label-sm text-text-secondary">
              {score.annotations.length}
            </span>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {score.scores.map(level => (
            <span
              key={level}
              className={`px-2 py-0.5 rounded-full text-label-sm border ${SCORE_PILL_CLASSES[level]}`}
            >
              {SCORE_LABELS[level]}
            </span>
          ))}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`w-4 h-4 text-text-muted transition-transform duration-[var(--transition-duration-base)]${expanded ? ' rotate-180' : ''}`}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-4">
          <div className="flex gap-3">
            <RatingBox
              variant="exceeds"
              isActive={score.scores.includes('exceeds')}
              comments={score.exceedsComments}
              onAddComment={(body) => onAddComment(rubricItem.id, 'exceeds', body)}
              onEditComment={(id, body) => onEditComment(rubricItem.id, id, 'exceeds', body)}
              onDeleteComment={(id) => onDeleteComment(rubricItem.id, id, 'exceeds')}
            />
            <RatingBox
              variant="exemplifies"
              isActive={score.scores.includes('exemplifies')}
              standardText={rubricItem.description ?? undefined}
              onToggle={() => onScoreToggle(rubricItem.id, 'exemplifies')}
            />
            <RatingBox
              variant="does_not_meet"
              isActive={score.scores.includes('does_not_meet')}
              comments={score.niComments}
              onAddComment={(body) => onAddComment(rubricItem.id, 'does_not_meet', body)}
              onEditComment={(id, body) => onEditComment(rubricItem.id, id, 'does_not_meet', body)}
              onDeleteComment={(id) => onDeleteComment(rubricItem.id, id, 'does_not_meet')}
            />
          </div>

          {score.annotations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
                Annotations ({score.annotations.length})
              </span>
              {(score.annotations as AnnotationSummary[]).map(ann => (
                <AnnotationListCard
                  key={ann.id}
                  annotation={ann}
                  onGoTo={onGoToAnnotation}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CriterionCard
