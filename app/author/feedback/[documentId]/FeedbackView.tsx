'use client'

import Link from 'next/link'
import { CRITERION_SCORE_LABELS } from '@/types'
import type { CriterionScore } from '@/types'

interface ReviewerInfo {
  display_name: string | null
  email: string
}

interface RubricItem {
  id: string
  label: string
  sort_order: number
}

interface ReviewScore {
  id: string
  score: CriterionScore | null
  comment: string | null
  rubric_item: RubricItem | null
}

interface Review {
  id: string
  overall_comment: string | null
  submitted_at: string | null
  reviewer: ReviewerInfo | null
  rubric: { id: string; title: string } | null
  review_scores: ReviewScore[]
}

interface Props {
  document: { id: string; title: string }
  reviews: Review[]
}

const SCORE_STYLES: Record<CriterionScore, string> = {
  does_not_meet: 'bg-red-50 text-red-700 border-red-200',
  exemplifies:   'bg-blue-50 text-blue-700 border-blue-200',
  exceeds:       'bg-green-50 text-green-700 border-green-200',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FeedbackView({ document, reviews }: Props) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/author"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{document.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {reviews.length === 0
            ? 'No submitted reviews yet.'
            : `${reviews.length} submitted ${reviews.length === 1 ? 'review' : 'reviews'}`}
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-600">No feedback yet</p>
          <p className="mt-1 text-xs text-slate-400">Reviews will appear here once submitted by a reviewer.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {reviews.map((review, i) => {
            const reviewerLabel =
              review.reviewer?.display_name ?? review.reviewer?.email ?? 'Anonymous Reviewer'
            const scores = [...review.review_scores].sort(
              (a, b) => (a.rubric_item?.sort_order ?? 0) - (b.rubric_item?.sort_order ?? 0)
            )

            return (
              <div key={review.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Review header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Review {i + 1} — {reviewerLabel}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Submitted {formatDate(review.submitted_at)}
                      {review.rubric && (
                        <> · Rubric: <span className="font-medium text-slate-500">{review.rubric.title}</span></>
                      )}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Submitted
                  </span>
                </div>

                {/* Overall comment */}
                {review.overall_comment && (
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overall Comment</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{review.overall_comment}</p>
                  </div>
                )}

                {/* Criterion scores */}
                {scores.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {scores.map(score => (
                      <div key={score.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <p className="text-sm font-medium text-slate-800">
                            {score.rubric_item?.label ?? 'Criterion'}
                          </p>
                          {score.score && (
                            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${SCORE_STYLES[score.score]}`}>
                              {CRITERION_SCORE_LABELS[score.score]}
                            </span>
                          )}
                        </div>
                        {score.comment && (
                          <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{score.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
