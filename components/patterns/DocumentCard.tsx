import Link from 'next/link'
import { Accordion } from '@/components/ui/Accordion'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Button } from '@/components/ui/Button'
import type { ReportStatus } from '@/types'

export interface RubricReview {
  rubricId: string
  rubricTitle: string
  status: 'unassigned' | 'assigned' | 'under-review' | 'review-submitted' | 'feedback-ready' | 'published'
}

export interface DocumentCardProps {
  id: string
  title: string
  platform: string
  authors: string
  discipline: string
  ccLicense: string
  description: string
  submittedAt: string
  rubrics: RubricReview[]
  /** Author's publish/revise/private decision on the released report. */
  reportStatus?: ReportStatus | null
  /** True once every rubric has been reviewed and released to the author. */
  reportReady?: boolean
  /** Whether this document is on the public-review track (affects pipeline step labels). */
  publicReview?: boolean
  onDelete?: () => void
  deleteDisabled?: boolean
}

// Badge shown for author report decisions not already covered by pipeline status badges.
// 'published'         → pipeline already shows 'Published' per-rubric when report_status='published' — removed here.
// 'ready to publish'  → pipeline already shows 'Feedback Ready' per-rubric when reportReady is true — removed here.
// 'private'           → kept: on public-track submissions it conveys distinct info from the Public/Private pill.
// 'revising'          → kept: no pipeline-status equivalent for this author action.
function reportBadgeFor(reportStatus: ReportStatus | null | undefined) {
  if (reportStatus === 'private')  return { label: 'Private',     bg: 'var(--color-status-draft-bg)',        text: 'var(--color-status-draft-text)' }
  if (reportStatus === 'revising') return { label: 'In Revision', bg: 'var(--color-status-in-progress-bg)', text: 'var(--color-status-in-progress-text)' }
  return null
}

const PRIORITY_ORDER: RubricReview['status'][] = [
  'published',
  'feedback-ready',
  'review-submitted',
  'under-review',
  'assigned',
  'unassigned',
]

const PIPELINE_STEPS_PRIVATE = ['Unassigned', 'Assigned', 'Under Review', 'Review Submitted', 'Feedback Ready']
const PIPELINE_STEPS_PUBLIC  = ['Unassigned', 'Assigned', 'Under Review', 'Review Submitted', 'Feedback Ready', 'Published']

const STATUS_TO_STEP: Record<RubricReview['status'], number> = {
  'unassigned':        1,
  'assigned':          2,
  'under-review':      3,
  'review-submitted':  4,
  'feedback-ready':    5,
  'published':         6,
}

export function DocumentCard({
  id,
  title,
  platform,
  authors,
  discipline,
  ccLicense,
  description,
  submittedAt,
  rubrics,
  reportStatus,
  reportReady,
  publicReview,
  onDelete,
  deleteDisabled,
}: DocumentCardProps) {
  const reportBadge = publicReview ? reportBadgeFor(reportStatus) : null
  const canViewReport = reportReady || reportStatus != null

  const distinctStatuses = PRIORITY_ORDER.filter(s => rubrics.some(r => r.status === s))
  const shownStatuses = distinctStatuses.slice(0, 3)
  const hiddenRubricCount = rubrics.filter(r => !shownStatuses.includes(r.status)).length

  const trigger = (
    <div className="flex items-start justify-between gap-4 w-full">

      {/* Left column */}
      <div className="flex-1 min-w-0">

        {/* Row 1: public/private pill + status badges + report badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={publicReview
            ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-none bg-[var(--color-primary)] text-[var(--color-on-primary)] text-label-sm font-label font-semibold uppercase tracking-widest"
            : "inline-flex items-center gap-1 px-2 py-0.5 rounded-none border border-[var(--color-status-unassigned-text)] bg-[var(--color-surface-card)] text-[var(--color-status-unassigned-text)] text-label-sm font-label font-semibold uppercase tracking-widest"
          }>
            {publicReview ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 2a8.5 8.5 0 010 12M8 2a8.5 8.5 0 000 12M2 8h12"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                <rect x="3" y="8" width="10" height="7" rx="1"/>
                <path d="M5 8V5a3 3 0 016 0v3"/>
              </svg>
            )}
            {publicReview ? 'Public' : 'Private'}
          </span>
          {shownStatuses.map(s => <StatusBadge key={s} variant={s} />)}
          {hiddenRubricCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-[var(--color-surface-container-high)] text-[var(--color-text-muted)] text-label-sm font-label font-medium uppercase tracking-widest">
              +{hiddenRubricCount} others
            </span>
          )}
          {reportBadge && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-sm text-label-sm font-label font-semibold uppercase tracking-widest"
              style={{ backgroundColor: reportBadge.bg, color: reportBadge.text }}
            >
              {reportBadge.label}
            </span>
          )}
        </div>

        {/* Row 2: title */}
        <h2 className="font-heading text-title-lg text-text-primary leading-snug mt-3 truncate">
          {title}
        </h2>

        {/* Row 3: platform + date */}
        <div className="flex items-center gap-4 mt-2 text-body-sm text-text-secondary flex-wrap">
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5v5M14 2L7 9" />
            </svg>
            {platform}
          </span>
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="12" height="10" rx="1" />
              <path d="M2 8h12M6 2v4M10 2v4" />
            </svg>
            Submitted: {new Date(submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

      </div>

      {/* Right column — report entry point */}
      {canViewReport && (
        <div className="shrink-0 flex items-center gap-2">
          <Link
            href={`/author/feedback/${id}?from=author&view=report`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--transition-duration-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md border border-primary bg-primary text-on-primary hover:bg-[var(--color-primary-hover)] px-4 py-2 text-sm"
          >
            {reportStatus ? 'Manage report' : 'View report'}
          </Link>
        </div>
      )}

    </div>
  )

  return (
    <Accordion trigger={trigger}>

      {/* Section 1 — Rubric rows */}
      <div className="-mb-3">
        {rubrics.map(rubric => (
          <div
            key={rubric.rubricId}
            className="flex items-center justify-between gap-4 py-3 border-t border-[var(--color-border)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-body-md text-text-primary font-medium shrink-0">
                {rubric.rubricTitle}
              </span>
              {rubric.status === 'feedback-ready' && (
                <Link
                  href={`/author/feedback/${id}?from=author&view=report&rubric=${rubric.rubricId}`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  className="inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--transition-duration-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md border border-border bg-surface-card text-text-secondary hover:bg-surface-container hover:border-border-strong px-3 py-1.5 text-xs"
                >
                  View Feedback
                </Link>
              )}
            </div>

            <StepIndicator
              steps={publicReview ? PIPELINE_STEPS_PUBLIC : PIPELINE_STEPS_PRIVATE}
              currentStep={STATUS_TO_STEP[rubric.status]}
              size="compact-labeled"
            />
          </div>
        ))}
      </div>

      {/* Section 2 — Metadata + description */}
      <div className="border-t border-[var(--color-border)] mt-3 pt-3">

        <div className="flex items-center gap-4 flex-wrap text-body-sm text-text-secondary">

          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 7a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0" />
            </svg>
            {authors}
          </span>

          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 010 1.414l-4.586 4.586a1 1 0 01-1.414 0L3 8.414A2 2 0 012 7V4z" />
              <circle cx="5.5" cy="5.5" r="0.75" fill="currentColor" />
            </svg>
            {discipline}
          </span>

          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M9.5 6.5a2 2 0 100 3" />
            </svg>
            {ccLicense}
          </span>

        </div>

        <p className="mt-2 text-body-sm text-text-secondary line-clamp-3">
          {description}
        </p>

        {(onDelete || deleteDisabled) && (
          <div className="flex justify-end mt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={deleteDisabled}
            >
              Delete submission
            </Button>
          </div>
        )}

      </div>

    </Accordion>
  )
}
