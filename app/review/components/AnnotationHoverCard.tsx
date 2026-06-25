'use client'

import { useState, useRef, useEffect } from 'react'
import type { HighlightTag } from '@/types'
import type { SavedAnnotation } from './PDFViewerCanvas'
import { Button } from '@/components/ui/Button'
import { TagChip, TagSelector } from './TagChip'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'

interface AnnotationHoverCardProps {
  annotation: SavedAnnotation
  criterionLabel: string | null
  criteria?: { id: string; label: string }[]
  linkedCriteriaIds?: string[]
  onSave: (updates: { tag: HighlightTag | null; body: string }) => void
  onRelink?: (newRubricItemIds: string[], updates: { body: string; tag: HighlightTag | null }) => void
  onDelete: () => void
  onViewFullComment?: () => void
  position: { x: number; y: number }
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function AnnotationHoverCard({
  annotation,
  criterionLabel,
  criteria,
  linkedCriteriaIds,
  onSave,
  onRelink,
  onDelete,
  onViewFullComment,
  position,
  onMouseEnter,
  onMouseLeave,
}: AnnotationHoverCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [tag, setTag] = useState<HighlightTag | null>((annotation.tag as HighlightTag) ?? null)
  const [body, setBody] = useState(annotation.body)
  const [relinkId, setRelinkId] = useState<string | null>(annotation.rubricItemId ?? null)
  const [adjustedPos, setAdjustedPos] = useState(position)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [snapshot, setSnapshot] = useState<{ body: string; tag: HighlightTag | null; relinkId: string | null } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const lastPositionRef = useRef({ x: position.x, y: position.y })

  // Reset from prop when annotation changes; re-clamp from current pos when mode changes
  useEffect(() => {
    if (!ref.current) return
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const parent = ref.current.offsetParent as HTMLElement | null
    const containerW = parent?.clientWidth  ?? window.innerWidth
    const containerH = parent?.clientHeight ?? window.innerHeight
    const scrollTop  = parent?.scrollTop   ?? 0
    const MARGIN = 8
    const positionChanged = lastPositionRef.current.x !== position.x || lastPositionRef.current.y !== position.y
    lastPositionRef.current = { x: position.x, y: position.y }
    setAdjustedPos(prev => {
      let x = positionChanged ? position.x : prev.x
      let y = positionChanged ? position.y : prev.y
      if (x + w > containerW - MARGIN) x = containerW - w - MARGIN
      if (y + h > scrollTop + containerH - MARGIN) y = scrollTop + containerH - h - MARGIN
      if (x < MARGIN) x = MARGIN
      if (y < scrollTop + MARGIN) y = scrollTop + MARGIN
      return { x, y }
    })
  }, [position.x, position.y, mode])

  function handleHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startX = adjustedPos.x
    const startY = adjustedPos.y

    function onMove(ev: PointerEvent) {
      const popup = ref.current
      if (!popup) return
      const parent = popup.offsetParent as HTMLElement | null
      const pW = parent?.clientWidth ?? window.innerWidth
      const pH = parent?.clientHeight ?? window.innerHeight
      const scrollTop = parent?.scrollTop ?? 0
      setAdjustedPos({
        x: Math.max(0, Math.min(startX + ev.clientX - startMouseX, pW - popup.offsetWidth)),
        y: Math.max(scrollTop, Math.min(startY + ev.clientY - startMouseY, scrollTop + pH - popup.offsetHeight)),
      })
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // Click-outside detection — only active in edit mode
  useEffect(() => {
    if (mode !== 'edit') return
    function handleMouseDown(e: MouseEvent) {
      if (showDiscardModal) return
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const changed = snapshot !== null && (
          body !== snapshot.body ||
          tag !== snapshot.tag ||
          relinkId !== snapshot.relinkId
        )
        if (changed) {
          setShowDiscardModal(true)
        } else {
          doResetToView()
        }
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [mode, body, tag, relinkId, snapshot, annotation, showDiscardModal])

  function hasUnsavedChanges() {
    if (!snapshot) return false
    return body !== snapshot.body || tag !== snapshot.tag || relinkId !== snapshot.relinkId
  }

  function enterEditMode() {
    setSnapshot({ body, tag, relinkId })
    setMode('edit')
  }

  function doResetToView() {
    setBody(annotation.body)
    setTag((annotation.tag as HighlightTag) ?? null)
    setRelinkId(annotation.rubricItemId ?? null)
    setSnapshot(null)
    setMode('view')
  }

  function attemptClose() {
    if (hasUnsavedChanges()) {
      setShowDiscardModal(true)
    } else {
      doResetToView()
    }
  }

  function handleSave() {
    if (!body.trim()) return
    const newBody = body.trim()
    if (onRelink && relinkId !== annotation.rubricItemId) {
      // Pass body/tag into the relink so the newly-inserted annotation uses the
      // updated values. Calling onSave separately would race against onRelink's
      // state read, causing the new annotation to inherit the stale comment.
      onRelink(relinkId ? [relinkId] : [], { body: newBody, tag })
    } else {
      onSave({ tag, body: newBody })
    }
    setSnapshot(null)
    setMode('view')
  }

  const _anc = annotation.anchor as any
  const highlightedText: string | undefined = _anc.text ?? _anc.selector?.find((s: any) => s.type === 'TextQuoteSelector')?.exact

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
    <>
      <div
        ref={ref}
        className={mode === 'edit'
          ? 'absolute z-[var(--z-popover)] min-w-[280px] max-w-[360px] rounded-none bg-surface-card border border-border shadow-3 flex flex-col'
          : 'absolute z-[var(--z-popover)] min-w-[220px] max-w-[300px] rounded-none bg-surface-card border border-border shadow-3 flex flex-col'
        }
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={mode === 'edit' ? undefined : onMouseLeave}
      >
        {mode === 'view' ? (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between bg-surface px-4 py-3 border-b border-border/40 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={handleHeaderPointerDown}
            >
              <span className={criterionDisplay !== null
                ? 'text-label-sm font-label font-semibold uppercase tracking-wide text-secondary truncate'
                : 'text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary'}>
                {criterionDisplay ?? 'UNLINKED HIGHLIGHT'}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={enterEditMode}
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
                  onClick={onDelete}
                  className="opacity-70 hover:opacity-100 transition-opacity text-error"
                  aria-label="Delete annotation"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Comment */}
            <p className="px-4 pt-3 pb-1 text-body-sm text-text-primary leading-relaxed">{commentPreview}</p>
            {/* View full comment link */}
            {onViewFullComment && (
              <div className="px-4 pb-3">
                <button
                  type="button"
                  onClick={onViewFullComment}
                  className="inline-flex items-center gap-1 p-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer text-secondary"
                >
                  <span className="text-body-sm font-body whitespace-nowrap">View full comment</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 17L17 7"/>
                    <path d="M7 7h10v10"/>
                  </svg>
                </button>
              </div>
            )}
            {/* Tag */}
            {annotation.tag && (
              <div className="px-4 pb-3">
                <TagChip tag={annotation.tag} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between bg-surface px-4 py-3 border-b border-border/40 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={handleHeaderPointerDown}
            >
              <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
                EDIT ANNOTATION
              </span>
              <button
                type="button"
                onClick={attemptClose}
                className="text-text-muted hover:text-text-primary"
                aria-label="Close"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Comment */}
            <div className="px-4 py-3">
              <p className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary mb-2">
                COMMENT
              </p>
              <Textarea
                autoFocus
                placeholder="Describe what this evidence shows..."
                variant="default"
                rows={4}
                resize="vertical"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div className="px-4 py-3 border-t border-border/40 flex items-center gap-3">
              <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary shrink-0">
                TAGS:
              </span>
              <TagSelector value={tag} onChange={setTag} />
            </div>

            {/* Link to Criteria */}
            {criteria && (
              <div className="px-4 py-3 border-t border-border/40">
                <p className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary mb-2">
                  LINK TO CRITERIA{' '}
                  <span className="text-text-muted normal-case font-normal tracking-normal">(OPTIONAL)</span>
                </p>
                <select
                  value={relinkId ?? ''}
                  onChange={e => setRelinkId(e.target.value || null)}
                  className="w-full border border-border bg-surface-card px-2 py-1.5 text-body-sm text-text-primary focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="">(save to unlinked annotations)</option>
                  {criteria.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border/40 flex justify-between">
              <Button variant="secondary" size="sm" shape="square" onClick={attemptClose}>
                CANCEL
              </Button>
              <Button variant="primary" size="sm" shape="square" disabled={!body.trim()} onClick={handleSave}>
                SAVE CHANGES
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Discard changes confirmation modal */}
      <Modal open={showDiscardModal} onClose={() => setShowDiscardModal(false)}>
        <div
          onClick={e => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs bg-surface-card border border-border shadow-3 rounded-none p-6 z-[var(--z-modal)]"
        >
          <h3 className="font-heading text-title-sm text-text-primary mb-2">Discard changes?</h3>
          <p className="text-body-sm text-text-secondary mb-6">Your edits to this annotation won&apos;t be saved.</p>
          <div className="flex justify-between gap-3">
            <Button variant="primary" shape="square" onClick={() => setShowDiscardModal(false)}>
              KEEP EDITING
            </Button>
            <Button variant="secondary" shape="square" onClick={() => {
              setShowDiscardModal(false)
              doResetToView()
            }}>
              DISCARD
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default AnnotationHoverCard
