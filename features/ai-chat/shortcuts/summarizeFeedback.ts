import { callAI } from './aiService'
import type { CriterionWithScore, SummarizeFeedbackResult } from './types'

const SCORE_LABEL: Record<string, string> = {
  does_not_meet: 'Does Not Meet',
  exemplifies:   'Exemplifies Standard',
  exceeds:       'Exceeds Standard',
}

export async function summarizeFeedback(input: {
  criteria: CriterionWithScore[]
}): Promise<SummarizeFeedbackResult> {
  const criteriaBlock = input.criteria
    .map(c => {
      const scoreLabels = c.scores.map(s => SCORE_LABEL[s] ?? s).join(', ') || 'Not yet rated'
      const comments = c.scoreComments.map(sc => `  - [${SCORE_LABEL[sc.score_level]}] ${sc.body}`).join('\n')
      const annotations = c.annotations.map(a => `  - ${a.tag ? `[${a.tag.replace('_', ' ')}] ` : ''}${a.body}`).join('\n')
      return [
        `Criterion: ${c.criterion.label}`,
        `Rating(s): ${scoreLabels}`,
        comments ? `Reviewer comments:\n${comments}` : null,
        annotations ? `Evidence annotations:\n${annotations}` : null,
      ].filter(Boolean).join('\n')
    })
    .join('\n\n')

  const prompt = `You are an academic peer review assistant. Below is structured peer feedback on an Open Educational Resource (OER). Produce:
1. A concise narrative summary (2-4 sentences) of the overall feedback tone and themes.
2. A prioritized list of criterion labels ordered by urgency (most critical first). Criteria rated "Does Not Meet" should appear first, then unrated ones, then "Exemplifies", then "Exceeds".

Output format (JSON):
{
  "summary": "<narrative>",
  "priorityOrder": ["<label1>", "<label2>", ...]
}

Feedback data:
${criteriaBlock}`

  const raw = await callAI(prompt)

  // Stub: parse if real JSON arrives; otherwise return safe defaults
  try {
    const parsed = JSON.parse(raw) as SummarizeFeedbackResult
    if (parsed.summary && Array.isArray(parsed.priorityOrder)) return parsed
  } catch { /* stub response, fall through */ }

  return {
    summary: raw,
    priorityOrder: input.criteria.map(c => c.criterion.label),
  }
}
