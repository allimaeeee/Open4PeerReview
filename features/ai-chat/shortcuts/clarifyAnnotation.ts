import { callAI } from './aiService'
import type { AnnotationInput, RubricCriterion, ClarifyAnnotationResult } from './types'

export async function clarifyAnnotation(input: {
  annotation: AnnotationInput
  criterion: RubricCriterion
}): Promise<ClarifyAnnotationResult> {
  const tagNote = input.annotation.tag
    ? `This annotation is tagged as "${input.annotation.tag.replace('_', ' ')}".`
    : ''

  const prompt = `You are an academic peer review assistant helping an OER author understand feedback.

Rubric criterion: "${input.criterion.label}"
Criterion standard: ${input.criterion.description}

Reviewer annotation: "${input.annotation.body}"
${tagNote}

Provide:
1. A plain-language explanation of what this feedback means in the context of the rubric criterion.
2. 2-3 concrete revision directions the author could take. Do NOT generate revised content — only suggest directions.

Output format (JSON):
{
  "explanation": "<explanation>",
  "revisionDirections": ["<direction1>", "<direction2>", "<direction3>"]
}`

  const raw = await callAI(prompt)

  try {
    const parsed = JSON.parse(raw) as ClarifyAnnotationResult
    if (parsed.explanation && Array.isArray(parsed.revisionDirections)) return parsed
  } catch { /* stub */ }

  return { explanation: raw, revisionDirections: [] }
}
