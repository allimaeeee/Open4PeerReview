import { createClient } from '@/lib/supabase/server'
import { getAllDocumentsWithRubrics } from '@/lib/supabase/queries'
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

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Available Documents</h2>
        <p className="text-sm text-slate-500 mt-0.5">Select a document to start or continue a peer review.</p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-600">No documents available yet</p>
          <p className="mt-1 text-xs text-slate-400">Check back later — authors will upload documents for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => {
            const author = doc.author as { display_name: string | null; email: string } | null
            const rubrics = (doc.document_rubrics ?? [])
              .map(dr => dr.rubric)
              .filter(Boolean) as { id: string; title: string }[]
            const reviews = (doc.reviews ?? []) as { id: string; status: string; reviewer_id: string }[]
            const myReview = reviews.find(r => r.reviewer_id === userId)
            const isSubmitted = myReview?.status === 'submitted'
            const isInProgress = myReview?.status === 'in_progress'

            return (
              <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      By {author?.display_name ?? author?.email ?? 'Unknown'} · {formatDate(doc.created_at)}
                    </p>

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
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Submitted
                      </span>
                    ) : isInProgress ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        In Progress
                      </span>
                    ) : null}

                    <Link
                      href={`/review?document=${doc.id}`}
                      className={[
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        isSubmitted
                          ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                          : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm',
                      ].join(' ')}
                    >
                      {isSubmitted ? 'View Review' : isInProgress ? 'Continue Review' : 'Start Review'}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
