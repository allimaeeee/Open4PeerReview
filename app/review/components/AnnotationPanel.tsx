'use client'

// app/reviewer/_components/AnnotationPanel.tsx

import { useRef, useEffect } from 'react'
import type { RubricItem } from './ReviewerApp'
import type { LocalScore } from './ReviewerConsole'
import type { CriterionScore } from '../../../hooks/useReviewAutoSave'
import type { HighlightTag } from '@/types'

// ─── Sub-criteria parser ──────────────────────────────────────────────────────
// Descriptions are stored as "1. Point one\n2. Point two\n..." in the DB.
function parseSubCriteria(description: string | null): string[] {
  if (!description) return []
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, ''))
}

// ─── Score options ────────────────────────────────────────────────────────────
const SCORE_OPTIONS: {
  value: CriterionScore
  label: string
  color: string
  bg: string
  ring: string
  dot: string
}[] = [
  {
    value: 'does_not_meet',
    label: 'Does Not Meet',
    color: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-400',
    dot: 'bg-red-400',
  },
  {
    value: 'exemplifies',
    label: 'Exemplifies',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-400',
    dot: 'bg-amber-400',
  },
  {
    value: 'exceeds',
    label: 'Exceeds',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-500',
    dot: 'bg-emerald-500',
  },
]

const SCORE_OPTION_MAP = Object.fromEntries(SCORE_OPTIONS.map((o) => [o.value, o]))

const TAG_LABELS: Record<HighlightTag, { label: string; bg: string; text: string }> = {
  general:     { label: 'General',     bg: 'bg-slate-100',  text: 'text-slate-500' },
  action_item: { label: 'Action Item', bg: 'bg-orange-50',  text: 'text-orange-700' },
  quick_fix:   { label: 'Quick Fix',   bg: 'bg-blue-50',    text: 'text-blue-700' },
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AnnotationPanelProps {
  rubricItems: RubricItem[]
  scores: Record<string, LocalScore>
  activeItemId: string | null
  isSubmitted: boolean
  onActiveItemChange: (id: string) => void
  onScoreChange: (rubricItemId: string, field: 'score' | 'comment', value: string) => void
  onAnnotationDelete: (rubricItemId: string, annotationId: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AnnotationPanel({
  rubricItems,
  scores,
  activeItemId,
  isSubmitted,
  onActiveItemChange,
  onScoreChange,
  onAnnotationDelete,
}: AnnotationPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeItemId])

  if (rubricItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-[#1e3a5f] rounded-full animate-spin" />
      </div>
    )
  }

  const scoredCount = Object.values(scores).filter((s) => s.score !== null).length

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Panel header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Criteria
        </p>
        <span className={[
          'text-[11px] font-semibold px-2 py-0.5 rounded-full',
          scoredCount === rubricItems.length
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-500',
        ].join(' ')}>
          {scoredCount} / {rubricItems.length} rated
        </span>
      </div>

      {/* Scrollable criteria list */}
      <div className="flex-1 overflow-y-auto">
        {rubricItems.map((item, index) => {
          const score = scores[item.id]
          const isActive = item.id === activeItemId
          const isScored = Boolean(score?.score)
          const subCriteria = parseSubCriteria(item.description)
          const scoreOpt = score?.score ? SCORE_OPTION_MAP[score.score] : null

          return (
            <div
              key={item.id}
              ref={isActive ? activeRef : null}
              onClick={() => onActiveItemChange(item.id)}
              className={[
                'border-b border-slate-100 transition-colors duration-100 cursor-pointer',
                isActive ? 'bg-slate-50' : 'hover:bg-slate-50/60',
              ].join(' ')}
            >
              {/* ── Criterion header ── */}
              <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
                {/* Status badge */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                  <span className={[
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0',
                    isScored
                      ? 'bg-[#1e3a5f] text-white'
                      : 'bg-slate-100 text-slate-500',
                  ].join(' ')}>
                    {isScored ? '✓' : index + 1}
                  </span>
                  {isActive && (
                    <div className="w-0.5 bg-[#1e3a5f] rounded-full min-h-[12px] flex-1" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {item.label}
                  </p>

                  {/* Collapsed score pill */}
                  {!isActive && isScored && scoreOpt && (
                    <span className={[
                      'inline-flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded',
                      scoreOpt.bg, scoreOpt.color,
                    ].join(' ')}>
                      <span className={`w-1.5 h-1.5 rounded-full ${scoreOpt.dot}`} />
                      {scoreOpt.label}
                    </span>
                  )}

                  {/* Sub-criteria count when collapsed */}
                  {!isActive && subCriteria.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {subCriteria.length} sub-criteria
                    </p>
                  )}
                </div>
              </div>

              {/* ── Expanded content (active criterion) ── */}
              {isActive && (
                <div className="px-4 pb-4 pl-13 space-y-3" style={{ paddingLeft: '2.75rem' }}>

                  {/* Sub-criteria checklist */}
                  {subCriteria.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Standards ({subCriteria.length})
                        </p>
                      </div>
                      <ol className="divide-y divide-slate-100">
                        {subCriteria.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5 px-3 py-2">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-100 text-slate-500
                              text-[10px] font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{point}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Score buttons */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Rating <span className="text-red-400">*</span>
                    </p>
                    <div className="flex gap-1.5">
                      {SCORE_OPTIONS.map((opt) => {
                        const isSelected = score?.score === opt.value
                        return (
                          <button
                            key={opt.value}
                            disabled={isSubmitted}
                            onClick={(e) => {
                              e.stopPropagation()
                              onScoreChange(item.id, 'score', opt.value)
                            }}
                            className={[
                              'flex-1 py-2 text-[11px] font-semibold rounded-lg border transition-all duration-100',
                              isSelected
                                ? `${opt.bg} ${opt.color} ring-2 ${opt.ring} border-transparent`
                                : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300',
                              isSubmitted ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Comment <span className="text-red-400">*</span>
                    </p>
                    <textarea
                      disabled={isSubmitted}
                      rows={3}
                      placeholder="Explain your rating and reference specific sub-criteria…"
                      value={score?.comment ?? ''}
                      onChange={(e) => {
                        e.stopPropagation()
                        onScoreChange(item.id, 'comment', e.target.value)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={[
                        'w-full text-xs rounded-lg border border-slate-200 px-3 py-2 resize-none',
                        'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]',
                        'placeholder-slate-300 text-slate-700',
                        isSubmitted ? 'bg-slate-50 cursor-not-allowed opacity-70' : 'bg-white',
                      ].join(' ')}
                    />
                  </div>

                  {/* Annotations */}
                  {score?.annotations && score.annotations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Annotations ({score.annotations.length})
                      </p>
                      <div className="space-y-1.5">
                        {score.annotations.map((ann) => (
                          <div
                            key={ann.id}
                            className="group flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {ann.tag && TAG_LABELS[ann.tag as HighlightTag] && (
                                  <span className={[
                                    'text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
                                    TAG_LABELS[ann.tag as HighlightTag].bg,
                                    TAG_LABELS[ann.tag as HighlightTag].text,
                                  ].join(' ')}>
                                    {TAG_LABELS[ann.tag as HighlightTag].label}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-amber-800 leading-snug">{ann.body}</p>
                              {(ann.anchor as any)?.text && (
                                <p className="mt-0.5 text-[10px] text-amber-600 italic truncate">
                                  &ldquo;{(ann.anchor as any).text.slice(0, 60)}&hellip;&rdquo;
                                </p>
                              )}
                            </div>
                            {!isSubmitted && (
                              <button
                                onClick={() => onAnnotationDelete(item.id, ann.id)}
                                className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-600 transition-opacity"
                                aria-label="Delete annotation"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PDF selection hint */}
                  {!isSubmitted && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Highlight text in the PDF to attach an annotation to this criterion
                    </p>
                  )}
                </div>
              )}

              {/* Score pill + annotation count when scored but not active */}
              {!isActive && isScored && score.annotations.length > 0 && (
                <div className="px-4 pb-2.5" style={{ paddingLeft: '2.75rem' }}>
                  <span className="text-[10px] text-slate-400">
                    {score.annotations.length} annotation{score.annotations.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
