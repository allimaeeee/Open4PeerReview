'use client'

// app/reviewer/_components/AnnotationPanel.tsx

import { useRef, useEffect, useState, useMemo } from 'react'
import type { RubricItem } from './ReviewerApp'
import type { LocalScore, ScoreCommentItem } from './ReviewerConsole'
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



const TAG_LABELS: Record<HighlightTag, { label: string; bg: string; text: string }> = {
  action_item: { label: 'Action Item', bg: 'bg-orange-50',  text: 'text-orange-700' },
  quick_fix:   { label: 'Quick Fix',   bg: 'bg-blue-50',    text: 'text-blue-700' },
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface GeneralAnnotation {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface AnnotationPanelProps {
  rubricItems: RubricItem[]
  scores: Record<string, LocalScore>
  activeItemId: string | null
  isSubmitted: boolean
  generalAnnotations: GeneralAnnotation[]
  onActiveItemChange: (id: string) => void
  onScoreChange: (rubricItemId: string, changes: { score?: CriterionScore | null; comment?: string }) => void
  onAnnotationDelete: (rubricItemId: string, annotationId: string) => void
  onAddGeneralNote: (body: string) => Promise<string | null>
  onDeleteGeneralAnnotation: (id: string) => void
  onAddScoreComment: (rubricItemId: string, scoreLevel: 'does_not_meet' | 'exceeds', body: string) => Promise<void>
  onDeleteScoreComment: (rubricItemId: string, commentId: string, scoreLevel: 'does_not_meet' | 'exceeds') => Promise<void>
}

// ─── Criterion card ───────────────────────────────────────────────────────────
function CriterionCard({
  item,
  index,
  score,
  isActive,
  isSubmitted,
  activeRef,
  onActiveItemChange,
  onScoreChange,
  onAnnotationDelete,
  onAddScoreComment,
  onDeleteScoreComment,
}: {
  item: RubricItem
  index: number
  score: LocalScore | undefined
  isActive: boolean
  isSubmitted: boolean
  activeRef: React.RefObject<HTMLDivElement | null>
  onActiveItemChange: (id: string) => void
  onScoreChange: (rubricItemId: string, changes: { score?: CriterionScore | null; comment?: string }) => void
  onAnnotationDelete: (rubricItemId: string, annotationId: string) => void
  onAddScoreComment: (rubricItemId: string, scoreLevel: 'does_not_meet' | 'exceeds', body: string) => Promise<void>
  onDeleteScoreComment: (rubricItemId: string, commentId: string, scoreLevel: 'does_not_meet' | 'exceeds') => Promise<void>
}) {
  const isScored = Boolean(score?.score) || (score?.niComments ?? []).length > 0 || (score?.exceedsComments ?? []).length > 0
  const subCriteria = parseSubCriteria(item.description)
  const [niDraft, setNiDraft] = useState('')
  const [exceedsDraft, setExceedsDraft] = useState('')

  return (
    <div
      ref={isActive ? activeRef : null}
      onClick={() => onActiveItemChange(item.id)}
      className={[
        'border-b border-slate-100 transition-colors duration-100 cursor-pointer',
        isActive ? 'bg-slate-50' : 'hover:bg-slate-50/60',
      ].join(' ')}
    >
      {/* ── Criterion header ── */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
          <span className={[
            'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0',
            isScored ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-500',
          ].join(' ')}>
            {isScored ? '✓' : index + 1}
          </span>
          {isActive && (
            <div className="w-0.5 bg-[#1e3a5f] rounded-full min-h-[12px] flex-1" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 leading-snug">{item.label}</p>

          {!isActive && isScored && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(score?.niComments ?? []).length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Needs Improvement
                </span>
              )}
              {score?.score === 'exemplifies' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Proficient
                </span>
              )}
              {(score?.exceedsComments ?? []).length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Exceeds
                </span>
              )}
            </div>
          )}

          {!isActive && subCriteria.length > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5">{subCriteria.length} sub-criteria</p>
          )}
        </div>
      </div>

      {/* ── Expanded content ── */}
      {isActive && (
        <div className="px-4 pb-4 space-y-3" style={{ paddingLeft: '2.75rem' }}>

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

          <div className="space-y-2">
            {/* Needs Improvement */}
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">
                Needs Improvement
              </p>
              {(score?.niComments ?? []).length > 0 && (
                <div className="space-y-1 mb-1.5">
                  {(score?.niComments ?? []).map((c) => (
                    <div key={c.id} className="group flex items-start gap-2 bg-red-50/60 rounded-lg px-3 py-2 border border-red-100">
                      <p className="flex-1 text-[11px] text-red-800 leading-snug">{c.body}</p>
                      {!isSubmitted && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteScoreComment(item.id, c.id, 'does_not_meet') }}
                          className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity flex-shrink-0"
                          aria-label="Delete comment"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isSubmitted && (
                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    placeholder="Add needs improvement comment…"
                    value={niDraft}
                    onChange={(e) => setNiDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && niDraft.trim()) {
                        e.preventDefault()
                        onAddScoreComment(item.id, 'does_not_meet', niDraft.trim())
                        setNiDraft('')
                      }
                    }}
                    className="flex-1 text-xs rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 placeholder-slate-300 text-slate-700"
                  />
                  <button
                    disabled={!niDraft.trim()}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!niDraft.trim()) return
                      onAddScoreComment(item.id, 'does_not_meet', niDraft.trim())
                      setNiDraft('')
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Proficient */}
            <div className="flex justify-center py-1">
              <button
                disabled={isSubmitted}
                onClick={(e) => {
                  e.stopPropagation()
                  onScoreChange(item.id, { score: score?.score === 'exemplifies' ? null : 'exemplifies' })
                }}
                className={[
                  'px-6 py-1.5 text-[11px] font-semibold rounded-lg border transition-all duration-100',
                  score?.score === 'exemplifies'
                    ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-400 border-transparent'
                    : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300',
                  isSubmitted ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                ].join(' ')}
              >
                Proficient
              </button>
            </div>

            {/* Exceeds */}
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                Exceeds
              </p>
              {(score?.exceedsComments ?? []).length > 0 && (
                <div className="space-y-1 mb-1.5">
                  {(score?.exceedsComments ?? []).map((c) => (
                    <div key={c.id} className="group flex items-start gap-2 bg-emerald-50/60 rounded-lg px-3 py-2 border border-emerald-100">
                      <p className="flex-1 text-[11px] text-emerald-800 leading-snug">{c.body}</p>
                      {!isSubmitted && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteScoreComment(item.id, c.id, 'exceeds') }}
                          className="opacity-0 group-hover:opacity-100 text-emerald-300 hover:text-emerald-500 transition-opacity flex-shrink-0"
                          aria-label="Delete comment"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isSubmitted && (
                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    placeholder="Add exceeds comment…"
                    value={exceedsDraft}
                    onChange={(e) => setExceedsDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && exceedsDraft.trim()) {
                        e.preventDefault()
                        onAddScoreComment(item.id, 'exceeds', exceedsDraft.trim())
                        setExceedsDraft('')
                      }
                    }}
                    className="flex-1 text-xs rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder-slate-300 text-slate-700"
                  />
                  <button
                    disabled={!exceedsDraft.trim()}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!exceedsDraft.trim()) return
                      onAddScoreComment(item.id, 'exceeds', exceedsDraft.trim())
                      setExceedsDraft('')
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

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

      {!isActive && isScored && score && score.annotations.length > 0 && (
        <div className="px-4 pb-2.5" style={{ paddingLeft: '2.75rem' }}>
          <span className="text-[10px] text-slate-400">
            {score.annotations.length} annotation{score.annotations.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AnnotationPanel({
  rubricItems,
  scores,
  activeItemId,
  isSubmitted,
  generalAnnotations,
  onActiveItemChange,
  onScoreChange,
  onAnnotationDelete,
  onAddGeneralNote,
  onDeleteGeneralAnnotation,
  onAddScoreComment,
  onDeleteScoreComment,
}: AnnotationPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null)
  const [newNoteBody, setNewNoteBody] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  // Group items by rubric
  const groups = useMemo(() => {
    const map = new Map<string, { rubricId: string; title: string; items: RubricItem[] }>()
    for (const item of rubricItems) {
      if (!map.has(item.rubric_id)) {
        map.set(item.rubric_id, {
          rubricId: item.rubric_id,
          title: item.rubric_title ?? 'Rubric',
          items: [],
        })
      }
      map.get(item.rubric_id)!.items.push(item)
    }
    return Array.from(map.values())
  }, [rubricItems])

  // Track which rubric sections are collapsed (default: all open)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapsed = (rubricId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(rubricId)) next.delete(rubricId)
      else next.add(rubricId)
      return next
    })
  }

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
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Criteria</p>
        <span className={[
          'text-[11px] font-semibold px-2 py-0.5 rounded-full',
          scoredCount === rubricItems.length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
        ].join(' ')}>
          {scoredCount} / {rubricItems.length} rated
        </span>
      </div>

      {/* Scrollable list grouped by rubric */}
      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.rubricId)
          const groupScoredCount = group.items.filter((i) => scores[i.id]?.score != null).length

          return (
            <div key={group.rubricId}>
              {/* Rubric section header / dropdown trigger */}
              <button
                onClick={() => toggleCollapsed(group.rubricId)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
              >
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate pr-2">
                  {group.title}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={[
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    groupScoredCount === group.items.length
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-200 text-slate-500',
                  ].join(' ')}>
                    {groupScoredCount}/{group.items.length}
                  </span>
                  <svg
                    className={['h-3.5 w-3.5 text-slate-400 transition-transform duration-150',
                      isCollapsed ? '' : 'rotate-180'].join(' ')}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd" />
                  </svg>
                </div>
              </button>

              {/* Criteria within this rubric */}
              {!isCollapsed && group.items.map((item, index) => (
                <CriterionCard
                  key={item.id}
                  item={item}
                  index={index}
                  score={scores[item.id]}
                  isActive={item.id === activeItemId}
                  isSubmitted={isSubmitted}
                  activeRef={activeRef}
                  onActiveItemChange={onActiveItemChange}
                  onScoreChange={onScoreChange}
                  onAnnotationDelete={onAnnotationDelete}
                  onAddScoreComment={onAddScoreComment}
                  onDeleteScoreComment={onDeleteScoreComment}
                />
              ))}
            </div>
          )
        })}
        {/* Free notes section */}
        <div className="border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => toggleCollapsed('__notes__')}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Free Notes
            </span>
            <svg
              className={['h-3.5 w-3.5 text-slate-400 transition-transform duration-150',
                collapsed.has('__notes__') ? '' : 'rotate-180'].join(' ')}
              viewBox="0 0 20 20" fill="currentColor"
            >
              <path fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd" />
            </svg>
          </button>

          {!collapsed.has('__notes__') && (
            <div className="px-4 py-3 space-y-2">
              {/* Existing note entries */}
              {generalAnnotations.map((ann) => {
                const hasAnchor = Array.isArray((ann.anchor as any)?.rects) && (ann.anchor as any).rects.length > 0
                return (
                  <div
                    key={ann.id}
                    className="group flex items-start gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      {hasAnchor && (
                        <p className="text-[10px] text-slate-400 italic truncate mb-0.5">
                          &ldquo;{(ann.anchor as any).text?.slice(0, 60)}&hellip;&rdquo;
                        </p>
                      )}
                      <p className="text-[11px] text-slate-700 leading-snug">{ann.body}</p>
                    </div>
                    {!isSubmitted && (
                      <button
                        onClick={() => onDeleteGeneralAnnotation(ann.id)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-slate-300 hover:text-red-400 transition-opacity mt-0.5"
                        aria-label="Delete note"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Add new note */}
              {!isSubmitted && (
                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    placeholder="Add a general observation…"
                    value={newNoteBody}
                    onChange={(e) => setNewNoteBody(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newNoteBody.trim()) {
                        setNoteSaving(true)
                        await onAddGeneralNote(newNoteBody.trim())
                        setNewNoteBody('')
                        setNoteSaving(false)
                      }
                    }}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 resize-none
                      focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]
                      placeholder-slate-300 text-slate-700 bg-white"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">⌘↵ to add</span>
                    <button
                      disabled={!newNoteBody.trim() || noteSaving}
                      onClick={async () => {
                        if (!newNoteBody.trim()) return
                        setNoteSaving(true)
                        await onAddGeneralNote(newNoteBody.trim())
                        setNewNoteBody('')
                        setNoteSaving(false)
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1e3a5f] text-white font-medium
                        disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#162d4a] transition-colors"
                    >
                      {noteSaving ? 'Adding…' : 'Add note'}
                    </button>
                  </div>
                </div>
              )}

              {generalAnnotations.length === 0 && isSubmitted && (
                <p className="text-[11px] text-slate-400 italic">No free notes were added.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
