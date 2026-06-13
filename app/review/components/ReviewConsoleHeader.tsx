'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface ReviewConsoleHeaderProps {
  scoredCount: number
  totalCount: number
  lastSavedAt: Date | null
  onBack: () => void
  onSubmit: () => Promise<void>
  isSubmitted: boolean
}

function formatLastSaved(lastSavedAt: Date | null): string {
  if (!lastSavedAt) return 'Not yet saved'
  const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000)
  const time = lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffSec < 10) return `Last saved ${time} (just now)`
  if (diffSec < 60) return `Last saved ${time} (${diffSec}s ago)`
  const diffMin = Math.floor(diffSec / 60)
  return `Last saved ${time} (${diffMin}m ago)`
}

export function ReviewConsoleHeader({
  scoredCount,
  totalCount,
  lastSavedAt,
  onBack,
  onSubmit,
  isSubmitted,
}: ReviewConsoleHeaderProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(id)
  }, [])

  const submitDisabled = scoredCount < totalCount || isSubmitted

  return (
    <header className="flex-shrink-0 bg-surface-card border-b border-border px-6 py-3 flex items-center justify-between gap-4">
      {/* Left — back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-body-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to dashboard
      </button>

      {/* Right */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Last saved */}
        <span className="text-body-sm text-text-muted">
          {formatLastSaved(lastSavedAt)}
        </span>

        {/* Criteria rated count */}
        <span className={[
          'text-body-sm font-medium',
          scoredCount === totalCount && totalCount > 0
            ? 'text-success'
            : 'text-text-muted',
        ].join(' ')}>
          {scoredCount}/{totalCount} criteria rated
        </span>

        {/* Submit button */}
        <Button
          variant="primary"
          disabled={submitDisabled}
          title={
            !isSubmitted && scoredCount < totalCount
              ? `Rate all ${totalCount} criteria before submitting`
              : undefined
          }
          onClick={() => setConfirmOpen(true)}
        >
          {isSubmitted ? (
            'Submitted'
          ) : (
            <>
              Submit Review
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22 11 13 2 9l20-7z" />
              </svg>
            </>
          )}
        </Button>
      </div>

      {/* Confirmation dialog */}
      <Modal open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)}>
        <div
          onClick={e => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-card rounded-lg shadow-4 p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-title-md font-semibold text-text-primary">Submit review?</h2>
            <p className="text-body-sm text-text-secondary">
              This will share your review with the author. You won't be able to make further edits after submitting.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
              className="text-body-sm text-text-muted hover:text-text-primary cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true)
                await onSubmit()
                setSubmitting(false)
                setConfirmOpen(false)
              }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>
    </header>
  )
}

export default ReviewConsoleHeader
