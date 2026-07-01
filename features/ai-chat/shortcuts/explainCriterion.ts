import { callAI } from './aiService'
import type { RubricCriterion, ExplainCriterionResult } from './types'

export async function explainCriterion(input: {
  criterion: RubricCriterion
}): Promise<ExplainCriterionResult> {
  const prompt = `You are an academic peer review assistant. Explain this OER rubric criterion to a reviewer in plain language.

Criterion: "${input.criterion.label}"
Standard definition: ${input.criterion.description}

Provide:
1. A plain-language explanation (2-3 sentences) of what this criterion is really asking.
2. A brief concrete example of what HIGH quality looks like for this criterion.
3. A brief concrete example of what LOW quality (Does Not Meet) looks like.

Output format (JSON):
{
  "plainExplanation": "<explanation>",
  "highQualityExample": "<example of exceeding/meeting this criterion>",
  "lowQualityExample": "<example of not meeting this criterion>"
}`

  const raw = await callAI(prompt)

  try {
    const parsed = JSON.parse(raw) as ExplainCriterionResult
    if (parsed.plainExplanation) return parsed
  } catch { /* stub */ }

  return { plainExplanation: raw, highQualityExample: '', lowQualityExample: '' }
}
