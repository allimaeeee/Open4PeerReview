import { SchemaType } from '@google/generative-ai'
import { callAI } from './aiService'
import { getCriterionStandardByIndex, type CriterionStandard } from '../rubric-data/criteriaStandards'
import {
  explainCriterionFirstTurnSpec,
  explainCriterionLookForSpec,
  explainCriterionTermsSpec,
} from '../server/outputSpecs'
import type { PageRole } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'
import type { RubricCriterion, ExplainCriterionFirstTurnResult } from './types'

export type ExplainCriterionFollowUp = 'look-for' | 'terms'

// Fixed order — zipped by index with the AI's `followUps` label array so a
// tapped option can be mapped back to the right key regardless of exact
// wording the model generated.
export const FOLLOW_UP_KEYS: ExplainCriterionFollowUp[] = ['look-for', 'terms']

export const FOLLOW_UP_LABELS: Record<ExplainCriterionFollowUp, string> = {
  'look-for': 'What questions can I ask myself?',
  terms: 'What do the terms mean?',
}

function resolveStandard(criterion: RubricCriterion, criterionIndex: number): CriterionStandard | null {
  return criterion.rubricSlug ? getCriterionStandardByIndex(criterion.rubricSlug, criterionIndex) : null
}

export async function explainCriterionFirstTurn(input: {
  criterion: RubricCriterion
  criterionIndex: number
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<ExplainCriterionFirstTurnResult> {
  const standard = resolveStandard(input.criterion, input.criterionIndex)

  const raw = await callAI({
    mode: 'shortcut',
    shortcutId: 'explain-criterion',
    userMessage: `The reviewer selected criterion "${input.criterion.label}".`,
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    includeBlocks: standard ? { criterionStandard: standard } : undefined,
    outputSpec: explainCriterionFirstTurnSpec(),
    generationConfig: {
      temperature: 0.5,
      // JSON-schema output needs headroom beyond the ~150-word prose target
      // (quotes/braces/array syntax add overhead) — too tight a cap here
      // truncates mid-JSON and breaks the parse below.
      maxOutputTokens: 512,
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          summary: { type: SchemaType.STRING },
          followUps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['summary', 'followUps'],
      },
    },
  })

  try {
    const parsed = JSON.parse(raw) as ExplainCriterionFirstTurnResult
    if (parsed.summary) return parsed
    throw new Error('empty summary')
  } catch {
    // Truncated/malformed JSON — never show the raw braces/quotes to the user.
    // Best-effort: pull out the summary field's text if present, else fall
    // back to a generic message rather than leaking JSON scaffolding.
    const summaryMatch = raw.match(/"summary"\s*:\s*"([^"]*)/)
    const summary = summaryMatch ? summaryMatch[1] : "Here's what this criterion covers — ask me anything specific about it."
    return { summary, followUps: Object.values(FOLLOW_UP_LABELS) }
  }
}

export async function explainCriterionFollowUp(input: {
  criterion: RubricCriterion
  criterionIndex: number
  followUp: ExplainCriterionFollowUp
  pageRole: PageRole
  rubricSlug: RubricSlug
}): Promise<string> {
  const standard = resolveStandard(input.criterion, input.criterionIndex)

  const specByFollowUp: Record<ExplainCriterionFollowUp, () => string> = {
    'look-for': explainCriterionLookForSpec,
    terms: explainCriterionTermsSpec,
  }

  const includeBlocksByFollowUp: Record<ExplainCriterionFollowUp, object | undefined> = {
    'look-for': standard ? { criterionStandard: standard, framingAndThreshold: true } : undefined,
    terms: standard ? { criterionStandard: standard, glossaryForCriterion: true } : undefined,
  }

  return callAI({
    mode: 'shortcut',
    shortcutId: `explain-criterion-${input.followUp}`,
    userMessage: `Follow-up: ${FOLLOW_UP_LABELS[input.followUp]}`,
    pageRole: input.pageRole,
    rubricSlug: input.rubricSlug,
    includeBlocks: includeBlocksByFollowUp[input.followUp],
    outputSpec: specByFollowUp[input.followUp](),
    generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
  })
}
