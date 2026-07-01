'use client'

// Reads the current route and extracts page role + document IDs.
// Preloads review data from Supabase so shortcuts can run without an extra fetch.

import { useEffect, useRef, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadReviewerData, loadFeedbackData } from './shortcuts/reviewDataLoader'
import { checkCoverage } from './shortcuts/checkCoverage'
import { explainCriterion } from './shortcuts/explainCriterion'
import { scaffoldReview } from './shortcuts/scaffoldReview'
import { nudgeFeedbackQuality } from './shortcuts/nudgeFeedbackQuality'
import { summarizeFeedback } from './shortcuts/summarizeFeedback'
import { clarifyAnnotation } from './shortcuts/clarifyAnnotation'
import type { ReviewerData, FeedbackData, CriterionWithScore } from './shortcuts/types'
import type { ContextSnippet } from './AIChatContext'

export type PageRole = 'reviewer' | 'author' | null

export type ShortcutRunResult = string | 'NEEDS_PICKER'

export interface Shortcut {
  id: string
  label: string
  /** Primary run — may return 'NEEDS_PICKER' for item-specific shortcuts when no snippet matches */
  run: (ctx: RunContext) => Promise<ShortcutRunResult>
  /** Called after user selects a criterion from the picker */
  runWithPick?: (ctx: RunContext, criterionId: string) => Promise<string>
  /** Whether this shortcut needs an item selection */
  needsPicker?: boolean
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChatContext(): {
  pageRole: PageRole
  documentId: string | null
  shortcuts: Shortcut[]
  reviewData: ReviewerData | FeedbackData | null
} {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const reviewDataRef = useRef<ReviewerData | FeedbackData | null>(null)
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
    reviewDataRef.current = null
    if (!documentId) return

    if (pageRole === 'reviewer') {
      loadReviewerData(supabase, documentId).then(data => { reviewDataRef.current = data })
    } else if (pageRole === 'author') {
      loadFeedbackData(supabase, documentId).then(data => { reviewDataRef.current = data })
    }
  }, [pageRole, documentId, supabase])

  // ── Reviewer shortcuts ────────────────────────────────────────────────────

  const reviewerShortcuts: Shortcut[] = useMemo(() => [
    {
      id: 'check-coverage',
      label: 'Check Coverage',
      run: async ({ reviewData }) => {
        const data = reviewData as ReviewerData | null
        if (!data) return 'No review data loaded yet. Navigate to a review first.'
        const result = await checkCoverage({ criteria: data.criteria })
        if (result.uncoveredCriteria.length === 0) return result.reminder
        return `${result.reminder}\n\nUncovered criteria:\n${result.uncoveredCriteria.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
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
        if (matched) {
          const result = await explainCriterion({ criterion: matched.criterion })
          return `**${matched.criterion.label}**\n\n${result.plainExplanation}\n\n✓ High quality: ${result.highQualityExample}\n✗ Low quality: ${result.lowQualityExample}`
        }
        return 'NEEDS_PICKER'
      },
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as ReviewerData | null
        const c = data?.criteria.find(c => c.criterion.id === criterionId)
        if (!c) return 'Criterion not found.'
        const result = await explainCriterion({ criterion: c.criterion })
        return `**${c.criterion.label}**\n\n${result.plainExplanation}\n\n✓ High quality: ${result.highQualityExample}\n✗ Low quality: ${result.lowQualityExample}`
      },
    },
    {
      id: 'scaffold-review',
      label: 'Scaffold Review',
      needsPicker: true,
      run: async ({ contextSnippets, reviewData }) => {
        const data = reviewData as ReviewerData | null
        if (!data) return 'No review data loaded yet.'
        const matched = matchSnippetToCriterion(contextSnippets, data.criteria)
        if (matched) {
          const oerContext = contextSnippets.map(s => s.text).join('\n')
          const result = await scaffoldReview({ criterion: matched.criterion, oerContext })
          return `**${matched.criterion.label} — Guiding Questions**\n\n${result.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
        }
        return 'NEEDS_PICKER'
      },
      runWithPick: async ({ contextSnippets, reviewData }, criterionId) => {
        const data = reviewData as ReviewerData | null
        const c = data?.criteria.find(c => c.criterion.id === criterionId)
        if (!c) return 'Criterion not found.'
        const oerContext = contextSnippets.map(s => s.text).join('\n')
        const result = await scaffoldReview({ criterion: c.criterion, oerContext })
        return `**${c.criterion.label} — Guiding Questions**\n\n${result.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      },
    },
    {
      id: 'nudge-quality',
      label: 'Nudge Quality',
      needsPicker: true,
      run: async ({ contextSnippets, reviewData }) => {
        const data = reviewData as ReviewerData | null
        // If user added a text snippet, treat it directly as the annotation body
        if (contextSnippets.length > 0) {
          const text = contextSnippets[0].text
          const result = await nudgeFeedbackQuality({ annotationBody: text })
          if (result.isGood) return 'This annotation is clear and actionable.'
          return `This annotation could be stronger.\n\nSuggestion: ${result.suggestion}`
        }
        // Otherwise try to find an annotation via snippet match on loaded data
        if (!data) return 'No review data loaded yet.'
        const matched = matchSnippetToAnnotation(contextSnippets, data.criteria)
        if (matched) {
          const result = await nudgeFeedbackQuality({ annotationBody: matched.annotation.body })
          if (result.isGood) return `"${matched.annotation.body.slice(0, 60)}…" is clear and actionable.`
          return `Annotation: "${matched.annotation.body.slice(0, 60)}…"\n\nSuggestion: ${result.suggestion}`
        }
        return 'NEEDS_PICKER'
      },
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as ReviewerData | null
        const c = data?.criteria.find(c => c.criterion.id === criterionId)
        if (!c || c.annotations.length === 0) return 'No annotations found for this criterion.'
        // Evaluate the first annotation for this criterion
        const ann = c.annotations[0]
        const result = await nudgeFeedbackQuality({ annotationBody: ann.body })
        if (result.isGood) return `"${ann.body.slice(0, 60)}…" is clear and actionable.`
        return `Annotation: "${ann.body.slice(0, 60)}…"\n\nSuggestion: ${result.suggestion}`
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
        if (!data) return 'No feedback data loaded yet.'
        const result = await summarizeFeedback({ criteria: data.criteria })
        return `${result.summary}\n\nPriority order:\n${result.priorityOrder.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
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
        if (matched) {
          const result = await clarifyAnnotation({ annotation: matched.annotation, criterion: matched.criterion.criterion })
          return `**What this feedback means:**\n${result.explanation}\n\n**Possible revision directions:**\n${result.revisionDirections.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
        }
        return 'NEEDS_PICKER'
      },
      runWithPick: async ({ reviewData }, criterionId) => {
        const data = reviewData as FeedbackData | null
        const c = data?.criteria.find(c => c.criterion.id === criterionId)
        if (!c || c.annotations.length === 0) return 'No annotations found for this criterion.'
        const ann = c.annotations[0]
        const result = await clarifyAnnotation({ annotation: ann, criterion: c.criterion })
        return `**What this feedback means:**\n${result.explanation}\n\n**Possible revision directions:**\n${result.revisionDirections.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
      },
    },
  ], [])

  const shortcuts = pageRole === 'reviewer'
    ? reviewerShortcuts
    : pageRole === 'author'
    ? authorShortcuts
    : []

  return { pageRole, documentId, shortcuts, reviewData: reviewDataRef.current }
}
