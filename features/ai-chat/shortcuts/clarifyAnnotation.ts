import { callAI } from './aiService'
import { getCriterionStandardByIndex } from '../rubric-data/criteriaStandards'
import { explainCommentSpec } from '../server/outputSpecs'
import type { PageRole } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'
import type { AnnotationInput, RubricCriterion, ScoreCommentInput, ClarifyAnnotationResult } from './types'

export async function clarifyAnnotation(input: {
  annotation: AnnotationInput
  criterion: RubricCriterion
  criterionIndex: number
  overallComment?: ScoreCommentInput
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<ClarifyAnnotationResult> {
  const standard = input.criterion.rubricSlug
    ? getCriterionStandardByIndex(input.criterion.rubricSlug, input.criterionIndex)
    : null

  const userMessage = `The author is looking at this annotation:
- Criterion: ${input.criterion.label}
- Tag: ${input.annotation.tag ?? '(untagged)'}
- Reviewer wrote: "${input.annotation.body}"
${input.overallComment ? `- Overall comment on this criterion (${input.overallComment.score_level}): "${input.overallComment.body}"` : ''}

Explain what the reviewer is pointing out and what the author could do about it.`

  const explanation = await callAI({
    mode: 'shortcut',
    shortcutId: 'clarify-annotation',
    userMessage,
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    includeBlocks: standard ? { criterionStandard: standard, glossaryForCriterion: true } : undefined,
    outputSpec: explainCommentSpec(),
    generationConfig: { temperature: 0.5, maxOutputTokens: 256 },
  })

  return { explanation }
}
