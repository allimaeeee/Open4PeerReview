'use client'

import { useState } from 'react'
import type { CriterionScore } from '@/types'
import { EvidenceCard } from '@/components/ui/EvidenceCard'

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

const POLARITY_CONFIG: Record<'does_not_meet' | 'exceeds', { label: string; border: string; text: string }> = {
  does_not_meet: {
    label:  'Does Not Meet Standard',
    border: 'var(--color-rating-dnm-border)',
    text:   'var(--color-rating-dnm-text)',
  },
  exceeds: {
    label:  'Exceeds Standard',
    border: 'var(--color-rating-exceeds-border)',
    text:   'var(--color-rating-exceeds-text)',
  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreCommentBlock({
  comments,
  level,
}: {
  comments: ScoreComment[]
  level: 'does_not_meet' | 'exceeds'
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
          <blockquote
            key={comment.id}
            className="pl-3 text-body-sm text-[var(--color-text-secondary)] leading-relaxed"
            style={{ borderLeft: `2px solid ${cfg.border}` }}
          >
            {comment.body}
          </blockquote>
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
  const dnmComments    = scoreComments.filter(c => c.score_level === 'does_not_meet')
  const exceedsComments = scoreComments.filter(c => c.score_level === 'exceeds')
  const hasComments    = scoreComments.length > 0
  const bothPolarities = dnmComments.length > 0 && exceedsComments.length > 0

  return (
    <div
      id={id}
      data-criterion-card
      className={cx(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] shadow-[var(--shadow-1)]',
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
            {rubricItem.label}
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
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Standard
                </span>
                <span
                  title="This describes what 'Exemplifies Established Standards of Quality' looks like for this criterion."
                  aria-label="About this criterion"
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] font-bold leading-none cursor-help text-[var(--color-text-muted)] border border-[var(--color-border)]"
                >
                  i
                </span>
              </div>
              <p className="text-body-sm text-[var(--color-text-secondary)] leading-relaxed">
                {rubricItem.description}
              </p>
            </div>

            {/* Section 2 — Reviewer Comments */}
            {hasComments && (
              <div>
                <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">
                  Reviewer Comments
                </span>
                {bothPolarities ? (
                  <div className="grid grid-cols-2 gap-4">
                    <ScoreCommentBlock comments={exceedsComments} level="exceeds" />
                    <ScoreCommentBlock comments={dnmComments} level="does_not_meet" />
                  </div>
                ) : (
                  <ScoreCommentBlock
                    comments={dnmComments.length > 0 ? dnmComments : exceedsComments}
                    level={dnmComments.length > 0 ? 'does_not_meet' : 'exceeds'}
                  />
                )}
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
                    <EvidenceCard key={annotation.id} annotation={annotation} />
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
