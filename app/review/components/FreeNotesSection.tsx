'use client'

import { useState } from 'react'
import type { HighlightTag } from '@/types'
import { Button } from '@/components/ui/Button'
import { FreeNoteCard } from './FreeNoteCard'

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
  notes: FreeNote[]
  criteria: CriterionOption[]
  isAdding: boolean
  onAddingChange: (val: boolean) => void
  onAddNote: (body: string, tag: HighlightTag | null, rubricItemId: string | null) => Promise<string | null>
  onEditNote: (noteId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onMoveNote: (noteId: string, rubricItemId: string) => void
  onDeleteNote: (noteId: string) => void
}

const TAG_OPTIONS: { value: HighlightTag; label: string }[] = [
  { value: 'action_item', label: 'Action item' },
  { value: 'quick_fix',   label: 'Quick fix'   },
]

export function FreeNotesSection({
  notes,
  criteria,
  isAdding,
  onAddingChange,
  onAddNote,
  onEditNote,
  onMoveNote,
  onDeleteNote,
}: FreeNotesSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [newBody, setNewBody] = useState('')
  const [newTag, setNewTag] = useState<HighlightTag | null>(null)
  const [newCriterionId, setNewCriterionId] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  function resetAddPanel() {
    onAddingChange(false)
    setNewBody('')
    setNewTag(null)
    setNewCriterionId('')
    setSaveError(null)
  }

  async function handleSaveNote() {
    const error = await onAddNote(newBody.trim(), newTag, newCriterionId || null)
    if (error) {
      setSaveError(error)
    } else {
      resetAddPanel()
    }
  }

  return (
    <div>
      {/* Add-note panel — shown when isAdding */}
      {isAdding && (
        <div className="border-b border-border bg-surface-card px-4 py-3 flex flex-col gap-3">
          <textarea
            autoFocus
            rows={3}
            placeholder="Write a note..."
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            className="w-full resize-none rounded-md border border-border bg-transparent p-2 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
          />

          {/* Tag pills */}
          <div className="flex gap-2">
            {TAG_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNewTag(prev => prev === opt.value ? null : opt.value)}
                className={[
                  'px-3 py-1 rounded-full text-body-sm border transition-colors cursor-pointer',
                  newTag === opt.value
                    ? 'bg-surface-container border-primary text-primary'
                    : 'bg-transparent border-border text-text-muted hover:border-primary hover:text-text-primary',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Criterion dropdown */}
          <div className="flex flex-col gap-1">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              Link to criterion{' '}
              <span className="text-text-muted normal-case font-normal tracking-normal">optional</span>
            </span>
            <select
              value={newCriterionId}
              onChange={e => setNewCriterionId(e.target.value)}
              className="w-full border-0 border-b-2 border-border bg-transparent pb-2 text-body-sm text-text-primary focus:border-primary focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">Save as free note</option>
              {criteria.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {saveError && (
            <p className="text-body-sm text-error">{saveError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetAddPanel}
              className="text-body-sm text-text-muted hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              size="sm"
              disabled={!newBody.trim()}
              onClick={handleSaveNote}
            >
              Save note
            </Button>
          </div>
        </div>
      )}

      {/* Expandable notes list card */}
      <div className="mx-4 mt-4 rounded-lg border border-border bg-surface-card">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-2">
            <span className="text-body-sm font-semibold text-text-primary">Free notes</span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-container text-label-sm text-text-secondary">
              {notes.length}
            </span>
          </div>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`w-4 h-4 text-text-muted transition-transform duration-[var(--transition-duration-base)]${expanded ? ' rotate-180' : ''}`}
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

        {expanded && (
          <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3">
            {notes.length === 0 ? (
              <p className="text-body-sm text-text-muted">No free notes yet.</p>
            ) : (
              notes.map(note => (
                <FreeNoteCard
                  key={note.id}
                  note={note}
                  criteria={criteria}
                  onEdit={onEditNote}
                  onMove={onMoveNote}
                  onDelete={onDeleteNote}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FreeNotesSection
