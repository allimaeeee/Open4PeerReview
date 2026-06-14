'use client'

import { useState, useEffect } from 'react'
import type { CriterionScore, HighlightTag } from '@/types'
import type { LocalScore } from './ReviewerConsole'
import type { RubricItem } from './ReviewerApp'
import { RatingBox } from './RatingBox'
import { AnnotationListCard } from './AnnotationListCard'
import { FreeNoteCard } from './FreeNoteCard'
import type { FreeNote } from './FreeNotesSection'

interface AnnotationSummary {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface CriterionCardProps {
  rubricItem: RubricItem
  score: LocalScore
  criterionIndex: number
  onScoreToggle: (rubricItemId: string, level: CriterionScore) => void
  onAddComment: (rubricItemId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onEditComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet', body: string) => void
  onDeleteComment: (rubricItemId: string, commentId: string, level: 'exceeds' | 'does_not_meet') => void
  onGoToAnnotation: (annotationId: string) => void
  onEditAnnotation: (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onDeleteAnnotation: (annotationId: string) => void
  expandToAnnotationId?: string | null
}

function TrendingUpIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12L6 8L9 11L14 5" />
      <path d="M10.5 5H14V8.5" />
    </svg>
  )
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5L6.5 12L13 4" />
    </svg>
  )
}

function TrendingDownIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4L6 8L9 5L14 11" />
      <path d="M10.5 11H14V7.5" />
    </svg>
  )
}

function BookmarkIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 1H12V14L8 11L4 14V1Z" />
    </svg>
  )
}

const STATUS_BADGE_DEFS = [
  {
    level: 'exceeds' as CriterionScore,
    label: 'EXC',
    Icon: TrendingUpIcon,
    activeClass: 'bg-rating-exceeds-bg text-rating-exceeds-text border border-rating-exceeds-border',
  },
  {
    level: 'exemplifies' as CriterionScore,
    label: 'EXE',
    Icon: CheckIcon,
    activeClass: 'bg-rating-exemplifies-bg text-rating-exemplifies-text border border-primary',
  },
  {
    level: 'does_not_meet' as CriterionScore,
    label: 'DNM',
    Icon: TrendingDownIcon,
    activeClass: 'bg-rating-dnm-bg text-rating-dnm-text border border-rating-dnm-border',
  },
]

export function CriterionCard({
  rubricItem,
  score,
  criterionIndex,
  onScoreToggle,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onGoToAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  expandToAnnotationId,
}: CriterionCardProps) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expandToAnnotationId) return
    if (score.annotations.some(a => a.id === expandToAnnotationId)) {
      setExpanded(true)
    }
  }, [expandToAnnotationId, score.annotations])
  const isRated = score.scores.length > 0

  return (
    <div className="rounded-lg border border-border bg-surface-card transition-colors">
      {/* Header — always visible */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Status circle */}
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            isRated
              ? 'border-secondary bg-secondary-container text-secondary'
              : 'border-border bg-transparent'
          }`}
        >
          {isRated && <CheckIcon size={12} />}
        </div>

        {/* Criterion ID + name */}
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          <span className="text-label-sm font-label font-semibold uppercase tracking-widest text-secondary">
            C{criterionIndex}
          </span>
          <span className="text-body-md font-heading font-semibold text-text-primary truncate">
            {rubricItem.label.replace(/^C\d+\s+/, '')}
          </span>
        </div>

        {/* Right side: evidence badge + status badges + chevron */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {/* Evidence count badge */}
          {score.annotations.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container/60 text-secondary text-label-sm font-label font-semibold">
              <BookmarkIcon size={12} />
              {score.annotations.length}
            </span>
          )}

          {/* Status badges — always visible */}
          <div className="flex gap-1">
            {STATUS_BADGE_DEFS.map(badge => {
              const isActive = score.scores.includes(badge.level)
              return (
                <span
                  key={badge.level}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-label-sm font-label font-semibold uppercase tracking-wide ${
                    isActive
                      ? badge.activeClass
                      : 'bg-transparent text-text-secondary/40 border border-border/40'
                  }`}
                >
                  <badge.Icon size={10} />
                  {badge.label}
                </span>
              )
            })}
          </div>

          {/* Expand chevron */}
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
              onActivate={() => { if (!score.scores.includes('exceeds')) onScoreToggle(rubricItem.id, 'exceeds') }}
              onDeactivate={() => { if (score.scores.includes('exceeds')) onScoreToggle(rubricItem.id, 'exceeds') }}
            />
            <RatingBox
              variant="exemplifies"
              isActive={score.scores.includes('exemplifies')}
              standardText={rubricItem.description ?? undefined}
              criterionLabel={`C${criterionIndex} · ${rubricItem.label.replace(/^C\d+\s+/, '')}`}
              onToggle={() => onScoreToggle(rubricItem.id, 'exemplifies')}
            />
            <RatingBox
              variant="does_not_meet"
              isActive={score.scores.includes('does_not_meet')}
              comments={score.niComments}
              onAddComment={(body) => onAddComment(rubricItem.id, 'does_not_meet', body)}
              onEditComment={(id, body) => onEditComment(rubricItem.id, id, 'does_not_meet', body)}
              onDeleteComment={(id) => onDeleteComment(rubricItem.id, id, 'does_not_meet')}
              onActivate={() => { if (!score.scores.includes('does_not_meet')) onScoreToggle(rubricItem.id, 'does_not_meet') }}
              onDeactivate={() => { if (score.scores.includes('does_not_meet')) onScoreToggle(rubricItem.id, 'does_not_meet') }}
            />
          </div>

          {score.annotations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
                Evidence ({score.annotations.length})
              </span>
              {(score.annotations as AnnotationSummary[]).map(ann => {
                const isFreeNote = Object.keys(ann.anchor).length === 0
                return (
                  <div key={ann.id} id={`annotation-card-${ann.id}`}>
                    {isFreeNote ? (
                      <FreeNoteCard
                        note={ann as unknown as FreeNote}
                        criteria={[]}
                        onEdit={onEditAnnotation}
                        onMove={() => {}}
                        onDelete={onDeleteAnnotation}
                        showMoveDropdown={false}
                      />
                    ) : (
                      <AnnotationListCard
                        annotation={ann}
                        onGoTo={onGoToAnnotation}
                        onEdit={onEditAnnotation}
                        onDelete={onDeleteAnnotation}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CriterionCard
