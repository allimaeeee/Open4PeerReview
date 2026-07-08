'use client'

// Reads the current route and extracts page role + document IDs.
// Preloads review data from Supabase so shortcuts can run without an extra fetch.

import { useEffect, useState, useMemo, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadReviewerData, loadFeedbackData } from './shortcuts/reviewDataLoader'
import { reviewProgress } from './shortcuts/reviewProgress'
import { checkAllFeedback } from './shortcuts/checkAllFeedback'
import { explainCriterionFirstTurn, FOLLOW_UP_KEYS } from './shortcuts/explainCriterion'
import { summarizeFeedback } from './shortcuts/summarizeFeedback'
import { clarifyAnnotation } from './shortcuts/clarifyAnnotation'
import { refineFeedback } from './shortcuts/refineFeedback'
import { checkTone } from './shortcuts/checkTone'
import type { ReviewerData, FeedbackData, CriterionWithScore, CheckAllFeedbackResult } from './shortcuts/types'
import type { ContextSnippet, ChatOption, PendingFollowUp } from './AIChatContext'
import type { RubricSlug } from './rubric-data/rubricNameMap'

export type PageRole = 'reviewer' | 'author' | null

// A shortcut can return plain text, ask for a picker, or (Explain Criterion's
// first turn) text plus tappable follow-up options bound to a specific
// criterion/rubric — the caller stores `followUpContext` so a later option
// click can resolve back to the right shortcut call.
export interface ShortcutResultWithOptions {
  text: string
  options: ChatOption[]
  followUpContext: PendingFollowUp
}

export type ShortcutRunResult = string | 'NEEDS_PICKER' | ShortcutResultWithOptions

export const ALL_CRITERIA_PICKER_ID = '__all__'

export interface Shortcut {
  id: string
  label: string
  /** Primary run — may return 'NEEDS_PICKER' for item-specific shortcuts when no snippet matches */
  run: (ctx: RunContext) => Promise<ShortcutRunResult>
  /** Called after user selects a criterion from the picker (or ALL_CRITERIA_PICKER_ID) */
  runWithPick?: (ctx: RunContext, criterionId: string) => Promise<string | ShortcutResultWithOptions>
  /** Whether this shortcut needs an item selection */
  needsPicker?: boolean
  /** Prepends an "All criteria" option to the picker (scope-picker shortcuts) */
  pickerIncludesAllOption?: boolean
}

export interface RunContext {
  contextSnippets: ContextSnippet[]
  reviewData: ReviewerData | FeedbackData | null
}

// ── Snippet matching ──────────────────────────────────────────────────────────

function matchSnippetToCriterion(
  snippets: ContextSnippet[],
  criteria: CriterionWithScore[],
): CriterionWithScore | null {
  if (snippets.length === 0) return null
  const snippetTexts = snippets.map(s => s.text.toLowerCase())

  const matches = criteria.filter(c => {
    const label = c.criterion.label.toLowerCase()
    const desc  = c.criterion.description.toLowerCase()
    return snippetTexts.some(t =>
      label.includes(t) || t.includes(label) ||
      desc.includes(t)  ||
      c.annotations.some(a => a.body.toLowerCase().includes(t) || t.includes(a.body.toLowerCase()))
    )
  })
  return matches.length === 1 ? matches[0] : null
}

function matchSnippetToAnnotation(
  snippets: ContextSnippet[],
  criteria: CriterionWithScore[],
): { annotation: CriterionWithScore['annotations'][number]; criterion: CriterionWithScore } | null {
  if (snippets.length === 0) return null
  const snippetTexts = snippets.map(s => s.text.toLowerCase())

  for (const c of criteria) {
    for (const a of c.annotations) {
      const body = a.body.toLowerCase()
      if (snippetTexts.some(t => body.includes(t) || t.includes(body))) {
        return { annotation: a, criterion: c }
      }
    }
  }
  return null
}

// ── Shortcut formatting helpers ───────────────────────────────────────────────

function toFollowUpOptions(followUps: string[]): ChatOption[] {
  return followUps.slice(0, FOLLOW_UP_KEYS.length).map((label, i) => ({ key: FOLLOW_UP_KEYS[i], label }))
}

function buildExplainCriterionResult(
  result: { summary: string; followUps: string[] },
  criterion: CriterionWithScore['criterion'],
  criterionIndex: number,
  rubricSlug: RubricSlug,
): ShortcutResultWithOptions {
  return {
    text: result.summary,
    options: toFollowUpOptions(result.followUps),
    followUpContext: { criterion, criterionIndex, rubricSlug },
  }
}

// Renders as short paragraphs, not a bracket-tagged/dash-bulleted data dump —
// the criterion's own label stands in for the internal issue-category enum,
// since the model's `explanation` text already says what's wrong in plain
// language. No "Flagged:"/"Strong examples:" headers, matching the same
// no-headers rule the model's own text is held to.
function formatCheckAllFeedback(result: CheckAllFeedbackResult): string {
  const concernParagraphs = result.topConcerns.map(c => `${c.criterionLabel}: "${c.excerpt}" — ${c.suggestion}`)
  const strongParagraphs = result.strongExamples.map(s => `${s.criterionLabel}: ${s.reason}`)

  return [result.overallImpression, ...concernParagraphs, ...strongParagraphs, result.followUpQuestion].filter(Boolean).join('\n\n')
}

// The reviewer's overall rating comments are the primary "feedback text" for
// a criterion — a criterion can have a comment in both the EXCEEDS and DOES
// NOT MEET boxes at once, so all non-empty ones are collected and labeled by
// rating level (not just the first), falling back to the first inline
// annotation (unlabeled) only when there are zero score comments.
function getExistingCommentText(criterionEntry: CriterionWithScore): string | null {
  const labeled = criterionEntry.scoreComments
    .filter(sc => sc.body.trim().length > 0)
    .map(sc => `[${sc.score_level === 'does_not_meet' ? 'DOES NOT MEET' : 'EXCEEDS'}]: "${sc.body}"`)
  if (labeled.length > 0) return labeled.join('\n')
  return criterionEntry.annotations[0]?.body || null
}

async function runRefineFeedback(
  selectedText: string,
  criterionEntry: CriterionWithScore,
  criterionIndex: number,
  rubricSlug: RubricSlug,
): Promise<string> {
  return refineFeedback({
    selectedText,
    criterion: criterionEntry.criterion,
    criterionIndex,
    pageRole: 'reviewer',
    rubricSlug,
  })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// Best-effort "primary" rubric for prompt-building: ReviewerData is always a
// single rubric (one review = one rubric_id); FeedbackData can span multiple
// rubrics assigned to a document, so we fall back to the first criterion with
// a resolvable slug — an approximation, not a guarantee of correctness for
// mixed-rubric feedback pages.
function getPrimaryRubricSlug(reviewData: ReviewerData | FeedbackData | null): RubricSlug | null {
  if (!reviewData) return null
  if ('rubricSlug' in reviewData) return reviewData.rubricSlug
  return reviewData.criteria.find(c => c.criterion.rubricSlug)?.criterion.rubricSlug ?? null
}

export function useChatContext(): {
  pageRole: PageRole
  documentId: string | null
  shortcuts: Shortcut[]
  reviewData: ReviewerData | FeedbackData | null
  rubricSlug: RubricSlug | null
  isReviewDataLoading: boolean
  /** Set when the query itself failed (RLS denial, network issue, etc.) — distinct from reviewData being null because there's legitimately nothing there yet. */
  reviewDataError: string | null
  fetchReviewData: () => Promise<ReviewerData | FeedbackData | null>
} {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  // Was a ref before — mutating `.current` from the async load below never
  // triggered a re-render, so shortcuts could see stale (null) data until some
  // unrelated state change happened to re-render the component first. useState
  // makes the load itself the thing that triggers the update.
  const [reviewData, setReviewData] = useState<ReviewerData | FeedbackData | null>(null)
  const [isReviewDataLoading, setIsReviewDataLoading] = useState(false)
  const [reviewDataError, setReviewDataError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Determine page role and document ID
  const isReviewConsole = pathname === '/review' || pathname.startsWith('/review?')
  const isFeedbackPage  = /^\/author\/feedback\//.test(pathname)

  const pageRole: PageRole = isReviewConsole ? 'reviewer' : isFeedbackPage ? 'author' : null
  const documentId: string | null = isReviewConsole
    ? searchParams.get('document')
    : isFeedbackPage
    ? pathname.split('/author/feedback/')[1]?.split('/')[0] ?? null
    : null

  // Preload review data when page role + documentId are known
  useEffect(() => {
    setReviewData(null)
    setReviewDataError(null)
    if (!documentId) {
      setIsReviewDataLoading(false)
      return
    }

    let cancelled = false
    setIsReviewDataLoading(true)

    const load = pageRole === 'reviewer' ? loadReviewerData(supabase, documentId)
      : pageRole === 'author' ? loadFeedbackData(supabase, documentId)
      : null

    if (!load) {
      setIsReviewDataLoading(false)
    } else {
      load.then(result => {
        if (cancelled) return
        if (result.ok) {
          setReviewData(result.data)
        } else {
          setReviewData(null)
          setReviewDataError(result.error)
        }
        setIsReviewDataLoading(false)
      })
    }

    return () => { cancelled = true }
  }, [pageRole, documentId, supabase])

  // On-demand refetch for shortcut invocation — the preload above only runs
  // once per [pageRole, documentId], so it goes stale the moment a rating
  // comment is saved elsewhere (e.g. the report panel) after that. Shortcuts
  // call this right before they run so they see the latest saved data instead
  // of the cached snapshot.
  const fetchReviewData = useCallback(async (): Promise<ReviewerData | FeedbackData | null> => {
    if (!documentId) return null
    const load = pageRole === 'reviewer' ? loadReviewerData(supabase, documentId)
      : pageRole === 'author' ? loadFeedbackData(supabase, documentId)
      : null
    if (!load) return null
    const result = await load
    if (!result.ok) {
      setReviewDataError(result.error)
      return null
    }
    setReviewData(result.data)
    setReviewDataError(null)
    return result.data
  }, [pageRole, documentId, supabase])

  // ── Reviewer shortcuts ────────────────────────────────────────────────────

  const reviewerShortcuts: Shortcut[] = useMemo(() => [
    {
      id: 'review-progress',
      label: 'Review Progress',
      run: async ({ reviewData }) => {
        const data = reviewData as ReviewerData | null
        if (!data || !data.rubricSlug) return 'No review data loaded yet. Navigate to a review first.'
        const result = await reviewProgress({ criteria: data.criteria, pageRole: 'reviewer', rubricSlug: data.rubricSlug })
        const detail = result.criteria
          .filter(c => c.status !== 'complete')
          .map(c => `- ${c.criterionLabel}: ${c.status} (missing ${c.missing.join(', ') || 'nothing'})`)
          .join('\n')
        return detail ? `${result.summary}\n\n${detail}` : result.summary
      },
    },
    {
      id: 'check-all-feedback',
      label: 'Check All Feedback',
      needsPicker: true,
      pickerIncludesAllOption: true,
      run: async () => 'NEEDS_PICKER',
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as ReviewerData | null
        if (!data || !data.rubricSlug) return 'No review data loaded yet.'
        const result = await checkAllFeedback({
          criteria: data.criteria,
          scopeCriterionId: criterionId === ALL_CRITERIA_PICKER_ID ? undefined : criterionId,
          pageRole: 'reviewer',
          rubricSlug: data.rubricSlug,
        })
        return formatCheckAllFeedback(result)
      },
    },
    {
      id: 'explain-criterion',
      label: 'Explain Criterion',
      needsPicker: true,
      run: async ({ contextSnippets, reviewData }) => {
        const data = reviewData as ReviewerData | null
        if (!data) return 'No review data loaded yet.'
        const matched = matchSnippetToCriterion(contextSnippets, data.criteria)
        if (matched && data.rubricSlug) {
          const index = data.criteria.findIndex(c => c.criterion.id === matched.criterion.id)
          const result = await explainCriterionFirstTurn({ criterion: matched.criterion, criterionIndex: index, pageRole: 'reviewer', rubricSlug: data.rubricSlug })
          return buildExplainCriterionResult(result, matched.criterion, index, data.rubricSlug)
        }
        return 'NEEDS_PICKER'
      },
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as ReviewerData | null
        const index = data?.criteria.findIndex(c => c.criterion.id === criterionId) ?? -1
        const c = index >= 0 ? data!.criteria[index] : undefined
        if (!c || !data?.rubricSlug) return 'Criterion not found.'
        const result = await explainCriterionFirstTurn({ criterion: c.criterion, criterionIndex: index, pageRole: 'reviewer', rubricSlug: data.rubricSlug })
        return buildExplainCriterionResult(result, c.criterion, index, data.rubricSlug)
      },
    },
    {
      id: 'refine-feedback',
      label: 'Refine my feedback',
      needsPicker: true,
      // Always goes straight to the criteria picker — the comment to refine
      // comes from the reviewer's existing rating comment for whichever
      // criterion they pick, not from a text selection.
      run: async () => 'NEEDS_PICKER',
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as ReviewerData | null
        const index = data?.criteria.findIndex(c => c.criterion.id === criterionId) ?? -1
        const c = index >= 0 ? data!.criteria[index] : undefined
        if (!c || !data?.rubricSlug) return 'Criterion not found.'
        const existingComment = getExistingCommentText(c)
        if (!existingComment) {
          return `No feedback text yet for "${c.criterion.label}" — write a comment for this criterion first, then come back.`
        }
        return runRefineFeedback(existingComment, c, index, data.rubricSlug)
      },
    },
    {
      id: 'check-tone',
      label: 'Check my tone',
      needsPicker: true,
      // Same picker pattern as Refine my feedback — pulls the reviewer's
      // existing comment for whichever criterion is picked, but checks
      // delivery (professional, collegial, resource-focused) rather than
      // rubric-grounded substance.
      run: async () => 'NEEDS_PICKER',
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as ReviewerData | null
        const index = data?.criteria.findIndex(c => c.criterion.id === criterionId) ?? -1
        const c = index >= 0 ? data!.criteria[index] : undefined
        if (!c || !data?.rubricSlug) return 'Criterion not found.'
        const existingComment = getExistingCommentText(c)
        if (!existingComment) {
          return 'No comment for this criterion yet — write one first and I can check the tone.'
        }
        return checkTone({ selectedText: existingComment, criterion: c.criterion, pageRole: 'reviewer', rubricSlug: data.rubricSlug })
      },
    },
  ], [])

  // ── Author shortcuts ──────────────────────────────────────────────────────

  const authorShortcuts: Shortcut[] = useMemo(() => [
    {
      id: 'summarize-feedback',
      label: 'Summarize Feedback',
      run: async ({ reviewData }) => {
        const data = reviewData as FeedbackData | null
        const rubricSlug = getPrimaryRubricSlug(data)
        if (!data || !rubricSlug) return 'No feedback data loaded yet.'
        return summarizeFeedback({ criteria: data.criteria, pageRole: 'author', rubricSlug })
      },
    },
    {
      id: 'clarify-annotation',
      label: 'Clarify Annotation',
      needsPicker: true,
      run: async ({ contextSnippets, reviewData }) => {
        const data = reviewData as FeedbackData | null
        if (!data) return 'No feedback data loaded yet.'
        const matched = matchSnippetToAnnotation(contextSnippets, data.criteria)
        if (matched && matched.criterion.criterion.rubricSlug) {
          const index = data.criteria.findIndex(c => c.criterion.id === matched.criterion.criterion.id)
          const result = await clarifyAnnotation({
            annotation: matched.annotation,
            criterion: matched.criterion.criterion,
            criterionIndex: index,
            overallComment: matched.criterion.scoreComments[0],
            pageRole: 'author',
            rubricSlug: matched.criterion.criterion.rubricSlug,
          })
          return result.explanation
        }
        return 'NEEDS_PICKER'
      },
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as FeedbackData | null
        const index = data?.criteria.findIndex(c => c.criterion.id === criterionId) ?? -1
        const c = index >= 0 ? data!.criteria[index] : undefined
        if (!c || c.annotations.length === 0 || !c.criterion.rubricSlug) return 'No annotations found for this criterion.'
        const ann = c.annotations[0]
        const result = await clarifyAnnotation({
          annotation: ann,
          criterion: c.criterion,
          criterionIndex: index,
          overallComment: c.scoreComments[0],
          pageRole: 'author',
          rubricSlug: c.criterion.rubricSlug,
        })
        return result.explanation
      },
    },
  ], [])

  const shortcuts = pageRole === 'reviewer'
    ? reviewerShortcuts
    : pageRole === 'author'
    ? authorShortcuts
    : []

  return {
    pageRole,
    documentId,
    shortcuts,
    reviewData,
    rubricSlug: getPrimaryRubricSlug(reviewData),
    isReviewDataLoading,
    reviewDataError,
    fetchReviewData,
  }
}
