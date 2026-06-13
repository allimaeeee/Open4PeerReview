'use client'

import { useState, useRef, useEffect } from 'react'
import type { HighlightTag } from '@/types'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Button } from '@/components/ui/Button'

interface CriterionOption {
  id: string
  label: string
}

interface AnnotationConfirmPayload {
  body: string
  rubricItemIds: string[]
  tag: HighlightTag | null
}

interface AnnotationPopupProps {
  selectedText: string
  criteria: CriterionOption[]
  onSave: (payload: AnnotationConfirmPayload) => void
  onCancel: () => void
  position: { x: number; y: number }
}

const TAG_OPTIONS: { value: HighlightTag; label: string }[] = [
  { value: 'action_item', label: 'Action item' },
  { value: 'quick_fix',   label: 'Quick fix'   },
]

export function AnnotationPopup({
  selectedText,
  criteria,
  onSave,
  onCancel,
  position,
}: AnnotationPopupProps) {
  const [rubricItemIds, setRubricItemIds] = useState<string[]>([])
  const [tag, setTag] = useState<HighlightTag | null>(null)
  const [body, setBody] = useState('')
  const [adjustedPos, setAdjustedPos] = useState(position)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const { offsetWidth: w, offsetHeight: h } = ref.current
    let x = position.x
    let y = position.y
    if (x + w > window.innerWidth - 16) x = window.innerWidth - w - 16
    if (y + h > window.innerHeight - 16) y = window.innerHeight - h - 16
    setAdjustedPos({ x, y })
  }, [position.x, position.y])

  function handleSave() {
    if (!body.trim()) return
    onSave({ body: body.trim(), rubricItemIds, tag })
  }

  const preview = selectedText.length > 60 ? selectedText.slice(0, 60) + '…' : selectedText

  return (
    <div
      ref={ref}
      className="absolute z-[var(--z-popover)] w-72 bg-surface-card rounded-lg shadow-3 border border-border p-4 flex flex-col gap-3"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
          Add annotation
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-text-muted hover:text-text-primary"
          aria-label="Close"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Selected text preview */}
      <p className="text-body-sm text-text-muted italic">&ldquo;{preview}&rdquo;</p>

      {/* Criteria selector */}
      <div className="flex flex-col gap-1">
        <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
          Link to criteria
        </span>
        <MultiSelect
          options={criteria.map(c => ({ value: c.id, label: c.label }))}
          value={rubricItemIds}
          onChange={setRubricItemIds}
          placeholder="Select criteria..."
        />
      </div>

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
          placeholder="Add a comment..."
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) handleSave()
          }}
          className="w-full resize-none rounded-md border border-border bg-transparent p-2 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-body-sm text-text-muted hover:text-text-primary cursor-pointer"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <span className="text-label-sm text-text-muted">⌘↵ to save</span>
          <Button variant="primary" disabled={!body.trim()} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AnnotationPopup
