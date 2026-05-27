'use client'

// app/reviewer/_components/AnnotationPanel.tsx

import { useRef, useEffect } from 'react'
import type { CriterionScore, RubricItemSummary } from '@/types'
import type { LocalScore } from './ReviewerConsole'

const SCORE_OPTIONS: { value: CriterionScore; label: string; color: string; bg: string; ring: string }[] = [
  {
    value: 'does_not_meet',
    label: 'Does Not Meet',
    color: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-400',
  },
  {
    value: 'exemplifies',
    label: 'Exemplifies',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-400',
  },
  {
    value: 'exceeds',
    label: 'Exceeds',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-500',
  },
]

interface AnnotationPanelProps {
  rubricItems: RubricItemSummary[]
  scores: Record<string, LocalScore>
  activeItemId: string | null
  isSubmitted: boolean
  onActiveItemChange: (id: string) => void
  onScoreChange: (rubricItemId: string, field: 'score' | 'comment', value: string) => void
  onAnnotationDelete: (rubricItemId: string, annotationId: string) => void
}

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

  // Scroll active criterion into view when it changes
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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Panel header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Criteria · {rubricItems.length} total
        </p>
      </div>

      {/* Scrollable criteria list */}
      <div className="flex-1 overflow-y-auto">
        {rubricItems.map((item, index) => {
          const score = scores[item.id]
          const isActive = item.id === activeItemId
          const isScored = Boolean(score?.score)

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
              {/* Criterion header */}
              <div className="flex items-start gap-3 px-5 pt-4 pb-2">
                {/* Index + status dot */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                  <span className={[
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
                    isScored
                      ? 'bg-[#1e3a5f] text-white'
                      : 'bg-slate-100 text-slate-500',
                  ].join(' ')}>
                    {isScored ? '✓' : index + 1}
                  </span>
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="w-0.5 flex-1 bg-[#1e3a5f] rounded-full min-h-[16px]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {item.label}
                  </p>
                  {isActive && item.description && (
                    <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Score + inputs (only when active or already scored) */}
              {(isActive || isScored) && (
                <div className="px-5 pb-4 space-y-3 pl-14">
                  {/* Score buttons */}
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
                            'flex-1 py-1.5 text-[11px] font-semibold rounded-lg border transition-all duration-100',
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

                  {/* Comment textarea */}
                  {isActive && (
                    <textarea
                      disabled={isSubmitted}
                      rows={3}
                      placeholder="Comment (required)"
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
                  )}

                  {/* Annotation chips */}
                  {score?.annotations && score.annotations.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Annotations ({score.annotations.length})
                      </p>
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
                            <p className="text-[11px] text-amber-800 leading-snug">{ann.body}</p>
                            {(ann.anchor as any)?.text && (
                              <p className="mt-0.5 text-[10px] text-amber-600 italic truncate">
                                "{(ann.anchor as any).text.slice(0, 60)}…"
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
                  )}

                  {/* "Select text in PDF to annotate" hint */}
                  {isActive && !isSubmitted && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Highlight text in the PDF to add an annotation
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
