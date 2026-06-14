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

  type ReviewScoreRow = { id: string; rubric_item_id: string; criterion_scores: string[] }
  type ReviewRow = { id: string; status: string; reviewer_id: string; submitted_at: string | null; rubric_id: string | null; review_scores: ReviewScoreRow[] }
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
    // One review covers all rubrics — find by reviewer_id only, not rubric_id
    const myReview = reviews.find(rev => rev.reviewer_id === userId)
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

  // Exclude documents the reviewer authored
  // NOTE: author.id is not currently selected in getAllDocumentsWithRubrics —
  // add `id` to `author:users!author_id (...)` in the query for this to take effect.
  const reviewable = documents.filter(d => {
    const author = d.author as AuthorRow & { id?: string }
    const reviews = (d.reviews ?? []) as ReviewRow[]
    return author?.id !== userId || reviews.some(r => r.reviewer_id === userId)
  })

  const activeReviews: Doc[] = []
  const taskPool: Doc[] = []
  const completedReviews: Doc[] = []

  for (const doc of reviewable) {
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReview = reviews.find(r => r.reviewer_id === userId)
    if (myReview?.status === 'in_progress') activeReviews.push(doc)
    else if (myReview?.status === 'submitted') completedReviews.push(doc)
    else taskPool.push(doc)
  }

  // Map to client prop shapes
  const activeCards = activeReviews.map(doc => {
    const author = doc.author as AuthorRow
    return {
      id: doc.id,
      title: doc.title,
      platform: getFileLabel(doc.file_type),
      authorName: author?.display_name ?? author?.email ?? 'Unknown',
      discipline: EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter ?? '',
      ccLicense: CC_LICENSE_LABELS[doc.creative_commons_license as CreativeCommonsLicense] ?? doc.creative_commons_license ?? '',
      description: doc.third_party_content_disclosure ?? '',
      claimedAt: doc.created_at,
      rubrics: mapRubricsWithProgress(doc),
      reviewUrl: `/review?document=${doc.id}`,
    }
  })


  const completedCards = completedReviews.map(doc => {
    const author = doc.author as AuthorRow
    const reviews = (doc.reviews ?? []) as ReviewRow[]
    const myReview = reviews.find(r => r.reviewer_id === userId)
    return {
      id: doc.id,
      title: doc.title,
      platform: getFileLabel(doc.file_type),
      authorName: author?.display_name ?? author?.email ?? 'Unknown',
      discipline: EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter ?? '',
      rubrics: mapRubrics(doc).map(r => ({ rubricId: r.id, rubricTitle: r.title })),
      completedAt: myReview?.submitted_at ?? doc.created_at,
      reviewUrl: `/author/feedback/${doc.id}`,
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
