'use client'

import { useState, useTransition } from 'react'
import { assignAndReleaseDocument } from '../actions'
import { releaseDocument } from '../actions'

interface OrgReviewer {
  id: string
  display_name: string | null
  email: string
}

interface Props {
  documentId: string
  orgReviewers: OrgReviewer[]
}

export function PendingDocActions({ documentId, orgReviewers }: Props) {
  const [mode, setMode] = useState<'idle' | 'assign'>('idle')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleRelease() {
    setError(null)
    startTransition(async () => {
      try {
        await releaseDocument(documentId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to release document.')
      }
    })
  }

  function handleAssignAndRelease() {
    setError(null)
    startTransition(async () => {
      try {
        await assignAndReleaseDocument(documentId, Array.from(selected))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assign reviewers.')
      }
    })
  }

  if (mode === 'assign') {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <p className="text-xs font-medium text-slate-700">Assign reviewers before releasing</p>

        {orgReviewers.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No reviewers in your organization yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {orgReviewers.map(r => (
              <label
                key={r.id}
                className={[
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all',
                  selected.has(r.id)
                    ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                    : 'border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-[#1e3a5f]"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  disabled={isPending}
                />
                <span>
                  <span className="block text-xs font-medium text-slate-800">
                    {r.display_name ?? 'Unnamed'}
                  </span>
                  <span className="block text-xs text-slate-500">{r.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => { setMode('idle'); setSelected(new Set()); setError(null) }}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssignAndRelease}
            disabled={isPending}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              isPending
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm',
            ].join(' ')}
          >
            {isPending
              ? 'Releasing…'
              : selected.size > 0
              ? `Assign ${selected.size} & Release`
              : 'Release without assignment'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('assign')}
          disabled={isPending}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Assign & Release
        </button>
        <button
          type="button"
          onClick={handleRelease}
          disabled={isPending}
          className={[
            'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm',
            isPending
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]',
          ].join(' ')}
        >
          {isPending ? 'Releasing…' : 'Release'}
        </button>
      </div>
    </div>
  )
}
