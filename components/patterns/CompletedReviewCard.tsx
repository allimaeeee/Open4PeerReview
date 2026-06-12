import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { RubricTagList } from '@/components/ui/RubricTagList'

export interface CompletedReviewCardProps {
  id: string
  title: string
  platform: string
  authorName: string
  discipline: string
  rubrics: { rubricId: string; rubricTitle: string }[]
  completedAt: string
  reviewUrl: string
}

export function CompletedReviewCard({
  title,
  platform,
  authorName,
  discipline,
  rubrics,
  completedAt,
  reviewUrl,
}: CompletedReviewCardProps) {
  const formattedDate = new Date(completedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Card>
      <div className="p-5 flex items-start justify-between gap-4">

        {/* Left column */}
        <div className="flex-1 min-w-0">

          {/* Row 1: status badge */}
          <div className="flex items-center gap-2">
            <StatusBadge variant="completed" />
          </div>

          {/* Row 2: title */}
          <h2 className="font-heading text-title-lg text-text-primary leading-snug mt-3 truncate">
            {title}
          </h2>

          {/* Row 3: metadata */}
          <div className="flex items-center gap-4 mt-2 text-body-sm text-text-secondary flex-wrap">
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 7a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0" />
              </svg>
              {authorName}
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
                <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5v5M14 2L7 9" />
              </svg>
              {platform}
            </span>
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="12" height="10" rx="1" />
                <path d="M2 8h12M6 2v4M10 2v4" />
              </svg>
              Completed: {formattedDate}
            </span>
          </div>

          {/* Row 4: rubric tags */}
          <RubricTagList rubrics={rubrics} variant="filled" className="mt-2" />

        </div>

        {/* Right column */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <Link
            href={reviewUrl}
            className="inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--transition-duration-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md font-semibold bg-primary text-on-primary shadow-1 hover:bg-primary-hover hover:shadow-2 active:scale-[0.99] px-3 py-1.5 text-label-md"
          >
            View Submitted Review
          </Link>
        </div>

      </div>
    </Card>
  )
}
