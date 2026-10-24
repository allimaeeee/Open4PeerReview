'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export interface RevisionNoteItem {
  id: string
  body: string
  created_at: string
}

interface RevisionNotesProps {
  notes: RevisionNoteItem[]
  onAdd: (body: string) => void | Promise<void>
  onUpdate: (id: string, body: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  className?: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const textareaClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] px-3 py-2 text-body-sm text-[var(--color-text-primary)] leading-relaxed resize-y min-h-[72px] focus:outline-none focus:border-[var(--color-border-strong)]'

/**
 * Author-only "Revision Notes" card: a running list of free-text notes the author
 * keeps while working through reviewer feedback. Controlled by the parent.
 */
export function RevisionNotes({ notes, onAdd, onUpdate, onDelete, className }: RevisionNotesProps) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const handleAdd = async () => {
    const body = draft.trim()
    if (!body || adding) return
    setAdding(true)
    try {
      await onAdd(body)
      setDraft('')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (note: RevisionNoteItem) => {
    setEditingId(note.id)
    setEditDraft(note.body)
  }

  const handleSaveEdit = async (id: string) => {
    const body = editDraft.trim()
    if (!body) return
    await onUpdate(id, body)
    setEditingId(null)
    setEditDraft('')
  }

  return (
    <div
      className={cx(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] shadow-[var(--shadow-1)] px-5 py-4',
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="block text-body-md font-heading font-semibold text-text-primary">
          Revision Notes
        </span>
        <span className="text-label-sm font-label text-[var(--color-text-muted)]">
          {notes.length > 0 ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : 'Private to you'}
        </span>
      </div>
      <p className="text-body-sm text-[var(--color-text-muted)] mb-3">
        Track your own plans for revising this resource. Only you can see these.
      </p>

      {/* Existing notes */}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2 mb-3">
          {notes.map(note => (
            <li
              key={note.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-3"
            >
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className={textareaClass}
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="text" size="sm" onClick={() => { setEditingId(null); setEditDraft('') }}>
                      Cancel
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleSaveEdit(note.id)} disabled={!editDraft.trim()}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-body-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap break-words">
                    {note.body}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-label-sm font-label text-[var(--color-text-muted)]">
                      {formatDate(note.created_at)}
                    </span>
                    <div className="flex items-center gap-1" data-print-hide>
                      <Button variant="text" size="sm" onClick={() => startEdit(note)}>
                        Edit
                      </Button>
                      <Button variant="text" size="sm" onClick={() => onDelete(note.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add new note */}
      <div className="flex flex-col gap-2" data-print-hide>
        <textarea
          className={textareaClass}
          placeholder="Add a revision note…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={handleAdd} disabled={!draft.trim() || adding} loading={adding}>
            Add note
          </Button>
        </div>
      </div>
    </div>
  )
}
