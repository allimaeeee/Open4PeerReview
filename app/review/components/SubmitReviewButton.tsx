'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface SubmitReviewButtonProps {
  activeRubricRated: number
  activeRubricTotal: number
  rubricName: string
  isReadOnly: boolean
  onSubmit: () => Promise<void>
}

export function SubmitReviewButton({
  activeRubricRated,
  activeRubricTotal,
  rubricName,
  isReadOnly,
  onSubmit,
}: SubmitReviewButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitDisabled = activeRubricRated < activeRubricTotal || isReadOnly

  return (
    <>
      <Button
        variant="primary"
        disabled={submitDisabled}
        title={
          !isReadOnly && activeRubricRated < activeRubricTotal
            ? `Rate all ${activeRubricTotal} criteria before submitting`
            : undefined
        }
        onClick={() => setConfirmOpen(true)}
      >
        Submit {rubricName} Review
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
      </Button>

      <Modal open={confirmOpen} onClose={() => { if (!submitting) { setConfirmOpen(false); setSubmitError(null) } }}>
        <div
          onClick={e => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-card rounded-lg shadow-4 p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-title-md font-semibold text-text-primary">Submit {rubricName} review?</h2>
            <p className="text-body-sm text-text-secondary">
              This will submit your {rubricName} ratings and share them with the author. You can continue reviewing other sections, but you won't be able to edit this section after submitting.
            </p>
          </div>
          {submitError && (
            <p className="text-body-sm text-[var(--color-rating-dnm-text)]">{submitError}</p>
          )}
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
                setSubmitError(null)
                try {
                  await onSubmit()
                  setConfirmOpen(false)
                } catch (e) {
                  setSubmitError(e instanceof Error ? e.message : 'Submit failed — please try again')
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default SubmitReviewButton
