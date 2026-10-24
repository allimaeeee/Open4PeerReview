import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getDocumentFeedback, getSignedUrl } from '@/lib/supabase/queries'
import { ReportFeedbackView } from '@/app/author/feedback/[documentId]/ReportFeedbackView'
import { CoordinatorDecisionClient } from './CoordinatorDecisionClient'

export default async function CoordinatorReviewPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { documentId } = await params

  try {
    const data = await getDocumentFeedback(supabase, documentId)
    if (!data.isCoordinator) redirect('/coordinator')

    const isHtml = data.document.file_type === 'html'
    const pdfUrl = isHtml || !data.document.storage_path
      ? null
      : await getSignedUrl(supabase, data.document.storage_path)

    const firstReview = data.reviews[0] ?? null
    const reviewerName = firstReview?.reviewer?.display_name ?? firstReview?.reviewer?.email ?? 'Anonymous Reviewer'

    return (
      <main className="flex-1 min-h-0 flex flex-col">
        <Suspense fallback={null}>
          <ReportFeedbackView
            document={data.document}
            reviews={data.reviews}
            allRubrics={data.allRubrics}
            pdfUrl={pdfUrl}
            decisionSlot={
              firstReview ? (
                <CoordinatorDecisionClient
                  reviewId={firstReview.id}
                  approval={(firstReview.coordinator_approval ?? null) as 'pending' | 'approved' | 'changes_requested' | null}
                  reviewerName={reviewerName}
                />
              ) : undefined
            }
          />
        </Suspense>
      </main>
    )
  } catch {
    notFound()
  }
}
