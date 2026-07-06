'use client'

import { useState } from 'react'
import type { HighlightTag } from '@/types'
import { AnnotationListCard } from '@/app/review/components/AnnotationListCard'

function cx(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

interface AnnotationSummary {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface CriterionOption {
  id: string
  label: string
}

interface UnlinkedAnnotationsCardProps {
  annotations: AnnotationSummary[]
  criterionOptions: CriterionOption[]
  onLink: (annotationId: string, criterionId: string) => void
  onGoToAnnotation: (annotationId: string) => void
  onEdit: (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onDelete: (annotationId: string) => void
  isReadOnly?: boolean
  goToLabel?: string
  annotationIndexMap?: Map<string, number>
}

export function UnlinkedAnnotationsCard({
  annotations,
  criterionOptions,
  onLink,
  onGoToAnnotation,
  onEdit,
  onDelete,
  isReadOnly = false,
  goToLabel,
  annotationIndexMap,
}: UnlinkedAnnotationsCardProps) {
  const [expanded, setExpanded] = useState(true)

  const isEmpty = annotations.length === 0

  return (
    <div className="mx-4 mt-4 rounded-lg border border-border border-l-[3px] border-l-secondary bg-surface-card">
      {/* Collapsible header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 flex items-baseline gap-2">
          <span className="text-body-md font-heading font-semibold text-text-primary">Unlinked Annotations</span>
          <span className={cx(
            'inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label font-semibold',
            isEmpty
              ? 'bg-surface-container text-text-muted'
              : 'bg-secondary-container/60 text-secondary'
          )}>
            {annotations.length}
          </span>
        </div>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`w-4 h-4 text-text-muted transition-transform duration-[var(--transition-duration-base)]${expanded ? ' rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-2">
          {isEmpty ? (
            <p className="text-body-sm text-text-muted italic">All annotations have been linked to a criterion</p>
          ) : (
            annotations.map(ann => (
              <div key={ann.id} id={`annotation-card-${ann.id}`}>
                <AnnotationListCard
                  annotation={ann}
                  onGoTo={onGoToAnnotation}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  showCriterionLink
                  criteria={criterionOptions}
                  onLink={onLink}
                  isReadOnly={isReadOnly}
                  goToLabel={goToLabel}
                  screenshotNumber={annotationIndexMap?.get(ann.id)}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
