'use client'

import { useState } from 'react'
import type { HighlightTag } from '@/types'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { TagChip, TagSelector } from './TagChip'

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

interface AnnotationListCardProps {
  annotation: AnnotationSummary
  onGoTo: (annotationId: string) => void
  onEdit: (annotationId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onDelete: (annotationId: string) => void
  showCriterionLink?: boolean
  showMoveInEdit?: boolean
  currentCriterionId?: string
  criteria?: CriterionOption[]
  onLink?: (annotationId: string, criterionId: string, body?: string, tag?: HighlightTag | null) => void
  isReadOnly?: boolean
}

function ArrowUpRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7"/>
      <path d="M7 7h10v10"/>
    </svg>
  )
}

export function AnnotationListCard({
  annotation,
  onGoTo,
  onEdit,
  onDelete,
  showCriterionLink,
  showMoveInEdit,
  currentCriterionId,
  criteria,
  onLink,
  isReadOnly = false,
}: AnnotationListCardProps) {
  const anchorText = (annotation.anchor as any).text as string | undefined ?? null
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editBody, setEditBody] = useState(annotation.body)
  const [editTag, setEditTag] = useState<HighlightTag | null>((annotation.tag as HighlightTag) ?? null)
  const [selectedCriterionId, setSelectedCriterionId] = useState(currentCriterionId ?? '')

  function enterEdit() {
    if (isReadOnly) return
    setEditBody(annotation.body)
    setEditTag((annotation.tag as HighlightTag) ?? null)
    setSelectedCriterionId(currentCriterionId ?? '')
    setMode('edit')
  }

  function handleCancel() {
    setEditBody(annotation.body)
    setEditTag((annotation.tag as HighlightTag) ?? null)
    setMode('view')
  }

  function handleSave() {
    if (!editBody.trim()) return
    if (showMoveInEdit && selectedCriterionId && selectedCriterionId !== currentCriterionId) {
      // Combined edit + move — single DB call via onLink to avoid race condition
      onLink?.(annotation.id, selectedCriterionId, editBody.trim(), editTag)
    } else {
      onEdit(annotation.id, { body: editBody.trim(), tag: editTag })
    }
    setMode('view')
  }

  return (
    <div className="rounded-none border border-border bg-surface-container-low p-3 flex flex-col gap-2">
      {/* Top row: annotated text section + edit/delete controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header row: label + go to annotation inline */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              Annotated Text
            </span>
            <button
              type="button"
              onClick={() => onGoTo(annotation.id)}
              className="inline-flex items-center gap-1 p-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer text-secondary"
            >
              <span className="text-body-sm font-body whitespace-nowrap">
                Go to annotation
              </span>
              <ArrowUpRightIcon />
            </button>
          </div>
          {anchorText ? (
            <p className="text-body-sm font-heading italic text-text-primary line-clamp-2">
              <span className="text-secondary font-heading not-italic">&ldquo;</span>
              {anchorText}
              <span className="text-secondary font-heading not-italic">&rdquo;</span>
            </p>
          ) : (
            <p className="text-body-sm text-text-muted italic">No annotated text</p>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex-shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={enterEdit}
              className="opacity-70 hover:opacity-100 transition-opacity text-text-muted"
              aria-label="Edit annotation"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onDelete(annotation.id)}
              className="opacity-70 hover:opacity-100 transition-opacity text-error"
              aria-label="Delete annotation"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Comment section */}
      <div>
        <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary mb-1">
          Comment
        </span>
        {mode === 'edit' ? (
          <Textarea
            variant="default"
            rows={3}
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            autoFocus
          />
        ) : (
          <p className="text-body-sm text-text-secondary">{annotation.body}</p>
        )}
      </div>

      {/* Tags section — always shown in edit mode; shown in view mode only when a tag exists */}
      {(mode === 'edit' || annotation.tag) && (
        <div className="flex items-center gap-2">
          <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
            Tags:
          </span>
          {mode === 'edit' ? (
            <TagSelector value={editTag} onChange={setEditTag} />
          ) : (
            annotation.tag ? <TagChip tag={annotation.tag} /> : null
          )}
        </div>
      )}

      {/* Move-to-criterion dropdown — edit mode only, when inside a criterion card */}
      {showMoveInEdit && mode === 'edit' && criteria && criteria.length > 0 && (
        <div>
          <div className="relative">
            <select
              value={selectedCriterionId}
              onChange={e => setSelectedCriterionId(e.target.value)}
              className="w-full border-0 border-b-2 border-border bg-transparent pb-2 pr-6 text-body-sm text-text-primary focus:border-primary focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">Move to criterion...</option>
              {criteria.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-0 bottom-2 flex items-center text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
      )}

      {/* Edit mode action buttons */}
      {mode === 'edit' && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" shape="square" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            shape="square"
            disabled={!editBody.trim()}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      )}

      {/* Criterion link section — only shown in view mode when showCriterionLink is true and not read-only */}
      {showCriterionLink && mode === 'view' && !isReadOnly && (
        <div>
          <div className="relative">
            <select
              value={selectedCriterionId}
              onChange={e => setSelectedCriterionId(e.target.value)}
              className="w-full border-0 border-b-2 border-border bg-transparent pb-2 pr-6 text-body-sm text-text-primary focus:border-primary focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">Move to criterion...</option>
              {(criteria ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-0 bottom-2 flex items-center text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          {selectedCriterionId && (
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                shape="square"
                onClick={() => setSelectedCriterionId('')}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                shape="square"
                onClick={() => {
                  onLink?.(annotation.id, selectedCriterionId)
                  setSelectedCriterionId('')
                }}
              >
                Move
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AnnotationListCard
