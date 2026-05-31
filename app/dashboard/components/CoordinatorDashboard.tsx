import { createClient } from '@/lib/supabase/server'
import { getCoordinatorStats, getAllDocumentsForCoordinator } from '@/lib/supabase/queries'
import Link from 'next/link'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', html: 'HTML', image: 'Image', audio: 'Audio',
}

export async function CoordinatorDashboard() {
  const supabase = await createClient()
  const [stats, documents] = await Promise.all([
    getCoordinatorStats(supabase),
    getAllDocumentsForCoordinator(supabase),
  ])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Coordinator Overview</h2>
        <p className="text-sm text-slate-500 mt-0.5">Monitor documents, reviews, and platform activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Documents', value: stats.documentCount },
          { label: 'Total Reviews', value: stats.reviewTotal },
          { label: 'In Progress', value: stats.reviewsInProgress },
          { label: 'Submitted', value: stats.reviewsSubmitted },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-center">
            <p className="text-2xl font-bold text-[#1e3a5f]">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Documents table */}
      <h3 className="text-base font-semibold text-slate-800 mb-3">All Documents</h3>
      {documents.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-slate-500">No documents have been uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => {
            const author = doc.author as { display_name: string | null; email: string } | null
            const rubrics = (doc.document_rubrics ?? [])
              .map(dr => dr.rubric)
              .filter(Boolean) as { id: string; title: string }[]
            const reviews = (doc.reviews ?? []) as { id: string; status: string }[]
            const submitted = reviews.filter(r => r.status === 'submitted').length
            const inProgress = reviews.filter(r => r.status === 'in_progress').length

            return (
              <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-slate-900">{doc.title}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {FILE_TYPE_LABEL[doc.file_type] ?? doc.file_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {author?.display_name ?? author?.email ?? 'Unknown'} · Uploaded {formatDate(doc.created_at)}
                    </p>
                    {rubrics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {rubrics.map(r => (
                          <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            {r.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        {submitted} <span className="font-normal text-slate-400">submitted</span>
                      </p>
                      {inProgress > 0 && (
                        <p className="text-xs text-amber-600">{inProgress} in progress</p>
                      )}
                    </div>
                    <Link
                      href={`/review?document=${doc.id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Open
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
