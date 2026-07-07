// Shared types for all AI shortcut functions.
// Score is always an array — a criterion can hold multiple ratings simultaneously
// (e.g. ['does_not_meet', 'exceeds'] for a multi-part criterion).
// Matches DB model: review_scores.criterion_scores is stored as an array.

import type { RubricSlug } from '../rubric-data/rubricNameMap'

export type CriterionScore = 'does_not_meet' | 'exemplifies' | 'exceeds'

export interface RubricCriterion {
  id: string
  label: string
  description: string
  // Resolved from the parent rubric's title via rubricNameMap.resolveRubricSlug —
  // null when the DB title doesn't match one of the 6 known rubrics (e.g. a
  // custom, non-preset rubric). Static rubric-data content (operational
  // definition, glossary, framing language) is unavailable in that case.
  rubricSlug: RubricSlug | null
}

export interface AnnotationInput {
  id: string
  body: string
  tag: 'action_item' | 'quick_fix' | null
  rubric_item_id: string | null
}

export interface ScoreCommentInput {
  id: string
  rubric_item_id: string
  score_level: 'does_not_meet' | 'exceeds'
  body: string
}

// CriterionWithScore is the canonical unit for all shortcut functions.
// - scores.length === 0  →  unrated
// - scores can hold >1 value simultaneously (multi-part criteria)
export interface CriterionWithScore {
  criterion: RubricCriterion
  scores: CriterionScore[]
  scoreComments: ScoreCommentInput[]
  annotations: AnnotationInput[]
}

// Data shape loaded from Supabase for the reviewer console (/review?document=<id>)
export interface ReviewerData {
  reviewId: string
  documentId: string
  rubricSlug: RubricSlug | null
  criteria: CriterionWithScore[]
}

// Data shape loaded from Supabase for the feedback view (/author/feedback/<id>)
export interface FeedbackData {
  documentId: string
  criteria: CriterionWithScore[]
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface ClarifyAnnotationResult {
  explanation: string
}

export interface ExplainCriterionFirstTurnResult {
  summary: string
  followUps: string[]
}

// ── v3 overhaul types ─────────────────────────────────────────────────────────

export type CriterionProgressStatus = 'complete' | 'in_progress' | 'not_started'

export interface CriterionProgress {
  criterionId: string
  criterionLabel: string
  status: CriterionProgressStatus
  missing: string[] // e.g. ["rating", "comment"] — what's still needed to reach "complete"
}

export interface ReviewProgressResult {
  summary: string
  criteria: CriterionProgress[]
}

// Compact ratings+comments shape used by Summarize Feedback — no rubric content needed.
export interface RatingSummary {
  criterionId: string
  criterionLabel: string
  ratingLevel: 'does_not_meet' | 'exceeds'
  comment: string
}

export interface TopConcernItem {
  criterionLabel: string
  excerpt: string
  suggestion: string
}

export interface StrongExampleItem {
  criterionLabel: string
  reason: string
}

export interface CheckAllFeedbackResult {
  overallImpression: string
  topConcerns: TopConcernItem[]
  strongExamples: StrongExampleItem[]
  followUpQuestion: string
}
