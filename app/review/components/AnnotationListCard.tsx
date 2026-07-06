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
  goToLabel?: string
  screenshotNumber?: number
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
  goToLabel,
  screenshotNumber,
}: AnnotationListCardProps) {
  const _a = annotation.anchor as any
  const anchorText: string | null = _a.text ?? _a.selector?.find((s: any) => s.type === 'TextQuoteSelector')?.exact ?? null

  // Torus-specific anchor data
  const anchorType = _a.type as string | undefined
  const isTorus = anchorType === 'bbox' || anchorType === 'point' || anchorType === 'html-char-offset'
  const pageName = isTorus ? (_a.pageName as string | undefined) : undefined
  const pageType = isTorus ? (_a.pageType as string | undefined) : undefined
  const isHotspot = anchorType === 'point'
  const hasScreenshot = isTorus && !!(_a.screenshotUrl as string | undefined)

  const PageIcon = pageType === 'nav' ? (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ) : pageType === 'checkpoint' ? (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  ) : (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  )
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editBody, setEditBody] = useState(annotation.body)
  const [editTag, setEditTag] = useState<HighlightTag | null>((annotation.tag as HighlightTag) ?? null)
  const [selectedCriterionId, setSelectedCriterionId] = useState(currentCriterionId ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
    <div className="relative rounded-none border border-border bg-surface-container-low p-3 flex flex-col gap-2">
      {/* Page name row — Torus only */}
      {pageName && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 text-text-primary">
              {PageIcon}
              <span className="text-body-md font-heading font-semibold text-text-primary truncate">{pageName}</span>
            </div>
            {screenshotNumber != null && hasScreenshot && (
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-label-sm bg-surface-container text-text-secondary border border-border">
                Screenshot #{screenshotNumber}
              </span>
            )}
          </div>
          <hr className="border-border" />
        </>
      )}

      {/* Top row: annotated text / hotspot section + edit/delete controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header row: label + go to link */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              {isHotspot ? 'Hotspot' : 'Annotated Text'}
            </span>
            <button
              type="button"
              onClick={() => onGoTo(annotation.id)}
              className="inline-flex items-center gap-1 p-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer text-secondary"
            >
              <span className="text-body-sm font-body whitespace-nowrap">
                {goToLabel ?? 'Go to annotation'}
              </span>
              <ArrowUpRightIcon />
            </button>
          </div>
          {isHotspot ? (
            <div className="flex items-center gap-1.5 text-text-muted">
              <svg className="w-3 h-4 shrink-0" viewBox="0 0 28 36" fill="currentColor" aria-hidden="true">
                <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" />
              </svg>
              <span className="text-body-sm italic">Hotspot annotation</span>
            </div>
          ) : anchorText ? (
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
              onClick={() => setShowDeleteConfirm(true)}
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
          <p className="text-body-sm text-text-secondary break-words hyphens-auto">{annotation.body}</p>
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

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/40">
          <div className="bg-surface-card rounded-lg shadow-4 p-4 flex flex-col items-center gap-3 w-3/5">
            <p className="text-body-sm font-semibold text-text-primary text-center">
              Delete this annotation?
            </p>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={() => { onDelete(annotation.id); setShowDeleteConfirm(false) }}>
                Delete
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnnotationListCard
