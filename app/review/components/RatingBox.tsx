'use client'

import { useState } from 'react'
import type { ScoreCommentItem } from './ReviewerConsole'
import { Button } from '@/components/ui/Button'

interface RatingBoxProps {
  variant: 'exceeds' | 'exemplifies' | 'does_not_meet'
  comments?: ScoreCommentItem[]
  onAddComment?: (body: string) => void
  onEditComment?: (commentId: string, body: string) => void
  onDeleteComment?: (commentId: string) => void
  standardText?: string
  isActive: boolean
  onToggle?: () => void
}

const LABELS: Record<string, string> = {
  exceeds:      'Exceeds',
  exemplifies:  'Exemplifies',
  does_not_meet: 'Does not meet',
}

export function RatingBox({
  variant,
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
  standardText,
  isActive,
  onToggle,
}: RatingBoxProps) {
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const containerBase = 'flex flex-col gap-2 p-3 rounded-md border flex-1 min-w-0 bg-surface-container'
  const borderClass = isActive ? 'border-primary' : 'border-border'
  const labelClass = `text-label-sm font-label font-semibold uppercase tracking-wide ${isActive ? 'text-primary' : 'text-text-secondary'}`

  if (variant === 'exemplifies') {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={[
          containerBase,
          borderClass,
          'cursor-pointer text-left w-full transition-colors',
          isActive ? 'bg-surface-container-high' : 'hover:border-primary hover:bg-surface-container',
        ].join(' ')}
      >
        <span className={labelClass}>{LABELS.exemplifies}</span>
        <p className={standardText ? 'text-body-sm text-text-secondary' : 'text-body-sm text-text-muted'}>
          {standardText || 'No standard defined'}
        </p>
      </button>
    )
  }

  return (
    <div className={`${containerBase} ${borderClass}`}>
      <span className={labelClass}>{LABELS[variant]}</span>

      {/* Existing comments */}
      {comments && comments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {comments.map(comment =>
            editingId === comment.id ? (
              <div key={comment.id} className="flex flex-col gap-1">
                <textarea
                  autoFocus
                  rows={2}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  className="w-full resize-none rounded-md border border-border bg-transparent p-2 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-body-sm text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!editBody.trim()}
                    onClick={() => {
                      onEditComment?.(comment.id, editBody.trim())
                      setEditingId(null)
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div key={comment.id} className="flex items-start justify-between gap-2 group">
                <p className="text-body-sm text-text-primary flex-1">{comment.body}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditingId(comment.id); setEditBody(comment.body) }}
                    className="text-text-muted hover:text-text-primary"
                    aria-label="Edit comment"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteComment?.(comment.id)}
                    className="text-text-muted hover:text-text-primary"
                    aria-label="Delete comment"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Add comment */}
      <textarea
        rows={2}
        placeholder="Add comment..."
        value={newComment}
        onChange={e => setNewComment(e.target.value)}
        className="w-full resize-none rounded-md border border-border bg-transparent p-2 text-body-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          disabled={!newComment.trim()}
          onClick={() => {
            onAddComment?.(newComment.trim())
            setNewComment('')
          }}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export default RatingBox
