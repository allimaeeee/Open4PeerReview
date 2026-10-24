import { callAI } from './aiService'
import { checkAllFeedbackSpec } from '../server/outputSpecs'
import { getCriterionStandardByIndex } from '../rubric-data/criteriaStandards'
import type { PageRole } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'
import type { CriterionWithScore, CheckAllFeedbackResult } from './types'

// Schema `type` values are the plain lowercase strings the Gemini API expects
// (matching @google/generative-ai's SchemaType enum), inlined here so the SDK
// isn't pulled into the client bundle — this file runs client-side and only
// forwards the schema as JSON to /api/ai-chat.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    overallImpression: { type: 'string' },
    topConcerns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterionLabel: { type: 'string' },
          excerpt: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['criterionLabel', 'excerpt', 'suggestion'],
      },
    },
    strongExamples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterionLabel: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['criterionLabel', 'reason'],
      },
    },
    followUpQuestion: { type: 'string' },
  },
  required: ['overallImpression', 'topConcerns', 'strongExamples', 'followUpQuestion'],
}

// Regex-recovers complete `topConcerns` entries from a JSON response that got
// cut off mid-array (finishReason: MAX_TOKENS) — objects are flat (no nested
// braces), so a non-greedy match between braces safely skips the trailing
// truncated object rather than needing a full JSON repair pass.
function recoverTopConcerns(raw: string): CheckAllFeedbackResult['topConcerns'] {
  const pattern = /\{\s*"criterionLabel"\s*:\s*"[^"]*"\s*,\s*"excerpt"\s*:\s*"(?:[^"\\]|\\.)*"\s*,\s*"suggestion"\s*:\s*"(?:[^"\\]|\\.)*"\s*\}/g
  const items: CheckAllFeedbackResult['topConcerns'] = []
  for (const match of raw.matchAll(pattern)) {
    try { items.push(JSON.parse(match[0])) } catch { /* skip unparseable match */ }
  }
  return items
}

// Scope-picker-limited when `scopeCriterionId` is given; corpus-wide otherwise.
export async function checkAllFeedback(input: {
  criteria: CriterionWithScore[]
  scopeCriterionId?: string
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<CheckAllFeedbackResult> {
  const criteria = input.scopeCriterionId
    ? input.criteria.filter(c => c.criterion.id === input.scopeCriterionId)
    : input.criteria

  // Check All Feedback scans the rating inbox (the reviewer's overall
  // NI/Exceeds comments per criterion) — not inline annotations. Annotations
  // are reviewed one at a time by the reviewer selecting text and asking the
  // AI directly (the "Ask AI" selection popup + freeform chat); there's no
  // dedicated shortcut for them.
  const comments = criteria.flatMap(c =>
    c.scoreComments
      .filter(sc => sc.body.trim().length > 0)
      .map(sc => `[${sc.id}] criterion=${c.criterion.id} (${c.criterion.label}) rating=${sc.score_level}: "${sc.body}"`),
  )

  if (comments.length === 0) {
    return { overallImpression: 'No rating comments yet to review.', topConcerns: [], strongExamples: [], followUpQuestion: 'Want to write a rating comment for one of the criteria first?' }
  }

  // One line per in-scope criterion's standard, so the model can judge
  // groundedness against the actual rubric rather than just tone/length.
  // Standards are matched positionally (rubric_items.sort_order ~ index into
  // the rubric's JSON criteria array) — same convention used everywhere else
  // criterion standards are resolved.
  const standardsBlock = criteria
    .map(c => {
      const index = input.criteria.findIndex(ic => ic.criterion.id === c.criterion.id)
      const standard = c.criterion.rubricSlug ? getCriterionStandardByIndex(c.criterion.rubricSlug, index) : null
      return standard ? `${c.criterion.label}: ${standard.standard}` : null
    })
    .filter(Boolean)
    .join('\n')

  // Output scales with comment count (each topConcerns/strongExamples item
  // costs ~150 tokens of JSON) — a fixed cap here previously truncated
  // mid-JSON on reviews with more than a handful of comments (finishReason:
  // MAX_TOKENS, confirmed in testing). Scale the budget, capped well under
  // the model's limit to keep latency/cost sane.
  const maxOutputTokens = Math.min(4096, 600 + comments.length * 150)

  const userMessage = [
    standardsBlock ? `Criterion standards:\n${standardsBlock}` : null,
    `Rating comments to review:\n${comments.join('\n')}`,
  ].filter(Boolean).join('\n\n')

  const raw = await callAI({
    mode: 'shortcut',
    shortcutId: 'check-all-feedback',
    userMessage,
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    includeBlocks: { framingAndThreshold: true, scopeBoundaries: true },
    outputSpec: checkAllFeedbackSpec(),
    generationConfig: { temperature: 0.3, maxOutputTokens, responseSchema: RESPONSE_SCHEMA },
  })

  try {
    const parsed = JSON.parse(raw) as CheckAllFeedbackResult
    if (
      typeof parsed.overallImpression === 'string' &&
      Array.isArray(parsed.topConcerns) &&
      Array.isArray(parsed.strongExamples) &&
      typeof parsed.followUpQuestion === 'string'
    ) {
      return parsed
    }
    throw new Error('malformed shape')
  } catch {
    // Truncated or malformed JSON — never show raw braces/quotes to the
    // user. Recover whatever complete topConcerns entries we can; the
    // response is scoped-narrower advice, not the JSON itself.
    const recovered = recoverTopConcerns(raw)
    return {
      overallImpression: recovered.length > 0
        ? `Found ${recovered.length} comment${recovered.length === 1 ? '' : 's'} worth another look so far — the response was cut off before finishing. Try narrowing to one criterion via the picker, or ask again.`
        : "This scan produced too much to fit in one response — try narrowing to one criterion via the picker, then ask again.",
      topConcerns: recovered,
      strongExamples: [],
      followUpQuestion: recovered.length > 0 ? 'Want to start with one of these?' : 'Want to try scoping to a single criterion?',
    }
  }
}
