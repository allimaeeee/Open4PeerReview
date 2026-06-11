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

  type ReviewRow = { id: string; status: string; reviewer_id: string; submitted_at: string | null }
  type AuthorRow = { display_name: string | null; email: string } | null
  type Doc = (typeof documents)[number]

  function getFileLabel(fileType: string): string {
    if (fileType === 'pdf') return 'PDF'
    if (fileType === 'html') return 'Web URL'
    return fileType.toUpperCase()
  }

  function mapRubrics(doc: Doc) {
    return (doc.document_rubrics ?? [])
      .map(dr => dr.rubric)
      .filter((r): r is { id: string; title: string } => r !== null)
  }

  // Exclude documents the reviewer authored
  // NOTE: author.id is not currently selected in getAllDocumentsWithRubrics —
  // add `id` to `author:users!author_id (...)` in the query for this to take effect.
  const reviewable = documents.filter(d => {
    const author = d.author as AuthorRow & { id?: string }
    return author?.id !== userId
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
      rubrics: mapRubrics(doc).map(r => ({ rubricId: r.id, rubricTitle: r.title, completionPercent: 0 })),
      reviewUrl: `/review?document=${doc.id}`,
    }
  })

  // MOCK — remove after real data is flowing
  activeCards.push({
    id: 'mock-active-1',
    title: 'Introduction to Thermodynamics: A Project-Based Learning Module',
    platform: 'PDF',
    authorName: 'Dr. Priya Nair',
    discipline: 'Physics',
    ccLicense: 'CC BY 4.0',
    description: 'Includes adapted diagrams from OpenStax Physics (CC BY 4.0).',
    claimedAt: '2026-05-14T10:22:00Z',
    rubrics: [
      { rubricId: 'rubric-accessibility', rubricTitle: 'Accessibility', completionPercent: 60 },
      { rubricId: 'rubric-pedagogy',      rubricTitle: 'Pedagogy',      completionPercent: 0  },
    ],
    reviewUrl: '/review?document=mock-active-1',
  })

  // MOCK — remove after real data is flowing
  completedReviews.push({
    id: 'mock-completed-1',
    title: 'Open Chemistry: Equilibrium and Reaction Rates',
    file_type: 'html',
    created_at: '2026-04-03T08:15:00Z',
    subject_matter: 'chemistry',
    creative_commons_license: 'cc_by_sa',
    third_party_content_disclosure: null,
    author: { id: 'mock-author-2', display_name: 'Marcus Webb', email: 'mwebb@example.edu' },
    document_rubrics: [
      { rubric: { id: 'rubric-accuracy', title: 'Content Accuracy' } },
    ],
    reviews: [{ id: 'mock-review-2', status: 'submitted', reviewer_id: userId }],
  } as unknown as Doc)

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
      reviewUrl: `/review?document=${doc.id}`,
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
