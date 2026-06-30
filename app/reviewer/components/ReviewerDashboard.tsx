import { createClient } from '@/lib/supabase/server'
import { getAllDocumentsWithRubrics } from '@/lib/supabase/queries'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense } from '@/types'
import { ReviewerDashboardClient } from './ReviewerDashboardClient'

interface Props {
  userId: string
  displayName: string
}

export async function ReviewerDashboard({ userId, displayName }: Props) {
  const supabase = await createClient()
  const documents = await getAllDocumentsWithRubrics(supabase)

  // Fetch coordinator assignments for this reviewer (non-declined only)
  const { data: assignmentsData } = await supabase
    .from('document_assignments')
    .select('document_id')
    .eq('reviewer_id', userId)
    .is('declined_at', null)
  const assignedIds = new Set((assignmentsData ?? []).map(a => a.document_id))

  type ReviewScoreRow = { id: string; rubric_item_id: string; criterion_scores: string[] }
  type ReviewRow = { id: string; status: string; reviewer_id: string; submitted_at: string | null; rubric_id: string | null; general_comment: string | null; review_scores: ReviewScoreRow[] }
  type AuthorRow = { display_name: string | null; email: string } | null
  type Doc = (typeof documents)[number]

  function getFileLabel(fileType: string | null): string {
    if (fileType === 'pdf') return 'PDF'
    if (fileType === 'html') return 'Web URL'
    return fileType?.toUpperCase() ?? ''
  }

  type RubricRow = { id: string; title: string; rubric_items?: { id: string }[] }

  function mapRubrics(doc: Doc) {
    return (doc.document_rubrics ?? [])
      .map(dr => dr.rubric as RubricRow | null)
      .filter((r): r is RubricRow => r !== null)
  }

  function mapRubricsWithProgress(doc: Doc) {
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReviews = reviews.filter(rev => rev.reviewer_id === userId)
    const myReview = myReviews.find(r => r.status === 'submitted')
      ?? myReviews.find(r => r.status === 'in_progress')
      ?? myReviews[0]
    const myScores = myReview?.review_scores ?? []
    return mapRubrics(doc).map(r => {
      const rubricItemIds = new Set((r.rubric_items ?? []).map(item => item.id))
      const totalCount = rubricItemIds.size
      const ratedCount = myScores.filter(
        rs => rubricItemIds.has(rs.rubric_item_id) && (rs.criterion_scores ?? []).length > 0
      ).length
      return { rubricId: r.id, rubricTitle: r.title, ratedCount, totalCount }
    })
  }

  const activeReviews: Doc[] = []
  const taskPool: Doc[] = []
  const completedReviews: Doc[] = []

  for (const doc of documents) {
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReviews = reviews.filter(r => r.reviewer_id === userId)
    // Prefer submitted over in_progress — a reviewer may have multiple reviews
    // (e.g. a stale one from a reassigned rubric plus a newly-submitted one).
    const myReview = myReviews.find(r => r.status === 'submitted')
      ?? myReviews.find(r => r.status === 'in_progress')
      ?? myReviews[0]
    if (myReview?.status === 'in_progress') activeReviews.push(doc)
    else if (myReview?.status === 'submitted') completedReviews.push(doc)
    else if (assignedIds.has(doc.id)) taskPool.push(doc)
  }

  const byTitle = (a: Doc, b: Doc) => a.title.localeCompare(b.title)
  activeReviews.sort(byTitle)
  completedReviews.sort(byTitle)
  taskPool.sort(byTitle)

  // Map to client prop shapes
  const activeCards = activeReviews.map(doc => {
    const author = doc.author as AuthorRow
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReview = reviews.filter(r => r.reviewer_id === userId).find(r => r.status === 'in_progress')
      ?? reviews.filter(r => r.reviewer_id === userId)[0]
    const hasGeneralComment = typeof myReview?.general_comment === 'string' && myReview.general_comment.trim().length > 0
    return {
      id: doc.id,
      title: doc.title,
      platform: doc.platform ?? getFileLabel(doc.file_type),
      authorName: author?.display_name ?? author?.email ?? 'Unknown',
      discipline: EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter ?? '',
      ccLicense: CC_LICENSE_LABELS[doc.creative_commons_license as CreativeCommonsLicense] ?? doc.creative_commons_license ?? '',
      description: doc.third_party_content_disclosure ?? '',
      claimedAt: doc.created_at,
      rubrics: mapRubricsWithProgress(doc),
      reviewUrl: `/review?document=${doc.id}`,
      hasGeneralComment,
      sourceUrl: doc.source_url ?? null,
      courseAccessCode: doc.course_access_code ?? null,
    }
  })


  const completedCards = completedReviews.map(doc => {
    const author = doc.author as AuthorRow
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReview = reviews.filter(r => r.reviewer_id === userId).find(r => r.status === 'submitted')
    return {
      id: doc.id,
      title: doc.title,
      platform: getFileLabel(doc.file_type),
      authorName: author?.display_name ?? author?.email ?? 'Unknown',
      discipline: EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter ?? '',
      rubrics: mapRubrics(doc).map(r => ({ rubricId: r.id, rubricTitle: r.title })),
      completedAt: myReview?.submitted_at ?? doc.created_at,
      reviewUrl: `/author/feedback/${doc.id}?from=reviewer`,
    }
  })

  const taskCards = taskPool.map(doc => {
    const author = doc.author as AuthorRow
    return {
      id: doc.id,
      title: doc.title,
      platform: getFileLabel(doc.file_type),
      resourceUrl: '', // stub — source_url not in schema yet
      authorName: author?.display_name ?? author?.email ?? 'Unknown',
      discipline: EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter ?? '',
      ccLicense: CC_LICENSE_LABELS[doc.creative_commons_license as CreativeCommonsLicense] ?? doc.creative_commons_license ?? '',
      description: doc.third_party_content_disclosure ?? '',
      submittedAt: doc.created_at,
      rubrics: mapRubrics(doc).map(r => ({ rubricId: r.id, rubricTitle: r.title })),
    }
  })

  return (
    <ReviewerDashboardClient
      displayName={displayName}
      activeCards={activeCards}
      completedCards={completedCards}
      taskCards={taskCards}
    />
  )
}
