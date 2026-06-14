'use client'

import { useState } from 'react'
import type { HighlightTag } from '@/types'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { FreeNoteCard } from './FreeNoteCard'
import { TagSelector } from './TagChip'

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
  onAddNote: (body: string, tag: HighlightTag | null, rubricItemId: string | null) => Promise<string | null>
  onEditNote: (noteId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onMoveNote: (noteId: string, rubricItemId: string) => void
  onDeleteNote: (noteId: string) => void
}

export function FreeNotesSection({
  notes,
  criteria,
  onAddNote,
  onEditNote,
  onMoveNote,
  onDeleteNote,
}: FreeNotesSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [selectedTag, setSelectedTag] = useState<HighlightTag | null>(null)
  const [linkedCriterion, setLinkedCriterion] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  function resetNewNote() {
    setNoteText('')
    setSelectedTag(null)
    setLinkedCriterion('')
    setSaveError(null)
  }

  async function handleSaveNewNote() {
    const error = await onAddNote(noteText.trim(), selectedTag, linkedCriterion || null)
    if (error) {
      setSaveError(error)
    } else {
      resetNewNote()
    }
  }

  return (
    <div className="mx-4 mt-4 rounded-lg border border-border border-l-[3px] border-l-secondary bg-surface-card">
      {/* Collapsible header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 flex items-baseline gap-2">
          <span className="text-body-md font-heading font-semibold text-text-primary">Free notes</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-container/60 text-secondary text-label-sm font-label font-semibold">
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
          {/* New Free Note card — always visible */}
          <div className="rounded-none border border-dashed border-border bg-surface p-4 flex flex-col gap-3">
            <Textarea
              placeholder="Write a note..."
              rows={3}
              variant="default"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />

            {noteText.trim().length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
                    Tags
                  </span>
                  <TagSelector value={selectedTag} onChange={setSelectedTag} />
                </div>

                <div>
                  <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary mb-1">
                    Link to criterion{' '}
                    <span className="text-text-muted normal-case font-normal tracking-normal">(optional)</span>
                  </span>
                  <div className="relative">
                    <select
                      value={linkedCriterion}
                      onChange={e => setLinkedCriterion(e.target.value)}
                      className="w-full border-0 border-b-2 border-border bg-transparent pb-2 pr-6 text-body-sm text-text-primary focus:border-primary focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="">---</option>
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

                {saveError && (
                  <p className="text-body-sm text-error">{saveError}</p>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" shape="square" onClick={resetNewNote}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    shape="square"
                    disabled={!noteText.trim()}
                    onClick={handleSaveNewNote}
                  >
                    Save note
                  </Button>
                </div>
              </>
            )}
          </div>

          {notes.length > 0 && (
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              Free Note Bank ({notes.length})
            </span>
          )}

          {notes.map(note => (
            <div key={note.id} id={`annotation-card-${note.id}`}>
              <FreeNoteCard
                note={note}
                criteria={criteria}
                onEdit={onEditNote}
                onMove={onMoveNote}
                onDelete={onDeleteNote}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FreeNotesSection
