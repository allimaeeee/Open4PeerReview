import { callAI } from './aiService'
import { buildRatingSummaries } from './ratingSummary'
import { summarizeFeedbackSpec } from '../server/outputSpecs'
import type { PageRole } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'
import type { CriterionWithScore } from './types'

export async function summarizeFeedback(input: {
  criteria: CriterionWithScore[]
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<string> {
  const ratings = buildRatingSummaries(input.criteria)

  return callAI({
    mode: 'shortcut',
    shortcutId: 'summarize-feedback',
    userMessage: 'Summarize this review data for the author.',
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    includeBlocks: { ratings },
    outputSpec: summarizeFeedbackSpec(),
    generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
  })
}
