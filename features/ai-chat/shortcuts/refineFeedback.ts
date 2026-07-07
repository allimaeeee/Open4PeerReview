import { callAI } from './aiService'
import { getCriterionStandardByIndex } from '../rubric-data/criteriaStandards'
import { refineFeedbackRevisionSpec } from '../server/outputSpecs'
import type { PageRole } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'
import type { RubricCriterion } from './types'

// A single peer-tone observation about the reviewer's own comment(s) — the
// model picks whichever single most-impactful improvement applies (tone,
// rubric-grounding, or actionability) rather than the reviewer choosing a
// refinement direction upfront. Never a rewritten version of the comment.
// `selectedText` may contain multiple `[RATING LEVEL]: "..."` lines when the
// criterion has comments in more than one rating box — the rating is carried
// inline per-line rather than as a separate param, since a criterion can
// have different ratings for different boxes at once.
export async function refineFeedback(input: {
  selectedText: string
  criterion: RubricCriterion
  criterionIndex: number
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<string> {
  const standard = input.criterion.rubricSlug
    ? getCriterionStandardByIndex(input.criterion.rubricSlug, input.criterionIndex)
    : null

  const userMessage = `The reviewer has shared feedback they wrote for criterion ${input.criterion.label}.

Their comments:
${input.selectedText}

Give a brief peer observation about how these could be stronger.`

  return callAI({
    mode: 'shortcut',
    shortcutId: 'refine-feedback',
    userMessage,
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    includeBlocks: standard ? { criterionStandard: standard, glossaryForCriterion: true } : undefined,
    outputSpec: refineFeedbackRevisionSpec(),
    generationConfig: { temperature: 0.5, maxOutputTokens: 256 },
  })
}
