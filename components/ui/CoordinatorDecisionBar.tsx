'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export type CoordinatorApproval = 'pending' | 'approved' | 'changes_requested' | null

interface CoordinatorDecisionBarProps {
  /** Current approval state of the review being viewed. */
  approval: CoordinatorApproval
  /** The reviewer whose work is being decided on (for context in the bar). */
  reviewerName: string
  /** Approve and release this review to the author. */
  onApprove: () => Promise<void>
  /** Send the review back to the reviewer with a required explanatory note. */
  onReturn: (note: string) => Promise<void>
  className?: string
}

/**
 * Coordinator-only decision bar shown above the review report. For a submitted
 * org review awaiting approval, the coordinator either approves it (releasing it
 * to the author) or sends it back to the reviewer with a note.
 */
export function CoordinatorDecisionBar({
  approval,
  reviewerName,
  onApprove,
  onReturn,
  className,
}: CoordinatorDecisionBarProps) {
  const [mode, setMode] = useState<'idle' | 'returning'>('idle')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<null | 'approve' | 'return'>(null)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setBusy('approve')
    setError(null)
    try {
      await onApprove()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve — please try again.')
    } finally {
      setBusy(null)
    }
  }

  const handleReturn = async () => {
    const trimmed = note.trim()
    if (!trimmed) {
      setError('Please add a note explaining what needs to change.')
      return
    }
    setBusy('return')
    setError(null)
    try {
      await onReturn(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send back — please try again.')
      setBusy(null)
    }
    // On success the page revalidates/navigates away; leave busy state as-is.
  }

  if (approval === 'approved') {
    return (
      <div
        className={cx(
          'rounded-lg border border-[var(--color-success)] bg-[var(--color-success-container)] px-5 py-3',
          className
        )}
      >
        <p className="text-body-sm font-label font-semibold text-[var(--color-success)]">
          Released to the author
        </p>
        <p className="mt-0.5 text-body-sm text-[var(--color-text-secondary)]">
          {reviewerName}&rsquo;s review is now visible to the author.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cx(
        'rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-container)] px-5 py-4',
        className
      )}
      data-print-hide
    >
      <p className="text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Coordinator review
      </p>
      <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
        Review {reviewerName}&rsquo;s feedback below, then release it to the author or send it back
        for changes. The author cannot see this review until you release it.
      </p>

      {mode === 'idle' ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm" onClick={handleApprove} loading={busy === 'approve'} disabled={busy !== null}>
            Release to author
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setMode('returning'); setError(null) }} disabled={busy !== null}>
            Send back to reviewer
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-label-sm font-label font-semibold text-[var(--color-text-primary)]">
            Why are you sending this back? <span className="text-[var(--color-error)]">*</span>
          </label>
          <textarea
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] px-3 py-2 text-body-sm text-[var(--color-text-primary)] leading-relaxed resize-y min-h-[80px] focus:outline-none focus:border-[var(--color-border-strong)]"
            placeholder="Explain what the reviewer needs to revise before this can go to the author…"
            value={note}
            onChange={e => setNote(e.target.value)}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="text"
              size="sm"
              onClick={() => { setMode('idle'); setNote(''); setError(null) }}
              disabled={busy === 'return'}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReturn}
              loading={busy === 'return'}
              disabled={!note.trim() || busy === 'return'}
            >
              Send back to reviewer
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-body-sm text-[var(--color-error)]">{error}</p>}
    </div>
  )
}
