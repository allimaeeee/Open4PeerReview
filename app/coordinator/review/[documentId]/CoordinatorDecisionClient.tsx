'use client'

import { useRouter } from 'next/navigation'
import { CoordinatorDecisionBar, type CoordinatorApproval } from '@/components/ui/CoordinatorDecisionBar'
import { approveReview, returnReviewToReviewer } from '@/app/coordinator/actions'

interface Props {
  reviewId: string
  approval: CoordinatorApproval
  reviewerName: string
}

export function CoordinatorDecisionClient({ reviewId, approval, reviewerName }: Props) {
  const router = useRouter()
  return (
    <CoordinatorDecisionBar
      approval={approval}
      reviewerName={reviewerName}
      onApprove={async () => {
        await approveReview(reviewId)
        router.refresh()
      }}
      onReturn={async (note) => {
        await returnReviewToReviewer(reviewId, note)
        router.push('/coordinator')
        router.refresh()
      }}
    />
  )
}
