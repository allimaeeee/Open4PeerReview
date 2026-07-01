import { callAI } from './aiService'
import type { RubricCriterion, ScaffoldReviewResult } from './types'

export async function scaffoldReview(input: {
  criterion: RubricCriterion
  oerContext?: string
}): Promise<ScaffoldReviewResult> {
  const contextBlock = input.oerContext
    ? `\nOER context the reviewer is reading:\n"${input.oerContext.slice(0, 800)}"\n`
    : ''

  const prompt = `You are an academic peer review coach. Generate 4-5 guiding questions to help a reviewer structure their evaluation of this OER rubric criterion.
${contextBlock}
Criterion: "${input.criterion.label}"
Standard: ${input.criterion.description}

The questions should prompt the reviewer to look for specific evidence in the OER and articulate their reasoning. They should be open-ended, not yes/no.

Output format (JSON):
{
  "guidingQuestions": ["<question1>", "<question2>", "<question3>", "<question4>", "<question5>"]
}`

  const raw = await callAI(prompt)

  try {
    const parsed = JSON.parse(raw) as ScaffoldReviewResult
    if (Array.isArray(parsed.guidingQuestions)) return parsed
  } catch { /* stub */ }

  return { guidingQuestions: [raw] }
}
