'use client'

import { useState } from 'react'
import type { CriterionScore, FeedbackResponseStatus, FeedbackTargetType } from '@/types'
import { EvidenceCard } from '@/components/ui/EvidenceCard'
import { AddressStatusControl } from '@/components/ui/AddressStatusControl'
import { AuthorCommentField } from '@/components/ui/AuthorCommentField'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RubricItem {
  id: string
  label: string
  description: string
  sort_order: number
}

interface ScoreComment {
  id: string
  rubric_item_id: string
  score_level: string
  body: string
}

interface AnnotationRecord {
  id: string
  rubric_item_id: string | null
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface CriterionReportCardProps {
  rubricItem: RubricItem
  criterionScores: CriterionScore[]
  scoreComments: ScoreComment[]
  annotations: AnnotationRecord[]
  index: number
  id?: string
  defaultExpanded?: boolean
  isOpen?: boolean
  onToggle?: () => void
  className?: string
  onGoToAnnotation?: (annotationId: string) => void
  goToLabel?: string
  annotationIndexMap?: Map<string, number>
  /** Author-only feedback status controls (on score comments + evidence). */
  showStatusControls?: boolean
  statusFor?: (targetType: FeedbackTargetType, targetId: string) => FeedbackResponseStatus | null
  onStatusChange?: (targetType: FeedbackTargetType, targetId: string, status: FeedbackResponseStatus | null) => void
  /** Author-only free-text comment boxes (on this criterion + each evidence annotation). */
  commentFor?: (targetType: FeedbackTargetType, targetId: string) => string
  onCommentChange?: (targetType: FeedbackTargetType, targetId: string, body: string) => void | Promise<void>
}

// ── Config ────────────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<CriterionScore, { label: string; bg: string; text: string; border: string }> = {
  does_not_meet: {
    label:  'Does Not Meet',
    bg:     'var(--color-rating-dnm-bg)',
    text:   'var(--color-rating-dnm-text)',
    border: 'var(--color-rating-dnm-border)',
  },
  exemplifies: {
    label:  'Exemplifies',
    bg:     'var(--color-rating-exemplifies-bg)',
    text:   'var(--color-rating-exemplifies-text)',
    border: 'transparent',
  },
  exceeds: {
    label:  'Exceeds',
    bg:     'var(--color-rating-exceeds-bg)',
    text:   'var(--color-rating-exceeds-text)',
    border: 'var(--color-rating-exceeds-border)',
  },
}

const POLARITY_CONFIG: Record<'does_not_meet' | 'exceeds' | 'exemplifies', { label: string; border: string; text: string }> = {
  does_not_meet: {
    label:  'Does Not Meet Standard',
    border: 'var(--color-rating-dnm-border)',
    text:   'var(--color-rating-dnm-text)',
  },
  exemplifies: {
    label:  'Exemplifies Standard',
    border: 'var(--color-brand-primary)',
    text:   'var(--color-rating-exemplifies-text)',
  },
  exceeds: {
    label:  'Exceeds Standard',
    border: 'var(--color-rating-exceeds-border)',
    text:   'var(--color-rating-exceeds-text)',
  },
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GlobeIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12" />
      <path d="M8 2a9.6 9.6 0 0 1 2.5 6A9.6 9.6 0 0 1 8 14 9.6 9.6 0 0 1 5.5 8 9.6 9.6 0 0 1 8 2z" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDescription(text: string): string[] {
  const byNewline = text.split(/\n+/).map(s => s.trim()).filter(Boolean)
  if (byNewline.length > 1) return byNewline
  const byNumber = text.split(/\s+(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean)
  return byNumber.length > 1 ? byNumber : byNewline
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreCommentBlock({
  comments,
  level,
  showStatusControls,
  statusFor,
  onStatusChange,
}: {
  comments: ScoreComment[]
  level: 'does_not_meet' | 'exceeds' | 'exemplifies'
  showStatusControls?: boolean
  statusFor?: (targetType: FeedbackTargetType, targetId: string) => FeedbackResponseStatus | null
  onStatusChange?: (targetType: FeedbackTargetType, targetId: string, status: FeedbackResponseStatus | null) => void
}) {
  const cfg = POLARITY_CONFIG[level]
  return (
    <div>
      <span
        className="block text-label-sm font-label font-semibold mb-2"
        style={{ color: cfg.text }}
      >
        {cfg.label}
      </span>
      <div className="flex flex-col gap-2">
        {comments.map(comment => (
          <div key={comment.id} className="flex flex-col gap-1.5">
            <blockquote
              className="pl-3 text-body-sm text-[var(--color-text-secondary)] leading-relaxed break-words hyphens-auto"
              style={{ borderLeft: `2px solid ${cfg.border}` }}
            >
              {comment.body}
            </blockquote>
            {showStatusControls && onStatusChange && (
              <div className="pl-3">
                <AddressStatusControl
                  status={statusFor?.('score_comment', comment.id) ?? null}
                  onChange={s => onStatusChange('score_comment', comment.id, s)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CriterionReportCard ───────────────────────────────────────────────────────

export function CriterionReportCard({
  rubricItem,
  criterionScores,
  scoreComments,
  annotations,
  index,
  id,
  defaultExpanded = false,
  isOpen: isOpenProp,
  onToggle,
  className,
  onGoToAnnotation,
  goToLabel,
  annotationIndexMap,
  showStatusControls,
  statusFor,
  onStatusChange,
  commentFor,
  onCommentChange,
}: CriterionReportCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultExpanded)
  const isControlled = isOpenProp !== undefined
  const open = isControlled ? isOpenProp : internalOpen

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.()
    } else {
      setInternalOpen(prev => !prev)
    }
  }

  const SCORE_ORDER: CriterionScore[] = ['exceeds', 'exemplifies', 'does_not_meet']
  const uniqueScores = SCORE_ORDER.filter(s => criterionScores.includes(s))
  const dnmComments         = scoreComments.filter(c => c.score_level === 'does_not_meet')
  const exemplifiesComments = scoreComments.filter(c => c.score_level === 'exemplifies')
  const exceedsComments     = scoreComments.filter(c => c.score_level === 'exceeds')
  const hasComments         = scoreComments.length > 0

  // Required-comment indicator: any annotation or score comment marked Addressed means
  // the author should leave a public revision comment on this criterion.
  const hasAddressed = !!(showStatusControls && statusFor && (
    scoreComments.some(c => statusFor('score_comment', c.id) === 'addressed') ||
    annotations.some(a => statusFor('annotation', a.id) === 'addressed')
  ))
  const criterionComment = commentFor?.('criterion', rubricItem.id) ?? ''
  const commentRequired = hasAddressed
  const commentFilled = criterionComment.trim().length > 0

  return (
    <div
      id={id}
      data-criterion-card
      className={cx(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] shadow-[var(--shadow-1)] overflow-hidden',
        className
      )}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={handleToggle}
      >
        {/* Left: criterion number + label */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-label-sm font-label font-semibold uppercase tracking-widest text-secondary">
            C{index}
          </span>
          <span className="text-body-md font-heading font-semibold text-text-primary truncate">
            {rubricItem.label.replace(/^C\d+\s+/, '')}
          </span>
        </div>

        {/* Right: rating badges + chevron */}
        <div className="flex items-center flex-wrap gap-2 shrink-0 justify-end">
          {uniqueScores.map(score => {
            const cfg = RATING_CONFIG[score]
            return (
              <span
                key={score}
                className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label font-semibold border"
                style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}
              >
                {cfg.label}
              </span>
            )
          })}
          <svg
            data-collapse-toggle
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={cx(
              'w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200',
              open && 'rotate-180'
            )}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* ── Body (collapsible) ── */}
      <div
        data-criterion-body
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--color-border)] px-5 pb-5 flex flex-col gap-6">

            {/* Section 1 — Standard */}
            <div className="pt-5">
              <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                Standard
              </span>
              <div className="flex flex-col gap-1">
                {formatDescription(rubricItem.description).map((line, i) => (
                  <p key={i} className="text-body-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Section 2 — Reviewer Comments */}
            {hasComments && (
              <div>
                <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">
                  Reviewer Comments
                </span>
                <div className="flex flex-col gap-4">
                  {exceedsComments.length > 0 && (
                    <ScoreCommentBlock comments={exceedsComments} level="exceeds" showStatusControls={false} statusFor={statusFor} onStatusChange={onStatusChange} />
                  )}
                  {exemplifiesComments.length > 0 && (
                    <ScoreCommentBlock comments={exemplifiesComments} level="exemplifies" showStatusControls={false} statusFor={statusFor} onStatusChange={onStatusChange} />
                  )}
                  {dnmComments.length > 0 && (
                    <ScoreCommentBlock comments={dnmComments} level="does_not_meet" showStatusControls={showStatusControls} statusFor={statusFor} onStatusChange={onStatusChange} />
                  )}
                </div>
              </div>
            )}

            {/* Section 3 — Evidence */}
            {annotations.length > 0 && (
              <div>
                <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">
                  Evidence
                </span>
                <div className="flex flex-col gap-2">
                  {annotations.map(annotation => (
                    <EvidenceCard
                      key={annotation.id}
                      annotation={annotation}
                      onGoToAnnotation={
                        onGoToAnnotation ? () => onGoToAnnotation(annotation.id) : undefined
                      }
                      goToLabel={goToLabel}
                      screenshotNumber={annotationIndexMap?.get(annotation.id)}
                      showStatusControl={showStatusControls}
                      status={statusFor?.('annotation', annotation.id) ?? null}
                      onStatusChange={
                        onStatusChange ? s => onStatusChange('annotation', annotation.id, s) : undefined
                      }
                      showComment={showStatusControls}
                      comment={commentFor?.('annotation', annotation.id) ?? ''}
                      onCommentChange={
                        onCommentChange ? body => onCommentChange('annotation', annotation.id, body) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
          {/* Section 4 — Criterion Revision Comment (full-width, outside the padded flex container) */}
          {showStatusControls && onCommentChange && (
            <div data-print-hide>
              <hr className="border-[var(--color-border)]" />
              <div className="px-5 pt-4 pb-5 bg-[var(--color-surface-container-low)]">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="block text-body-md font-heading font-semibold text-text-primary">
                      Criterion Revision Comment
                    </span>
                    {commentRequired && (
                      commentFilled ? (
                        <span className="text-label-sm font-label font-semibold px-1.5 py-0.5 rounded bg-[var(--color-success-container)] text-[var(--color-success)]">
                          Added
                        </span>
                      ) : (
                        <span className="text-label-sm font-label font-semibold px-1.5 py-0.5 rounded bg-[var(--color-error-container)] text-[var(--color-error)]">
                          Required
                        </span>
                      )
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-label text-[var(--color-text-muted)] bg-[var(--color-surface-card)] border border-[var(--color-border)]">
                    <GlobeIcon />
                    Public once published
                  </span>
                </div>
                <p className="text-body-sm text-[var(--color-text-muted)] mb-3">
                  Describe the revisions you made for this criterion — visible on the public page once published.
                </p>
                <AuthorCommentField
                  label=""
                  placeholder="Add a public response to this criterion's feedback…"
                  value={criterionComment}
                  onSave={body => onCommentChange('criterion', rubricItem.id, body)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
