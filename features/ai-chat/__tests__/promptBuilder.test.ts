import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { buildSystemPrompt, GLOBAL_RULES } from '../server/promptBuilder'
import { getCriterionStandardByIndex } from '../rubric-data/criteriaStandards'
import { getRubricMdSections } from '../rubric-data/index'
import {
  reviewProgressSpec,
  checkAllFeedbackSpec,
  explainCriterionFirstTurnSpec,
  explainCriterionLookForSpec,
  explainCriterionTermsSpec,
  refineFeedbackRevisionSpec,
  summarizeFeedbackSpec,
  explainCommentSpec,
} from '../server/outputSpecs'
import type { RubricSlug } from '../rubric-data/rubricNameMap'

const RUBRIC_SLUGS: RubricSlug[] = ['accessibility', 'copy-editing', 'copyright', 'disciplinary', 'elearning', 'udl']

const BANNED_PHRASES = [
  'great question',
  'absolutely!',
  'let me help you with that',
  'keep in mind that',
  "it's important to note",
]

describe('GLOBAL_RULES', () => {
  it('explicitly bans each filler phrase rather than merely mentioning it', () => {
    const fillerRule = GLOBAL_RULES.find(r => r.toLowerCase().startsWith('no filler'))!
    expect(fillerRule).toBeDefined()
    for (const phrase of BANNED_PHRASES) {
      expect(fillerRule.toLowerCase()).toContain(phrase)
    }
    expect(fillerRule.toLowerCase()).toContain('never say')
  })

  it('states the <100 word first-response limit', () => {
    expect(GLOBAL_RULES.some(r => r.includes('100 words'))).toBe(true)
  })

  it('forbids teacher framing', () => {
    const rulesText = GLOBAL_RULES.join(' ')
    expect(rulesText).toContain('you should')
    expect(rulesText).toContain('remember to')
  })
})

describe('buildSystemPrompt', () => {
  it('includes ROLE, CONTEXT, and RULES sections always', () => {
    const prompt = buildSystemPrompt({ pageRole: 'reviewer', rubricSlug: 'copyright' })
    expect(prompt).toContain('[ROLE]')
    expect(prompt).toContain('[CONTEXT]')
    expect(prompt).toContain('[RULES]')
  })

  it('only includes OUTPUT SPEC when provided', () => {
    const withoutSpec = buildSystemPrompt({ pageRole: 'reviewer', rubricSlug: 'copyright' })
    expect(withoutSpec).not.toContain('[OUTPUT SPEC]')

    const withSpec = buildSystemPrompt({ pageRole: 'reviewer', rubricSlug: 'copyright', outputSpec: 'Say hi.' })
    expect(withSpec).toContain('[OUTPUT SPEC]')
    expect(withSpec).toContain('Say hi.')
  })

  for (const slug of RUBRIC_SLUGS) {
    it(`quotes ${slug}'s operational definition verbatim, not paraphrased`, () => {
      const { operationalDefinition } = getRubricMdSections(slug)
      const prompt = buildSystemPrompt({ pageRole: 'reviewer', rubricSlug: slug })
      expect(prompt).toContain(operationalDefinition)
    })

    it(`quotes ${slug}'s criterion 0 standard verbatim when included`, () => {
      const standard = getCriterionStandardByIndex(slug, 0)
      if (!standard) return
      const prompt = buildSystemPrompt({
        pageRole: 'reviewer',
        rubricSlug: slug,
        includeBlocks: { criterionStandard: standard },
      })
      expect(prompt).toContain(standard.standard)
    })
  }
})

describe('outputSpecs word limits match the doc', () => {
  it('reviewProgressSpec caps at 150 words and asks for a quality scan, not just status', () => {
    const spec = reviewProgressSpec()
    expect(spec).toContain('Under 150 words')
    expect(spec.toLowerCase()).toContain('quality scan')
  })

  it('checkAllFeedbackSpec never leaks internal category labels', () => {
    const spec = checkAllFeedbackSpec()
    expect(spec).toContain('vague_or_minimal')
    expect(spec.toLowerCase()).toContain('do not use internal analysis labels')
  })

  // explainCriterion.ts and its specs are intentionally out of scope for the
  // tone/structure pass — assertions here match its current (unchanged) shape.
  it('explainCriterionFirstTurnSpec does not pre-answer follow-ups', () => {
    expect(explainCriterionFirstTurnSpec()).toContain('Do not answer all three upfront')
  })

  it('explainCriterionFirstTurnSpec asks for exactly 3 follow-ups', () => {
    expect(explainCriterionFirstTurnSpec()).toContain('exactly 3 items')
  })

  it('explainCriterionLookForSpec caps at 150 words', () => {
    expect(explainCriterionLookForSpec()).toContain('Under 150 words')
  })

  it('explainCriterionTermsSpec caps at 100 words', () => {
    expect(explainCriterionTermsSpec()).toContain('Under 100 words')
  })

  it('refineFeedbackRevisionSpec never allows rewriting from scratch', () => {
    expect(refineFeedbackRevisionSpec()).toContain("Don't rewrite their comment or output a revised version")
  })

  it('summarizeFeedbackSpec caps at 200 words', () => {
    expect(summarizeFeedbackSpec()).toContain('Under 200 words')
  })

  it('explainCommentSpec caps at 100 words', () => {
    expect(explainCommentSpec()).toContain('Under 100 words')
  })
})

describe('rubric-data files exist for all 6 rubrics', () => {
  const dataDir = path.join(process.cwd(), 'features/ai-chat/rubric-data')
  for (const slug of RUBRIC_SLUGS) {
    it(`${slug}.md and ${slug}.json exist`, () => {
      expect(fs.existsSync(path.join(dataDir, `${slug}.md`))).toBe(true)
      expect(fs.existsSync(path.join(dataDir, `${slug}.json`))).toBe(true)
    })
  }
})
