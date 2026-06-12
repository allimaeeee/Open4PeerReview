import { createClient } from '@/lib/supabase/server'
import { getDocumentsForReviewer } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense } from '@/types'
import Link from 'next/link'
import { ReviewerAvailableCard } from './ReviewerAvailableCard'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  userId: string
}

export async function ReviewerDashboard({ userId }: Props) {
  const supabase = await createClient()
  const { documents, acceptedDocIds } = await getDocumentsForReviewer(supabase, userId)

  type Doc = (typeof documents)[number]
  type ReviewRow = { id: string; status: string; reviewer_id: string; submitted_at: string | null; review_scores: { id: string; score: string | null }[] }
  type AuthorRow = { id: string; display_name: string | null; email: string; institution: string | null } | null

  const inProgress: Doc[] = []
  const available: Doc[] = []
  const completed: Doc[] = []

  for (const doc of documents) {
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReview = reviews.find(r => r.reviewer_id === userId)
    if (myReview?.status === 'submitted') {
      completed.push(doc)
    } else if (myReview?.status === 'in_progress') {
      inProgress.push(doc)
    } else {
      // 'assigned' (not yet opened) or no review row → available
      available.push(doc)
    }
  }

  // Server-rendered card used for in-progress and completed docs
  function DocCard({
    doc,
    myStatus,
    scoredCount,
    totalCount,
  }: {
    doc: Doc
    myStatus: 'assigned' | 'in_progress' | 'submitted' | null
    scoredCount?: number
    totalCount?: number
  }) {
    const author = doc.author as AuthorRow
    const rubrics = (doc.document_rubrics ?? [])
      .map(dr => dr.rubric)
      .filter(Boolean) as { id: string; title: string; rubric_items?: { id: string }[] }[]
    const subjectLabel = doc.subject_matter
      ? (EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter)
      : null
    const licenseLabel = doc.creative_commons_license
      ? (CC_LICENSE_LABELS[doc.creative_commons_license as CreativeCommonsLicense] ?? doc.creative_commons_license)
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

        {myStatus === 'in_progress' && totalCount !== undefined && totalCount > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">Criteria scored</span>
              <span className="text-xs font-medium text-slate-700">{scoredCount ?? 0} / {totalCount}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1e3a5f] transition-all"
                style={{ width: `${Math.round(((scoredCount ?? 0) / totalCount) * 100)}%` }}
              />
            </div>
          </div>
        )}
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
              const reviews = (doc.reviews ?? []) as ReviewRow[]
              const myReview = reviews.find(r => r.reviewer_id === userId)
              const scoredCount = (myReview?.review_scores ?? []).filter(s => s.score !== null).length
              const totalCount = (doc.document_rubrics ?? []).reduce((sum, dr) => {
                const items = (dr.rubric as { id: string; title: string; rubric_items?: { id: string }[] } | null)?.rubric_items ?? []
                return sum + items.length
              }, 0)
              return (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  myStatus={myReview?.status as 'in_progress' | null ?? null}
                  scoredCount={scoredCount}
                  totalCount={totalCount}
                />
              )
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
          Accept documents you plan to review, or decline with a note to remove them from your queue.
        </p>

        {available.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <p className="text-sm text-slate-500">
              {documents.length === 0
                ? 'No documents are available for review yet.'
                : 'You have reviewed all available documents.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {available.map(doc => {
              const author = doc.author as AuthorRow
              const rubrics = (doc.document_rubrics ?? [])
                .map(dr => dr.rubric)
                .filter(Boolean) as { id: string; title: string }[]
              const subjectLabel = doc.subject_matter
                ? (EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter)
                : null
              const licenseLabel = doc.creative_commons_license
                ? (CC_LICENSE_LABELS[doc.creative_commons_license as CreativeCommonsLicense] ?? doc.creative_commons_license)
                : null
              return (
                <ReviewerAvailableCard
                  key={doc.id}
                  doc={{
                    id: doc.id,
                    title: doc.title,
                    created_at: doc.created_at,
                    subject_matter: doc.subject_matter ?? null,
                    creative_commons_license: doc.creative_commons_license ?? null,
                    third_party_content_disclosure: doc.third_party_content_disclosure ?? null,
                    author: author ? { display_name: author.display_name, email: author.email } : null,
                    rubrics,
                  }}
                  subjectLabel={subjectLabel}
                  licenseLabel={licenseLabel}
                  isAccepted={acceptedDocIds.has(doc.id)}
                />
              )
            })}
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
