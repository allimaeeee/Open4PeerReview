// Shared types for all AI shortcut functions.
// Score is always an array — a criterion can hold multiple ratings simultaneously
// (e.g. ['does_not_meet', 'exceeds'] for a multi-part criterion).
// Matches DB model: review_scores.criterion_scores is stored as an array.

export type CriterionScore = 'does_not_meet' | 'exemplifies' | 'exceeds'

export interface RubricCriterion {
  id: string
  label: string
  description: string
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
  criteria: CriterionWithScore[]
}

// Data shape loaded from Supabase for the feedback view (/author/feedback/<id>)
export interface FeedbackData {
  documentId: string
  criteria: CriterionWithScore[]
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface SummarizeFeedbackResult {
  summary: string
  priorityOrder: string[]
}

export interface ClarifyAnnotationResult {
  explanation: string
  revisionDirections: string[]
}

export interface CheckCoverageResult {
  uncoveredCriteria: string[]
  reminder: string
}

export interface NudgeFeedbackQualityResult {
  isGood: boolean
  suggestion: string | null
}

export interface ExplainCriterionResult {
  plainExplanation: string
  highQualityExample: string
  lowQualityExample: string
}

export interface ScaffoldReviewResult {
  guidingQuestions: string[]
}
