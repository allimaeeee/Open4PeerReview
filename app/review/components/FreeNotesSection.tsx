'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/Textarea'
import type { SaveStatus } from '@/hooks/useReviewAutoSave'

// These interfaces are imported by CriterionCard and ReviewRightPanel — keep exported.
export interface FreeNote {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

export interface CriterionOption {
  id: string
  label: string
}

interface FreeNotesSectionProps {
  initialNotes: string | null
  onNotesChange: (val: string) => void
  saveStatus: SaveStatus
  isReadOnly?: boolean
}

export function FreeNotesSection({
  initialNotes,
  onNotesChange,
  saveStatus,
  isReadOnly = false,
}: FreeNotesSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [localNotes, setLocalNotes] = useState(initialNotes ?? '')

  return (
    <div className="mx-4 mt-4 rounded-lg border border-border border-l-[3px] border-l-secondary bg-surface-card">
      {/* Collapsible header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="flex-1 text-body-md font-heading font-semibold text-text-primary">Free Notes</span>
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
          <Textarea
            placeholder="Your personal scratch pad — not included in your submission…"
            rows={5}
            variant="default"
            value={localNotes}
            onChange={e => {
              setLocalNotes(e.target.value)
              onNotesChange(e.target.value)
            }}
            disabled={isReadOnly}
          />
          <p className="text-label-sm font-label text-text-muted h-4">
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'error' && <span className="text-error">Save failed — please try again</span>}
          </p>
        </div>
      )}
    </div>
  )
}

export default FreeNotesSection
