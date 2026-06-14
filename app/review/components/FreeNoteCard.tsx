'use client'

import { useState } from 'react'
import type { HighlightTag } from '@/types'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { FreeNote, CriterionOption } from './FreeNotesSection'
import { TagChip, TagSelector } from './TagChip'

interface FreeNoteCardProps {
  note: FreeNote
  criteria: CriterionOption[]
  onEdit: (noteId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onMove: (noteId: string, rubricItemId: string) => void
  onDelete: (noteId: string) => void
  showMoveDropdown?: boolean
}

export function FreeNoteCard({ note, criteria, onEdit, onMove, onDelete, showMoveDropdown = true }: FreeNoteCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [body, setBody] = useState(note.body)
  const [tag, setTag] = useState<HighlightTag | null>((note.tag as HighlightTag) ?? null)
  const [selectedCriterionId, setSelectedCriterionId] = useState('')

  function handleCancel() {
    setBody(note.body)
    setTag((note.tag as HighlightTag) ?? null)
    setMode('view')
  }

  if (mode === 'edit') {
    return (
      <div className="rounded-none border border-border bg-surface-container-low p-3 flex flex-col gap-2">
        <Textarea
          autoFocus
          rows={3}
          variant="default"
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <TagSelector value={tag} onChange={setTag} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" shape="square" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            shape="square"
            disabled={!body.trim()}
            onClick={() => {
              onEdit(note.id, { body: body.trim(), tag })
              setMode('view')
            }}
          >
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-none border border-border bg-surface-container-low p-3 flex flex-col gap-2">
      {/* Top row: comment + edit/delete icons */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary mb-1">
            Free Note
          </span>
          <p className="text-body-sm text-text-primary">{note.body}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="opacity-70 hover:opacity-100 transition-opacity text-text-muted"
            aria-label="Edit note"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="opacity-70 hover:opacity-100 transition-opacity text-error"
            aria-label="Delete note"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tags row — only when a tag exists */}
      {note.tag && (
        <>
          <hr className="border-0 border-t border-border" />
          <div className="flex items-center gap-2">
            <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary">
              Tags
            </span>
            <TagChip tag={note.tag} />
          </div>
        </>
      )}


      {/* Move-to criterion — hidden when rendered inside a criterion card */}
      {showMoveDropdown && (
        <>
          <hr className="border-0 border-t border-border" />
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
          {selectedCriterionId && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" shape="square" onClick={() => setSelectedCriterionId('')}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                shape="square"
                onClick={() => onMove(note.id, selectedCriterionId)}
              >
                Move
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FreeNoteCard
