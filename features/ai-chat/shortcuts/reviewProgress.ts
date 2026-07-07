import { callAI } from './aiService'
import { reviewProgressSpec } from '../server/outputSpecs'
import type { PageRole } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'
import type { CriterionWithScore, CriterionProgress, ReviewProgressResult } from './types'

// Deterministic — the LLM is not trusted to get complete/in_progress/not_started
// classification right; it only narrates the state computed here.
export function computeCriterionStatus(criterion: CriterionWithScore): CriterionProgress {
  const hasScore = criterion.scores.length > 0
  const hasComment = criterion.scoreComments.some(c => c.body.trim().length > 0)
  const hasAnnotation = criterion.annotations.length > 0

  const missing: string[] = []
  if (!hasScore) missing.push('rating')
  if (!hasComment) missing.push('comment')

  let status: CriterionProgress['status']
  if (hasScore && hasComment) status = 'complete'
  else if (hasScore || hasComment || hasAnnotation) status = 'in_progress'
  else status = 'not_started'

  return {
    criterionId: criterion.criterion.id,
    criterionLabel: criterion.criterion.label,
    status,
    missing,
  }
}

export async function reviewProgress(input: {
  criteria: CriterionWithScore[]
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<ReviewProgressResult> {
  const criteria = input.criteria.map(computeCriterionStatus)

  // Always calls the model, even when every criterion is complete — a
  // quality scan of the comment text (thin, generic, repeated across
  // criteria) is the point, not just relaying status the reviewer can
  // already see in the UI.
  const commentByCriterionId = new Map(
    input.criteria.map(c => [c.criterion.id, c.scoreComments[0]?.body?.trim() || null]),
  )

  const userMessage = `Precomputed criterion status:
${criteria.map(c => {
    const comment = commentByCriterionId.get(c.criterionId)
    return `- ${c.criterionLabel}: ${c.status} (missing: ${c.missing.join(', ') || 'nothing'})\n  Comment: "${comment || '(no comment yet)'}"`
  }).join('\n')}`

  const summary = await callAI({
    mode: 'shortcut',
    shortcutId: 'review-progress',
    userMessage,
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    outputSpec: reviewProgressSpec(),
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  })

  return { summary, criteria }
}
