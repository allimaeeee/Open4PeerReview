import { createClient } from '@/lib/supabase/server'
import { getCoordinatorDashboardData } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS } from '@/types'
import type { ExpertDomain } from '@/types'
import type { AssignmentDocShape, ReviewDocShape } from './CoordinatorDashboardClient'
import { CoordinatorDashboardClient } from './CoordinatorDashboardClient'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

type CoordData = Awaited<ReturnType<typeof getCoordinatorDashboardData>>
type ReviewRow = CoordData['released'][number]['reviews'][number]
type RubricStatus = 'unassigned' | 'assigned' | 'under-review' | 'review-submitted' | 'feedback-ready' | 'published'

function getRubricStatus(rubricId: string, reviews: ReviewRow[]): RubricStatus {
  const review = reviews.find(r => (r as { rubric_id?: string }).rubric_id === rubricId)
  if (!review) return 'unassigned'
  const status = review.status as string
  const approval = (review as { coordinator_approval?: string | null }).coordinator_approval ?? null
  if (status === 'submitted' && approval === 'approved') return 'feedback-ready'
  if (status === 'submitted') return 'review-submitted'
  if (status === 'in_progress') return 'under-review'
  if (status === 'assigned') return 'assigned'
  return 'unassigned'
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

  // Active (non-declined) assignments by document
  const assignmentsByDoc = new Map<string, { id: string; display_name: string | null; email: string }[]>()
  for (const a of assignments) {
    const reviewer = a.reviewer as { id: string; display_name: string | null; email: string } | null
    if (!reviewer || (a as { declined_at?: string | null }).declined_at) continue
    const list = assignmentsByDoc.get(a.document_id) ?? []
    list.push({ id: reviewer.id, display_name: reviewer.display_name, email: reviewer.email })
    assignmentsByDoc.set(a.document_id, list)
  }

  const reviewsSubmitted = released
    .flatMap(d => (d.reviews ?? []) as { status: string }[])
    .filter(r => r.status === 'submitted').length

  // ── Need Assignment bucket ────────────────────────────────────────────────
  const needAssignmentDocs: AssignmentDocShape[] = pending.map(doc => ({
    id: doc.id,
    title: doc.title,
    file_type: doc.file_type ?? null,
    created_at: doc.created_at,
    submission_scope: (doc.submission_scope ?? []) as string[],
    author: doc.author as { display_name: string | null; email: string } | null,
    document_rubrics: (doc.document_rubrics ?? []) as { rubric: { id: string; title: string } | null }[],
    preAssigned: assignmentsByDoc.get(doc.id) ?? [],
  }))

  // ── Under Review / Need Approval buckets ─────────────────────────────────
  const underReviewDocs: ReviewDocShape[] = []
  const needApprovalDocs: ReviewDocShape[] = []
  const approvedDocs: ReviewDocShape[] = []

  for (const doc of released) {
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const docAny = doc as {
      authors?: string
      platform?: string | null
      subject_matter?: string
      creative_commons_license?: string
      public_review?: boolean
    }

    const rubrics = (doc.document_rubrics ?? []).flatMap(dr => {
      const rubric = dr.rubric as { id: string; title: string } | null
      if (!rubric) return []
      return [{ rubricId: rubric.id, rubricTitle: rubric.title, status: getRubricStatus(rubric.id, reviews) }]
    })

    const scope = (doc.submission_scope ?? []) as string[]
    const reviewDoc: ReviewDocShape = {
      id: doc.id,
      title: doc.title,
      platform: docAny.platform ?? '',
      authors: docAny.authors ?? '',
      discipline: docAny.subject_matter ?? '',
      ccLicense: CC_LICENSE_LABELS[docAny.creative_commons_license as keyof typeof CC_LICENSE_LABELS] ?? docAny.creative_commons_license ?? '',
      submittedAt: doc.created_at,
      rubrics,
      publicReview: docAny.public_review === true || scope.includes('public'),
    }

    const allSubmitted = (doc.document_rubrics ?? []).every(dr => {
      const rubric = dr.rubric as { id: string; title: string } | null
      if (!rubric) return false
      return reviews.some(r => (r as { rubric_id?: string }).rubric_id === rubric.id && r.status === 'submitted')
    })

    const isApproved = rubrics.length > 0 && rubrics.every(r =>
      r.status === 'feedback-ready' || r.status === 'published'
    )

    if (allSubmitted && rubrics.some(r => r.status === 'review-submitted')) {
      needApprovalDocs.push(reviewDoc)
    } else if (isApproved) {
      approvedDocs.push(reviewDoc)
    } else {
      underReviewDocs.push(reviewDoc)
    }
  }

  return (
    <CoordinatorDashboardClient
      institution={institution ?? null}
      stats={{
        members: members.length,
        needAssignment: pending.length,
        needApproval: needApprovalDocs.length,
        reviewsSubmitted,
      }}
      orgReviewers={orgReviewers}
      needAssignment={needAssignmentDocs}
      underReview={underReviewDocs}
      needApproval={needApprovalDocs}
      approved={approvedDocs}
    >
      {/* Organization Members — untouched per Build Prompt 4 Step 4 */}
      {institution && (
        <section className="mt-8">
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
      )}
    </CoordinatorDashboardClient>
  )
}
