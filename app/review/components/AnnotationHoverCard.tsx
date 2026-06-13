'use client'

import { useState, useRef, useEffect } from 'react'
import type { HighlightTag } from '@/types'
import type { SavedAnnotation } from './PDFViewerCanvas'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Button } from '@/components/ui/Button'

interface AnnotationHoverCardProps {
  annotation: SavedAnnotation
  criterionLabel: string | null
  criteria?: { id: string; label: string }[]
  linkedCriteriaIds?: string[]
  onSave: (updates: { tag: HighlightTag | null; body: string }) => void
  onRelink?: (newRubricItemIds: string[]) => void
  onDelete: () => void
  position: { x: number; y: number }
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

const TAG_OPTIONS: { value: HighlightTag; label: string }[] = [
  { value: 'action_item', label: 'Action item' },
  { value: 'quick_fix',   label: 'Quick fix'   },
]

const TAG_LABELS: Record<string, string> = {
  action_item: 'Action item',
  quick_fix:   'Quick fix',
}

function sameIds(a: string[], b: string[]) {
  return [...a].sort().join(',') === [...b].sort().join(',')
}

export function AnnotationHoverCard({
  annotation,
  criterionLabel,
  criteria,
  linkedCriteriaIds,
  onSave,
  onRelink,
  onDelete,
  position,
  onMouseEnter,
  onMouseLeave,
}: AnnotationHoverCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [tag, setTag] = useState<HighlightTag | null>((annotation.tag as HighlightTag) ?? null)
  const [body, setBody] = useState(annotation.body)
  const [relinkIds, setRelinkIds] = useState<string[]>(linkedCriteriaIds ?? [])
  const [adjustedPos, setAdjustedPos] = useState(position)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const { offsetWidth: w, offsetHeight: h } = ref.current
    // Clamp within the nearest positioned ancestor (the viewer container),
    // not the window — the card is absolute inside that container.
    const parent = ref.current.offsetParent as HTMLElement | null
    const containerW  = parent?.clientWidth  ?? window.innerWidth
    const containerH  = parent?.clientHeight ?? window.innerHeight
    const scrollTop   = parent?.scrollTop   ?? 0
    const MARGIN = 8
    let x = position.x
    let y = position.y
    if (x + w > containerW  - MARGIN) x = containerW  - w - MARGIN
    if (y + h > scrollTop + containerH - MARGIN) y = scrollTop + containerH - h - MARGIN
    if (x < MARGIN) x = MARGIN
    if (y < scrollTop + MARGIN) y = scrollTop + MARGIN
    setAdjustedPos({ x, y })
  }, [position.x, position.y])

  function handleCancel() {
    setTag((annotation.tag as HighlightTag) ?? null)
    setBody(annotation.body)
    setRelinkIds(linkedCriteriaIds ?? [])
    setMode('view')
  }

  function handleSave() {
    if (!body.trim()) return
    onSave({ tag, body: body.trim() })
    if (onRelink && !sameIds(relinkIds, linkedCriteriaIds ?? [])) {
      onRelink(relinkIds)
    }
    setMode('view')
  }

  const extraCount = (linkedCriteriaIds?.length ?? 0) - 1
  const criterionDisplay = criterionLabel === null
    ? null
    : extraCount > 0
      ? `${criterionLabel} + ${extraCount} more`
      : criterionLabel

  const commentPreview = annotation.body.length > 80
    ? annotation.body.slice(0, 80) + '…'
    : annotation.body

  return (
    <div
      ref={ref}
      className="absolute z-[var(--z-popover)] w-72 bg-surface-card rounded-lg shadow-3 border border-border p-3 flex flex-col gap-2"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {mode === 'view' ? (
        <>
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <span className={criterionDisplay !== null ? 'text-label-sm font-semibold text-text-primary truncate' : 'text-label-sm text-text-muted'}>
              {criterionDisplay ?? 'No criterion linked'}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="text-text-muted hover:text-text-primary"
                aria-label="Edit annotation"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-text-muted hover:text-text-primary"
                aria-label="Delete annotation"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tag pill */}
          {annotation.tag && TAG_LABELS[annotation.tag] && (
            <span className="self-start px-2 py-0.5 rounded-full text-label-sm border border-border text-text-secondary bg-surface-container">
              {TAG_LABELS[annotation.tag]}
            </span>
          )}

          {/* Comment */}
          <p className="text-body-sm text-text-primary">{commentPreview}</p>
        </>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              Edit annotation
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="text-text-muted hover:text-text-primary"
              aria-label="Close"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Criteria selector */}
          {criteria && (
            <div className="flex flex-col gap-1">
              <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
                Link to criteria
              </span>
              <MultiSelect
                options={criteria.map(c => ({ value: c.id, label: c.label }))}
                value={relinkIds}
                onChange={setRelinkIds}
                placeholder="Select criteria..."
              />
            </div>
          )}

          {/* Tag pills */}
          <div className="flex flex-col gap-1">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              Tag{' '}
              <span className="text-text-muted normal-case font-normal tracking-normal">optional</span>
            </span>
            <div className="flex gap-2">
              {TAG_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTag(prev => prev === opt.value ? null : opt.value)}
                  className={[
                    'px-3 py-1 rounded-full text-body-sm border transition-colors cursor-pointer',
                    tag === opt.value
                      ? 'bg-surface-container border-primary text-primary'
                      : 'bg-transparent border-border text-text-muted hover:border-primary hover:text-text-primary',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment textarea */}
          <div className="flex flex-col gap-1">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              Comment <span className="text-error" aria-hidden="true">*</span>
            </span>
            <textarea
              autoFocus
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full resize-none rounded-md border border-border bg-transparent p-2 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onDelete}
              className="text-body-sm text-error hover:underline cursor-pointer"
            >
              Delete
            </button>
            <Button variant="primary" disabled={!body.trim()} onClick={handleSave}>
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default AnnotationHoverCard
