import { callAI } from './aiService'
import type { NudgeFeedbackQualityResult } from './types'

export async function nudgeFeedbackQuality(input: {
  annotationBody: string
}): Promise<NudgeFeedbackQualityResult> {
  const prompt = `You are an academic peer review quality coach. Evaluate this reviewer annotation for actionability and specificity:

"${input.annotationBody}"

Determine whether it gives the author enough concrete, specific guidance to act on. Vague phrases like "could be better", "needs work", or "unclear" without explanation are not actionable.

Output format (JSON):
{
  "isGood": true/false,
  "suggestion": "<improvement suggestion if isGood is false, otherwise null>"
}`

  const raw = await callAI(prompt)

  try {
    const parsed = JSON.parse(raw) as NudgeFeedbackQualityResult
    if (typeof parsed.isGood === 'boolean') return parsed
  } catch { /* stub */ }

  return { isGood: false, suggestion: raw }
}
