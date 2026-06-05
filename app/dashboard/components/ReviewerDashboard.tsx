import { createClient } from '@/lib/supabase/server'
import { getAllDocumentsWithRubrics } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS } from '@/types'
import type { ExpertDomain } from '@/types'
import Link from 'next/link'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  userId: string
}

export async function ReviewerDashboard({ userId }: Props) {
  const supabase = await createClient()
  const documents = await getAllDocumentsWithRubrics(supabase)

  type Doc = (typeof documents)[number]
  type ReviewRow = { id: string; status: string; reviewer_id: string; submitted_at: string | null }
  type AuthorRow = { id: string; display_name: string | null; email: string } | null

  // Exclude documents the reviewer authored
  const reviewable = documents.filter(d => (d.author as AuthorRow)?.id !== userId)

  const inProgress: Doc[] = []
  const available: Doc[] = []
  const completed: Doc[] = []

  for (const doc of reviewable) {
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReview = reviews.find(r => r.reviewer_id === userId)
    if (myReview?.status === 'in_progress') inProgress.push(doc)
    else if (myReview?.status === 'submitted') completed.push(doc)
    else available.push(doc)
  }

  function DocCard({
    doc,
    myStatus,
  }: {
    doc: Doc
    myStatus: 'in_progress' | 'submitted' | null
  }) {
    const author = doc.author as AuthorRow
    const rubrics = (doc.document_rubrics ?? [])
      .map(dr => dr.rubric)
      .filter(Boolean) as { id: string; title: string }[]
    const subjectLabel = doc.subject_matter
      ? (EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter)
      : null

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              By {author?.display_name ?? author?.email ?? 'Unknown'} · {formatDate(doc.created_at)}
            </p>
            {subjectLabel && (
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-medium">Subject:</span> {subjectLabel}
              </p>
            )}
            {rubrics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {rubrics.map(r => (
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
            {myStatus === 'in_progress' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                In Progress
              </span>
            )}
            {myStatus === 'submitted' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Submitted
              </span>
            )}
            <Link
              href={`/review?document=${doc.id}`}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                myStatus === 'submitted'
                  ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm',
              ].join(' ')}
            >
              {myStatus === 'submitted' ? 'View Review' : myStatus === 'in_progress' ? 'Continue Review' : 'Start Review'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">

      {/* ── Active Reviews ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Active Reviews</h2>
          {inProgress.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {inProgress.length}
            </span>
          )}
        </div>

        {inProgress.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <p className="text-sm text-slate-500">No reviews in progress.</p>
            <p className="text-xs text-slate-400 mt-1">Claim a document below to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inProgress.map(doc => {
              const reviews = (doc.reviews ?? []) as { id: string; status: string; reviewer_id: string; submitted_at: string | null }[]
              const myReview = reviews.find(r => r.reviewer_id === userId)
              return <DocCard key={doc.id} doc={doc} myStatus={myReview?.status as 'in_progress' | null ?? null} />
            })}
          </div>
        )}
      </section>

      {/* ── Available Documents ────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Available to Review</h2>
          {available.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {available.length}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 -mt-2 mb-4">
          Click <span className="font-medium">Start Review</span> to claim a document and begin your review.
        </p>

        {available.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <p className="text-sm text-slate-500">
              {reviewable.length === 0
                ? 'No documents have been uploaded yet.'
                : 'You have reviewed all available documents.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {available.map(doc => (
              <DocCard key={doc.id} doc={doc} myStatus={null} />
            ))}
          </div>
        )}
      </section>

      {/* ── Completed Reviews ──────────────────────────────────────── */}
      {completed.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Completed Reviews</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {completed.length}
            </span>
          </div>
          <div className="space-y-3">
            {completed.map(doc => (
              <DocCard key={doc.id} doc={doc} myStatus="submitted" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
