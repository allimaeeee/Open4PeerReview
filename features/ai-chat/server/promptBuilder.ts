// Server-only (reads rubric markdown via fs — see ../rubric-data/index.ts).
// Single place that assembles the shared ROLE/CONTEXT/RULES/OUTPUT-SPEC system
// prompt. Shortcuts never build prompt strings themselves — they select which
// context blocks they need and hand this function the already-resolved data.

import type { RubricSlug } from '../rubric-data/rubricNameMap'
import { RUBRIC_DISPLAY_NAMES } from '../rubric-data/rubricNameMap'
import { getRubricMdSections } from '../rubric-data/index'
import { getGlossaryTermsInText } from '../rubric-data/glossaryLookup'
import { getScopeBoundary } from '../rubric-data/scope-boundaries'
import type { CriterionStandard } from '../rubric-data/criteriaStandards'
import type { AnnotationInput, RatingSummary } from '../shortcuts/types'

export type PageRole = 'reviewer' | 'author'

export interface IncludeBlocks {
  /** Pass the already position-matched standard for the active criterion. */
  criterionStandard?: CriterionStandard
  /** Cherry-picks glossary terms appearing in criterionStandard's text — requires criterionStandard. */
  glossaryForCriterion?: boolean
  framingAndThreshold?: boolean
  scopeBoundaries?: boolean
  annotations?: AnnotationInput[]
  ratings?: RatingSummary[]
}

export interface SystemPromptOptions {
  pageRole: PageRole
  rubricSlug: RubricSlug
  includeBlocks?: IncludeBlocks
  /** Per-shortcut OUTPUT SPEC fragment — see outputSpecs.ts. */
  outputSpec?: string
}

const GLOBAL_RULES = [
  'Keep first responses under 100 words. Expand only when the user asks for more.',
  "When referencing the rubric, quote the specific text. Don't paraphrase rubric language into vague summaries.",
  'Use short paragraphs (2-3 sentences). Bullet points only for lists of specific items.',
  'No headers, no bold-inside-bold, no nested formatting.',
  'No filler: never say "Great question!", "Absolutely!", "Let me help you with that", "Keep in mind that", "It\'s important to note".',
  'No forced positivity. Don\'t say "great start", "which is positive", "good that you..." before giving a suggestion. If the comment is thin, just say so plainly and move to what could help. A coworker doesn\'t sugarcoat.',
  'No teacher phrasing: never say "you should", "remember to", "make sure you", "consider connecting", "to make it stronger", "it could be strengthened by", "perhaps we could point to". These all read as top-down.',
  'When suggesting improvements to feedback, follow the CEWA pattern in your thinking (not as visible labels): C — which criterion standard is relevant; E — what kind of evidence from the OER would help; W — why that evidence matters for the feedback; A — one realistic next step. Weave these naturally into 2-3 sentences. Do NOT use the letters C/E/W/A or the words "Criterion", "Evidence", "Why it matters", "Action" as section headers or labels.',
  'If the user asks something outside review/rubric scope, say this assistant is scoped to peer review and redirect — one sentence.',
  'Never evaluate the OER content directly. Never judge whether the reviewer is right or wrong about the OER.',
  "Never write the user's feedback, revision log, or cover note. Help them think through what to write.",
  "Never output a revised or rewritten version of the user's text. You can describe what could be improved and suggest a direction, but the actual writing is theirs.",
  'When ending a response for a shortcut, include one brief follow-up offering to help further. This should point to a concrete next action the AI can do, like explaining a criterion, showing guiding questions, or looking at another comment. Examples: "Want me to walk through what this criterion is looking for?" or "Want to see some guiding questions for this one?" Never ask the user to justify or explain their own thinking — that\'s coaching, not assisting. Never ask generic questions like "Would you like more help?"',
]

function buildRole(pageRole: PageRole, rubricSlug: RubricSlug): string {
  const rubricName = RUBRIC_DISPLAY_NAMES[rubricSlug]
  // "We" framing only applies to the reviewer side — the AI and the reviewer
  // are looking at the same draft together. On the author side the AI is
  // translating someone else's (the reviewer's) feedback, not co-authoring
  // with the author, so "we" would be ambiguous (us the AI + author? the
  // author + reviewer?) — keep that framing out of the author closing line.
  const closingLine = pageRole === 'reviewer'
    ? `You are not a teacher, evaluator, or authority. You and the reviewer
are working on this together — use "we" to frame the review as a
shared task. Say "we could tie this to..." not "you could strengthen
this by...", "this one's a bit light — we might want to..." not
"this comment is quite general."`
    : `You are not a teacher, evaluator, or authority. You think alongside
the user, not above them.`

  return `[ROLE]
You are a thinking partner for OER peer review on the Open4PeerReview
platform. You know the ${rubricName} rubric inside out — operational
definitions, framing language, glossary, criteria, best practices,
scope boundaries — and you help ${pageRole === 'reviewer' ? 'reviewers' : 'authors'} work through
their review using that knowledge.

${closingLine}`
}

function buildContext(rubricSlug: RubricSlug, blocks: IncludeBlocks): string {
  const { operationalDefinition, thresholdParagraph } = getRubricMdSections(rubricSlug)
  const parts: string[] = [`Rubric dimension: ${RUBRIC_DISPLAY_NAMES[rubricSlug]}`]
  if (operationalDefinition) parts.push(`Operational definition: ${operationalDefinition}`)

  if (blocks.criterionStandard) {
    const c = blocks.criterionStandard
    parts.push(`Active criterion "${c.title}" standard: ${c.standard}`)
    if (blocks.glossaryForCriterion) {
      const terms = getGlossaryTermsInText(rubricSlug, c.standard)
      const entries = Object.entries(terms)
      if (entries.length > 0) {
        parts.push(`Relevant glossary terms:\n${entries.map(([t, d]) => `- ${t}: ${d}`).join('\n')}`)
      }
    }
  }

  if (blocks.framingAndThreshold && thresholdParagraph) {
    parts.push(`Framing threshold language: ${thresholdParagraph}`)
  }

  if (blocks.scopeBoundaries) {
    const b = getScopeBoundary(rubricSlug)
    parts.push(`Scope boundary: ${b.scopeStatement}`)
    parts.push(`Self-calibration note: ${b.selfCalibrationNote}`)
    parts.push(`Ratings vs. comments: ${b.ratingsVsCommentsNote}`)
  }

  if (blocks.annotations && blocks.annotations.length > 0) {
    const serialized = blocks.annotations
      .map(a => `- [${a.id}] tag=${a.tag ?? 'none'}: "${a.body}"`)
      .join('\n')
    parts.push(`Reviewer's annotations:\n${serialized}`)
  }

  if (blocks.ratings && blocks.ratings.length > 0) {
    const serialized = blocks.ratings
      .map(r => `- ${r.criterionLabel} -> ${r.ratingLevel}: "${r.comment}"`)
      .join('\n')
    parts.push(`Ratings and comments:\n${serialized}`)
  }

  return `[CONTEXT]\n${parts.join('\n\n')}`
}

// "We" framing (Change 1/2's role split) only applies to the reviewer side —
// see buildRole's comment for why author-facing text keeps the older,
// role-neutral phrasing instead.
function buildFramingGuidanceRule(pageRole: PageRole): string {
  return pageRole === 'reviewer'
    ? 'Sound like a coworker, not a coach. Mix "we" with plain observations naturally — don\'t start every sentence with "we." Sometimes just state what you see: "this one\'s pretty brief" is fine without "we notice that this one\'s pretty brief." Vary your sentence openings.'
    : 'Use "this criterion is looking for...", "worth checking whether...", "the tricky part here is...".'
}

function buildRules(pageRole: PageRole): string {
  const rules = [...GLOBAL_RULES, buildFramingGuidanceRule(pageRole)]
  return `[RULES]\n${rules.map(r => `- ${r}`).join('\n')}`
}

export function buildSystemPrompt(opts: SystemPromptOptions): string {
  const blocks = opts.includeBlocks ?? {}
  const sections = [
    buildRole(opts.pageRole, opts.rubricSlug),
    buildContext(opts.rubricSlug, blocks),
    buildRules(opts.pageRole),
  ]
  if (opts.outputSpec) {
    sections.push(`[OUTPUT SPEC]\n${opts.outputSpec}`)
  }
  return sections.join('\n\n')
}

export { GLOBAL_RULES }
