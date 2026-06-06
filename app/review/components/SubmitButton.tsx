'use client'

// app/reviewer/_components/SubmitButton.tsx

import { useState } from 'react'

interface SubmitButtonProps {
  isSubmitted: boolean
  scoredCount: number
  totalCount: number
  overallComment: string
  onOverallCommentChange: (v: string) => void
  onSubmit: (overallComment: string) => Promise<string | null>
}

export function SubmitButton({
  isSubmitted,
  scoredCount,
  totalCount,
  overallComment,
  onOverallCommentChange,
  onSubmit,
}: SubmitButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allScored = scoredCount === totalCount && totalCount > 0

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    const err = await onSubmit(overallComment)
    setLoading(false)
    if (err) {
      // Surface the DB trigger message (names missing criteria)
      setError(err)
    } else {
      setOpen(false)
    }
  }

  if (isSubmitted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd" />
        </svg>
        Submitted
      </span>
    )
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className={[
          'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
          allScored
            ? 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm hover:shadow-md active:scale-95'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed',
        ].join(' ')}
        title={!allScored ? `${totalCount - scoredCount} criteria still unrated` : 'Submit your review'}
      >
        Submit Review
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-lg font-bold text-slate-900">Submit your review</h2>
              <p className="mt-1 text-sm text-slate-500">
                Once submitted your scores and annotations are locked and cannot be edited.
              </p>
            </div>

            {/* Completion check */}
            <div className={[
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm',
              allScored
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-red-50 text-red-800',
            ].join(' ')}>
              {allScored ? (
                <>
                  <svg className="h-5 w-5 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd" />
                  </svg>
                  All {totalCount} criteria rated
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd" />
                  </svg>
                  {totalCount - scoredCount} of {totalCount} criteria still unrated
                </>
              )}
            </div>

            {/* Overall comment */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Overall comment <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={4}
                placeholder="Any overall observations about this OER…"
                value={overallComment}
                onChange={(e) => onOverallCommentChange(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-200 px-3.5 py-2.5 resize-none
                  focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]
                  placeholder-slate-300"
              />
            </div>

            {/* DB error (e.g. missing criteria from trigger) */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 leading-relaxed">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium
                  text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !allScored}
                className={[
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                  'inline-flex items-center justify-center gap-2',
                  allScored && !loading
                    ? 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                ].join(' ')}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </>
                ) : (
                  'Confirm & Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
