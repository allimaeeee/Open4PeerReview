'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { CriterionScore, HighlightTag } from '@/types'
import { CRITERION_SCORE_LABELS } from '@/types'
import type { ReadOnlyAnnotation } from './PDFViewerReadOnlyCanvas'

const PDFViewerReadOnly = dynamic(() => import('./PDFViewerReadOnlyCanvas'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center bg-slate-100"><p className="text-sm text-slate-400">Loading PDF…</p></div>,
})

// ── Types ────────────────────────────────────────────────────────────────────

interface ReviewAnnotation {
  id: string
  body: string
  tag: string | null
  rubric_item_id: string | null
  anchor: unknown
}

interface RubricItemData {
  id: string
  label: string
  sort_order: number
  description: string | null
}

interface ReviewScore {
  id: string
  score: CriterionScore | null
  comment: string | null
  rubric_item: RubricItemData | null
}

interface Review {
  id: string
  overall_comment: string | null
  submitted_at: string | null
  reviewer: { display_name: string | null; email: string } | null
  rubric: { id: string; title: string } | null
  review_scores: ReviewScore[]
  annotations: ReviewAnnotation[]
}

interface Props {
  document: { id: string; title: string; file_type?: string | null; content_fingerprint?: string | null }
  reviews: Review[]
  pdfUrl: string | null
  includeAuthorNotes?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SCORE_BADGE: Record<CriterionScore, string> = {
  does_not_meet: 'bg-amber-50 text-amber-800 border-amber-200',
  exemplifies:   'bg-blue-50 text-blue-700 border-blue-200',
  exceeds:       'bg-green-50 text-green-700 border-green-200',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── TagChip ──────────────────────────────────────────────────────────────────

function TagChip({ tag }: { tag: HighlightTag }) {
  if (tag === 'quick_fix') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
        ⚡ Quick Fix
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
      🎓 Action Item
    </span>
  )
}

// ── CriterionCard ────────────────────────────────────────────────────────────

function CriterionCard({
  index,
  score,
  rubricTitle,
  annotations,
  onViewAnnotation,
  includeAuthorNotes,
}: {
  index: number
  score: ReviewScore
  rubricTitle: string | null
  annotations: ReviewAnnotation[]
  onViewAnnotation: ((annId: string) => void) | null
  includeAuthorNotes: boolean
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [log, setLog] = useState('')
  const [resolved, setResolved] = useState(false)

  const item = score.rubric_item
  const todoAnnotations = annotations.filter(a => a.tag)

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${resolved ? 'border-green-200 opacity-60' : 'border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-bold text-slate-500 shrink-0">C{index + 1}</span>
          <span className="text-slate-300 shrink-0">·</span>
          {rubricTitle && (
            <>
              <span className="text-sm text-slate-500 shrink-0">{rubricTitle}</span>
              <span className="text-slate-300 shrink-0">—</span>
            </>
          )}
          <span className="text-sm font-semibold text-slate-800 truncate">{item?.label ?? 'Criterion'}</span>
        </div>
        {score.score && (
          <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${SCORE_BADGE[score.score]}`}>
            {CRITERION_SCORE_LABELS[score.score]}
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {/* About This Criterion */}
        {item?.description && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">About This Criterion</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
          </section>
        )}

        {/* Reviewer's per-criterion comment */}
        {score.comment && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              {"Reviewer's Overall Comment"}
            </h3>
            <div className="border-l-4 border-amber-400 pl-4">
              <p className="text-sm text-slate-700 leading-relaxed">{score.comment}</p>
            </div>
          </section>
        )}

        {/* To-Do list */}
        {todoAnnotations.length > 0 && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              To-Do For This Criterion
            </h3>
            <div className="space-y-2.5">
              {todoAnnotations.map(ann => (
                <div key={ann.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={checked[ann.id] ?? false}
                    onChange={e => setChecked(prev => ({ ...prev, [ann.id]: e.target.checked }))}
                    className="print:hidden mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    {ann.tag && <div className="mb-1.5"><TagChip tag={ann.tag as HighlightTag} /></div>}
                    <p className="text-sm text-slate-700">{ann.body}</p>
                    {onViewAnnotation && (ann.anchor as { page?: number })?.page != null && (
                      <button
                        onClick={() => onViewAnnotation(ann.id)}
                        className="print:hidden mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
                      >
                        ↗ View source
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All annotations */}
        {annotations.length > 0 && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Annotations ({annotations.length})
            </h3>
            <div className="space-y-2.5">
              {annotations.map(ann => {
                const anchorPage =
                  ann.anchor !== null &&
                  typeof ann.anchor === 'object' &&
                  !Array.isArray(ann.anchor) &&
                  'page' in ann.anchor
                    ? (ann.anchor as { page: number }).page
                    : null
                return (
                  <div key={ann.id} className="rounded-lg border border-slate-100 bg-white px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {ann.tag ? (
                        <>
                          <TagChip tag={ann.tag as HighlightTag} />
                          <span className="text-xs text-slate-400">↑ in to-do</span>
                        </>
                      ) : (
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                      {anchorPage != null && (
                        <span className="text-xs text-slate-400">Page {anchorPage}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700">{ann.body}</p>
                    {onViewAnnotation && anchorPage != null && (
                      <button
                        onClick={() => onViewAnnotation(ann.id)}
                        className="print:hidden mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
                      >
                        ↗ View annotation
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Revision Log — author only */}
        {includeAuthorNotes && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Revision Log</h3>
            {log ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{log}</p>
            ) : (
              <textarea
                value={log}
                onChange={e => setLog(e.target.value)}
                placeholder="Leave any notes about your revisions or thoughts on this feedback..."
                rows={3}
                className="print:hidden w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            )}
          </section>
        )}

        {/* Footer — interactive only, hidden in print */}
        <div className="print:hidden flex justify-end px-5 py-3 bg-slate-50">
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={resolved}
              onChange={e => setResolved(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            Mark resolved
          </label>
        </div>
      </div>
    </div>
  )
}

// ── ReviewerSection ──────────────────────────────────────────────────────────

function ReviewerSection({
  review,
  reviewIndex,
  onViewAnnotation,
  includeAuthorNotes,
}: {
  review: Review
  reviewIndex: number
  onViewAnnotation: ((annId: string) => void) | null
  includeAuthorNotes: boolean
}) {
  const reviewer = review.reviewer?.display_name ?? review.reviewer?.email ?? 'Anonymous Reviewer'
  const scores = [...review.review_scores].sort(
    (a, b) => (a.rubric_item?.sort_order ?? 0) - (b.rubric_item?.sort_order ?? 0)
  )

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-100" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
          Review {reviewIndex + 1} · {reviewer}
          {review.rubric && <> · {review.rubric.title}</>}
          {' · '}Submitted {formatDate(review.submitted_at)}
        </p>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {review.overall_comment && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-1.5">{"Reviewer's Summary"}</p>
          <p className="text-sm text-amber-900 leading-relaxed">{review.overall_comment}</p>
        </div>
      )}

      <div className="space-y-4">
        {scores.map((score, idx) => (
          <CriterionCard
            key={score.id}
            index={idx}
            score={score}
            rubricTitle={review.rubric?.title ?? null}
            annotations={(review.annotations ?? []).filter(
              a => a.rubric_item_id === score.rubric_item?.id
            )}
            onViewAnnotation={onViewAnnotation}
            includeAuthorNotes={includeAuthorNotes}
          />
        ))}
      </div>
    </div>
  )
}

// ── FeedbackView ─────────────────────────────────────────────────────────────

export function FeedbackView({ document, reviews, pdfUrl, includeAuthorNotes = true }: Props) {
  const [focusAnnotationId, setFocusAnnotationId] = useState<string | null>(null)

  const isHtml = document.file_type === 'html'
  const snapshotSrc = isHtml && document.content_fingerprint
    ? `/api/snapshot/${document.content_fingerprint}`
    : null

  const allAnnotations: ReadOnlyAnnotation[] = reviews.flatMap(r => {
    const itemLabelById = Object.fromEntries(
      r.review_scores.map(s => [s.rubric_item?.id, s.rubric_item?.label ?? null])
    )
    return r.annotations.map(a => ({
      id: a.id,
      anchor: a.anchor,
      tag: a.tag,
      body: a.body,
      rubricItemLabel: a.rubric_item_id ? (itemLabelById[a.rubric_item_id] ?? null) : null,
    }))
  })

  const onViewAnnotation = (pdfUrl || snapshotSrc)
    ? (annId: string) => setFocusAnnotationId(annId)
    : null

  const focusedAnnotation = focusAnnotationId
    ? allAnnotations.find(a => a.id === focusAnnotationId) ?? null
    : null

  const panelOpen = !!(focusAnnotationId && (pdfUrl || snapshotSrc))

  return (
    <>
      <style>{`
        @media print {
          .feedback-main { max-width: none !important; width: 100% !important; padding: 1rem !important; }
          .feedback-side-panel { display: none !important; }
        }
      `}</style>

      <div className={`feedback-main ${panelOpen ? 'w-1/2 px-6 py-10' : 'mx-auto max-w-4xl px-6 py-10'}`}>
        <div className="mb-8">
          {/* Back link — hidden in print */}
          <Link
            href="/dashboard"
            className="print:hidden inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{document.title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {reviews.length === 0
                  ? 'No submitted reviews yet.'
                  : `${reviews.length} submitted ${reviews.length === 1 ? 'review' : 'reviews'}`}
              </p>
            </div>

            {/* Export button — hidden in print */}
            {reviews.length > 0 && (
              <button
                onClick={() => window.print()}
                className="print:hidden shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Export PDF
              </button>
            )}
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-20 text-center">
            <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-600">No feedback yet</p>
            <p className="mt-1 text-xs text-slate-400">Reviews will appear here once submitted by a reviewer.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {reviews.map((review, i) => (
              <ReviewerSection
                key={review.id}
                review={review}
                reviewIndex={i}
                onViewAnnotation={onViewAnnotation}
                includeAuthorNotes={includeAuthorNotes}
              />
            ))}
          </div>
        )}
      </div>

      {/* Side-by-side canvas panel — hidden in print */}
      {panelOpen && (
        <div className="feedback-side-panel fixed right-0 top-0 bottom-0 w-1/2 z-40 bg-white border-l border-slate-200 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-200 flex-shrink-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">
                {isHtml ? 'Annotation in OpenStax content' : 'Annotation in PDF'}
              </p>
              {focusedAnnotation && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{focusedAnnotation.body}</p>
              )}
            </div>
            <button
              onClick={() => setFocusAnnotationId(null)}
              className="shrink-0 p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close panel"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {isHtml && snapshotSrc ? (
              <iframe
                src={snapshotSrc}
                className="w-full h-full border-0"
                title={document.title}
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            ) : pdfUrl ? (
              <PDFViewerReadOnly
                fileUrl={pdfUrl}
                annotations={allAnnotations}
                focusAnnotationId={focusAnnotationId}
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
