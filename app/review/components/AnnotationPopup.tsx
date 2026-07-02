'use client'

import { useState, useRef, useEffect } from 'react'
import type { HighlightTag } from '@/types'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { TagSelector } from './TagChip'

interface CriterionOption {
  id: string
  label: string
}

export interface AnnotationConfirmPayload {
  body: string
  rubricItemId: string | null
  tag: HighlightTag | null
}

interface AnnotationPopupProps {
  criteria: CriterionOption[]
  selectedText?: string
  onSave: (payload: AnnotationConfirmPayload) => void
  onCancel: () => void
  position: { x: number; selectionTop: number; selectionBottom: number }
}

export function AnnotationPopup({
  criteria,
  selectedText,
  onSave,
  onCancel,
  position,
}: AnnotationPopupProps) {
  const [rubricItemId, setRubricItemId] = useState<string | null>(null)
  const [tag, setTag] = useState<HighlightTag | null>(null)
  const [body, setBody] = useState('')
  const [adjustedPos, setAdjustedPos] = useState({ x: position.x, y: position.selectionBottom + 8 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const parent = ref.current.offsetParent as HTMLElement | null
    const pW = parent?.clientWidth ?? window.innerWidth
    const pH = parent?.clientHeight ?? window.innerHeight
    const MARGIN = 8
    let x = position.x
    let y = position.selectionTop - h - MARGIN
    if (y < MARGIN) y = position.selectionBottom + MARGIN
    if (x + w > pW - MARGIN) x = pW - w - MARGIN
    if (x < MARGIN) x = MARGIN
    if (y + h > pH - MARGIN) y = pH - h - MARGIN
    if (y < MARGIN) y = MARGIN
    setAdjustedPos({ x, y })
  }, [position.x, position.selectionTop, position.selectionBottom])

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

  function handleSave() {
    if (!body.trim()) return
    onSave({ body: body.trim(), rubricItemId, tag })
  }

  return (
    <div
      ref={ref}
      className="absolute z-[var(--z-popover)] min-w-[280px] max-w-[360px] rounded-none bg-surface-card border border-border shadow-3 flex flex-col"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between bg-surface px-4 py-3 border-b border-border/40 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handleHeaderPointerDown}
      >
        <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
          ADD ANNOTATION
        </span>
        <button
          type="button"
          onClick={onCancel}
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
      <div className="px-4 py-3 border-t border-border/40">
        <p className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary mb-2">
          LINK TO CRITERIA{' '}
          <span className="text-text-muted normal-case font-normal tracking-normal">(OPTIONAL)</span>
        </p>
        <select
          value={rubricItemId ?? ''}
          onChange={e => setRubricItemId(e.target.value || null)}
          className="w-full border border-border bg-surface-card px-2 py-1.5 text-body-sm text-text-primary focus:border-primary focus:outline-none transition-colors"
        >
          <option value="">(save to unlinked annotations)</option>
          {criteria.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/40 flex justify-end">
        <Button variant="primary" size="sm" shape="square" disabled={!body.trim()} onClick={handleSave}>
          SAVE EVIDENCE
        </Button>
      </div>
    </div>
  )
}

export default AnnotationPopup
