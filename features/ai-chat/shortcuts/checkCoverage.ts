import { callAI } from './aiService'
import type { CriterionWithScore, CheckCoverageResult } from './types'

export async function checkCoverage(input: {
  criteria: CriterionWithScore[]
}): Promise<CheckCoverageResult> {
  // "Uncovered" = no ratings AND no linked annotations
  const uncovered = input.criteria.filter(
    c => c.scores.length === 0 && c.annotations.length === 0
  )

  if (uncovered.length === 0) {
    return {
      uncoveredCriteria: [],
      reminder: 'All criteria have been addressed. Great work — every criterion has at least a rating or an annotation.',
    }
  }

  const uncoveredLabels = uncovered.map(c => c.criterion.label)

  const prompt = `You are an academic peer review assistant. A reviewer is working through a rubric and has not yet addressed the following criteria (no rating and no annotations):

${uncoveredLabels.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Write a brief, encouraging reminder (1-2 sentences) prompting the reviewer to address these criteria before submitting.

Output format (JSON):
{
  "reminder": "<reminder text>"
}`

  const raw = await callAI(prompt)

  try {
    const parsed = JSON.parse(raw) as { reminder: string }
    if (parsed.reminder) return { uncoveredCriteria: uncoveredLabels, reminder: parsed.reminder }
  } catch { /* stub */ }

  return {
    uncoveredCriteria: uncoveredLabels,
    reminder: raw || `${uncoveredLabels.length} criteria still need your attention.`,
  }
}
