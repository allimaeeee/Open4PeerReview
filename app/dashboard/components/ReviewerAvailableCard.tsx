'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptDocument, declineDocument } from '../actions'

interface ReviewerAvailableCardProps {
  doc: {
    id: string
    title: string
    created_at: string
    subject_matter: string | null
    creative_commons_license: string | null
    third_party_content_disclosure: string | null
    author: { display_name: string | null; email: string } | null
    rubrics: { id: string; title: string }[]
  }
  subjectLabel: string | null
  licenseLabel: string | null
  isAccepted: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ReviewerAvailableCard({ doc, subjectLabel, licenseLabel, isAccepted }: ReviewerAvailableCardProps) {
  const [accepted, setAccepted] = useState(isAccepted)
  const [declining, setDeclining] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isStarting, setIsStarting] = useState(false)
  const router = useRouter()

  if (declined) return null

  function handleAccept() {
    setAccepted(true)
    startTransition(async () => {
      await acceptDocument(doc.id)
    })
  }

  async function handleStartReview() {
    setIsStarting(true)
    await acceptDocument(doc.id)
    router.push(`/review?document=${doc.id}`)
  }

  function handleDeclineSubmit() {
    if (!note.trim()) {
      setNoteError('Please provide a reason for declining.')
      return
    }
    setNoteError(null)
    startTransition(async () => {
      await declineDocument(doc.id, note.trim())
      setDeclined(true)
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            By {doc.author?.display_name ?? doc.author?.email ?? 'Unknown'} · {formatDate(doc.created_at)}
          </p>
          {subjectLabel && (
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-medium">Subject:</span> {subjectLabel}
            </p>
          )}
          {licenseLabel && (
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-medium">License:</span> {licenseLabel}
            </p>
          )}
          {doc.third_party_content_disclosure && (
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-medium">Third-Party Content:</span>{' '}
              {doc.third_party_content_disclosure}
            </p>
          )}
          {doc.rubrics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {doc.rubrics.map(r => (
                <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {r.title}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400 italic">No rubrics assigned</p>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <button
            onClick={handleStartReview}
            disabled={isStarting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isStarting ? 'Opening…' : 'Start Review'}
          </button>
        </div>
      </div>

      {/* Accept / Decline prompt */}
      {!accepted && !declining && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Will you review this document?</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeclining(true)}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {accepted && !declining && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Accepted
          </span>
        </div>
      )}

      {declining && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <p className="text-xs font-medium text-slate-700">Why are you declining this review?</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Outside my area of expertise, scheduling conflict…"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] resize-none"
          />
          {noteError && <p className="text-xs text-red-600">{noteError}</p>}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setDeclining(false); setNote(''); setNoteError(null) }}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeclineSubmit}
              disabled={isPending || !note.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Declining…' : 'Confirm Decline'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
