'use client'

import type { CriterionScore } from '@/types'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CriterionSummaryItem {
  id: string
  label: string
  scores: CriterionScore[]
  evidenceCount: number
}

interface ReviewSummaryPanelProps {
  items: CriterionSummaryItem[]
  onCriterionClick: (id: string) => void
  className?: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const SCORE_ORDER: CriterionScore[] = ['exceeds', 'exemplifies', 'does_not_meet']

const BADGE_CONFIG: Record<CriterionScore, { label: string; bg: string; text: string; border: string }> = {
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

// ── ReviewSummaryPanel ────────────────────────────────────────────────────────

export function ReviewSummaryPanel({ items, onCriterionClick, className }: ReviewSummaryPanelProps) {
  const allScores = items.flatMap(item => item.scores)
  const exceedsCount     = allScores.filter(s => s === 'exceeds').length
  const exemplifiesCount = allScores.filter(s => s === 'exemplifies').length
  const dnmCount         = allScores.filter(s => s === 'does_not_meet').length

  return (
    <div className={cx('flex flex-col gap-3', className)}>

      {/* ── Counts row — outside the card ── */}
      <p className="flex items-center gap-2 flex-wrap text-label-sm font-label font-semibold uppercase tracking-wide">
        <span style={{ color: 'var(--color-rating-exceeds-text)' }}>
          {exceedsCount} {exceedsCount === 1 ? 'exceeds' : 'exceed'} standard
        </span>
        <span className="text-[var(--color-text-muted)]">·</span>
        <span style={{ color: 'var(--color-primary)' }}>
          {exemplifiesCount} {exemplifiesCount === 1 ? 'exemplifies' : 'exemplify'} standard
        </span>
        <span className="text-[var(--color-text-muted)]">·</span>
        <span style={{ color: 'var(--color-rating-dnm-text)' }}>
          {dnmCount} {dnmCount === 1 ? 'does not meet' : 'do not meet'} standard
        </span>
      </p>

      {/* ── Contents heading — outside the card ── */}
      <h2 className="font-heading text-heading-sm text-[var(--color-text-primary)]">
        Review Summary
      </h2>

      {/* ── Criterion rows ── */}
      <div>
        {items.map((item, i) => {
          const uniqueScores = SCORE_ORDER.filter(s => item.scores.includes(s))
          return (
            <div
              key={item.id}
              onClick={() => onCriterionClick(item.id)}
              className={cx(
                'flex items-center gap-3 px-1 py-3 cursor-pointer transition-colors rounded-md',
                'hover:bg-[var(--color-surface-container-low)]',
                i > 0 && 'border-t border-[var(--color-border)]'
              )}
            >
              {/* Criterion label */}
              <span className="text-body-sm text-[var(--color-text-primary)] flex-1 min-w-0 truncate">
                {item.label}
              </span>

              {/* Evidence count pill + rating badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                {item.evidenceCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-label font-semibold bg-[var(--color-surface-container-high)] text-[var(--color-text-muted)]">
                    <svg width={10} height={10} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M4 1H12V14L8 11L4 14V1Z" />
                    </svg>
                    {item.evidenceCount}
                  </span>
                )}
                {uniqueScores.map(score => {
                  const cfg = BADGE_CONFIG[score]
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
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
