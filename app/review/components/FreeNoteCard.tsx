'use client'

import { useState } from 'react'
import type { HighlightTag } from '@/types'
import { Button } from '@/components/ui/Button'
import type { FreeNote, CriterionOption } from './FreeNotesSection'

interface FreeNoteCardProps {
  note: FreeNote
  criteria: CriterionOption[]
  onEdit: (noteId: string, changes: { body: string; tag: HighlightTag | null }) => void
  onMove: (noteId: string, rubricItemId: string) => void
  onDelete: (noteId: string) => void
}

const TAG_LABELS: Record<string, string> = {
  action_item: 'Action item',
  quick_fix:   'Quick fix',
}

const TAG_OPTIONS: { value: HighlightTag; label: string }[] = [
  { value: 'action_item', label: 'Action item' },
  { value: 'quick_fix',   label: 'Quick fix'   },
]

export function FreeNoteCard({ note, criteria, onEdit, onMove, onDelete }: FreeNoteCardProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'moving'>('view')
  const [body, setBody] = useState(note.body)
  const [tag, setTag] = useState<HighlightTag | null>((note.tag as HighlightTag) ?? null)
  const [selectedCriterionId, setSelectedCriterionId] = useState('')

  function handleCancel() {
    setBody(note.body)
    setTag((note.tag as HighlightTag) ?? null)
    setSelectedCriterionId('')
    setMode('view')
  }

  if (mode === 'edit') {
    return (
      <div className="rounded-md border border-border bg-surface-container-low p-3 flex flex-col gap-2">
        <textarea
          autoFocus
          rows={3}
          value={body}
          onChange={e => setBody(e.target.value)}
          className="w-full resize-none rounded-md border border-border bg-transparent p-2 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
        />

        {/* Tag pills */}
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

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="text-body-sm text-error hover:underline cursor-pointer"
          >
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="text-body-sm text-text-muted hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              size="sm"
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
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-surface-container-low p-3 flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-body-sm text-text-primary flex-1">{note.body}</p>
        <div className="flex-shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="text-text-muted hover:text-text-primary"
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
            className="text-text-muted hover:text-text-primary"
            aria-label="Delete note"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tag pill */}
      {note.tag && TAG_LABELS[note.tag] && (
        <span className="self-start px-2 py-0.5 rounded-full text-label-sm border border-border text-text-secondary bg-surface-container">
          {TAG_LABELS[note.tag]}
        </span>
      )}

      {/* Move to criterion */}
      {mode === 'moving' ? (
        <div className="flex flex-col gap-1">
          <select
            value={selectedCriterionId}
            onChange={e => setSelectedCriterionId(e.target.value)}
            className="w-full border-0 border-b-2 border-border bg-transparent pb-2 text-body-sm text-text-primary focus:border-primary focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Select a criterion...</option>
            {criteria.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setMode('view'); setSelectedCriterionId('') }}
              className="text-body-sm text-text-muted hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedCriterionId}
              onClick={() => onMove(note.id, selectedCriterionId)}
            >
              Move
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMode('moving')}
          className="text-body-sm text-primary hover:underline cursor-pointer self-start"
        >
          Move to criterion →
        </button>
      )}
    </div>
  )
}

export default FreeNoteCard
