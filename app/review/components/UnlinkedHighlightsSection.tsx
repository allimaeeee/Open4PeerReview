'use client'

import { useState } from 'react'
import type { HighlightTag } from '@/types'
import { AnnotationListCard } from './AnnotationListCard'
import type { CriterionOption } from './FreeNotesSection'

interface AnnotationSummary {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface UnlinkedHighlightsSectionProps {
  annotations: AnnotationSummary[]
  criteria: CriterionOption[]
  onGoTo: (annotationId: string) => void
  onEdit: (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onDelete: (annotationId: string) => void
  onLink: (annotationId: string, criterionId: string) => void
}

export function UnlinkedHighlightsSection({
  annotations,
  criteria,
  onGoTo,
  onEdit,
  onDelete,
  onLink,
}: UnlinkedHighlightsSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const isEmpty = annotations.length === 0

  return (
    <div className="mx-4 mt-4 rounded-lg border border-border border-l-[3px] border-l-secondary bg-surface-card">
      {/* Collapsible header */}
      <div
        className={`flex items-center gap-2 px-4 py-3 select-none${isEmpty ? '' : ' cursor-pointer'}`}
        onClick={() => { if (!isEmpty) setExpanded(v => !v) }}
      >
        <div className="flex-1 flex items-baseline gap-2">
          <span className="text-body-md font-heading font-semibold text-text-primary">Unlinked highlights</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-container/60 text-secondary text-label-sm font-label font-semibold">
            {annotations.length}
          </span>
        </div>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`w-4 h-4 transition-transform duration-[var(--transition-duration-base)]${isEmpty ? ' text-border' : ' text-text-muted'}${expanded ? ' rotate-180' : ''}`}
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

      {expanded && !isEmpty && (
        <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3">
          {annotations.map(ann => (
            <div key={ann.id} id={`annotation-card-${ann.id}`}>
              <AnnotationListCard
                annotation={ann}
                onGoTo={onGoTo}
                onEdit={onEdit}
                onDelete={onDelete}
                showCriterionLink
                criteria={criteria}
                onLink={onLink}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default UnlinkedHighlightsSection
