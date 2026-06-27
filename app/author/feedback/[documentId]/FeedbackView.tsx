'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { CriterionScore } from '@/types'
import { Button } from '@/components/ui/Button'
import { CriterionReportCard } from '@/components/ui/CriterionReportCard'
import { ReviewSummaryPanel } from '@/components/ui/ReviewSummaryPanel'

// ── Types ────────────────────────────────────────────────────────────────────

interface RubricItemRow {
  id: string
  label: string
  sort_order: number
  description: string | null
}

interface ReviewScoreRow {
  id: string
  score: CriterionScore | null
  criterion_scores: string[]
  comment: string | null
  rubric_item: RubricItemRow | null
}

interface ScoreCommentRow {
  id: string
  rubric_item_id: string
  score_level: string
  body: string
}

interface AnnotationRow {
  id: string
  rubric_item_id: string | null
  anchor: unknown
  body: string
  tag: string | null
}

interface ReviewRow {
  id: string
  overall_comment: string | null
  submitted_at: string | null
  reviewer: { display_name: string | null; email: string } | null
  rubric: { id: string; title: string } | null
  review_scores: ReviewScoreRow[]
  annotations: AnnotationRow[]
  score_comments: ScoreCommentRow[]
}

interface Props {
  document: { id: string; title: string; file_type?: string | null; content_fingerprint?: string | null }
  reviews: ReviewRow[]
  allRubrics?: { id: string; title: string; itemIds: string[] }[]
  pdfUrl?: string | null
  includeAuthorNotes?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveScores(criterionScores: string[] | null, score: CriterionScore | null): CriterionScore[] {
  const arr = (criterionScores ?? []) as CriterionScore[]
  return arr.length > 0 ? arr : (score ? [score] : [])
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function PrintIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6V2h8v4" />
      <rect x="2" y="6" width="12" height="7" rx="1" />
      <path d="M4 10h8M4 13h5" />
    </svg>
  )
}

// ── FeedbackView ─────────────────────────────────────────────────────────────

export function FeedbackView({ document, reviews, allRubrics: allRubricsFromProps }: Props) {
  const router = useRouter()
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const handleCriterionClick = (rubricItemId: string) => {
    setExpandedCards(prev => ({ ...prev, [rubricItemId]: true }))
    setTimeout(() => {
      window.document.getElementById(`criterion-${rubricItemId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
  }

  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const requestedRubricId = searchParams.get('rubric')
  const backHref = from === 'reviewer'
    ? '/reviewer?tab=completed'
    : from === 'coordinator'
      ? '/coordinator'
      : '/author'

  const allRubrics: { id: string; title: string; itemIds: string[] }[] = allRubricsFromProps ?? []

  // Global submit: one review row covers all rubrics. All pills are accessible whenever
  // any submitted review exists for this document.
  const submittedRubricIds = new Set(
    reviews.length > 0 ? allRubrics.map(r => r.id) : []
  )

  const [selectedRubricId, setSelectedRubricId] = useState<string | null>(() => {
    if (!reviews.length) return null
    if (requestedRubricId && allRubrics.some(r => r.id === requestedRubricId)) {
      return requestedRubricId
    }
    return allRubrics[0]?.id ?? null
  })

  // Prefer the review linked to the selected rubric; fall back to the first submitted review
  const review = reviews.find(r => r.rubric?.id === selectedRubricId) ?? reviews[0] ?? null

  // Filter scores to the selected rubric's items (handles a single review covering all rubrics)
  const selectedItemIds = new Set(
    allRubrics.find(r => r.id === selectedRubricId)?.itemIds ?? []
  )

  const sortedScores = review
    ? [...review.review_scores]
        .filter(rs => rs.rubric_item !== null && (selectedItemIds.size === 0 || selectedItemIds.has(rs.rubric_item!.id)))
        .sort((a, b) => (a.rubric_item!.sort_order ?? 0) - (b.rubric_item!.sort_order ?? 0))
    : []

  const reviewerName = review?.reviewer?.display_name ?? review?.reviewer?.email ?? 'Anonymous Reviewer'
  const submittedDate = formatDate(review?.submitted_at ?? null)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <style>{`
        @media print {
          nav,
          .back-link,
          .export-pdf-btn,
          [data-print-hide] {
            display: none !important;
          }
          [data-criterion-body] {
            display: block !important;
            grid-template-rows: 1fr !important;
          }
          [data-criterion-card] {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            border-top: 1px solid #000 !important;
            page-break-inside: avoid;
          }
          [data-collapse-toggle] {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-6 py-10">

        {/* Back link */}
        <Button
          variant="text"
          size="sm"
          className="back-link mb-6"
          onClick={() => router.push(backHref)}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to Dashboard
        </Button>

        {/* Page header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div className="min-w-0">
            <h1 className="font-heading text-heading-md font-semibold text-[var(--color-text-primary)] leading-tight">
              {document.title}
            </h1>

            {review && (
              <p className="mt-1.5 text-body-sm text-[var(--color-text-muted)]">
                {submittedDate && <>Review submitted {submittedDate} · </>}
                Reviewed by {reviewerName}
              </p>
            )}

            {allRubrics.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {allRubrics.map(rubric => {
                  const isSubmitted = submittedRubricIds.has(rubric.id)
                  const isSelected = rubric.id === selectedRubricId
                  return (
                    <button
                      key={rubric.id}
                      disabled={!isSubmitted}
                      onClick={() => isSubmitted && setSelectedRubricId(rubric.id)}
                      className={[
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-label font-semibold border transition-colors',
                        isSelected
                          ? 'bg-primary text-on-primary border-primary'
                          : isSubmitted
                            ? 'bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-container)] cursor-pointer'
                            : 'bg-[var(--color-surface-container-high)] text-[var(--color-text-muted)] border-[var(--color-border)] opacity-50 cursor-not-allowed',
                      ].join(' ')}
                    >
                      {rubric.title}
                      {!isSubmitted && (
                        <span className="text-[0.65rem] opacity-75">In progress</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {review && (
            <Button
              variant="secondary"
              size="sm"
              className="export-pdf-btn shrink-0"
              onClick={() => window.print()}
            >
              <PrintIcon />
              Export PDF
            </Button>
          )}
        </div>

        {/* Empty state */}
        {!review && (
          <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] py-20 text-center">
            <p className="text-body-md font-medium text-[var(--color-text-secondary)]">No submitted reviews yet</p>
            <p className="mt-1 text-body-sm text-[var(--color-text-muted)]">Reviews will appear here once submitted by a reviewer.</p>
          </div>
        )}

        {review && (
          <>
            {/* Reviewer's summary */}
            {review.overall_comment && (
              <div className="rounded-lg bg-[var(--color-surface-container)] px-5 py-4 mb-6">
                <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                  Reviewer&rsquo;s Summary
                </span>
                <p className="text-body-sm text-[var(--color-text-primary)] leading-relaxed">
                  {review.overall_comment}
                </p>
              </div>
            )}

            {/* Review summary panel */}
            <ReviewSummaryPanel
              items={sortedScores.map(rs => ({
                id: rs.rubric_item!.id,
                label: rs.rubric_item!.label,
                scores: resolveScores(rs.criterion_scores, rs.score),
                evidenceCount: review.annotations.filter(
                  a => a.rubric_item_id === rs.rubric_item!.id
                ).length,
              }))}
              onCriterionClick={handleCriterionClick}
              className="mb-6"
            />

            {/* Detailed feedback heading */}
            <h2 className="font-heading text-heading-sm text-[var(--color-text-primary)]">
              Detailed Feedback
            </h2>

            {/* Criterion report cards */}
            <div className="flex flex-col gap-3 mt-2">
              {sortedScores.map((rs, i) => (
                <CriterionReportCard
                  key={rs.id}
                  id={`criterion-${rs.rubric_item!.id}`}
                  isOpen={expandedCards[rs.rubric_item!.id] ?? false}
                  onToggle={() =>
                    setExpandedCards(prev => ({
                      ...prev,
                      [rs.rubric_item!.id]: !(prev[rs.rubric_item!.id] ?? false),
                    }))
                  }
                  rubricItem={{
                    id: rs.rubric_item!.id,
                    label: rs.rubric_item!.label,
                    sort_order: rs.rubric_item!.sort_order,
                    description: rs.rubric_item!.description ?? '',
                  }}
                  criterionScores={resolveScores(rs.criterion_scores, rs.score)}
                  scoreComments={review.score_comments.filter(c => c.rubric_item_id === rs.rubric_item!.id)}
                  annotations={
                    review.annotations.filter(
                      a => a.rubric_item_id === rs.rubric_item!.id
                    ) as { id: string; rubric_item_id: string | null; anchor: Record<string, unknown>; body: string; tag: string | null }[]
                  }
                  index={i + 1}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
