import { callAI } from './aiService'
import { checkToneSpec } from '../server/outputSpecs'
import type { PageRole } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'
import type { RubricCriterion } from './types'

// Checks delivery (professional, collegial, resource-focused), not substance —
// that's Refine My Feedback's job. No rubric-standard context is needed here,
// only the comment text itself, so includeBlocks is omitted entirely.
export async function checkTone(input: {
  selectedText: string
  criterion: RubricCriterion
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<string> {
  const userMessage = `The reviewer wants to check the tone of their feedback for criterion ${input.criterion.label}.

Their comments:
${input.selectedText}

Check the tone of this feedback.`

  return callAI({
    mode: 'shortcut',
    shortcutId: 'check-tone',
    userMessage,
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    outputSpec: checkToneSpec(),
    generationConfig: { temperature: 0.5, maxOutputTokens: 256 },
  })
}
