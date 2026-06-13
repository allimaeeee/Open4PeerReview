'use client'

import { useState, useTransition } from 'react'
import { saveReviewerAssignments } from '../actions'

interface OrgReviewer {
  id: string
  display_name: string | null
  email: string
}

interface Props {
  documentId: string
  orgReviewers: OrgReviewer[]
  onDone: () => void
}

export function AssignReviewersStep({ documentId, orgReviewers, onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggleReviewer(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handlePublish() {
    setError(null)
    startTransition(async () => {
      try {
        await saveReviewerAssignments(documentId, Array.from(selected))
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to publish document.')
      }
    })
  }

  const publishLabel = selected.size > 0
    ? `Assign ${selected.size} reviewer${selected.size === 1 ? '' : 's'} & Publish`
    : 'Publish to Org Pool'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Assign Reviewers</h3>
        <p className="text-sm text-slate-500 mt-1">
          Select org members to assign to this document, or publish it to the general org reviewer pool without a specific assignment.
        </p>
      </div>

      {orgReviewers.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center mb-5">
          <p className="text-sm text-slate-500">No reviewers found in your organization.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-5 pr-1">
          {orgReviewers.map(r => (
            <label
              key={r.id}
              className={[
                'flex items-center gap-3 rounded-lg border-2 px-3.5 py-2.5 cursor-pointer transition-all',
                selected.has(r.id) ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-[#1e3a5f]"
                checked={selected.has(r.id)}
                onChange={() => toggleReviewer(r.id)}
                disabled={isPending}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {r.display_name ?? 'Unnamed'}
                </span>
                <span className="block text-xs text-slate-500">{r.email}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5 mb-4">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          className={[
            'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
            isPending
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm',
          ].join(' ')}
        >
          {isPending ? 'Publishing…' : publishLabel}
        </button>
      </div>
    </div>
  )
}
