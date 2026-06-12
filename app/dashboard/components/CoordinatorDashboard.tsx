import { createClient } from '@/lib/supabase/server'
import { getCoordinatorDashboardData } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS } from '@/types'
import type { ExpertDomain } from '@/types'
import Link from 'next/link'
import { PendingDocActions } from './PendingDocActions'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', html: 'HTML', image: 'Image', audio: 'Audio',
}

type CoordData = Awaited<ReturnType<typeof getCoordinatorDashboardData>>
type DocRow = CoordData['pending'][number]
type AssignmentWithDecline = { id: string; display_name: string | null; email: string; decline_note: string | null; declined_at: string | null }

function DocCard({
  doc,
  showRelease,
  assignedReviewers,
  orgReviewers,
}: {
  doc: DocRow
  showRelease: boolean
  assignedReviewers?: AssignmentWithDecline[]
  orgReviewers?: { id: string; display_name: string | null; email: string }[]
}) {
  const author = doc.author as { id: string; display_name: string | null; email: string; institution: string | null } | null
  const rubrics = (doc.document_rubrics ?? []).map(dr => dr.rubric).filter(Boolean) as { id: string; title: string }[]
  const reviews = (doc.reviews ?? []) as { id: string; status: string }[]
  const submitted = reviews.filter(r => r.status === 'submitted').length
  const inProgress = reviews.filter(r => r.status === 'assigned' || r.status === 'in_progress').length
  const scope: string[] = (doc.submission_scope ?? []) as string[]

  const activeReviewers = (assignedReviewers ?? []).filter(r => !r.declined_at)
  const declinedReviewers = (assignedReviewers ?? []).filter(r => !!r.declined_at)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900">{doc.title}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {FILE_TYPE_LABEL[doc.file_type ?? ''] ?? doc.file_type}
            </span>
            {scope.includes('public') && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                Also public
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {author?.display_name ?? author?.email ?? 'Unknown'} · {formatDate(doc.created_at)}
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
          {activeReviewers.length > 0 && (
            <div className="mt-2.5">
              <p className="text-xs text-slate-500 font-medium mb-1">Assigned reviewers</p>
              <div className="flex flex-wrap gap-1.5">
                {activeReviewers.map(r => (
                  <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                    {r.display_name ?? r.email}
                  </span>
                ))}
              </div>
            </div>
          )}
          {declinedReviewers.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              <p className="text-xs text-slate-500 font-medium">Declined</p>
              {declinedReviewers.map(r => (
                <div key={r.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                  <p className="text-xs font-medium text-red-700">{r.display_name ?? r.email}</p>
                  {r.decline_note && (
                    <p className="text-xs text-red-600 mt-0.5">&ldquo;{r.decline_note}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!showRelease && (
          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">
                {submitted} <span className="font-normal text-slate-400">submitted</span>
              </p>
              {inProgress > 0 && (
                <p className="text-xs text-amber-600">{inProgress} in progress</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {submitted > 0 && (
                <Link
                  href={`/dashboard/feedback/${doc.id}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  View Feedback
                </Link>
              )}
              <Link
                href={`/review?document=${doc.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Open
              </Link>
            </div>
          </div>
        )}
      </div>

      {showRelease && (
        <PendingDocActions
          documentId={doc.id}
          orgReviewers={orgReviewers ?? []}
        />
      )}
    </div>
  )
}

export async function CoordinatorDashboard() {
  const supabase = await createClient()
  const {
    institution,
    members,
    rubrics: rubricsList,
    pending,
    released,
    assignments,
  } = await getCoordinatorDashboardData(supabase)

  const orgReviewers = members
    .filter(m => ((m.roles ?? []) as string[]).includes('reviewer'))
    .map(m => ({ id: m.id, display_name: m.display_name, email: m.email }))

  const rubricMap = new Map(rubricsList.map(r => [r.id, r.title]))

  // Build assignment map: document_id → reviewer[] (with decline info)
  const assignmentsByDoc = new Map<string, AssignmentWithDecline[]>()
  for (const a of assignments) {
    const reviewer = a.reviewer as { id: string; display_name: string | null; email: string } | null
    if (!reviewer) continue
    const list = assignmentsByDoc.get(a.document_id) ?? []
    list.push({
      id: reviewer.id,
      display_name: reviewer.display_name,
      email: reviewer.email,
      decline_note: (a as { decline_note?: string | null }).decline_note ?? null,
      declined_at: (a as { declined_at?: string | null }).declined_at ?? null,
    })
    assignmentsByDoc.set(a.document_id, list)
  }

  const totalReviews = released.flatMap(d => (d.reviews ?? []) as { status: string }[])
  const reviewsInProgress = totalReviews.filter(r => r.status === 'assigned' || r.status === 'in_progress').length
  const reviewsSubmitted = totalReviews.filter(r => r.status === 'submitted').length

  return (
    <div className="space-y-10">

      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Coordinator Dashboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {institution ? `Managing OER for ${institution}` : 'No organization set — add one in your profile settings.'}
        </p>
      </div>

      {!institution ? null : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Members', value: members.length },
              { label: 'Pending Release', value: pending.length },
              { label: 'Under Review', value: reviewsInProgress },
              { label: 'Reviews Submitted', value: reviewsSubmitted },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-center">
                <p className="text-2xl font-bold text-[#1e3a5f]">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Pending org submissions from authors */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-semibold text-slate-800">Pending Release</h3>
              {pending.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {pending.length}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 -mt-1 mb-4">
              These documents were submitted to your organization and are awaiting your approval before appearing in reviewer queues.
            </p>
            {pending.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                <p className="text-sm text-slate-500">No documents pending release.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map(doc => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    showRelease
                    assignedReviewers={assignmentsByDoc.get(doc.id)}
                    orgReviewers={orgReviewers}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Released — active in reviewer pool */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-semibold text-slate-800">Released for Review</h3>
              {released.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  {released.length}
                </span>
              )}
            </div>
            {released.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                <p className="text-sm text-slate-500">No documents have been released yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {released.map(doc => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    showRelease={false}
                    assignedReviewers={assignmentsByDoc.get(doc.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Organization members */}
          <section>
            <h3 className="text-base font-semibold text-slate-800 mb-3">Organization Members</h3>
            {members.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                <p className="text-sm text-slate-500">No other members found for {institution}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Roles</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reviewer type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Expertise</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Rubric expertise</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map(m => {
                      const roles: string[] = (m.roles ?? []) as string[]
                      const tags: string[] = (m.expertise_tags ?? []) as string[]
                      const specializations: string[] = (m.rubric_specializations ?? []) as string[]
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {m.display_name ?? <span className="text-slate-400 italic">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{m.email}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {roles.length > 0 ? roles.map(r => (
                                <span key={r} className="text-xs capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {r}
                                </span>
                              )) : <span className="text-slate-400 text-xs italic">none</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 capitalize text-xs">
                            {m.reviewer_type?.replace('_', ' ') ?? <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 3).map(t => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                  {EXPERT_DOMAIN_LABELS[t as ExpertDomain] ?? t}
                                </span>
                              ))}
                              {tags.length > 3 && (
                                <span className="text-xs text-slate-400">+{tags.length - 3} more</span>
                              )}
                              {tags.length === 0 && <span className="text-slate-300 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {specializations.slice(0, 3).map(id => {
                                const title = rubricMap.get(id) ?? id
                                return (
                                  <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                                    {title}
                                  </span>
                                )
                              })}
                              {specializations.length > 3 && (
                                <span className="text-xs text-slate-400">+{specializations.length - 3} more</span>
                              )}
                              {specializations.length === 0 && <span className="text-slate-300 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                            {m.created_at ? formatDate(m.created_at) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
