import type { CriterionWithScore, RatingSummary } from './types'

// Flattens CriterionWithScore[] -> one RatingSummary per scored comment, joined
// with the parent criterion's label. Used by Summarize Feedback, which needs
// ratings+comments but no rubric content (glossary/framing/standards).
export function buildRatingSummaries(criteria: CriterionWithScore[]): RatingSummary[] {
  return criteria.flatMap(c =>
    c.scoreComments
      .filter(sc => sc.body.trim().length > 0)
      .map(sc => ({
        criterionId: c.criterion.id,
        criterionLabel: c.criterion.label,
        ratingLevel: sc.score_level,
        comment: sc.body,
      })),
  )
}
