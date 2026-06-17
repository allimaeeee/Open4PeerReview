'use client'

import { useState } from 'react'
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
  rubrics,
  completedAt,
  reviewUrl,
}: CompletedReviewCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const formattedDate = new Date(completedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Card>
      {/* Header — always visible, clickable to toggle */}
      <div
        className="p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
        onClick={() => setIsOpen(prev => !prev)}
      >
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

        {/* Right column: chevron */}
        <div className="shrink-0 flex flex-col items-end">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200${isOpen ? ' rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Expandable body */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--color-border)] px-5 pb-5">
            {rubrics.map(r => (
              <div
                key={r.rubricId}
                className="flex items-center justify-between gap-4 py-3 border-b border-[var(--color-border)] last:border-b-0"
              >
                <span className="text-body-md text-text-primary font-medium">
                  {r.rubricTitle}
                </span>
                <Link
                  href={reviewUrl}
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--transition-duration-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md font-semibold bg-primary text-on-primary shadow-1 hover:bg-primary-hover hover:shadow-2 active:scale-[0.99] px-3 py-1.5 text-label-md"
                >
                  View Submitted Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
