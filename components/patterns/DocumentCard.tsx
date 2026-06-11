import { Accordion } from '@/components/ui/Accordion'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Button } from '@/components/ui/Button'

export interface RubricReview {
  rubricId: string
  rubricTitle: string
  status: 'unassigned' | 'assigned' | 'under-review' | 'feedback-ready' | 'certified'
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
}

const PRIORITY_ORDER: RubricReview['status'][] = [
  'feedback-ready',
  'under-review',
  'assigned',
  'unassigned',
]

const PIPELINE_STEPS = ['Unassigned', 'Assigned', 'Under Review', 'Feedback Ready', 'Certified']

const STATUS_TO_STEP: Record<RubricReview['status'], number> = {
  'unassigned':     1,
  'assigned':       2,
  'under-review':   3,
  'feedback-ready': 4,
  'certified':      5,
}

export function DocumentCard({
  title,
  platform,
  authors,
  discipline,
  ccLicense,
  description,
  submittedAt,
  rubrics,
}: DocumentCardProps) {
  const allCertified = rubrics.length > 0 && rubrics.every(r => r.status === 'certified')

  const priorityStatus: RubricReview['status'] = allCertified
    ? 'certified'
    : PRIORITY_ORDER.find(s => rubrics.some(r => r.status === s)) ?? 'unassigned'

  const otherCount = rubrics.filter(r => r.status !== priorityStatus).length

  const trigger = (
    <div className="flex items-start justify-between gap-4 w-full">

      {/* Left column */}
      <div className="flex-1 min-w-0">

        {/* Row 1: status badge + count hint */}
        <div className="flex items-center gap-2">
          <StatusBadge variant={priorityStatus} />
          {otherCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-[var(--color-surface-container-high)] text-[var(--color-text-muted)] text-label-sm font-label font-medium uppercase tracking-widest">
              +{otherCount} others
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

      {/* Right column — only shown when allCertified */}
      {allCertified && (
        <div className="shrink-0">
          <Button
            variant="secondary"
            size="md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            Download Stamp
          </Button>
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
                <Button variant="secondary" size="sm">
                  View Feedback
                </Button>
              )}
            </div>

            <StepIndicator
              steps={PIPELINE_STEPS}
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

      </div>

    </Accordion>
  )
}
